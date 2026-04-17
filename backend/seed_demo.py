"""
VeriClaim AI — Demo Seed Script
Guidewire DEVTrails 2026

Run this before your judge demo:
    cd backend
    python seed_demo.py

What it creates in 3 phases:
  Phase 1 — Master data
    • 3 insurance policy tiers  (basic / standard / premium)
    • 1 admin account

  Phase 2 — Drivers + enrollments
    • 6 delivery partners across Chennai zones
    • 6 active policy enrollments (mix of tiers)
    • 4 weeks of earnings history per driver

  Phase 3 — Live demo events
    • 2 APPROVED auto-payouts  (rain + flood)
    • 1 HELD fraud case        (speed/weather mismatch)
    • 1 REJECTED fraud case    (GPS spoofing)
    • 1 ESCALATED case         (borderline, needs senior review)
    • Renewal logs for 2 completed cycles
    • Trigger event log rows matching each payout

Idempotent — safe to re-run; existing rows are skipped not duplicated.
"""

from __future__ import annotations

import sys
import os
import random
from datetime import datetime, date, timedelta

# ── Make sure backend/ is on the path when running from project root ──────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app.utils.security import hash_password

# ── Models ────────────────────────────────────────────────────────────────────
from app.models.user_model        import DeliveryPartner
from app.models.admin_model       import Admin
from app.models.policy_model      import InsurancePolicy
from app.models.enrollment_model  import PolicyEnrollment
from app.models.premium_model     import PremiumPayment
from app.models.earnings_model    import DeliveryEarnings
from app.models.payout_model      import PayoutRecord, PredictionHistory
from app.models.trigger_model     import TriggerEvent
from app.models.fraud_audit_model import FraudAuditLog
from app.models.renewal_log_model import RenewalLog

# Create all tables (no-op if already exist)
Base.metadata.create_all(bind=engine)

# ─── Colour helpers for terminal output ───────────────────────────────────────
G  = "\033[92m"   # green
Y  = "\033[93m"   # yellow
R  = "\033[91m"   # red
B  = "\033[94m"   # blue
DIM= "\033[2m"
RST= "\033[0m"
BOLD="\033[1m"

def ok(msg):  print(f"  {G}✓{RST}  {msg}")
def skip(msg):print(f"  {DIM}→  {msg} (already exists){RST}")
def hdr(msg): print(f"\n{BOLD}{B}▸ {msg}{RST}")
def done(msg):print(f"\n{G}{BOLD}✅  {msg}{RST}\n")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — MASTER DATA
# ══════════════════════════════════════════════════════════════════════════════

POLICIES = [
    dict(
        policy_name             = "Basic Shield",
        policy_tier             = "basic",
        description             = "Entry-level protection — covers severe rain & flood events",
        weekly_premium          = 99.0,
        coverage_amount         = 15_000.0,
        max_weekly_payout       = 1_500.0,
        coverage_hours_per_week = 16,
        max_claims_per_week     = 2,
        min_disruption_hours    = 1.0,
        income_covered_pct      = 0.60,
        is_active               = True,
    ),
    dict(
        policy_name             = "Standard Guard",
        policy_tier             = "standard",
        description             = "Mid-tier — rain, flood, road closure, severe AQI",
        weekly_premium          = 149.0,
        coverage_amount         = 25_000.0,
        max_weekly_payout       = 2_500.0,
        coverage_hours_per_week = 24,
        max_claims_per_week     = 3,
        min_disruption_hours    = 0.5,
        income_covered_pct      = 0.75,
        is_active               = True,
    ),
    dict(
        policy_name             = "Premium Protect",
        policy_tier             = "premium",
        description             = "Full protection — all disruption types, highest payout",
        weekly_premium          = 199.0,
        coverage_amount         = 40_000.0,
        max_weekly_payout       = 4_000.0,
        coverage_hours_per_week = 40,
        max_claims_per_week     = 5,
        min_disruption_hours    = 0.5,
        income_covered_pct      = 0.90,
        is_active               = True,
    ),
]

DRIVERS = [
    dict(full_name="Arjun Murugan",   email="arjun@demo.vc",   phone="9840001001",
         zone="t_nagar",   platform="zomato", driver_ref="DRV-001"),
    dict(full_name="Priya Krishnan",  email="priya@demo.vc",   phone="9840001002",
         zone="velachery", platform="swiggy", driver_ref="DRV-002"),
    dict(full_name="Karthik Rajan",   email="karthik@demo.vc", phone="9840001003",
         zone="omr",       platform="zomato", driver_ref="DRV-003"),
    dict(full_name="Deepa Sundaram",  email="deepa@demo.vc",   phone="9840001004",
         zone="adyar",     platform="swiggy", driver_ref="DRV-004"),
    dict(full_name="Murugan Pillai",  email="murugan@demo.vc", phone="9840001005",
         zone="anna_nagar",platform="both",   driver_ref="DRV-005"),
    dict(full_name="Lakshmi Venkat",  email="lakshmi@demo.vc", phone="9840001006",
         zone="porur",     platform="zomato", driver_ref="DRV-006"),
]

