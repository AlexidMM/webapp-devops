#!/usr/bin/env bash
set -euo pipefail

source <(sudo cat /opt/monitor/oo.env)

sudo docker logs --tail 200 webapp-container 2>&1 | grep '^{' | python3 -c 'import sys,json
out=[]
for line in sys.stdin:
    try: r=json.loads(line)
    except Exception: continue
    out.append({"timestamp":r.get("timestamp",""),"timestamp_mx":r.get("timestamp_mx",""),"severity":str(r.get("level","info")).upper(),"body":r.get("message",""),"method":r.get("method",""),"url":r.get("url",""),"route":r.get("route",""),"statusCode":r.get("statusCode",0),"responseTimeMs":r.get("responseTimeMs",0),"trace_id":r.get("trace_id",""),"span_id":r.get("span_id","")})
print(json.dumps(out))' > /tmp/app_logs_batch.json

[ "$(python3 -c 'import json;print(len(json.load(open("/tmp/app_logs_batch.json"))))')" -gt 0 ] || exit 0

curl -sf -X POST "$OO_URL/api/default/app_logs/_json" \
  -H "Content-Type: application/json" \
  -u "$OO_USER:$OO_PASS" \
  --data-binary @/tmp/app_logs_batch.json >/dev/null
