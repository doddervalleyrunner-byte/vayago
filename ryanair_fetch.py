import sys, json, time, requests
from datetime import datetime, timedelta

SPANISH = {"MAD","BCN","GRO","REU","AGP","ALC","VLC","SVQ","PMI","IBZ","RMU","SDR","SCQ","OVD","CDT","ZAZ","TFS","ACE","LPA","FUE"}
NIGHTS = {"weekend": (2, 3), "shortbreak": (4, 5), "week": (6, 8), "twoweeks": (10, 14)}
HDRS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0", "Accept": "application/json", "Origin": "https://ryanair.com", "Referer": "https://ryanair.com/ie/en/cheap-flights"}

def get_fares(s, params):
    r = s.get("https://ryanair.com", params=params, headers=HDRS, timeout=10)
    if r.status_code == 403 or not r.text.strip():
        raise Exception("Ryanair blocked Render cloud IP. Run VayaGo locally on your Wi-Fi for unrestricted access.")
    r.raise_for_status()
    return r.json().get("fares", [])

def ok_dest(code, dest):
    if dest == "LON": return code in ("STN", "LGW", "LTN")
    if dest == "ESP": return code in SPANISH
    return True

def make_deal(uid, origin, name, code, total, tier, o_leg, i_leg, pred):
    return {"id": uid, "origin": origin, "destination": f"{name} ({code})", "total_price": total, "deal_tier": tier, "out_dep_time": o_leg["departureDate"], "outbound_time": o_leg["arrivalDate"], "inbound_time": i_leg["departureDate"], "in_arr_time": i_leg["arrivalDate"], "flight_number": f"{o_leg['flightNumber']} / {i_leg['flightNumber']}", "prediction": pred}

