import os
import json
import subprocess
import requests
from datetime import datetime

def get_top_deals(origin="DUB", duration="daytrip", max_budget="65"):
    result = subprocess.run(
        ["python", "ryanair_fetch.py", origin, "", duration, max_budget],
        capture_output=True,
        text=True
    )
    data = json.loads(result.stdout.strip())
    if data.get("status") != "success":
        return []
    return data.get("deals", [])[:8]

def build_email_html(deals):
    rows = ""
    for d in deals:
        dep_dt = datetime.fromisoformat(d["out_dep_time"])
        arr_dt = datetime.fromisoformat(d["outbound_time"])
        ret_dt = datetime.fromisoformat(d["inbound_time"])
        date_str = dep_dt.strftime("%a %d %b")
        hrs = int((ret_dt - arr_dt).total_seconds() // 3600)
        mins = int(((ret_dt - arr_dt).total_seconds() % 3600) // 60)

        rows += f"""
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-weight: bold; color: #003893;">{d['destination']}</td>
            <td style="padding: 10px;">{date_str}</td>
            <td style="padding: 10px;">{dep_dt.strftime('%H:%M')} &rarr; {ret_dt.strftime('%H:%M')}</td>
            <td style="padding: 10px;">{hrs}h {mins}m</td>
            <td style="padding: 10px; font-weight: bold; color: #CE1126;">&euro;{d['total_price']:.2f}</td>
        </tr>
        """

    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: auto; border: 2px solid #FCD116; border-radius: 16px; overflow: hidden;">
        <div style="background: #003893; color: white; padding: 20px; border-bottom: 4px solid #FCD116;">
            <h2 style="margin: 0;">VAYA<span style="color: #FCD116;">GO</span> Daily Fare Alert</h2>
            <p style="margin: 5px 0 0; font-size: 13px; color: #dbeafe;">Top same-day European escapes from Dublin under &euro;65</p>
        </div>
        <div style="padding: 16px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <thead>
                    <tr style="background: #f8fafc; color: #003893;">
                        <th style="padding: 10px;">Destination</th>
                        <th style="padding: 10px;">Date</th>
                        <th style="padding: 10px;">Flights</th>
                        <th style="padding: 10px;">Explore</th>
                        <th style="padding: 10px;">Return</th>
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>
        </div>
    </div>
    """

def send_alert():
    api_key = os.environ.get("RESEND_API_KEY2")
    recipient = os.environ.get("ALERT_RECIPIENT")

    if not api_key or not recipient:
        print("Missing RESEND_API_KEY2 or ALERT_RECIPIENT.")
        return

    deals = get_top_deals()
    if not deals:
        print("No deals found under budget today.")
        return

    cheapest_price = deals[0]["total_price"]

    res = requests.post(
        "https://resend.com",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        json={
            "from": "VayaGo Alerts <onboarding@resend.dev>",
            "to": [recipient],
            "subject": f"✈️ VayaGo Alert: {len(deals)} Dublin Daytrips from €{cheapest_price:.2f}",
            "html": build_email_html(deals)
        },
        timeout=10
    )
    print("Status:", res.status_code, res.text)

if __name__ == "__main__":
    send_alert()