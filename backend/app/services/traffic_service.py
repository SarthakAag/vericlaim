import random
from datetime import datetime


def get_traffic():

    hour = datetime.now().hour

    # rush hour
    if 8 <= hour <= 10 or 17 <= hour <= 20:
        return "heavy"

    # moderate hours
    if 11 <= hour <= 16:
        return random.choice(["moderate","normal"])

    return "normal"