def fetch_deals(origin, dest, dur, budget, s_date="", w_day=""):
    s, today, deals, seen = requests.Session(), datetime.now().date(), [], set()
    w_int = int(w_day) if w_day.isdigit() else None
    try:
        try: s.get("https://ryanair.com/ie/en", headers=HDRS, timeout=5)
        except Exception: pass

        if dur == "daytrip":
            if s_date: wins = [(s_date, s_date)]
            elif w_int is not None:
                f = today + timedelta(days=(w_int - today.weekday()) % 7)
                wins = [((f + timedelta(days=w*7)).strftime("%Y-%m-%d"), (f + timedelta(days=w*7)).strftime("%Y-%m-%d")) for w in range(6)]
            else:
                wins = [((today + timedelta(days=i*10)).strftime("%Y-%m-%d"), (today + timedelta(days=i*10+9)).strftime("%Y-%m-%d")) for i in range(4)]

            for ws, we in wins:
                p = {"departureAirportIataCode": origin, "outboundDepartureDateFrom": ws, "outboundDepartureDateTo": we, "currency": "EUR", "limit": 200}
                if dest and dest not in ("LON", "ESP"): p["arrivalAirportIataCode"] = dest
                out_f = get_fares(s, p)
                time.sleep(0.15)
                v_out, origs = [], set()
                for it in out_f:
                    lg, pr = it.get("outbound", {}), it.get("summary", {}).get("price", {}).get("value")
                    if lg and pr is not None and float(pr) <= budget and ok_dest(lg["arrivalAirport"]["iataCode"], dest):
                        v_out.append((lg, float(pr))); origs.add(lg["arrivalAirport"]["iataCode"])
                in_map = {}
                for dep in list(origs)[:12]:
                    for it in get_fares(s, {"departureAirportIataCode": dep, "arrivalAirportIataCode": origin, "outboundDepartureDateFrom": ws, "outboundDepartureDateTo": we, "currency": "EUR", "limit": 60}):
                        lg, pr = it.get("outbound", {}), it.get("summary", {}).get("price", {}).get("value")
                        if lg and pr is not None: in_map.setdefault(f"{dep}_{lg['departureDate'][:10]}", []).append((lg, float(pr)))
                    time.sleep(0.15)
                for o_lg, o_pr in v_out:
                    c, ds = o_lg["arrivalAirport"]["iataCode"], o_lg["departureDate"][:10]
                    nm = f"{o_lg['arrivalAirport']['name']}, {o_lg['arrivalAirport']['countryName']}"
                    for i_lg, i_pr in in_map.get(f"{c}_{ds}", []):
                        tot = round(o_pr + i_pr, 2)
                        hrs = (datetime.fromisoformat(i_lg["departureDate"]) - datetime.fromisoformat(o_lg["arrivalDate"])).total_seconds()
                        uid = f"{c}_{ds}_{o_lg['flightNumber']}_{i_lg['flightNumber']}"
                        if tot <= budget and hrs >= 18000 and uid not in seen:
                            seen.add(uid)
                            deals.append(make_deal(uid, origin, nm, c, tot, "⚡ Extreme Saver" if tot < 45 else "⚡ Same-Day Return", o_lg, i_lg, 99))
        else:
            mn, mx = NIGHTS.get(dur, (2, 7))
            if s_date:
                b = datetime.strptime(s_date, "%Y-%m-%d").date()
                of, ot, inf, int_d = s_date, s_date, (b + timedelta(days=mn)).strftime("%Y-%m-%d"), (b + timedelta(days=mx)).strftime("%Y-%m-%d")
            else:
                end = today + timedelta(days=60)
                of, ot, inf, int_d = today.strftime("%Y-%m-%d"), (end - timedelta(days=mn)).strftime("%Y-%m-%d"), (today + timedelta(days=mn)).strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
            p = {"departureAirportIataCode": origin, "outboundDepartureDateFrom": of, "outboundDepartureDateTo": ot, "currency": "EUR", "limit": 200}
            if dest and dest not in ("LON", "ESP"): p["arrivalAirportIataCode"] = dest
            by_d = {}
            for it in get_fares(s, p):
                lg, pr = it.get("outbound", {}), it.get("summary", {}).get("price", {}).get("value")
                if lg and pr is not None and float(pr) <= budget:
                    c = lg["arrivalAirport"]["iataCode"]
                    if (w_int is None or datetime.fromisoformat(lg["departureDate"]).weekday() == w_int) and ok_dest(c, dest):
                        by_d.setdefault(c, []).append((lg, float(pr)))
            time.sleep(0.15)
            for c, o_list in list(by_d.items())[:15]:
                in_f = get_fares(s, {"departureAirportIataCode": c, "arrivalAirportIataCode": origin, "outboundDepartureDateFrom": inf, "outboundDepartureDateTo": int_d, "currency": "EUR", "limit": 100})
                time.sleep(0.15)
                for o_lg, o_pr in o_list:
                    od = datetime.fromisoformat(o_lg["departureDate"]).date()
                    nm = f"{o_lg['arrivalAirport']['name']}, {o_lg['arrivalAirport']['countryName']}"
                    for it in in_f:
                        i_lg, i_pr = it.get("outbound", {}), it.get("summary", {}).get("price", {}).get("value")
                        if i_lg and i_pr is not None:
                            id_dt = datetime.fromisoformat(i_lg["departureDate"]).date()
                            nts, tot = (id_dt - od).days, round(o_pr + float(i_pr), 2)
                            uid = f"{c}_{od}_{id_dt}"
                            if mn <= nts <= mx and tot <= budget and uid not in seen:
                                seen.add(uid)
                                deals.append(make_deal(uid, origin, nm, c, tot, f"🌴 {nts} Nights (Back {id_dt.strftime('%d %b')})", o_lg, i_lg, 98))

        deals.sort(key=lambda x: x["total_price"])
        print(json.dumps({"status": "success", "deals": deals[:50]}))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))

if __name__ == "__main__":
    a = sys.argv[1:]
    fetch_deals(a[0] if len(a)>0 else "DUB", a[1] if len(a)>1 else "", a[2] if len(a)>2 else "daytrip", float(a[3]) if len(a)>3 else 250.0, a[4] if len(a)>4 else "", a[5] if len(a)>5 else "")