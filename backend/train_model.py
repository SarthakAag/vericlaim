"""
ML Model Training Pipeline
Guidewire DEVTrails 2026 — GigShield Parametric Insurance Platform

Trains three models on the synthetic Chennai disruption dataset:

  Model 1 — Risk Score Regressor  (RandomForest)
            Predicts continuous risk_score (0–100)
            Used as the primary AI score in the prediction engine

  Model 2 — Delay Level Classifier  (GradientBoosting)
            Predicts delay_level: 0=low, 1=moderate, 2=high, 3=critical
            Used for human-readable severity label

  Model 3 — Parametric Trigger Classifier  (RandomForest + calibration)
            Binary: will a parametric insurance trigger fire?
            Used by the payout engine for auto-claim eligibility
            Calibrated for probability output (precision matters here)

Saves:
  models/risk_score_model.pkl
  models/delay_level_model.pkl
  models/trigger_model.pkl
  models/feature_scaler.pkl
  models/model_metadata.json
"""

import os
import json
import joblib
import warnings
import numpy as np
import pandas as pd

from sklearn.ensemble import (
    RandomForestRegressor,
    RandomForestClassifier,
    GradientBoostingClassifier,
)
from sklearn.calibration import CalibratedClassifierCV
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    mean_absolute_error, r2_score,
    classification_report, roc_auc_score, confusion_matrix,
)
from sklearn.pipeline import Pipeline

warnings.filterwarnings("ignore")

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_PATH   = os.path.join(BASE_DIR, "training_data.csv")
MODELS_DIR  = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ─── Feature columns (must match what ml_risk_model.py sends at inference) ────
FEATURE_COLS = [
    "rain_mm_per_hr",
    "temperature_c",
    "aqi",
    "wind_kmh",
    "visibility_m",
    "zone_flood_risk",
    "congestion",
    "traffic_delay_min",
    "road_closure",
    "driver_speed",
    "speed_deviation",
    "distance_remaining",
    "hour",
    "weekday",
    "month",
    "is_weekend",
    "is_rush_hour",
]


# ══════════════════════════════════════════════════════════════════════════════
def load_and_prepare(path: str) -> tuple:
    print("Loading dataset...")
    df = pd.read_csv(path)
    print(f"  Rows: {len(df):,}  |  Columns: {len(df.columns)}")

    X = df[FEATURE_COLS].copy()
    y_score   = df["risk_score"]
    y_level   = df["delay_level"]
    y_trigger = df["parametric_trigger"]

    # Feature engineering additions
    X["rain_x_zone"]     = X["rain_mm_per_hr"] * X["zone_flood_risk"]
    X["heat_x_aqi"]      = (X["temperature_c"] - 28) * (X["aqi"] / 100)
    X["congestion_rush"] = X["congestion"] * X["is_rush_hour"]
    X["speed_zone"]      = X["driver_speed"] * (1 - X["zone_flood_risk"])

    print(f"  Final feature count: {X.shape[1]}")
    return X, y_score, y_level, y_trigger, df


def train_risk_regressor(X_tr, X_te, y_tr, y_te) -> tuple:
    print("\n── Model 1: Risk Score Regressor (RandomForest) ──────────────────")
    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=18,
        min_samples_split=10,
        min_samples_leaf=4,
        max_features="sqrt",
        n_jobs=-1,
        random_state=42,
    )
    model.fit(X_tr, y_tr)
    preds = model.predict(X_te)

    mae = mean_absolute_error(y_te, preds)
    r2  = r2_score(y_te, preds)
    print(f"  MAE  : {mae:.3f} risk points")
    print(f"  R²   : {r2:.4f}")
    print(f"  Pred range: [{preds.min():.1f}, {preds.max():.1f}]")
    return model, {"mae": round(mae, 3), "r2": round(r2, 4)}


def train_delay_classifier(X_tr, X_te, y_tr, y_te) -> tuple:
    print("\n── Model 2: Delay Level Classifier (GradientBoosting) ────────────")
    model = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.08,
        max_depth=6,
        min_samples_split=15,
        subsample=0.85,
        random_state=42,
    )
    model.fit(X_tr, y_tr)
    preds = model.predict(X_te)

    report = classification_report(
        y_te, preds,
        target_names=["low", "moderate", "high", "critical"],
        output_dict=True,
    )
    acc = report["accuracy"]
    mac = report["macro avg"]["f1-score"]
    print(f"  Accuracy      : {acc:.4f}")
    print(f"  Macro F1      : {mac:.4f}")
    print(classification_report(
        y_te, preds,
        target_names=["low", "moderate", "high", "critical"],
    ))
    return model, {"accuracy": round(acc, 4), "macro_f1": round(mac, 4)}


