# WebApp DevOps

API REST + dashboard web desplegados en AWS EC2 con GitHub Actions, Docker Hub y OpenObserve.

## Estructura

```text
webapp-devops/
├── app.js                     API Express: /health, /users, /items, /logs, /backup, /truncate, /stats/requests
├── db.js                      SQLite instrumentado con OpenTelemetry
├── logger.js                  logs JSON con trace_id / span_id
├── instrumentation.js         exportadores OTLP (logs, métricas y trazas)
├── server.js                  arranque HTTP (:3000) y socket TCP (:6061)
├── public/index.html          login, CRUD y gráficas Chart.js
├── test/api.test.js           34 pruebas Jest + Supertest
├── e2e/app.spec.js            39 pruebas Playwright
├── Dockerfile                 node:20-alpine + pnpm 12.4.2
├── pnpm-workspace.yaml        allowBuilds para sqlite3 / protobufjs
├── monitor/metrics.sh         métricas de EC2 -> infra_metrics
├── openobserve/dashboard.json dashboard importable
└── .github/workflows/main.yml CI, publicación y deploy
```

## Código

- **Backend:** Express 5 + SQLite. `app.js` registra middleware de métricas (`http_requests_total`, `http_errors_total`, `http_request_duration_ms`) y un log estructurado por petición. `db.js` crea spans para cada consulta.
- **Frontend:** `public/index.html` usa la API y muestra datos con Chart.js. La tabla de peticiones usa hora de `America/Mexico_City`.
- **Observabilidad:** `instrumentation.js` envía por OTLP/HTTP a `http://<host>:5080/api/default`. Si faltan las variables `OTEL_*`, la instrumentación se desactiva y la app sigue funcionando. `monitor/metrics.sh` envía CPU, RAM, red, temperatura, disco y host cada minuto.
- **Pruebas:** Jest cubre el backend; Playwright cubre el frontend levantando el servidor con `DB_PATH=:memory:`. No se generan reportes HTML/PDF: el registro de ejecuciones vive en el stream `pipeline_logs`.

## Flujo de CI/CD

1. Push a `main`/`master` → `pnpm install`, Jest y Playwright.
2. El resultado se envía a `pipeline_logs`. Si hay fallo, **no se hace SSH** a EC2.
3. Si pasa: build/push a Docker Hub (tags `latest` y SHA).
4. El job `deploy` levanta OpenObserve, reemplaza el contenedor de la app, instala el cron de métricas, valida `/health` y registra `DEPLOYMENT_SUCCESSFUL`.

## Secretos de GitHub

| Secreto | Uso |
|---|---|
| `EC2_HOST` | IP o dominio de la instancia EC2 (Ubuntu). |
| `EC2_SSH_KEY` | Llave privada SSH del usuario `ubuntu`. |
| `DOCKER_USERNAME` / `DOCKER_PASSWORD` | Docker Hub. |
| `OPENOBSERVE_USER` | Email del usuario root de OpenObserve. |
| `OPENOBSERVE_PASS` | Contraseña root. Si no cumple la política de OpenObserve (8-128 caracteres, mayúscula, minúscula, dígito y símbolo), el pipeline añade el sufijo `Aa1!Aa1!` automáticamente. |
| `OPENOBSERVE_URL` | Opcional. URL pública para el runner; por defecto `http://EC2_HOST:5080`. |

Abrir el puerto TCP `5080` en el Security Group para ver OpenObserve y para que el runner publique los eventos.

## Descargar y ejecutar en una EC2

Requisitos: Ubuntu, Docker, Git y acceso SSH.

```bash
sudo apt update
sudo apt install -y docker.io git curl
sudo systemctl enable --now docker
sudo usermod -aG docker $USER && newgrp docker

git clone <URL_DEL_REPO> webapp-devops
cd webapp-devops
docker build -t webapp-devops .
```

Sin observabilidad:

```bash
docker run -d --name webapp-container \
  -p 80:3000 -p 6061:6061 \
  -e DB_PATH=/app/data/data.sqlite \
  -v webapp_data:/app/data \
  --restart always webapp-devops
```

Con observabilidad (OpenObserve ya corriendo en la misma EC2):

```bash
docker run -d --name openobserve -p 5080:5080 \
  -e ZO_ROOT_USER_EMAIL="admin@example.com" \
  -e ZO_ROOT_USER_PASSWORD="Password1!" \
  -v openobserve_data:/data --restart always \
  openobserve/openobserve:latest

docker run -d --name webapp-container \
  --add-host=host.docker.internal:host-gateway \
  -p 80:3000 -p 6061:6061 \
  -e PORT=3000 \
  -e DB_PATH=/app/data/data.sqlite \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:5080/api/default \
  -e OTEL_EXPORTER_OTLP_USER="admin@example.com" \
  -e OTEL_EXPORTER_OTLP_PASS="Password1!" \
  -e OTEL_SERVICE_NAME=webapp-devops \
  -v webapp_data:/app/data --restart always webapp-devops
```

Verificación:

```bash
curl http://localhost/health
curl http://localhost/users
docker logs --tail 100 webapp-container
```

En modo producción no hace falta hacer esto a mano: el workflow lo ejecuta por SSH en cada push válido.

## Comandos locales

```bash
pnpm install
pnpm start                  # http://localhost:3000 (admin / admin123)
pnpm test                   # Jest
pnpm test:e2e               # Playwright (instala Chromium si hace falta)
```

## OpenObserve

UI: `http://<EC2_HOST>:5080`.

| Stream | Contenido |
|---|---|
| `pipeline_logs` | `TESTS_PASSED`, `TESTS_FAILED`, `DEPLOYMENT_SUCCESSFUL`. |
| `app_logs` | logs JSON de la API con `trace_id` / `span_id`. |
| `app_traces` | trazas HTTP, Express y SQLite. |
| `http_requests_total`, `http_errors_total`, `http_request_duration_ms` | métricas de la app. |
| `infra_metrics` | CPU, RAM, red, temperatura, disco y host de la EC2. |

En *Dashboards > Import* sube `openobserve/dashboard.json`. Tiene tres pestañas: CI/CD, Aplicación e Infraestructura.

Alertas sugeridas: `TESTS_FAILED` en 5 min, `status_code >= 500` en `app_logs`, `cpu_percent > 85` o `ram_percent > 90` en `infra_metrics`, y ausencia de `DEPLOYMENT_SUCCESSFUL` tras un `TESTS_PASSED`.

> Las EC2 no suelen exponer sensor térmico. Si no hay `thermal_zone0` ni `hwmon`, `temperature_c` se reporta en `0` (sin dato).
