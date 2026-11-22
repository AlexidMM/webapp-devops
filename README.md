# WebApp DevOps - CI/CD, pruebas y observabilidad

API REST + dashboard web desplegados en AWS EC2 con GitHub Actions, Docker Hub y OpenObserve.

## Arquitectura

```
Push a main/master
  -> GitHub Actions: pnpm install -> Jest (backend) -> Playwright (frontend)
  -> si falla: POST a OpenObserve (TESTS_FAILED) y NO hay SSH a EC2
  -> si pasa: POST (TESTS_PASSED) -> Docker Hub -> SSH a EC2 -> deploy
  -> EC2: OpenObserve + webapp (OTLP) + cron de métricas (infra_metrics)
```

- **Backend:** Express 5 + SQLite (`app.js`, `db.js`, `server.js`). Endpoints: `/health`, CRUD `/users`, CRUD `/items`, `/logs`, `/backup`, `/truncate`, `/stats/requests`; además un socket TCP en el puerto 6061.
- **Frontend:** `public/index.html` (login, CRUD de usuarios y productos, gráficas Chart.js y tabla de peticiones con hora de México).
- **Contenedores:** `Dockerfile` basado en `node:20-alpine`, pnpm 12.4.2 (misma versión de `packageManager`), arranca con `--import ./instrumentation.js`.
- **Observabilidad:** OpenTelemetry envía logs, métricas y trazas por OTLP/HTTP a OpenObserve; un script de cron envía métricas de la EC2.

## Pruebas automatizadas

| Suite | Comando | Cobertura |
|---|---|---|
| Backend (Jest + Supertest) | `pnpm test` | 34 pruebas: health, validaciones y CRUD de users/items/logs, backups, truncate, stats y rutas 404. |
| Frontend (Playwright) | `pnpm test:e2e` | 39 pruebas: 7 de login/sesión, 11 de usuarios, 9 de productos, 12 de dashboard/gráficas/tabla de peticiones. |

Cada prueba tiene un nombre descriptivo de la conducta verificada. Playwright levanta el servidor con `DB_PATH=:memory:` y cada caso limpia la BD con `DELETE /truncate`, por lo que no afectan los datos reales. El proyecto es JavaScript: Jest cubre el backend y Playwright el frontend (no se usa pytest porque no hay código Python).

No se genera reporte HTML/PDF de Playwright: el reporter es solo `list` y `trace`/`screenshot`/`video` están desactivados. La trazabilidad de ejecuciones vive en el stream `pipeline_logs` de OpenObserve.

## Secretos configurados en GitHub (Settings > Secrets and variables > Actions)

| Secreto | Uso |
|---|---|
| `EC2_HOST` | IP/dominio de la instancia AWS EC2 (Ubuntu). |
| `EC2_SSH_KEY` | Llave privada SSH (usuario `ubuntu`). |
| `DOCKER_USERNAME` / `DOCKER_PASSWORD` | Docker Hub. |
| `OPENOBSERVE_USER` / `OPENOBSERVE_PASS` | Email y contraseña del usuario root de OpenObserve. |
| `OPENOBSERVE_URL` | Opcional: URL pública de OpenObserve para el runner (ej. `http://IP:5080`). Por defecto `http://EC2_HOST:5080`. Dentro de la EC2 el pipeline usa `http://localhost:5080`. |

Si OpenObserve solo escucha en `localhost`, el pipeline necesita `OPENOBSERVE_URL` accesible desde el runner o abrir el puerto TCP 5080 en el Security Group de EC2. Si el `curl` termina con `exit code 28` (timeout), ese es el motivo: el evento no se registra, pero el paso usa `continue-on-error` y no cancela el job.

## Flujo del pipeline (`.github/workflows/main.yml`)

1. `pnpm/action-setup@v4` **sin** `version:`: toma `pnpm@12.4.2` desde `package.json`. Declarar `version: 9` provoca `ERR_PNPM_BAD_PM_VERSION`; el Dockerfile también usa 12.4.2.
2. Jest y Playwright. Con `if: always()` se envía el resultado a `pipeline_logs`, incluso si hay fallo, mediante HTTP directo (sin SSH).
3. Solo con `success()` y `event_name == push`: login/build/push a Docker Hub con tags `latest` y SHA del commit.
4. El job `deploy` (que depende del anterior) copia `monitor/metrics.sh`, levanta OpenObserve si hace falta, reemplaza el contenedor de la app, instala el cron y verifica `GET /health` antes de registrar `DEPLOYMENT_SUCCESSFUL`.

## OpenObserve en sencillo

OpenObserve es un backend de observabilidad: recibe **logs**, **métricas** y **trazas** por OTLP y los guarda en *streams* (como tablas). Se consulta desde su UI con SQL o PromQL y se visualiza en dashboards.

- UI: `http://<EC2_HOST>:5080` (usuario root = `OPENOBSERVE_USER`).
- Logs y trazas de la app: `POST /api/default/v1/logs` y `/v1/traces` (`instrumentation.js` envía cabecera `stream-name` → `app_logs` y `app_traces`). Las trazas se ven en **Traces** y permiten seguir la petición HTTP, el span de Express y las consultas SQLite instrumentadas en `db.js`. Los logs incluyen `trace_id`/`span_id` para correlacionarlos.
- Métricas de la app: `/api/default/v1/metrics`. OpenObserve crea un stream por métrica: `http_requests_total`, `http_errors_total` y `http_request_duration_ms` (latencia), con atributos `method`, `route`, `status_code`.
- Eventos CI/CD: `POST /api/default/pipeline_logs/_json` con `event`, `status`, `commit_sha`, `actor`, `branch` y timestamp.
- Infraestructura: `POST /api/default/infra_metrics/_json` cada minuto con `cpu_percent`, `ram_percent`, `network_bps`, `temperature_c`, `disk_used_percent`, `host` y `timestamp_mx`.

**Dashboard:** en *Dashboards > Import* sube `openobserve/dashboard.json`. Tiene 3 pestañas: CI/CD, Aplicación (OTLP) e Infraestructura EC2. Las horas se muestran en formato de México (`timestamp_mx`, `America/Mexico_City`).

**Alertas sugeridas** (UI > Alerts > New):
- `TESTS_FAILED` en `pipeline_logs` en los últimos 5 min → incidente de CI.
- `status_code >= 500` en `app_logs` en 5 min → error de aplicación.
- `cpu_percent > 85` o `ram_percent > 90` en `infra_metrics` durante 5 min → saturación de EC2.
- Caída de `DEPLOYMENT_SUCCESSFUL` tras un `TESTS_PASSED` → revisar el job de deploy.

> Nota: las instancias EC2 no exponen sensor térmico al sistema operativo. Si no existe `thermal_zone0` ni `hwmon`, el script reporta `temperature_c = 0` (sin dato), no un valor inventado.

## Ejecución local

```bash
pnpm install
pnpm start                 # http://localhost:3000 (login: admin / admin123)
pnpm test                  # backend
pnpm test:e2e              # frontend (instala chromium antes si hace falta)
```
