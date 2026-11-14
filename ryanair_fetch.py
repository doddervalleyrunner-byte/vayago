import sys
import json
import time
import requests
from datetime import datetime, timedelta

SPANISH_AIRPORTS = {
    "MAD", "BCN", "GRO", "REU", "AGP", "ALC", "VLC", "SVQ",
    "PMI", "IBZ", "RMU", "SDR", "SCQ", "OVD", "CDT", "ZAZ",
    "TFS", "ACE", "LPA", "FUE"
}

NIGHT_RANGES = {
    "weekend": (2, 3),
    "shortbreak": (4, 5),
    "week": (6, 8),
    "twoweeks": (10, 14)
}

def query_ryanair_oneway(session, params):
    url = "https://ryanair.com"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://ryanair.com",
        "Referer": "https://ryanair.com/ie/en/cheap-flights"
    }
    res = session.get(url, params=params, headers=headers, timeout=8)
    if res.status_code == 403:
        raise Exception("Ryanair blocked cloud server IP (403).")
    res.raise_for_status()
    return res.json().get("fares", [])

def fetch_deals(origin, dest, duration_type, max_budget, specific_date="", target_weekday=""):
    session = requests.Session()
    today = datetime.now().date()
    deals = []
    seen_ids = set()
    weekday_int = int(target_weekday) if target_weekday.isdigit() else None

    try:
        if duration_type == "daytrip":
            if specific_date:
                windows = [(specific_date, specific_date)]
            elif weekday_int is not None:
                days_ahead = (weekday_int - today.weekday()) % 7
                first_match = today + timedelta(days=days_ahead)
                windows = [
                    ((first_match + timedelta(days=w * 7)).strftime("%Y-%m-%d"),
                     (first_match + timedelta(days=w * 7)).strftime("%Y-%m-%d"))
                    for w in range(6)
                ]
            else:
                windows = [
                    ((today + timedelta(days=idx * 10)).strftime("%Y-%m-%d"),
                     (today + timedelta(days=idx * 10 + 9)).strftime("%Y-%m-%d"))
                    for idx in range(4)
                ]

            for w_start, w_end in windows:
                out_params = {
                    "departureAirportIataCode": origin,
                    "outboundDepartureDateFrom": w_start,
                    "outboundDepartureDateTo": w_end,
                    "currency": "EUR",
                    "limit": 200
                }
                if dest and dest not in ("LON", "ESP"):
                    out_params["arrivalAirportIataCode"] = dest

                out_fares = query_ryanair_oneway(session, out_params)
                time.sleep(0.1)

                valid_out = []
                needed_origins = set()
                for item in out_fares:
                    leg = item.get("outbound", {})
                    price = item.get("summary", {}).get("price", {}).get("value")
                    if not leg or price is None or float(price) > max_budget:
                        continue
                    arr_code = leg.get("arrivalAirport", {}).get("iataCode", "")
                    if dest == "LON" and arr_code not in ("STN", "LGW", "LTN"):
                        continue
                    if dest == "ESP" and arr_code not in SPANISH_AIRPORTS:
                        continue
                    valid_out.append((leg, float(price)))
                    needed_origins.add(arr_code)

                if not valid_out:
                    continue

                in_by_key = {}
                for dep_code in list(needed_origins)[:12]:
                    in_params = {
                        "departureAirportIataCode": dep_code,
                        "arrivalAirportIataCode": origin,
                        "outboundDepartureDateFrom": w_start,
                        "outboundDepartureDateTo": w_end,
                        "currency": "EUR",
                        "limit": 60
                    }
                    in_fares = query_ryanair_oneway(session, in_params)
                    time.sleep(0.1)

                    for item in in_fares:
                        leg = item.get("outbound", {})
                        price = item.get("summary", {}).get("price", {}).get("value")
                        if not leg or price is None:
                            continue
                        dep_date = leg.get("departureDate", "")[:10]
                        in_by_key.setdefault(f"{dep_code}_{dep_date}", []).append((leg, float(price)))

                for out_leg, out_price in valid_out:
                    dest_code = out_leg["arrivalAirport"]["iataCode"]
                    dest_name = f"{out_leg['arrivalAirport']['name']}, {out_leg['arrivalAirport']['countryName']}"
                    d_str = out_leg["departureDate"][:10]

                    for in_leg, in_price in in_by_key.get(f"{dest_code}_{d_str}", []):
                        total = round(out_price + in_price, 2)
                        if total > max_budget:
                            continue

                        out_dep = datetime.fromisoformat(out_leg["departureDate"])
                        out_arr = datetime.fromisoformat(out_leg["arrivalDate"])
                        in_dep = datetime.fromisoformat(in_leg["departureDate"])
                        in_arr = datetime.fromisoformat(in_leg["arrivalDate"])

                        if (in_dep - out_arr).total_seconds() / 3600 < 5.0:
                            continue

                        uid = f"{dest_code}_{d_str}_{out_leg['flightNumber']}_{in_leg['flightNumber']}"
                        if uid in seen_ids:
                            continue
                        seen_ids.add(uid)

                        deals.append({
                            "id": uid,
                            "origin": origin,
                            "destination": f"{dest_name} ({dest_code})",
                            "total_price": total,
                            "deal_tier": "⚡ Extreme Saver" if total < 45 else "⚡ Same-Day Return",
                            "out_dep_time": out_dep.isoformat(),
                            "outbound_time": out_arr.isoformat(),
                            "inbound_time": in_dep.isoformat(),
                            "in_arr_time": in_arr.isoformat(),
                            "flight_number": f"{out_leg['flightNumber']} / {in_leg['flightNumber']}",
                            "prediction": 99
                        })
        else:
            min_n, max_n = NIGHT_RANGES.get(duration_type, (2, 7))
            if specific_date:
                base_dt = datetime.strptime(specific_date, "%Y-%m-%d").date()
                out_from, out_to = specific_date, specific_date
                in_from = (base_dt + timedelta(days=min_n)).strftime("%Y-%m-%d")
                in_to = (base_dt + timedelta(days=max_n)).strftime("%Y-%m-%d")
            else:
                end_win = today + timedelta(days=60)
                out_from = today.strftime("%Y-%m-%d")
                out_to = (end_win - timedelta(days=min_n)).strftime("%Y-%m-%d")
                in_from = (today + timedelta(days=min_n)).strftime("%Y-%m-%d")
                in_to = end_win.strftime("%Y-%m-%d")

            out_params = {
                "departureAirportIataCode": origin,
                "outboundDepartureDateFrom": out_from,
                "outboundDepartureDateTo": out_to,
                "currency": "EUR",
                "limit": 200
            }
            if dest and dest not in ("LON", "ESP"):
                out_params["arrivalAirportIataCode"] = dest

            out_fares = query_ryanair_oneway(session, out_params)
            time.sleep(0.1)

            by_dest = {}
            for item in out_fares:
                leg = item.get("outbound", {})
                price = item.get("summary", {}).get("price", {}).get("value")
                if not leg or price is None or float(price) > max_budget:
                    continue
                out_dt = datetime.fromisoformat(leg["departureDate"])
                if weekday_int is not None and out_dt.weekday() != weekday_int:
                    continue
                arr_code = leg.get("arrivalAirport", {}).get("iataCode", "")
                if dest == "LON" and arr_code not in ("STN", "LGW", "LTN"):
                    continue
                if dest == "ESP" and arr_code not in SPANISH_AIRPORTS:
                    continue
                by_dest.setdefault(arr_code, []).append((leg, float(price)))

            for dest_code, out_list in list(by_dest.items())[:15]:
                in_params = {
                    "departureAirportIataCode": dest_code,
                    "arrivalAirportIataCode": origin,
                    "outboundDepartureDateFrom": in_from,
                    "outboundDepartureDateTo": in_to,
                    "currency": "EUR",
                    "limit": 100
                }
                in_fares = query_ryanair_oneway(session, in_params)
                time.sleep(0.1)

                for out_leg, out_price in out_list:
                    out_dep = datetime.fromisoformat(out_leg["departureDate"])
                    out_arr = datetime.fromisoformat(out_leg["arrivalDate"])
                    dest_name = f"{out_leg['arrivalAirport']['name']}, {out_leg['arrivalAirport']['countryName']}"

                    for item in in_fares:
                        in_leg = item.get("outbound", {})
                        in_price = item.get("summary", {}).get("price", {}).get("value")
                        if not in_leg or in_price is None:
                            continue

                        in_dep = datetime.fromisoformat(in_leg["departureDate"])
                        in_arr = datetime.fromisoformat(in_leg["arrivalDate"])
                        nights = (in_dep.date() - out_dep.date()).days

                        if min_n <= nights <= max_n: