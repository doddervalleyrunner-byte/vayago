from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import random

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REAL_ROUTE_NETWORK = {
    "daytrip": [
        {
            "route_id": "1", "carrier": "Aer Lingus", "base": 24.99, "dest": "LHR", "tier": "Business Commuter Special",
            "out_code": "EI152", "out_dep": "06:40", "out_arr": "08:15",
            "ret_code": "EI179", "ret_dep": "21:10", "ret_arr": "22:30"
        },
        {
            "route_id": "2", "carrier": "British Airways", "base": 29.99, "dest": "LHR", "tier": "Premium Day Escape",
            "out_code": "BA827", "out_dep": "07:15", "out_arr": "08:45",
            "ret_code": "BA822", "ret_dep": "20:45", "ret_arr": "22:10"
        },
        {
            "route_id": "3", "carrier": "Ryanair", "base": 14.99, "dest": "LGW", "tier": "Extreme Daytrip Radar",
            "out_code": "FR114", "out_dep": "06:15", "out_arr": "07:45",
            "ret_code": "FR119", "ret_dep": "22:25", "ret_arr": "23:55"
        },
        {
            "route_id": "4", "carrier": "Ryanair", "base": 12.50, "dest": "STN", "tier": "Ultra Low Cost Arc",
            "out_code": "FR202", "out_dep": "06:25", "out_arr": "07:40",
            "ret_code": "FR291", "ret_dep": "23:15", "ret_arr": "00:30"
        }
    ],
    "weekend": [
        {
            "route_id": "1", "carrier": "Aer Lingus", "base": 55.00, "dest": "CDG", "tier": "Paris Weekend Saver",
            "out_code": "EI524", "out_dep": "08:20", "out_arr": "11:05",
            "ret_code": "EI529", "ret_dep": "21:55", "ret_arr": "22:40"
        }
    ],
    "longhaul": [
        {
            "route_id": "1", "carrier": "Avianca", "base": 415.00, "dest": "BOG", "tier": "Intercontinental Economy",
            "out_code": "AV121", "out_dep": "22:15", "out_arr": "04:10",
            "ret_code": "AV120", "ret_dep": "23:20", "ret_arr": "15:00"
        }
    ]
}

class SearchRequest(BaseModel):
    origin: str
    destination: str
    trip_duration_type: str
    max_budget: Optional[float] = 150.0
    baggage_type: Optional[str] = "none"
    allow_split_tickets: Optional[bool] = True

@app.post("/search")
async def search_flights(req: SearchRequest):
    # FIXED: Safely extracts airport code text profiles without throwing string split exceptions
    def extract_code(val: str, default: str):
        if "(" in val and ")" in val:
            try:
                return val.split("(")[1].split(")")[0].strip().upper()
            except Exception:
                return default
        return default

    origin_code = extract_code(req.origin, "DUB")
    user_destination = extract_code(req.destination, "").strip()

    mission_key = req.trip_duration_type if req.trip_duration_type in REAL_ROUTE_NETWORK else "daytrip"
    routes = REAL_ROUTE_NETWORK[mission_key]

    baggage_fee = 0.0
    if req.baggage_type == "cabin":
        baggage_fee = 18.50
    elif req.baggage_type == "checked":
        baggage_fee = 38.00

    # Dynamically calculates upcoming calendar dates
    next_saturday = datetime.now() + timedelta(days=(5 - datetime.now().weekday()) % 7 + 7)
    travel_date = next_saturday.strftime("%d %b %Y")
    return_date = travel_date if mission_key == "daytrip" else (next_saturday + timedelta(days=2)).strftime("%d %b %Y")

    output_deals = []
    for r in routes:
        calculated_total = round(r["base"] + baggage_fee, 2)
        if user_destination and user_destination != "EVERYWHERE" and r["dest"] != user_destination:
            continue
        if calculated_total > req.max_budget:
            continue

        arr_hour = int(r["out_arr"].split(":")[0])
        ret_hour = int(r["ret_dep"].split(":")[0])
        hours_on_ground = ret_hour - arr_hour

        output_deals.append({
            "id": f"deal-{r['route_id']}-{mission_key}",
            "origin": f"{origin_code} ({r['carrier']})",
            "destination": f"{r['dest']}",
            "total_price": calculated_total,
            "deal_tier": r["tier"],
            "prediction": random.randint(85, 98),
            "date": travel_date,
            "return_date": return_date,
            "outbound_schedule": f"🛫 {r['out_code']} Dep: {r['out_dep']} ➔ Arr: {r['out_arr']}",
            "return_schedule": f"🛬 {r['ret_code']} Dep: {r['ret_dep']} ➔ Arr: {r['ret_arr']}",
            "ground_time": f"⏱️ {hours_on_ground}h on ground"
        })

    return {"status": "success", "deals": output_deals}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)