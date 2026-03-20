import math


# Calculate distance between 2 GPS points (km)
def calculate_distance(lat1, lon1, lat2, lon2):

    R = 6371  # Earth radius in km

    lat1 = math.radians(lat1)
    lon1 = math.radians(lon1)
    lat2 = math.radians(lat2)
    lon2 = math.radians(lon2)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


# Calculate driver speed (km/h)
def calculate_speed(distance_km, time_minutes):

    if time_minutes == 0:
        return 0

    speed = (distance_km / time_minutes) * 60
    return round(speed, 2)


# Detect if driver is stuck
def detect_stuck(driver_speed):

    if driver_speed < 5:
        return True

    return False