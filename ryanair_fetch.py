import sys, json, time, requests
from datetime import datetime, timedelta

SPANISH_AIRPORTS = {"MAD","BCN","GRO","REU","AGP","ALC","VLC","SVQ","PMI","IBZ","RMU","SDR","SCQ","OVD","CDT","ZAZ","TFS","ACE","LPA","FUE"}
NIGHT_RANGES = {"weekend": (2, 3), "shortbreak": (4, 5), "week": (6, 8), "twoweeks": (10, 14)}

def query_ryanair(session, params):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0",
        "Accept": "application/json",
        "Origin": "https://ryanair.com",
        "Referer": "https://ryanair.com/ie/en/cheap-flights"
    }
    res = session.get("https://ryanair.com", params=params, headers=headers, timeout=8)
    if res.status_code == 403:
        raise Exception("Ryanair blocked cloud IP (403).")
    res.raise_for_status()
    return res.json().get("fares", [])

def valid_dest(code, dest):
    if dest == "LON": return code in ("STN", "LGW", "LTN")
    if dest == "ESP": return code in SPANISH_AIRPORTS
    return True

def fetch_deals(origin, dest, duration_type, max_budget, specific_date="", target_weekday=""):
    session = requests.Session()
    today = datetime.now().date()
    deals, seen = [], set()
    w_int = int(target_weekday) if target_weekday.isdigit() else None

    try:
        if duration_type == "daytrip":
            if specific_date:
                windows = [(specific_date, specific_date)]
            elif w_int is not None:
                first = today + timedelta(days=(w_int - today.weekday()) % 7)
                windows = [((first + timedelta(days=w*7)).strftime("%Y-%m-%d"), (first + timedelta(days=w*7)).strftime("%Y-%m-%d")) for w in range(6)]
            else:
                windows = [((today + timedelta(days=i*10)).strftime("%Y-%m-%d"), (today + timedelta(days=i*10+9)).strftime("%Y-%m-%d")) for i in range(4)]

            for w_start, w_end in windows:
                p = {"departureAirportIataCode": origin, "outboundDepartureDateFrom": w_start, "outboundDepartureDateTo": w_end, "currency": "EUR", "limit": 200}
                if dest and dest not in ("LON", "ESP"): p["arrivalAirportIataCode"] = dest
                out_fares = query_ryanair(session, p)
                time.sleep(0.1)

                valid_out, origins = [], set()
                for item in out_fares:
                    leg, price = item.get("outbound", {}), item.get("summary", {}).get("price", {}).get("value")
                    if leg and price is not None and float(price) <= max_budget:
                        code = leg.get("arrivalAirport", {}).get("iataCode", "")
                        if valid_dest(code, dest):
                            valid_out.append((leg, float(price)))
                            origins.add(code)

                in_map = {}
                for dep in list(origins)[:12]:
                    in_fares = query_ryanair(session, {"departureAirportIataCode": dep, "arrivalAirportIataCode": origin, "outboundDepartureDateFrom": w_start, "outboundDepartureDateTo": w_end, "currency": "EUR", "limit": 60})
                    time.sleep(0.1)
                    for item in in_fares:
                        leg, price = item.get("outbound", {}), item.get("summary", {}).get("price", {}).get("value")
                        if leg and price is not None:
                            in_map.setdefault(f"{dep}_{leg['departureDate'][:10]}", []).append((leg, float(price)))

                for o_leg, o_price in valid_out:
                    code, d_str = o_leg["arrivalAirport"]["iataCode"], o_leg["departureDate"][:10]
                    name = f"{o_leg['arrivalAirport']['name']}, {o_leg['arrivalAirport']['countryName']}"
                    for i_leg, i_price in in_map.get(f"{code}_{d_str}", []):
                        total = round(o_price + i_price, 2)
                        o_dep, o_arr = datetime.fromisoformat(o_leg["departureDate"]), datetime.fromisoformat(o_leg["arrivalDate"])
                        i_dep, i_arr = datetime.fromisoformat(i_leg["departureDate"]), datetime.fromisoformat(i_leg["arrivalDate"])
                        uid = f"{code}_{d_str}_{o_leg['flightNumber']}_{i_leg['flightNumber']}"
                        if total <= max_budget and (i_dep - o_arr).total_seconds() >= 18000 and uid not in seen:
                            seen.add(uid)
                            deals.append({"id": uid, "origin": origin, "destination": f"{name} ({code})", "total_price": total, "deal_tier": "⚡ Extreme Saver" if total < 45 else "⚡ Same-Day Return", "out_dep_time": o_dep.isoformat(), "outbound_time": o_arr.isoformat(), "inbound_time": i_dep.isoformat(), "in_arr_time": i_arr.isoformat(), "flight_number": f"{o_leg['flightNumber']} / {i_leg['flightNumber']}", "prediction": 99})
        else:
            min_n, max_n = NIGHT_RANGES.get(duration_type, (2, 7))
            if specific_date:
                b = datetime.strptime(specific_date, "%Y-%m-%d").date()
                out_from, out_to, in_from, in_to = specific_date, specific_date, (b + timedelta(days=min_n)).strftime("%Y-%m-%d"), (b + timedelta(days=max_n)).strftime("%Y-%m-%d")
            else:
                end = today + timedelta(days=60)
                out_from, out_to, in_from, in_to = today.strftime("%Y-%m-%d"), (end - timedelta(days=min_n)).strftime("%Y-%m-%d"), (today + timedelta(days=min_n)).strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")

            p = {"departureAirportIataCode": origin, "outboundDepartureDateFrom": out_from, "outboundDepartureDateTo": out_to, "currency": "EUR", "limit": 200}
            if dest and dest not in ("LON", "ESP"): p["arrivalAirportIataCode"] = dest
            out_fares = query_ryanair(session, p)
            time.sleep(0.1)

            by_dest = {}
            for item in out_fares:
                leg, price = item.get("outbound", {}), item.get("summary", {}).get("price", {}).get("value")
                if leg and price is not None and float(price) <= max_budget:
                    code = leg.get("arrivalAirport", {}).get("iataCode", "")
                    if (w_int is None or datetime.fromisoformat(leg["departureDate"]).weekday() == w_int) and valid_dest(code, dest):
                        by_dest.setdefault(code, []).append((leg, float(price)))

            for code, out_list in list(by_dest.items())[:15]:
                in_fares = query_ryanair(session, {"departureAirportIataCode": code, "arrivalAirportIataCode": origin, "outboundDepartureDateFrom": in_from, "outboundDepartureDateTo": in_to, "currency": "EUR", "limit": 100})
                time.sleep(0.1)
                for o_leg, o_price in out_list:
                    o_dep, o_arr = datetime.fromisoformat(o_leg["departureDate"]), datetime.fromisoformat(o_leg["arrivalDate"])
                    name = f"{o_leg['arrivalAirport']['name']}, {o_leg['arrivalAirport']['countryName']}"
                    for item in in_fares:
                        i_leg, i_price = item.get("outbound", {}), item.get("summary", {}).get("price", {}).get("value")
                        if i_leg and i_price is not None:
                            i_dep, i_arr = datetime.fromisoformat(i_leg["departureDate"]), datetime.fromisoformat(i_leg["arrivalDate"])
                            nights = (i_dep.date() - o_dep.date()).days
                            total = round(o_price + float(i_price), 2)
                            uid = f"{code}_{o_dep.strftime('%Y-%m-%d')}_{i_dep.strftime('%Y-%m-%d')}"
                            if min_n <= nights <= max_n and total <= max_budget and uid not in seen:
                                seen.add(uid)
                                deals.append({"id": uid, "origin": origin, "destination": f"{name} ({code})", "total_price": total, "deal_tier": f"🌴 {nights} Nights (Back {i_dep.strftime('%d %b')})", "out_dep_time": o_dep.isoformat(), "outbound_time": o_arr.isoformat(), "inbound_time": i_dep.isoformat(), "in_arr_time": i_arr.isoformat(), "flight_number": f"{o_leg['flightNumber']} / {i_leg['flightNumber']}", "prediction": 98})

        deals.sort(key=lambda x: x["total_price"])
        print(json.dumps({"status": "success", "deals": deals[:50]}))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))

if __name__ == "__main__":
    a = sys.argv[1:]
    fetch_deals(a[0] if len(a)>0 else "DUB", a[1] if len(a)>1 else "", a[2] if len(a)>2 else "daytrip", float(a[3]) if len(a)>3 else 250.0, a[4] if len(a)>4 else "", a[5] if len(a)>5 else "")