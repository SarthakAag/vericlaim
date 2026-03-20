"""
Synthetic Training Data Generator
Guidewire DEVTrails 2026 — GigShield Parametric Insurance Platform

Generates 50,000 realistic Chennai gig-worker disruption records.

Feature engineering rationale
------------------------------
Each row represents one prediction call with:
  • Weather readings  (rain, temp, AQI, wind, visibility)
  • Traffic state     (congestion encoded 0-3)
  • Zone flood risk   (hyperlocal Chennai geography)
  • Temporal context  (hour, weekday, month)
  • Driver behaviour  (speed, speed deviation, distance remaining)

Labels (what we predict)
  • risk_score        0–100  (regression target)
  • delay_level       0=low / 1=moderate / 2=high / 3=critical
  • parametric_trigger 0/1   (binary — triggers insurance payout)
  • income_loss_pct   0–1    (fraction of hourly income lost)

Data is generated with physically coherent correlations:
  • Heavy rain in Oct/Nov (NE Monsoon season) → high flood risk zones
  • Rush hours correlate with heavy traffic
  • Extreme weather → parametric trigger fires
  • Flood zones amplify rain impact
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random
import os

random.seed(42)
np.random.seed(42)

N_SAMPLES = 50_000


# ─── Zone registry  (name → flood_risk) ──────────────────────────────────────
ZONES = {
    "velachery": 0.90, "adyar": 0.85, "madipakkam": 0.82,
    "perungudi": 0.80, "sholinganallur": 0.78, "porur": 0.75,
    "tambaram": 0.70,  "chromepet": 0.60,      "kodambakkam": 0.65,
    "perambur": 0.55,  "ambattur": 0.58,       "pallikaranai": 0.72,
    "medavakkam": 0.68,"t_nagar": 0.50,         "anna_nagar": 0.40,
    "nungambakkam": 0.42, "mylapore": 0.48,     "guindy": 0.44,
}
ZONE_NAMES      = list(ZONES.keys())
ZONE_RISKS      = np.array([ZONES[z] for z in ZONE_NAMES])

# ─── Seasonal rain distribution (month → mean, std in mm/hr) ─────────────────
MONTHLY_RAIN = {
    1: (2, 3),   2: (1, 2),   3: (1, 2),
    4: (5, 8),   5: (8, 12),  6: (30, 20),
    7: (40, 25), 8: (35, 22), 9: (20, 18),
    10: (50, 30),11: (60, 35),12: (20, 18),
}

MONTHLY_TEMP = {
    1: (26, 2), 2: (28, 2), 3: (31, 2),  4: (34, 3), 5: (38, 2), 6: (36, 2),
    7: (33, 1), 8: (32, 1), 9: (31, 2), 10: (29, 2), 11: (27, 2), 12: (26, 2),
}

MONTHLY_AQI = {
    1: (90, 20),  2: (85, 18), 3: (90, 20),
    4: (110, 30), 5: (130, 40),6: (80, 25),
    7: (70, 20),  8: (75, 20), 9: (80, 25),
    10: (95, 30), 11: (105, 35),12: (95, 30),
}


def generate_dataset(n: int = N_SAMPLES) -> pd.DataFrame:
    print(f"Generating {n:,} synthetic Chennai disruption records...")

    # ── Temporal features ─────────────────────────────────────────────────────
    months   = np.random.choice(range(1, 13), n, p=[
        0.06, 0.06, 0.07, 0.07, 0.08,
        0.09, 0.09, 0.09, 0.09,
        0.10, 0.11, 0.09   # Oct/Nov/Dec monsoon over-sampled
    ])
    raw_p    = np.array([
        0.02, 0.02, 0.02, 0.02, 0.02, 0.02,
        0.03, 0.06, 0.07, 0.06, 0.04, 0.04,
        0.05, 0.05, 0.04, 0.04, 0.04, 0.06,
        0.07, 0.07, 0.05, 0.04, 0.03, 0.02,
    ])
    raw_p   /= raw_p.sum()
    hours    = np.random.choice(range(24), n, p=raw_p)
    weekdays = np.random.randint(0, 7, n)
    is_weekend = (weekdays >= 5).astype(int)

    # Rush hour flag  (7–10 AM, 12–2 PM, 5–8 PM)
    is_rush = (
        ((hours >= 7)  & (hours <= 10)) |
        ((hours >= 12) & (hours <= 14)) |
        ((hours >= 17) & (hours <= 20))
    ).astype(int)

    # ── Zone + flood risk ─────────────────────────────────────────────────────
    zone_idx   = np.random.randint(0, len(ZONE_NAMES), n)
    zone_risk  = ZONE_RISKS[zone_idx]

    # ── Weather features ──────────────────────────────────────────────────────
    rain_mm    = np.array([
        max(0, np.random.normal(*MONTHLY_RAIN[m])) for m in months
    ])
    # Monsoon amplification for high flood-risk zones
    rain_mm    = rain_mm * (1 + zone_risk * 0.3)

    temp_c     = np.array([
        np.random.normal(*MONTHLY_TEMP[m]) for m in months
    ])
    aqi        = np.clip(
        np.array([np.random.normal(*MONTHLY_AQI[m]) for m in months]),
        20, 500
    ).astype(int)
    wind_kmh   = np.clip(
        np.random.exponential(12, n) + (rain_mm * 0.2),
        0, 80
    )
    # Visibility drops as rain increases
    visibility_m = np.clip(
        10_000 - (rain_mm * 120) + np.random.normal(0, 500, n),
        50, 10_000
    )

    # ── Traffic features ──────────────────────────────────────────────────────
    # Congestion: 0=low, 1=moderate, 2=heavy, 3=gridlock
    # More congestion during rush, weekdays, heavy rain
    traffic_base = (
        is_rush * 1.5
        + (1 - is_weekend) * 0.5
        + (rain_mm > 35).astype(float) * 1.0
        + (rain_mm > 65).astype(float) * 1.5
        + np.random.normal(0, 0.5, n)
    )
    congestion = np.clip(
        np.floor(traffic_base).astype(int), 0, 3
    )
    traffic_delay = congestion * 12 + np.random.randint(0, 10, n)

    # Road closure: rare but correlated with extreme rain + flood zones
    road_closure = (
        (rain_mm > 65) & (zone_risk > 0.75) &
        (np.random.random(n) < 0.25)
    ).astype(int)

    # ── Driver behaviour features ─────────────────────────────────────────────
    # Effective speed drops in bad conditions
    base_speed      = np.random.normal(22, 6, n)
    speed_reduction = (
        congestion * 3
        + (rain_mm > 15).astype(float) * 4
        + (rain_mm > 35).astype(float) * 6
        + (rain_mm > 65).astype(float) * 10
    )
    driver_speed    = np.clip(base_speed - speed_reduction, 0, 80)

    hist_avg_speed  = np.clip(
        np.random.normal(22, 4, n), 5, 50
    )
    speed_deviation = np.abs(driver_speed - hist_avg_speed) / (hist_avg_speed + 1e-6)
    distance_rem    = np.clip(np.random.exponential(4, n), 0.2, 20)

    # ── Compute ground-truth risk score ───────────────────────────────────────
    # This mirrors the weighted ensemble logic in ai_delay_predictor.py
    # so the model learns the same underlying physics

    # Weather score (0-100)
    w_score = np.zeros(n)
    w_score += np.where(rain_mm >= 65, 95,
               np.where(rain_mm >= 35, 75,
               np.where(rain_mm >= 15, 50,
               np.where(rain_mm >   5, 25, 0))))
    w_score += np.where(wind_kmh >= 40, 20, 0)
    w_score += np.where(temp_c   >= 42, 35,
               np.where(temp_c   >= 38, 15, 0))
    w_score += np.where(aqi >= 300, 30,
               np.where(aqi >= 200, 15, 0))
    w_score += np.where(visibility_m <= 200, 20, 0)
    w_score  = np.clip(w_score, 0, 100)

    # Traffic score (0-100)
    t_score = congestion * 28.3   # 0/28/56/85

    # Zone score (0-100)
    z_score = zone_risk * 100

    # Temporal score (0-100)
    temp_score = (
        is_rush * 40
        * np.where(is_weekend, 0.7, 1.0)
        + np.where((hours >= 22) | (hours <= 5), 20, 0)
    )

    # Behaviour score (0-100)
    b_score = (
        np.where(speed_deviation > 0.5, 30, 0)
        + np.where((driver_speed < 5) & (distance_rem > 1), 40,
          np.where(driver_speed < 15, 20, 0))
        + np.where(distance_rem > 10, 15,
          np.where(distance_rem >  5,  8, 0))
    )
    b_score = np.clip(b_score, 0, 100)

    # Seasonal multiplier
    seasonal = np.array([
        {1:1.0,2:1.0,3:1.0,4:1.2,5:1.4,6:1.3,
         7:1.2,8:1.2,9:1.3,10:1.8,11:1.9,12:1.5}[m]
        for m in months
    ])

    raw_score = (
        t_score * 0.25
        + w_score * 0.35
        + z_score * 0.20
        + temp_score * 0.10
        + b_score * 0.10
    )
    risk_score = np.clip(raw_score * seasonal, 0, 100)
    # Add realistic noise
    risk_score = np.clip(
        risk_score + np.random.normal(0, 3, n), 0, 100
    )

    # ── Labels derived from risk_score ────────────────────────────────────────
    delay_level = np.where(risk_score >= 80, 3,
                  np.where(risk_score >= 60, 2,
                  np.where(risk_score >= 40, 1, 0)))

    # Parametric trigger: fired if extreme weather thresholds met
    parametric_trigger = (
        (rain_mm >= 35) | (temp_c >= 42) |
        (aqi >= 300)    | (road_closure == 1)
    ).astype(int)
    # Must also exceed minimum risk threshold
    parametric_trigger = parametric_trigger & (risk_score >= 40).astype(int)

    # Income loss percentage
    income_loss_pct = np.clip(
        (risk_score / 100) * 0.85 + np.random.normal(0, 0.05, n),
        0.0, 1.0
    )

    # ── Assemble DataFrame ────────────────────────────────────────────────────
    df = pd.DataFrame({
        # Temporal
        "hour":             hours,
        "weekday":          weekdays,
        "month":            months,
        "is_weekend":       is_weekend,
        "is_rush_hour":     is_rush,
        # Weather
        "rain_mm_per_hr":   rain_mm.round(2),
        "temperature_c":    temp_c.round(1),
        "aqi":              aqi,
        "wind_kmh":         wind_kmh.round(1),
        "visibility_m":     visibility_m.round(0),
        # Zone
        "zone_flood_risk":  zone_risk.round(2),
        # Traffic
        "congestion":       congestion,
        "traffic_delay_min":traffic_delay,
        "road_closure":     road_closure,
        # Driver behaviour
        "driver_speed":     driver_speed.round(1),
        "hist_avg_speed":   hist_avg_speed.round(1),
        "speed_deviation":  speed_deviation.round(3),
        "distance_remaining": distance_rem.round(2),
        # Labels
        "risk_score":       risk_score.round(2),
        "delay_level":      delay_level,
        "parametric_trigger": parametric_trigger,
        "income_loss_pct":  income_loss_pct.round(3),
    })

    print(f"Dataset shape: {df.shape}")
    print(f"Parametric trigger rate: {df['parametric_trigger'].mean()*100:.1f}%")
    print(f"Risk score distribution:\n{df['delay_level'].value_counts().sort_index()}")
    return df


if __name__ == "__main__":
    df = generate_dataset(N_SAMPLES)
    out = os.path.join(os.path.dirname(__file__), "training_data.csv")
    df.to_csv(out, index=False)
    print(f"\nSaved: {out}")