# (driver_index, policy_tier, zone_flood_risk, auto_renew)
ENROLLMENTS = [
    (0, "premium",  0.80, True),
    (1, "standard", 0.75, True),
    (2, "standard", 0.55, True),
    (3, "basic",    0.50, True),
    (4, "premium",  0.65, True),
    (5, "basic",    0.45, False),   # opted out → shows in "will not renew"
]

ADMIN = dict(
    full_name = "VeriClaim Admin",
    email     = "admin@vericlaim.ai",
    username  = "admin",
    password  = "admin123",
)


def seed_master_data(db) -> tuple[dict, list, list]:
    """Returns (policy_map, driver_list, enrollment_list)."""
    hdr("Phase 1 — Master Data")

    # ── Admin ─────────────────────────────────────────────────────────────────
    existing_admin = db.query(Admin).filter(Admin.username == ADMIN["username"]).first()
    if existing_admin:
        skip(f"Admin '{ADMIN['username']}'")
    else:
        admin = Admin(
            full_name     = ADMIN["full_name"],
            email         = ADMIN["email"],
            username      = ADMIN["username"],
            password_hash = hash_password(ADMIN["password"]),
        )
        db.add(admin); db.flush()
        ok(f"Admin '{ADMIN['username']}' / password '{ADMIN['password']}'")

    # ── Policies ──────────────────────────────────────────────────────────────
    policy_map: dict[str, InsurancePolicy] = {}
    for p in POLICIES:
        existing = db.query(InsurancePolicy).filter(
            InsurancePolicy.policy_tier == p["policy_tier"]
        ).first()
        if existing:
            skip(f"Policy '{p['policy_tier']}'")
            policy_map[p["policy_tier"]] = existing
        else:
            obj = InsurancePolicy(**p)
            db.add(obj); db.flush()
            policy_map[p["policy_tier"]] = obj
            ok(f"Policy '{p['policy_tier']}' — ₹{p['weekly_premium']}/wk "
               f"→ max ₹{p['max_weekly_payout']}/wk")

    db.commit()
    return policy_map


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — DRIVERS + ENROLLMENTS + EARNINGS
# ══════════════════════════════════════════════════════════════════════════════

def seed_drivers_and_enrollments(db, policy_map):
    hdr("Phase 2 — Drivers, Enrollments & Earnings")

    drivers: list[DeliveryPartner] = []
    enrollments: list[PolicyEnrollment] = []

    for i, d in enumerate(DRIVERS):
        # Driver
        existing = db.query(DeliveryPartner).filter(
            DeliveryPartner.email == d["email"]
        ).first()
        if existing:
            skip(f"Driver '{d['full_name']}'")
            driver = existing
        else:
            driver = DeliveryPartner(
                full_name  = d["full_name"],
                email      = d["email"],
                phone      = d["phone"],
                zone       = d["zone"],
                platform   = d["platform"],
                driver_ref = d["driver_ref"],
                password_hash = hash_password("driver123"),
            )
            db.add(driver); db.flush()
            ok(f"Driver '{d['full_name']}' — {d['zone']} / {d['platform']}")
        drivers.append(driver)

        # Enrollment
        tier, flood_risk, auto_renew = (
            ENROLLMENTS[i][1], ENROLLMENTS[i][2], ENROLLMENTS[i][3]
        )
        policy = policy_map[tier]
        existing_enroll = db.query(PolicyEnrollment).filter(
            PolicyEnrollment.user_id == driver.id,
            PolicyEnrollment.status  == "active",
        ).first()
        if existing_enroll:
            skip(f"Enrollment {driver.full_name} / {tier}")
            enrollments.append(existing_enroll)
        else:
            today      = date.today()
            week_start = today - timedelta(days=today.weekday())
            enroll = PolicyEnrollment(
                user_id                      = driver.id,
                policy_id                    = policy.id,
                policy_tier                  = tier,
                weekly_premium_paid          = policy.weekly_premium,
                start_date                   = today - timedelta(weeks=4),
                status                       = "active",
                week_start                   = week_start,
                claims_this_week             = 0,
                coverage_hours_used_this_week= 0.0,
                payout_total_this_week       = 0.0,
                home_zone                    = d["zone"],
                zone_flood_risk              = flood_risk,
                auto_renew                   = auto_renew,
                total_premiums_paid          = policy.weekly_premium * 4,
            )
            db.add(enroll); db.flush()
            enrollments.append(enroll)
            ok(f"Enrollment {driver.full_name} → {tier} "
               f"({'auto-renew ON' if auto_renew else 'auto-renew OFF'})")

        # 4 weeks of earnings
        _seed_earnings(db, driver, i)

    db.commit()
    return drivers, enrollments