def train_trigger_classifier(X_tr, X_te, y_tr, y_te) -> tuple:
    print("\n── Model 3: Parametric Trigger Classifier (RF + Calibration) ─────")

    base = RandomForestClassifier(
        n_estimators=200,
        max_depth=16,
        min_samples_split=10,
        min_samples_leaf=4,
        class_weight="balanced",   # handles imbalanced trigger rates
        max_features="sqrt",
        n_jobs=-1,
        random_state=42,
    )
    # Platt scaling calibration → reliable probability estimates
    model = CalibratedClassifierCV(base, method="sigmoid", cv=3)
    model.fit(X_tr, y_tr)

    preds      = model.predict(X_te)
    proba      = model.predict_proba(X_te)[:, 1]
    auc        = roc_auc_score(y_te, proba)
    cm         = confusion_matrix(y_te, preds)
    report     = classification_report(
        y_te, preds,
        target_names=["no_trigger", "trigger"],
        output_dict=True,
    )
    precision  = report["trigger"]["precision"]
    recall     = report["trigger"]["recall"]
    f1         = report["trigger"]["f1-score"]

    print(f"  ROC-AUC   : {auc:.4f}")
    print(f"  Precision : {precision:.4f}  (low FP = fewer wrongful payouts)")
    print(f"  Recall    : {recall:.4f}   (high = fewer missed payouts)")
    print(f"  F1        : {f1:.4f}")
    print(f"  Confusion matrix:\n{cm}")
    return model, {
        "roc_auc": round(auc, 4),
        "trigger_precision": round(precision, 4),
        "trigger_recall":    round(recall, 4),
        "trigger_f1":        round(f1, 4),
    }


def feature_importance_report(model, feature_names: list, top_n: int = 12):
    try:
        # Works for RF and GB directly; for calibrated wrapper get base
        estimator = getattr(model, "calibrated_classifiers_", None)
        if estimator:
            rf = model.calibrated_classifiers_[0].estimator
            imp = rf.feature_importances_
        else:
            imp = model.feature_importances_
        pairs = sorted(
            zip(feature_names, imp), key=lambda x: x[1], reverse=True
        )[:top_n]
        print(f"\n  Top {top_n} features:")
        for fname, score in pairs:
            bar = "█" * int(score * 200)
            print(f"    {fname:<25} {score:.4f}  {bar}")
    except Exception:
        pass


def main():
    X, y_score, y_level, y_trigger, df = load_and_prepare(DATA_PATH)
    feature_names = list(X.columns)

    X_tr, X_te, ys_tr, ys_te, yl_tr, yl_te, yt_tr, yt_te = train_test_split(
        X, y_score, y_level, y_trigger,
        test_size=0.20, random_state=42, stratify=y_level,
    )
    print(f"\nTrain: {len(X_tr):,}  |  Test: {len(X_te):,}")

    # ── Train ─────────────────────────────────────────────────────────────────
    risk_model,    risk_metrics    = train_risk_regressor(X_tr, X_te, ys_tr, ys_te)
    delay_model,   delay_metrics   = train_delay_classifier(X_tr, X_te, yl_tr, yl_te)
    trigger_model, trigger_metrics = train_trigger_classifier(X_tr, X_te, yt_tr, yt_te)

    # ── Feature importance ────────────────────────────────────────────────────
    print("\n── Feature Importances ────────────────────────────────────────────")
    print("\nRisk Regressor:")
    feature_importance_report(risk_model, feature_names)
    print("\nTrigger Classifier:")
    feature_importance_report(trigger_model, feature_names)

    # ── Save models ───────────────────────────────────────────────────────────
    print("\n── Saving models ──────────────────────────────────────────────────")
    joblib.dump(risk_model,    os.path.join(MODELS_DIR, "risk_score_model.pkl"),    compress=3)
    joblib.dump(delay_model,   os.path.join(MODELS_DIR, "delay_level_model.pkl"),   compress=3)
    joblib.dump(trigger_model, os.path.join(MODELS_DIR, "trigger_model.pkl"),       compress=3)

    # ── Save metadata ─────────────────────────────────────────────────────────
    metadata = {
        "trained_at":      pd.Timestamp.now().isoformat(),
        "n_training_rows": int(len(X_tr)),
        "n_test_rows":     int(len(X_te)),
        "feature_names":   feature_names,
        "n_features":      len(feature_names),
        "models": {
            "risk_score_regressor":       risk_metrics,
            "delay_level_classifier":     delay_metrics,
            "parametric_trigger_classifier": trigger_metrics,
        },
        "thresholds": {
            "risk_score":  {"low": 0, "moderate": 40, "high": 60, "critical": 80},
            "trigger_prob_min": 0.50,
        },
        "data_stats": {
            "trigger_rate_pct":  round(float(df["parametric_trigger"].mean() * 100), 1),
            "avg_risk_score":    round(float(df["risk_score"].mean()), 2),
            "months_covered":    list(range(1, 13)),
        },
    }
    with open(os.path.join(MODELS_DIR, "model_metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  risk_score_model.pkl")
    print(f"  delay_level_model.pkl")
    print(f"  trigger_model.pkl")
    print(f"  model_metadata.json")
    print(f"\n{'='*60}")
    print("TRAINING COMPLETE")
    print(f"{'='*60}")
    print(f"Risk Regressor  → MAE={risk_metrics['mae']}  R²={risk_metrics['r2']}")
    print(f"Delay Classifier→ Accuracy={delay_metrics['accuracy']}  F1={delay_metrics['macro_f1']}")
    print(f"Trigger Clf     → AUC={trigger_metrics['roc_auc']}  Precision={trigger_metrics['trigger_precision']}")


if __name__ == "__main__":
    main()