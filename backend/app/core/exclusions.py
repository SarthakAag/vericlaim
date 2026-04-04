"""
GigShield Insurance — Policy Exclusion Clauses
Guidewire DEVTrails 2026

Single source of truth for all exclusions.
Imported by:
  • payout_calculation_service.py  (_check_eligibility gate)
  • policy_routes.py               (GET /policy/exclusions endpoint)
  • enroll-policy frontend         (acknowledgement UI)
"""

from __future__ import annotations

# ──────────────────────────────────────────────────────────────────────────────
# MANDATORY — problem-statement hard rules (cannot be waived ever)
# ──────────────────────────────────────────────────────────────────────────────
MANDATORY_EXCLUSIONS: dict[str, dict] = {
    "health_medical": {
        "title":       "Health & Medical Expenses",
        "category":    "mandatory",
        "description": (
            "This policy does NOT cover any medical expenses, hospitalisation, "
            "doctor fees, or treatment costs — even if caused by working conditions."
        ),
        "examples": [
            "Doctor visit after working in rain",
            "Hospital bills from a road accident",
            "Medicines for heat-related illness",
        ],
        "rejection_code": "EXCLUDED_HEALTH_MEDICAL",
    },
    "life_insurance": {
        "title":       "Life Insurance / Death Benefit",
        "category":    "mandatory",
        "description": (
            "No death benefit, terminal illness benefit, or permanent disability "
            "benefit is payable. GigShield covers INCOME LOSS from external "
            "disruptions ONLY."
        ),
        "examples": [
            "Death of the delivery partner",
            "Permanent disability from any cause",
        ],
        "rejection_code": "EXCLUDED_LIFE_INSURANCE",
    },
    "accident_injury": {
        "title":       "Personal Accident & Injury",
        "category":    "mandatory",
        "description": (
            "Costs or income loss arising from a personal accident or physical "
            "injury are excluded. Only EXTERNAL environmental or social disruptions "
            "are covered."
        ),
        "examples": [
            "Bike accident during delivery",
            "Slip and fall injury",
            "Income lost during accident recovery",
        ],
        "rejection_code": "EXCLUDED_ACCIDENT_INJURY",
    },
    "vehicle_repair": {
        "title":       "Vehicle Repair & Maintenance",
        "category":    "mandatory",
        "description": (
            "No vehicle repair costs, spare parts, maintenance charges, or "
            "breakdown assistance are covered under any circumstance."
        ),
        "examples": [
            "Bike repair after flood damage",
            "Tyre puncture replacement",
            "Engine breakdown costs",
        ],
        "rejection_code": "EXCLUDED_VEHICLE_REPAIR",
    },
}

# ──────────────────────────────────────────────────────────────────────────────
# REGULATORY — standard IRDAI / insurance law requirements
# ──────────────────────────────────────────────────────────────────────────────
REGULATORY_EXCLUSIONS: dict[str, dict] = {
    "war": {
        "title":       "War & Civil Conflict",
        "category":    "regulatory",
        "description": (
            "Any loss caused directly or indirectly by war, invasion, civil war, "
            "rebellion, or military action is excluded."
        ),
        "examples": [
            "City shutdown due to military conflict",
            "Curfew imposed due to civil war",
        ],
        "rejection_code": "EXCLUDED_WAR",
    },
    "pandemic": {
        "title":       "Pandemic / Epidemic",
        "category":    "regulatory",
        "description": (
            "Income loss caused by government-mandated lockdowns or restrictions "
            "arising from a declared pandemic or epidemic is excluded."
        ),
        "examples": [
            "COVID-19 lockdown work stoppage",
            "Government-ordered pandemic curfew",
        ],
        "rejection_code": "EXCLUDED_PANDEMIC",
    },
    "nuclear": {
        "title":       "Nuclear & Radiation Events",
        "category":    "regulatory",
        "description": (
            "Any loss caused by nuclear reaction, radiation, or radioactive "
            "contamination is excluded."
        ),
        "examples": [
            "Nuclear plant incident causing evacuation",
        ],
        "rejection_code": "EXCLUDED_NUCLEAR",
    },
    "terrorism": {
        "title":       "Terrorism",
        "category":    "regulatory",
        "description": (
            "Income loss caused directly by a terrorist act or threat "
            "is excluded."
        ),
        "examples": [
            "Bomb scare shutting down delivery zone",
            "Terror-related area lockdown",
        ],
        "rejection_code": "EXCLUDED_TERRORISM",
    },
}

# ──────────────────────────────────────────────────────────────────────────────
# OPERATIONAL — platform business rules
# ──────────────────────────────────────────────────────────────────────────────
OPERATIONAL_EXCLUSIONS: dict[str, dict] = {
    "self_inflicted_stoppage": {
        "title":       "Voluntary / Self-Inflicted Stoppage",
        "category":    "operational",
        "description": (
            "Income loss due to the partner's own choice to stop working "
            "is not covered."
        ),
        "examples": [
            "Decided not to work today",
            "Took a voluntary day off",
        ],
        "rejection_code": "EXCLUDED_SELF_INFLICTED",
    },
    "platform_deactivation": {
        "title":       "Platform Deactivation / Suspension",
        "category":    "operational",
        "description": (
            "If the delivery platform (Zomato/Swiggy) suspends or deactivates "
            "the partner's account due to policy violations, no payout is made."
        ),
        "examples": [
            "Zomato account banned for misconduct",
            "Swiggy suspension for low ratings",
        ],
        "rejection_code": "EXCLUDED_PLATFORM_DEACTIVATION",
    },
    "policy_lapse": {
        "title":       "Policy Lapse (Missed Premium)",
        "category":    "operational",
        "description": (
            "If the weekly premium is not paid, coverage lapses immediately "
            "and no claims are payable for that week."
        ),
        "examples": [
            "Weekly premium not paid on time",
            "Insufficient balance for auto-debit",
        ],
        "rejection_code": "EXCLUDED_POLICY_LAPSE",
    },
}


# ──────────────────────────────────────────────────────────────────────────────
# COMBINED flat lookup — used by _check_eligibility()
# ──────────────────────────────────────────────────────────────────────────────
ALL_EXCLUSIONS: dict[str, dict] = {
    **MANDATORY_EXCLUSIONS,
    **REGULATORY_EXCLUSIONS,
    **OPERATIONAL_EXCLUSIONS,
}

# Set of disruption_type strings that are always rejected
EXCLUDED_DISRUPTION_TYPES: set[str] = {
    # mandatory
    "health_medical", "life_insurance", "accident_injury", "vehicle_repair",
    "vehicle_damage", "health", "accident", "medical",
    # regulatory
    "war", "pandemic", "nuclear", "terrorism",
    # operational
    "self_inflicted_stoppage", "platform_deactivation", "policy_lapse",
}


def get_rejection_code(disruption_type: str) -> str:
    """Returns the rejection_code for a given disruption_type, or a generic one."""
    entry = ALL_EXCLUSIONS.get(disruption_type)
    if entry:
        return entry["rejection_code"]
    # Partial match fallback (e.g. "vehicle_damage" → vehicle_repair clause)
    for key, val in ALL_EXCLUSIONS.items():
        if key in disruption_type or disruption_type in key:
            return val["rejection_code"]
    return f"EXCLUDED_{disruption_type.upper()}"


def exclusions_for_frontend() -> list[dict]:
    """
    Returns a clean list for the /policy/exclusions API endpoint
    and frontend display — no internal fields exposed.
    """
    result = []
    for code, data in ALL_EXCLUSIONS.items():
        result.append({
            "code":        code,
            "title":       data["title"],
            "category":    data["category"],
            "description": data["description"],
            "examples":    data["examples"],
        })
    return result