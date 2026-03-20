import random
from datetime import datetime


def get_traffic():

    now = datetime.now()
    hour = now.hour
    weekday = now.weekday()  # 0=Mon, 6=Sun

    # Weekend traffic usually lighter
    if weekday >= 5:
        return random.choice(["normal", "moderate"])

    # Morning rush hour
    if 7 <= hour <= 10:
        return random.choice(["heavy", "heavy", "moderate"])

    # Evening rush hour
    if 17 <= hour <= 20:
        return random.choice(["heavy", "heavy", "moderate"])

    # Midday moderate traffic
    if 11 <= hour <= 16:
        return random.choice(["moderate", "normal"])

    # Late night
    return "normal"