def _seed_earnings(db, driver: DeliveryPartner, driver_idx: int):
    """4 weeks of weekly earnings — realistic Chennai gig income."""
    base_earnings = [4_200, 3_800, 5_100, 4_600, 4_900, 3_500][driver_idx % 6]
    today = date.today()
    for w in range(4, 0, -1):
        week_start = (today - timedelta(weeks=w)) - timedelta(
            days=(today - timedelta(weeks=w)).weekday()
        )
        existing = db.query(DeliveryEarnings).filter(
            DeliveryEarnings.user_id    == driver.id,
            DeliveryEarnings.week_start == week_start,
        ).first()
        if existing:
            continue
        # Add ±15% variance per week
        variance    = random.uniform(0.85, 1.15)
        total       = round(base_earnings * variance, 2)
        payout_recv = 0.0
        earnings = DeliveryEarnings(
            user_id             = driver.id,
            week_start          = week_start,
            total_earnings      = total,
            deliveries_completed = int(total / 45),
            payout_received_inr = payout_recv,
            net_protected_income= total + payout_recv,
        )
        db.add(earnings)


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — DEMO EVENTS
# ══════════════════════════════════════════════════════════════════════════════

def seed_demo_events(db, drivers: list, enrollments: list, policy_map: dict):
    hdr("Phase 3 — Demo Events")

    today      = date.today()
    week_start = today - timedelta(days=today.weekday())
    now        = datetime.utcnow()

    # ── 1. APPROVED — extreme rain payout (Arjun, premium tier) ──────────────
    _approved_payout(
        db, drivers[0], enrollments[0], policy_map["premium"],
        disruption    = "extreme_rain",
        severity      = "CRITICAL",
        delay_minutes = 95,
        payout_inr    = 680.0,
        location      = "T Nagar",
        minutes_ago   = 18,
        week_start    = week_start,
        now           = now,
    )

    # ── 2. APPROVED — flood road closure (Karthik, standard tier) ────────────
    _approved_payout(
        db, drivers[2], enrollments[2], policy_map["standard"],
        disruption    = "flood",
        severity      = "MAJOR",
        delay_minutes = 75,
        payout_inr    = 420.0,
        location      = "OMR Sholinganallur",
        minutes_ago   = 47,
        week_start    = week_start,
        now           = now,
    )

    # ── 3. HELD FOR REVIEW — speed/weather mismatch (Deepa, basic) ───────────
    _held_payout(
        db, drivers[3], enrollments[3], policy_map["basic"],
        disruption    = "heavy_rain",
        severity      = "MODERATE",
        fraud_flags   = ["FRAUD_SPEED_WEATHER_MISMATCH", "SUSPICIOUS_TIMING"],
        fraud_score   = 55,
        location      = "Adyar",
        minutes_ago   = 82,
        week_start    = week_start,
        now           = now,
    )

    # ── 4. REJECTED — GPS spoofing (Murugan, premium) ────────────────────────
    _rejected_payout(
        db, drivers[4], enrollments[4], policy_map["premium"],
        disruption    = "extreme_rain",
        fraud_flags   = ["GPS_SPOOFING_DETECTED", "LOCATION_MISMATCH",
                          "CLAIM_OUTSIDE_RAIN_ZONE"],
        fraud_score   = 91,
        location      = "Anna Nagar",
        minutes_ago   = 135,
        week_start    = week_start,
        now           = now,
    )

    # ── 5. ESCALATED — borderline score (Lakshmi, basic) ─────────────────────
    record = _held_payout(
        db, drivers[5], enrollments[5], policy_map["basic"],
        disruption    = "severe_aqi",
        severity      = "MINOR",
        fraud_flags   = ["FRAUD_BORDERLINE_RISK_SCORE"],
        fraud_score   = 61,
        location      = "Porur",
        minutes_ago   = 200,
        week_start    = week_start,
        now           = now,
        escalate      = True,
    )

    # Write audit log for the escalation
    if record:
        _write_audit(db, record, "escalated",
                     notes="Borderline score — route verified but timing suspicious. "
                           "Sending to senior review.",
                     now=now, minutes_ago=195)

    # ── 6. Renewal logs for 2 past cycles ────────────────────────────────────
    for driver, enrollment in zip(drivers[:4], enrollments[:4]):
        for weeks_back in (2, 1):
            ws = week_start - timedelta(weeks=weeks_back)
            existing = db.query(RenewalLog).filter(
                RenewalLog.user_id    == driver.id,
                RenewalLog.week_start == ws,
            ).first()
            if not existing:
                log = RenewalLog(
                    enrollment_id = enrollment.id,
                    user_id       = driver.id,
                    run_id        = f"RENEW-{ws.strftime('%Y%m%d')}-000500",
                    outcome       = "renewed",
                    premium_inr   = policy_map[enrollment.policy_tier].weekly_premium,
                    week_start    = ws,
                    policy_tier   = enrollment.policy_tier,
                    zone          = enrollment.home_zone,
                    processed_at  = datetime.combine(ws, datetime.min.time()),
                )
                db.add(log)

    # ── 7. Trigger event rows for the approved payouts ────────────────────────
    run_id = f"RUN-{now.strftime('%Y%m%d-%H%M%S')}"
    for driver, (disruption, severity, risk_score, delay, payout_status) in zip(
        drivers[:2],
        [
            ("extreme_rain", "CRITICAL", 88, 95, "APPROVED"),
            ("flood",        "MAJOR",    76, 75, "APPROVED"),
        ],
    ):
        existing = db.query(TriggerEvent).filter(
            TriggerEvent.user_id          == driver.id,
            TriggerEvent.scheduler_run_id == run_id,
        ).first()
        if not existing:
            evt = TriggerEvent(
                user_id           = driver.id,
                scheduler_run_id  = run_id,
                driver_location   = DRIVERS[drivers.index(driver)]["zone"],
                status            = f"PAYOUT_{payout_status}",
                disruption_type   = disruption,
                severity_level    = severity,
                risk_score        = risk_score,
                delay_minutes     = delay,
                income_loss_inr   = payout_status == "APPROVED" and 500 or 0,
                auto_claim_eligible= True,
                fraud_risk        = "low",
                fraud_flags       = [],
                payout_status     = payout_status,
                evaluated_at      = now - timedelta(minutes=20),
                processing_ms     = random.randint(180, 420),
            )
            db.add(evt)

    db.commit()
    ok("All demo events seeded")


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _payout_ref(user_id: int, now: datetime, offset: int = 0) -> str:
    ts = now - timedelta(minutes=offset)
    return f"PAY-{user_id:06d}-{ts.strftime('%Y%m%d%H%M%S')}"


