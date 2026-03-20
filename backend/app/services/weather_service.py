import requests

API_KEY = ""


def get_weather(lat, lon):

    url = f"http://api.weatherapi.com/v1/current.json?key={API_KEY}&q={lat},{lon}"

    try:
        res = requests.get(url, timeout=5)
        data = res.json()

        if "current" not in data:
            return "normal"

        condition = data["current"]["condition"]["text"].lower()

        rain_keywords = [
            "rain",
            "drizzle",
            "storm",
            "thunder",
            "shower",
            "snow",
            "sleet"
        ]

        if any(word in condition for word in rain_keywords):
            return "rain"

        return "normal"

    except Exception:
        # If API fails, system will not crash
        return "normal"