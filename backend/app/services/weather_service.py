import requests

API_KEY = "42d6b4094f5a43c39eb83334261503"

def get_weather(lat, lon):

    url = f"http://api.weatherapi.com/v1/current.json?key={API_KEY}&q={lat},{lon}"

    res = requests.get(url)

    data = res.json()

    # Safety check if API fails
    if "current" not in data:
        return "normal"

    condition = data["current"]["condition"]["text"].lower()

    if any(word in condition for word in ["rain", "drizzle", "storm", "thunder"]):
        return "rain"

    return "normal"