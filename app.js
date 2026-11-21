import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { metrics } from '@opentelemetry/api';
import { db } from './db.js';
import { log } from './logger.js';

export { db };
export const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || './data.sqlite';
const BACKUP_PATH =
  process.env.BACKUP_PATH ||
  (DB_PATH === ':memory:' ? './backup.sqlite' : path.join(path.dirname(DB_PATH), 'backup.sqlite'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// MÉTRICAS (OpenTelemetry)
// ==========================================
const meter = metrics.getMeter('webapp-devops');
const requestCounter = meter.createCounter('http_requests_total', {
  description: 'Total de peticiones HTTP por endpoint, método y statusCode',
});
const errorCounter = meter.createCounter('http_errors_total', {
  description: 'Peticiones HTTP con statusCode >= 400',
});
const durationHistogram = meter.createHistogram('http_request_duration_ms', {
  description: 'Latencia de las peticiones HTTP',
  unit: 'ms',
});

// Middleware de trazabilidad: métrica + log estructurado por cada petición
app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const responseTimeMs = Number(process.hrtime.bigint() - start) / 1e6;
    const statusCode = res.statusCode;
    const route = req.route
      ? `${req.baseUrl}${req.route.path}`
      : statusCode === 404 ? 'not_found' : 'static';

    const attrs = { method: req.method, route, status_code: statusCode };
    requestCounter.add(1, attrs);
    durationHistogram.record(responseTimeMs, attrs);
    if (statusCode >= 400) errorCounter.add(1, attrs);

    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    log(level, `${req.method} ${req.originalUrl} ${statusCode}`, {
      method: req.method,
      url: req.originalUrl,
      route,
      statusCode,
      responseTimeMs: Number(responseTimeMs.toFixed(2)),
    });
  });

  next();
});

// Inicialización de tablas
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, item TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, action TEXT)');
});

const response = (res, data, code = 200) => res.status(code).json({ statusCode: code, data });
const error = (res, msg, code) => res.status(code).json({ statusCode: code, error: msg });
const validId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;
const validText = (v) => typeof v === 'string' && v.trim() !== '';

// ==========================================
// HEALTH CHECK
// ==========================================
app.get('/health', (req, res) => {
  db.get('SELECT 1', (err) => {
    if (err) return error(res, 'Base de datos no disponible', 500);
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      service: 'webapp-devops-api',
      uptime: `${process.uptime().toFixed(2)}s`,
      timestamp: new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
      database: 'connected',
    });
  });
});

// ==========================================
// CRUD genérico: users (name) e items (item)
// ==========================================
const crud = (route, table, col) => {
  app.get(`/${route}`, (req, res) =>
    db.all(`SELECT * FROM ${table}`, (err, rows) =>
      err ? error(res, err.message, 500) : response(res, rows)));

  app.get(`/${route}/:id`, (req, res) => {
    if (!validId(req.params.id)) return error(res, 'ID inválido', 400);
    db.get(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id], (err, row) =>
      err ? error(res, err.message, 500)
          : row ? response(res, row) : error(res, 'No encontrado', 404));
  });

  app.post(`/${route}`, (req, res) => {
    const value = req.body?.[col];
    if (!validText(value)) return error(res, `El campo "${col}" es obligatorio`, 400);
    db.run(`INSERT INTO ${table} (${col}) VALUES (?)`, [value.trim()], function (err) {
      err ? error(res, err.message, 500) : response(res, { id: this.lastID }, 201);
    });
  });

  app.put(`/${route}/:id`, (req, res) => {
    if (!validId(req.params.id)) return error(res, 'ID inválido', 400);
    const value = req.body?.[col];
    if (!validText(value)) return error(res, `El campo "${col}" es obligatorio`, 400);
    db.run(`UPDATE ${table} SET ${col} = ? WHERE id = ?`, [value.trim(), req.params.id], function (err) {
      if (err) return error(res, err.message, 500);
      this.changes === 0 ? error(res, 'No encontrado', 404)
                         : response(res, { updated: Number(req.params.id) });
    });
  });

  app.delete(`/${route}/:id`, (req, res) => {
    if (!validId(req.params.id)) return error(res, 'ID inválido', 400);
    db.run(`DELETE FROM ${table} WHERE id = ?`, [req.params.id], function (err) {
      if (err) return error(res, err.message, 500);
      this.changes === 0 ? error(res, 'No encontrado', 404)
                         : response(res, { deleted: Number(req.params.id) });
    });
  });
};

crud('users', 'users', 'name');
crud('items', 'items', 'item');

// ==========================================
// LOGS
// ==========================================
app.get('/logs', (req, res) =>
  db.all('SELECT * FROM logs', (err, rows) =>
    err ? error(res, err.message, 500) : response(res, rows)));

app.post('/logs', (req, res) => {
  const action = req.body?.action;
  if (!validText(action)) return error(res, 'El campo "action" es obligatorio', 400);
  db.run('INSERT INTO logs (action) VALUES (?)', [action.trim()], function (err) {
    err ? error(res, err.message, 500) : response(res, { id: this.lastID }, 201);
  });
});

// ==========================================
// BACKUP
// ==========================================
app.post('/backup', (req, res) => {
  try {
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    response(res, { message: 'Backup exitoso' });
  } catch (e) {
    error(res, 'No se pudo generar el backup', 500);
  }
});

app.get('/backup/download', (req, res) => {
  const file = path.resolve(BACKUP_PATH);
  if (!fs.existsSync(file)) return error(res, 'Primero genera un backup con POST /backup', 404);
  res.download(file, 'backup.sqlite');
});

app.delete('/truncate', (req, res) => {
  db.exec('DELETE FROM users; DELETE FROM items; DELETE FROM logs;', (err) =>
    err ? error(res, err.message, 500) : response(res, { message: 'Base de datos vaciada' }));
});

// ==========================================
// 404 y manejo de errores
// ==========================================
app.use((req, res) => error(res, 'Ruta no encontrada', 404));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return error(res, 'JSON inválido', 400);
  log('error', err.message, { stack: err.stack, url: req.originalUrl, method: req.method });
  return error(res, 'Error interno del servidor', 500);
});