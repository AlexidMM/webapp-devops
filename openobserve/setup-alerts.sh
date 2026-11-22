#!/usr/bin/env bash
set -euo pipefail

if [ ! -f /opt/monitor/oo.env ]; then
  echo "Falta /opt/monitor/oo.env"
  exit 1
fi

source /opt/monitor/oo.env

AUTH=$(printf '%s' "$OO_USER:$OO_PASS" | base64 -w0)
API="$OO_URL/api"
DEST_NAME="oo_pipeline"
TEMPLATE_NAME="oo_json"
ALERT_NAMES="alert_tests_failed alert_http_5xx alert_cpu_alta alert_ram_alta"

delete_alert() {
  local name="$1" ids=""
  ids=$(curl -sf -u "$OO_USER:$OO_PASS" "$API/v2/default/alerts" |
    NAME="$name" python3 -c 'import sys,json,os
try:
    data=json.load(sys.stdin)
except Exception:
    data={"list":[]}
print(" ".join(a["alert_id"] for a in data.get("list",[]) if a["name"]==os.environ["NAME"]))' || true)
  for id in $ids; do
    curl -sf -o /dev/null -X DELETE -u "$OO_USER:$OO_PASS" \
      "$API/v2/default/alerts/$id" || true
  done
}

for name in $ALERT_NAMES; do
  delete_alert "$name"
done

curl -sf -o /dev/null -X DELETE -u "$OO_USER:$OO_PASS" \
  "$API/default/alerts/destinations/$DEST_NAME" || true
curl -sf -o /dev/null -X DELETE -u "$OO_USER:$OO_PASS" \
  "$API/default/alerts/templates/$TEMPLATE_NAME" || true

curl -sf -X POST "$API/default/alerts/templates" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{"name":"oo_json","body":"{\"event\":\"ALERT_FIRED\",\"status\":\"ALERT\",\"alert\":\"{alert_name}\",\"stream\":\"{stream_name}\",\"org\":\"{org_name}\",\"type\":\"{alert_type}\"}"}' >/dev/null || true

curl -sf -X POST "$API/default/alerts/destinations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d "{\"name\":\"$DEST_NAME\",\"url\":\"$OO_URL/api/default/pipeline_logs/_json\",\"method\":\"post\",\"template\":\"$TEMPLATE_NAME\",\"headers\":{\"Content-Type\":\"application/json\",\"Authorization\":\"Basic $AUTH\"}}" >/dev/null || true

create_alert() {
  local name="$1" stream="$2" sql="$3" threshold="$4" period="$5"
  if curl -sf -X POST "$API/v2/default/alerts" \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic $AUTH" \
    -d "{\"name\":\"$name\",\"stream_type\":\"logs\",\"stream_name\":\"$stream\",\"is_real_time\":false,\"query_condition\":{\"type\":\"sql\",\"sql\":\"$sql\",\"conditions\":null,\"promql\":null,\"aggregation\":null},\"trigger_condition\":{\"period\":$period,\"operator\":\">=\",\"threshold\":$threshold,\"silence\":10,\"frequency\":1,\"frequency_type\":\"minutes\"},\"destinations\":[\"$DEST_NAME\"],\"enabled\":true,\"description\":\"$name\"}" >/dev/null; then
    echo "Alerta creada: $name"
  else
    echo "No se pudo crear: $name"
  fi
}

create_alert alert_tests_failed pipeline_logs "SELECT count(*) as c FROM pipeline_logs WHERE event = 'TESTS_FAILED'" 1 5
create_alert alert_http_5xx app_logs "SELECT count(*) as c FROM app_logs WHERE statuscode >= 500" 1 5
create_alert alert_cpu_alta infra_metrics "SELECT avg(cpu_percent) as c FROM infra_metrics" 85 5
create_alert alert_ram_alta infra_metrics "SELECT avg(ram_percent) as c FROM infra_metrics" 90 5

echo "Destinos configurados:"
curl -sf -u "$OO_USER:$OO_PASS" "$API/default/alerts/destinations" | python3 -m json.tool | grep '"name"' || true

echo "Alertas configuradas:"
curl -sf -u "$OO_USER:$OO_PASS" "$API/v2/default/alerts" | python3 -m json.tool | grep '"name"' || true
