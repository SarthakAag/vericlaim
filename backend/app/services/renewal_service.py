"""
Policy Auto-Renewal Service — VeriClaim AI Platform
Guidewire DEVTrails 2026

Runs every Monday at 00:05 IST via APScheduler.

For each active PolicyEnrollment:
  1. Skip if PremiumPayment already exists for this week (idempotent)
  2. Check end_date — expire enrollment if past
  3. Check auto_renew flag — suspend if turned off
  4. Calculate dynamic premium (zone + risk + seasonal adjustments)
  5. Create PremiumPayment row (status=paid — deducted from platform payout)
  6. Reset weekly counters on PolicyEnrollment
  7. Write RenewalLog row for admin feed

Also runs a mid-week expiry check (Thursday 00:05 IST) to catch
enrollments where end_date passes during the week.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, date, timedelta
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import SessionLocal
from app.models.enrollment_model  import PolicyEnrollment
from app.models.policy_model      import InsurancePolicy
from app.models.premium_model     import PremiumPayment
from app.models.user_model        import DeliveryPartner
from app.models.renewal_log_model import RenewalLog
from app.services.payout_calculation_service import calculate_weekly_premium

logger = logging.getLogger(__name__)

# ─── Platform payout day alignment ────────────────────────────────────────────
# Premium is deducted on the day the platform pays the driver.
# weekday(): 0=Monday … 6=Sunday
PLATFORM_PAYOUT_WEEKDAY: dict[str, int] = {
    "zomato": 0,   # Monday
    "swiggy": 2,   # Wednesday
    "both":   0,
}


# ══════════════════════════════════════════════════════════════════════════════
class RenewalService:
    """
    Singleton service that owns the renewal APScheduler jobs.
    Call .start() on FastAPI startup, .stop() on shutdown.
    """

    def __init__(self) -> None:
        self._scheduler: Optional[BackgroundScheduler] = None
        self._running   = False

    # ──────────────────────────────────────────────────────────────────────────
    # Lifecycle
    # ──────────────────────────────────────────────────────────────────────────

    def start(self) -> None:
        if self._running:
            return

        self._scheduler = BackgroundScheduler(
            job_defaults={"coalesce": True, "max_instances": 1},
            timezone="Asia/Kolkata",
        )

        # Main renewal job — every Monday 00:05 IST
        self._scheduler.add_job(
            func=self._run_renewal_cycle,
            trigger=CronTrigger(day_of_week="mon", hour=0, minute=5,
                                timezone="Asia/Kolkata"),
            id="weekly_renewal",
            name="Weekly Policy Auto-Renewal",
            replace_existing=True,
        )

        # Mid-week expiry check — every Thursday 00:05 IST
        self._scheduler.add_job(
            func=self._run_expiry_check,
            trigger=CronTrigger(day_of_week="thu", hour=0, minute=5,
                                timezone="Asia/Kolkata"),
            id="midweek_expiry_check",
            name="Mid-Week Expiry Check",
            replace_existing=True,
        )

        self._scheduler.start()
        self._running = True
        logger.info("✅ [RenewalService] Scheduler started — "
                    "renewal: Mon 00:05 IST, expiry check: Thu 00:05 IST")

    def stop(self) -> None:
        if self._scheduler and self._running:
            self._scheduler.shutdown(wait=False)
            self._running = False
            logger.info("[RenewalService] Scheduler stopped")

    @property
    def is_running(self) -> bool:
        return self._running

    def run_now(self) -> dict:
        """
        Immediately run a full renewal cycle.
        Used by the admin 'Process Renewals Now' button.
        """
        logger.info("[RenewalService] Manual renewal cycle triggered")
        return self._run_renewal_cycle()

    def run_expiry_check_now(self) -> dict:
        """Immediately run expiry check — admin utility."""
        return self._run_expiry_check()

    # ──────────────────────────────────────────────────────────────────────────
    # Main renewal cycle
    # ──────────────────────────────────────────────────────────────────────────

    def _run_renewal_cycle(self) -> dict:
        """
        Process auto-renewals for all active enrollments.
        Idempotent — safe to run multiple times in the same week.
        """
        run_id  = f"RENEW-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        started = time.perf_counter()
        today   = date.today()
        # Monday of current week
        week_start = today - timedelta(days=today.weekday())

        summary = {
            "run_id":            run_id,
            "week_start":        week_start.isoformat(),
            "started_at":        datetime.utcnow().isoformat(),
            "total_enrollments": 0,
            "renewed":           0,
            "expired":           0,
            "suspended":         0,
            "skipped_already_paid": 0,
            "errors":            0,
            "total_premium_inr": 0.0,
        }

        db: Session = SessionLocal()
        try:
            enrollments = self._fetch_renewable_enrollments(db)
            summary["total_enrollments"] = len(enrollments)

            if not enrollments:
                logger.info(f"[{run_id}] No renewable enrollments found")
                return summary

            logger.info(f"[{run_id}] Processing {len(enrollments)} enrollments…")

            for enrollment, partner in enrollments:
                result = self._process_enrollment(
                    db=db,
                    run_id=run_id,
                    enrollment=enrollment,
                    partner=partner,
                    week_start=week_start,
                )
                # Aggregate
                outcome = result.get("outcome", "error")
                if outcome == "renewed":
                    summary["renewed"]           += 1
                    summary["total_premium_inr"] += result.get("premium_inr", 0)
                elif outcome == "expired":  summary["expired"]             += 1
                elif outcome == "suspended": summary["suspended"]          += 1
                elif outcome == "skipped":  summary["skipped_already_paid"]+= 1
                else:                       summary["errors"]              += 1

        except Exception as exc:
            logger.error(f"[{run_id}] Renewal cycle failed: {exc}", exc_info=True)
            summary["errors"] += 1
        finally:
            db.close()

        elapsed = round((time.perf_counter() - started) * 1000)
        summary["elapsed_ms"]  = elapsed
        summary["finished_at"] = datetime.utcnow().isoformat()

        logger.info(
            f"[{run_id}] Done in {elapsed}ms — "
            f"renewed={summary['renewed']} expired={summary['expired']} "
            f"suspended={summary['suspended']} errors={summary['errors']} "
            f"total_premium=₹{summary['total_premium_inr']:.2f}"
        )
        return summary

    # ──────────────────────────────────────────────────────────────────────────
    # Per-enrollment processing
    # ──────────────────────────────────────────────────────────────────────────

    def _process_enrollment(
        self,
        db:         Session,
        run_id:     str,
        enrollment: PolicyEnrollment,
        partner:    DeliveryPartner,
        week_start: date,
    ) -> dict:
        """
        Process a single enrollment for renewal.
        Returns a result dict with outcome + details for summary aggregation.
        """
        try:
            # ── 1. Idempotency: skip if premium already paid this week ─────────
            existing = (
                db.query(PremiumPayment)
                .filter(
                    PremiumPayment.user_id     == partner.id,
                    PremiumPayment.week_start  == week_start,
                    PremiumPayment.status      == "paid",
                )
                .first()
            )
            if existing:
                logger.debug(f"[{run_id}] uid={partner.id} already paid this week — skip")
                return {"outcome": "skipped", "premium_inr": 0}

            # ── 2. Expiry check ───────────────────────────────────────────────
            if enrollment.end_date and enrollment.end_date < week_start:
                self._expire_enrollment(db, enrollment, run_id, partner.id)
                return {"outcome": "expired", "premium_inr": 0}

            # ── 3. Auto-renew flag check ──────────────────────────────────────
            if not enrollment.auto_renew:
                self._suspend_enrollment(db, enrollment, run_id, partner.id,
                                         reason="AUTO_RENEW_DISABLED")
                return {"outcome": "suspended", "premium_inr": 0}

            # ── 4. Calculate dynamic premium ─────────────────────────────────
            premium_result = calculate_weekly_premium(
                db=db,
                user_id=partner.id,
                policy_tier=enrollment.policy_tier,
                zone_flood_risk=enrollment.zone_flood_risk or 0.50,
            )

            if "error" in premium_result:
                logger.error(f"[{run_id}] uid={partner.id} premium calc error: "
                             f"{premium_result['error']}")
                self._write_renewal_log(db, enrollment.id, partner.id, run_id,
                                        "error", 0, week_start,
                                        error=premium_result["error"])
                return {"outcome": "error"}

            final_premium = premium_result["final_weekly_premium_inr"]
            base_premium  = premium_result["base_premium_inr"]
            breakdown     = premium_result.get("premium_breakdown", {})

            # ── 5. Create PremiumPayment row ──────────────────────────────────
            txn_id = f"TXN-{partner.id:06d}-{week_start.strftime('%Y%m%d')}"
            payment = PremiumPayment(
                user_id             = partner.id,
                policy_id           = enrollment.policy_id,
                week_start          = week_start,
                week_end            = week_start + timedelta(days=6),
                base_amount         = base_premium,
                final_amount        = final_premium,
                zone_adjustment_pct = breakdown.get("zone_adjustment_pct", 0),
                risk_adjustment_pct = breakdown.get("risk_adjustment_pct", 0),
                seasonal_adj_pct    = breakdown.get("seasonal_adjustment_pct", 0),
                payment_method      = "UPI",
                transaction_id      = txn_id,
                status              = "paid",
                policy_tier         = enrollment.policy_tier,
                zone_flood_risk     = enrollment.zone_flood_risk or 0.50,
                is_auto_renewed     = True,
                payment_date        = datetime.utcnow(),
            )
            db.add(payment)

            # ── 6. Reset weekly counters on enrollment ────────────────────────
            enrollment.week_start                    = week_start
            enrollment.claims_this_week              = 0
            enrollment.coverage_hours_used_this_week = 0.0
            enrollment.payout_total_this_week        = 0.0
            enrollment.total_premiums_paid           = (
                (enrollment.total_premiums_paid or 0) + final_premium
            )
            enrollment.weekly_premium_paid = final_premium
            enrollment.updated_at          = datetime.utcnow()

            # ── 7. Write renewal log ──────────────────────────────────────────
            self._write_renewal_log(
                db, enrollment.id, partner.id, run_id,
                "renewed", final_premium, week_start,
                policy_tier=enrollment.policy_tier,
                zone=getattr(partner, "zone", None),
            )

            db.commit()

            logger.info(
                f"[{run_id}] uid={partner.id} tier={enrollment.policy_tier} "
                f"premium=₹{final_premium:.2f} → renewed"
            )
            return {"outcome": "renewed", "premium_inr": final_premium}

        except Exception as exc:
            db.rollback()
            logger.error(f"[{run_id}] uid={partner.id} failed: {exc}", exc_info=True)
            try:
                self._write_renewal_log(db, enrollment.id, partner.id, run_id,
                                        "error", 0, week_start, error=str(exc)[:400])
                db.commit()
            except Exception:
                db.rollback()
            return {"outcome": "error"}

    # ──────────────────────────────────────────────────────────────────────────
    # Mid-week expiry check
    # ──────────────────────────────────────────────────────────────────────────

    def _run_expiry_check(self) -> dict:
        """
        Expire any active enrollments whose end_date has passed.
        Runs Thursday — catches enrollments expiring mid-week.
        """
        run_id  = f"EXPIRY-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        today   = date.today()
        expired = 0

        db: Session = SessionLocal()
        try:
            overdue = (
                db.query(PolicyEnrollment)
                .filter(
                    PolicyEnrollment.status   == "active",
                    PolicyEnrollment.end_date <  today,
                )
                .all()
            )
            for enrollment in overdue:
                self._expire_enrollment(db, enrollment, run_id, enrollment.user_id)
                expired += 1
            db.commit()
            logger.info(f"[{run_id}] Expiry check — expired {expired} enrollments")
        except Exception as exc:
            db.rollback()
            logger.error(f"[{run_id}] Expiry check failed: {exc}", exc_info=True)
        finally:
            db.close()

        return {"run_id": run_id, "expired": expired}

    # ──────────────────────────────────────────────────────────────────────────
    # Status transitions
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _expire_enrollment(
        db: Session, enrollment: PolicyEnrollment,
        run_id: str, user_id: int,
    ) -> None:
        enrollment.status     = "expired"
        enrollment.updated_at = datetime.utcnow()
        logger.info(f"[{run_id}] uid={user_id} enrollment {enrollment.id} → expired")

    @staticmethod
    def _suspend_enrollment(
        db: Session, enrollment: PolicyEnrollment,
        run_id: str, user_id: int, reason: str,
    ) -> None:
        enrollment.status     = "suspended"
        enrollment.updated_at = datetime.utcnow()
        logger.info(f"[{run_id}] uid={user_id} enrollment {enrollment.id} "
                    f"→ suspended ({reason})")

    # ──────────────────────────────────────────────────────────────────────────
    # DB helpers
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _fetch_renewable_enrollments(
        db: Session,
    ) -> list[tuple[PolicyEnrollment, DeliveryPartner]]:
        """All active enrollments joined with partner for zone/platform info."""
        return (
            db.query(PolicyEnrollment, DeliveryPartner)
            .join(DeliveryPartner, PolicyEnrollment.user_id == DeliveryPartner.id)
            .filter(PolicyEnrollment.status == "active")
            .all()
        )

    @staticmethod
    def _write_renewal_log(
        db:            Session,
        enrollment_id: int,
        user_id:       int,
        run_id:        str,
        outcome:       str,
        premium_inr:   float,
        week_start:    date,
        policy_tier:   str  = "",
        zone:          str  = "",
        error:         str  = "",
    ) -> None:
        log = RenewalLog(
            enrollment_id = enrollment_id,
            user_id       = user_id,
            run_id        = run_id,
            outcome       = outcome,
            premium_inr   = premium_inr,
            week_start    = week_start,
            policy_tier   = policy_tier,
            zone          = zone,
            error_message = error or None,
        )
        db.add(log)


# ─── Module-level singleton ───────────────────────────────────────────────────
renewal_service = RenewalService()