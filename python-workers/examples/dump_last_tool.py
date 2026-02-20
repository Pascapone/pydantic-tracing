import sqlite3
import json

db = sqlite3.connect('traces.db')
c = db.cursor()

# Get the last trace id
c.execute("SELECT id FROM traces ORDER BY rowid DESC LIMIT 1")
trace_id = c.fetchone()[0]

print(f"Latest trace_id: {trace_id}")

print("\n--- Delegation Spans ---")
c.execute("SELECT name, attributes FROM spans WHERE trace_id = ? AND span_type = 'agent.delegation'", (trace_id,))
rows = c.fetchall()

for row in rows:
    name, attr_json = row
    attr = json.loads(attr_json)
    print(f"\nSpan: {name}")
    print(f"Status: {attr.get('result.status')}")
    print(f"Error: {attr.get('result.error', 'None')}")
    print(f"Result JSON: {attr.get('delegation.result', 'None')}")

