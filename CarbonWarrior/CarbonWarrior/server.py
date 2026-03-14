from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import json
import os
import requests
import datetime
import time

app = Flask(__name__)
CORS(app)

# Airport Coordinates for Weather Fetching
AIRPORT_COORDS = {
    "DEL": {"lat": 28.5562, "lng": 77.1000},
    "BOM": {"lat": 19.0896, "lng": 72.8656},
    "BLR": {"lat": 13.1986, "lng": 77.7066},
    "MAA": {"lat": 12.9941, "lng": 80.1709},
    "CCU": {"lat": 22.6547, "lng": 88.4467},
    "HYD": {"lat": 17.2403, "lng": 78.4294},
    "AMD": {"lat": 23.0771, "lng": 72.6347},
    "PNQ": {"lat": 18.5822, "lng": 73.9197},
    "GOI": {"lat": 15.3808, "lng": 73.8314},
    "JAI": {"lat": 26.8242, "lng": 75.8122},
}

# Regional Fuel Prices ($/kg)
FUEL_PRICES = {
    "DEL": 0.82, "BOM": 0.88, "BLR": 0.85, "MAA": 0.86, "CCU": 0.84,
    "HYD": 0.83, "AMD": 0.81, "PNQ": 0.87, "GOI": 0.92, "JAI": 0.80,
    "DEFAULT": 0.85
}

SAVED_ROUTES_FILE = "data/saved_routes.json"
os.makedirs("data", exist_ok=True)
if not os.path.exists(SAVED_ROUTES_FILE):
    with open(SAVED_ROUTES_FILE, "w") as f:
        json.dump([], f)

# Weather Cache
weather_cache = {
    "data": {},
    "timestamp": 0
}
CACHE_DURATION = 600  # 10 minutes

def fetch_live_weather():
    global weather_cache
    current_time = time.time()
    
    if current_time - weather_cache["timestamp"] < CACHE_DURATION and weather_cache["data"]:
        return weather_cache["data"]

    weather_report = {}
    try:
        for code, coords in AIRPORT_COORDS.items():
            url = f"https://api.open-meteo.com/v1/forecast?latitude={coords['lat']}&longitude={coords['lng']}&current_weather=true"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()["current_weather"]
                weather_report[code] = {
                    "temp": round(data["temperature"]),
                    "condition": get_condition_from_code(data["weathercode"]),
                    "wind_speed": round(data["windspeed"]),
                    "wind_dir": get_wind_dir(data["winddirection"])
                }
            else:
                weather_report[code] = {"temp": 25, "condition": "Clear", "wind_speed": 10, "wind_dir": "N"}
        
        weather_cache["data"] = weather_report
        weather_cache["timestamp"] = current_time
        return weather_report
    except Exception as e:
        print(f"Weather Fetch Error: {e}")
        return weather_cache["data"] if weather_cache["data"] else {}

def get_condition_from_code(code):
    codes = {
        0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
        45: "Foggy", 48: "Foggy", 51: "Drizzle", 61: "Rain", 71: "Snow",
        80: "Showers", 95: "Thunderstorm"
    }
    return codes.get(code, "Clear")

def get_wind_dir(deg):
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    idx = round(deg / 45) % 8
    return dirs[idx]

@app.route('/api/weather', methods=['GET'])
def get_weather():
    """Returns real-time weather data for all supported airports."""
    return jsonify(fetch_live_weather())

@app.route('/api/wind-currents', methods=['GET'])
def get_wind_currents():
    """Generates dynamic wind current vectors for visualization."""
    currents = []
    for i in range(10):
        currents.append({
            "start": {"lat": 10 + random.random()*15, "lng": 70 + random.random()*15},
            "end": {"lat": 12 + random.random()*15, "lng": 72 + random.random()*15},
            "intensity": random.random()
        })
    return jsonify(currents)

@app.route('/api/fuel-prices', methods=['GET'])
def get_fuel_prices():
    """Returns baseline fuel prices for airports."""
    return jsonify(FUEL_PRICES)

@app.route('/api/save-route', methods=['POST'])
def save_route():
    """Saves an optimized route to the local JSON store."""
    route_data = request.json
    try:
        with open(SAVED_ROUTES_FILE, "r") as f:
            saved = json.load(f)
        
        route_data["timestamp"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        route_data["id"] = random.randint(10000, 99999)
        
        saved.insert(0, route_data)
        saved = saved[:10]
        
        with open(SAVED_ROUTES_FILE, "w") as f:
            json.dump(saved, f, indent=2)
        
        return jsonify({"status": "success", "message": "Route saved successfully."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/saved-routes', methods=['GET'])
def get_saved_routes():
    """Retrieves history of saved routes."""
    try:
        with open(SAVED_ROUTES_FILE, "r") as f:
            return jsonify(json.load(f))
    except:
        return jsonify([])

if __name__ == '__main__':
    print("CarbonWarrior Weather Intelligence Server Starting on port 5000...")
    app.run(port=5000, debug=True)
