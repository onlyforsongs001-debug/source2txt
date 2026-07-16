import requests, json

headers = {"Authorization": "Bearer rnd_wBAtli0qZql4fTBZrwHJU3kW01QK"}

r = requests.get("https://api.render.com/v1/services/srv-d9c6sbnavr4c73afuv80/deploys?limit=1", headers=headers)
data = r.json()

if isinstance(data, dict) and "deploy" in data:
    deploy_id = data["deploy"]["id"]
else:
    deploy_id = data[0]["deploy"]["id"]

print(f"Deploy ID: {deploy_id}")

r2 = requests.get(f"https://api.render.com/v1/services/srv-d9c6sbnavr4c73afuv80/deploys/{deploy_id}", headers=headers)
print(f"Status: {r2.status_code}")
if r2.status_code == 200:
    dep = r2.json()
    print(f"Keys: {list(dep.keys())}")
    print(f"Status: {dep.get('status')}")
    print(json.dumps(dep, indent=2))
