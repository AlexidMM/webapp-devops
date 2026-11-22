#!/usr/bin/env bash
# Métricas de la instancia EC2 -> OpenObserve (stream: infra_metrics)
# Instalado por el pipeline en /opt/monitor/metrics.sh y ejecutado por cron cada minuto.
set -euo pipefail

source /opt/monitor/oo.env

# --- CPU: diferencia de contadores en 1 segundo (porcentaje de uso) ---
read -r CPU_T1 IDLE_T1 < <(awk '/^cpu / {print $2+$3+$4+$5+$6+$7+$8, $5+$6}' /proc/stat)
sleep 1
read -r CPU_T2 IDLE_T2 < <(awk '/^cpu / {print $2+$3+$4+$5+$6+$7+$8, $5+$6}' /proc/stat)
CPU=$(awk -v t1="$CPU_T1" -v i1="$IDLE_T1" -v t2="$CPU_T2" -v i2="$IDLE_T2" \
  'BEGIN { d=t2-t1; if (d>0) printf "%.2f", (1-(i2-i1)/d)*100; else printf "0.00" }')

# --- RAM: (MemTotal - MemAvailable) / MemTotal ---
read -r MEM_TOTAL MEM_AVAIL < <(awk '/^MemTotal:/ {t=$2} /^MemAvailable:/ {a=$2} END {print t, a}' /proc/meminfo)
RAM=$(awk -v t="$MEM_TOTAL" -v a="$MEM_AVAIL" \
  'BEGIN { if (t>0) printf "%.2f", (t-a)/t*100; else printf "0.00" }')

# --- Ancho de banda: bytes/s agregados de todas las interfaces excepto lo ---
read -r RX TX < <(awk -F'[: ]+' '$2 != "" && $2 != "lo" && $3 ~ /^[0-9]+$/ {rx+=$3; tx+=$11} END {print rx+0, tx+0}' /proc/net/dev)
PREV_FILE=/tmp/oo-net-prev
if [ -f "$PREV_FILE" ]; then
  read -r PREV_RX PREV_TX < "$PREV_FILE"
else
  PREV_RX=$RX; PREV_TX=$TX
fi
printf '%s %s\n' "$RX" "$TX" > "$PREV_FILE"
NETWORK_BPS=$(( (RX - PREV_RX + TX - PREV_TX) / 60 ))
if [ "$NETWORK_BPS" -lt 0 ]; then NETWORK_BPS=0; fi

# --- Temperatura: EC2 no expone sensor físico; se intenta thermal_zone y hwmon ---
TEMPERATURE=0
if [ -r /sys/class/thermal/thermal_zone0/temp ]; then
  TEMPERATURE=$(awk '{printf "%.1f", $1/1000}' /sys/class/thermal/thermal_zone0/temp)
elif [ -r /sys/class/hwmon/hwmon0/temp1_input ]; then
  TEMPERATURE=$(awk '{printf "%.1f", $1/1000}' /sys/class/hwmon/hwmon0/temp1_input)
fi

DISK=$(df -P / | awk 'NR==2 {gsub(/%/, "", $5); print $5}')
HOST=$(hostname)
TIMESTAMP=$(date -u +%FT%TZ)
TIMESTAMP_MX=$(TZ=America/Mexico_City date +%FT%T)

curl -sf -X POST "$OO_URL/api/default/infra_metrics/_json" \
  -H "Content-Type: application/json" \
  -u "$OO_USER:$OO_PASS" \
  -d "[{\"timestamp\":\"$TIMESTAMP\",\"timestamp_mx\":\"$TIMESTAMP_MX\",\"host\":\"$HOST\",\"cpu_percent\":$CPU,\"ram_percent\":$RAM,\"network_bps\":$NETWORK_BPS,\"temperature_c\":$TEMPERATURE,\"disk_used_percent\":$DISK}]"