def _approved_payout(
    db, driver, enrollment, policy,
    disruption, severity, delay_minutes, payout_inr,
    location, minutes_ago, week_start, now,
) -> PayoutRecord | None:
    ref = _payout_ref(driver.id, now, minutes_ago)
    if db.query(PayoutRecord).filter(PayoutRecord.payout_reference == ref).first():
        skip(f"Approved payout {ref}"); return None

    record = PayoutRecord(
        user_id               = driver.id,
        policy_id             = policy.id,
        enrollment_id         = enrollment.id,
        payout_reference      = ref,
        week_start            = week_start,
        disruption_type       = disruption,
        severity_level        = severity,
        trigger_type          = disruption,
        payout_tier_label     = "partial",
        coverage_hours_claimed= round(delay_minutes / 60, 2),
        base_payout_inr       = payout_inr,
        final_payout_inr      = payout_inr,
        status                = "approved",
        fraud_score           = 0,
        fraud_risk_level      = "low",
        fraud_flags           = [],
        manual_review_required= False,
        payment_channel       = "UPI_INSTANT" if payout_inr <= 200 else "IMPS",
        calculation_breakdown = {
            "after_cap_inr":   payout_inr,
            "base_payout_inr": payout_inr,
            "location":        location,
        },
        created_at = now - timedelta(minutes=minutes_ago),
    )
    db.add(record); db.flush()
    ok(f"APPROVED payout ₹{payout_inr} — {driver.full_name} ({disruption})")

    # Update enrollment counters
    enrollment.claims_this_week              += 1
    enrollment.coverage_hours_used_this_week += record.coverage_hours_claimed
    enrollment.payout_total_this_week        += payout_inr
    enrollment.total_payout_received         += payout_inr

    return record


