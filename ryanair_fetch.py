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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Origin": "https://ryanair.com",
        "Referer": "https://ryanair.com/ie/en/cheap-flights"
    }
    res = session.get(url, params=params, headers=headers, timeout=10)
    if res.status_code == 403:
        raise Exception("Ryanair rate-limited requests (403). Wait 10 seconds and try again.")
    res.raise_for_status()
    return res.json().get("fares", list())

def fetch_deals(origin, dest, duration_type, max_budget, specific_date="", target_weekday=""):
    session = requests.Session()
    today = datetime.now().date()
    deals = list()
    seen_ids = set()
    weekday_int = int(target_weekday) if target_weekday.isdigit() else None

    try:
        if duration_type == "daytrip":
            if specific_date:
                windows = [(specific_date, specific_date)]
            elif weekday_int is not None:
                # Find the next 10 occurrences of that exact day of the week (e.g. next 10 Saturdays)
                days_ahead = (weekday_int - today.weekday()) % 7
                first_match = today + timedelta(days=days_ahead)
                windows = [
                    ((first_match + timedelta(days=w * 7)).strftime("%Y-%m-%d"),
                     (first_match + timedelta(days=w * 7)).strftime("%Y-%m-%d"))
                    for w in range(10)
                ]
            else:
                windows = [
                    ((today + timedelta(days=idx * 6)).strftime("%Y-%m-%d"),
                     (today + timedelta(days=idx * 6 + 5)).strftime("%Y-%m-%d"))
                    for idx in range(10)
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
                time.sleep(0.15)

                valid_out = list()
                needed_origins = set()
                for item in out_fares:
                    leg = item.get("outbound", dict())
                    price = item.get("summary", dict()).get("price", dict()).get("value")
                    if not leg or price is None or float(price) > max_budget:
                        continue
                    arr_code = leg.get("arrivalAirport", dict()).get("iataCode", "")
                    if dest == "LON" and arr_code not in ("STN", "LGW", "LTN"):
                        continue
                    if dest == "ESP" and arr_code not in SPANISH_AIRPORTS:
                        continue
                    valid_out.append((leg, float(price)))
                    needed_origins.add(arr_code)

                if not valid_out:
                    continue

                in_by_key = dict()
                for dep_code in list(needed_origins)[:25]:
                    in_params = {
                        "departureAirportIataCode": dep_code,
                        "arrivalAirportIataCode": origin,
                        "outboundDepartureDateFrom": w_start,
                        "outboundDepartureDateTo": w_end,
                        "currency": "EUR",
                        "limit": 60
                    }
                    in_fares = query_ryanair_oneway(session, in_params)
                    time.sleep(0.15)

                    for item in in_fares:
                        leg = item.get("outbound", dict())
                        price = item.get("summary", dict()).get("price", dict()).get("value")
                        if not leg or price is None:
                            continue
                        dep_date = leg.get("departureDate", "")[:10]
                        in_by_key.setdefault(f"{dep_code}_{dep_date}", list()).append((leg, float(price)))

                for out_leg, out_price in valid_out:
                    dest_code = out_leg["arrivalAirport"]["iataCode"]
                    dest_name = f"{out_leg['arrivalAirport']['name']}, {out_leg['arrivalAirport']['countryName']}"
                    d_str = out_leg["departureDate"][:10]

                    for in_leg, in_price in in_by_key.get(f"{dest_code}_{d_str}", list()):
                        total = round(out_price + in_price, 2)
                        if total > max_budget:
                            continue

                        out_dep = datetime.fromisoformat(out_leg["departureDate"])
                        out_arr = datetime.fromisoformat(out_leg["arrivalDate"])
                        in_dep = datetime.fromisoformat(in_leg["departureDate"])
                        in_arr = datetime.fromisoformat(in_leg["arrivalDate"])

                        hours_on_ground = (in_dep - out_arr).total_seconds() / 3600
                        if hours_on_ground < 5.0:
                            continue

                        unique_key = f"{dest_code}_{d_str}_{out_leg['flightNumber']}_{in_leg['flightNumber']}"
                        if unique_key in seen_ids:
                            continue
                        seen_ids.add(unique_key)

                        deals.append({
                            "id": unique_key,
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
            min_nights, max_nights = NIGHT_RANGES.get(duration_type, (2, 7))
            if specific_date:
                base_dt = datetime.strptime(specific_date, "%Y-%m-%d").date()
                out_from, out_to = specific_date, specific_date
                in_from = (base_dt + timedelta(days=min_nights)).strftime("%Y-%m-%d")
                in_to = (base_dt + timedelta(days=max_nights)).strftime("%Y-%m-%d")
            else:
                end_window = today + timedelta(days=75)
                out_from = today.strftime("%Y-%m-%d")
                out_to = (end_window - timedelta(days=min_nights)).strftime("%Y-%m-%d")
                in_from = (today + timedelta(days=min_nights)).strftime("%Y-%m-%d")
                in_to = end_window.strftime("%Y-%m-%d")

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
            time.sleep(0.18)

            by_dest = dict()
            for item in out_fares:
                leg = item.get("outbound", dict())
                price = item.get("summary", dict()).get("price", dict()).get("value")
                if not leg or price is None or float(price) > max_budget:
                    continue
                out_dt = datetime.fromisoformat(leg["departureDate"])
                if weekday_int is not None and out_dt.weekday() != weekday_int:
                    continue
                arr_code = leg.get("arrivalAirport", dict()).get("iataCode", "")
                if dest == "LON" and arr_code not in ("STN", "LGW", "LTN"):
                    continue
                if dest == "ESP" and arr_code not in SPANISH_AIRPORTS:
                    continue
                by_dest.setdefault(arr_code, list()).append((leg, float(price)))

            for dest_code, out_list in list(by_dest.items())[:25]:
                in_params = {
                    "departureAirportIataCode": dest_code,
                    "arrivalAirportIataCode": origin,
                    "outboundDepartureDateFrom": in_from,
                    "outboundDepartureDateTo": in_to,
                    "currency": "EUR",
                    "limit": 100
                }
                in_fares = query_ryanair_oneway(session, in_params)
                time.sleep(0.15)

                for out_leg, out_price in out_list:
                    out_dep = datetime.fromisoformat(out_leg["departureDate"])
                    out_arr = datetime.fromisoformat(out_leg["arrivalDate"])
                    dest_name = f"{out_leg['arrivalAirport']['name']}, {out_leg['arrivalAirport']['countryName']}"

                    for item in in_fares:
                        in_leg = item.get("outbound", dict())
                        in_price = item.get("summary", dict()).get("price", dict()).get("value")