def _held_payout(
    db, driver, enrollment, policy,
    disruption, severity, fraud_flags, fraud_score,
    location, minutes_ago, week_start, now,
    escalate: bool = False,
) -> PayoutRecord | None:
    ref = _payout_ref(driver.id, now, minutes_ago)
    if db.query(PayoutRecord).filter(PayoutRecord.payout_reference == ref).first():
        skip(f"Held payout {ref}"); return None

    status = "escalated" if escalate else "held_for_review"
    record = PayoutRecord(
        user_id               = driver.id,
        policy_id             = policy.id,
        enrollment_id         = enrollment.id,
        payout_reference      = ref,
        week_start            = week_start,
        disruption_type       = disruption,
        severity_level        = severity,
        trigger_type          = disruption,
        payout_tier_label     = "partial",
        coverage_hours_claimed= 1.5,
        base_payout_inr       = 280.0,
        final_payout_inr      = 0.0,
        status                = status,
        rejection_reason      = "FRAUD_MEDIUM_RISK_MANUAL_REVIEW",
        fraud_score           = fraud_score,
        fraud_risk_level      = "medium",
        fraud_flags           = fraud_flags,
        manual_review_required= True,
        calculation_breakdown = {
            "after_cap_inr":   280.0,
            "base_payout_inr": 280.0,
            "location":        location,
        },
        created_at = now - timedelta(minutes=minutes_ago),
    )
    db.add(record); db.flush()
    label = "ESCALATED" if escalate else "HELD"
    ok(f"{label} payout — {driver.full_name} "
       f"(fraud_score={fraud_score}, {disruption})")
    return record


def _rejected_payout(
    db, driver, enrollment, policy,
    disruption, fraud_flags, fraud_score,
    location, minutes_ago, week_start, now,
) -> PayoutRecord | None:
    ref = _payout_ref(driver.id, now, minutes_ago)
    if db.query(PayoutRecord).filter(PayoutRecord.payout_reference == ref).first():
        skip(f"Rejected payout {ref}"); return None

    record = PayoutRecord(
        user_id               = driver.id,
        policy_id             = policy.id,
        enrollment_id         = enrollment.id,
        payout_reference      = ref,
        week_start            = week_start,
        disruption_type       = disruption,
        severity_level        = "CRITICAL",
        trigger_type          = disruption,
        payout_tier_label     = "none",
        coverage_hours_claimed= 0.0,
        base_payout_inr       = 680.0,
        final_payout_inr      = 0.0,
        status                = "rejected",
        rejection_reason      = "FRAUD_RISK_HIGH",
        fraud_score           = fraud_score,
        fraud_risk_level      = "high",
        fraud_flags           = fraud_flags,
        manual_review_required= False,
        calculation_breakdown = {"location": location},
        created_at            = now - timedelta(minutes=minutes_ago),
    )
    db.add(record); db.flush()
    ok(f"REJECTED payout — {driver.full_name} "
       f"(fraud_score={fraud_score}, GPS spoofing)")
    return record


def _write_audit(
    db, record: PayoutRecord, action: str,
    notes: str, now: datetime, minutes_ago: int,
):
    existing = db.query(FraudAuditLog).filter(
        FraudAuditLog.payout_record_id == record.id,
        FraudAuditLog.action           == action,
    ).first()
    if existing:
        return
    log = FraudAuditLog(
        payout_record_id = record.id,
        user_id          = record.user_id,
        admin_username   = "admin",
        action           = action,
        previous_status  = "held_for_review",
        new_status       = action,
        notes            = notes,
        acted_at         = now - timedelta(minutes=minutes_ago),
    )
    db.add(log)


# ══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print(f"\n{BOLD}{'═'*55}")
    print("  VeriClaim AI — Demo Seed Script")
    print(f"{'═'*55}{RST}")

    db = SessionLocal()
    try:
        policy_map              = seed_master_data(db)
        drivers, enrollments    = seed_drivers_and_enrollments(db, policy_map)
        seed_demo_events(db, drivers, enrollments, policy_map)
    except Exception as exc:
        db.rollback()
        print(f"\n{R}✕  Seed failed: {exc}{RST}")
        import traceback; traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

    done("Demo data ready — start your demo!")

    print(f"{BOLD}Quick reference:{RST}")
    print(f"  Admin login  → username: {Y}admin{RST}   password: {Y}admin123{RST}")
    print(f"  Driver login → email: {Y}arjun@demo.vc{RST}  password: {Y}driver123{RST}")
    print(f"  All driver passwords → {Y}driver123{RST}")
    print()
    print(f"{DIM}  Fraud panel   → 2 approved · 1 held · 1 rejected · 1 escalated")
    print(f"  Renewals tab  → 2 completed cycles · 5 active auto-renew · 1 opted-out")
    print(f"  Trigger feed  → 2 live APPROVED events in the feed{RST}")
    print()


if __name__ == "__main__":
    main()