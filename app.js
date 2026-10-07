import express from 'express';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const sql = sqlite3.verbose();
export const db = new sql.Database(process.env.DB_PATH || './data.sqlite');
export const app = express();
app.use(express.json());

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, item TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, action TEXT)");
});

const response = (res, data, code = 200) => res.status(code).json({ statusCode: code, data });
const error = (res, msg, code) => res.status(code).json({ statusCode: code, error: msg });
const validId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;
const validText = (v) => typeof v === 'string' && v.trim() !== '';

// CRUD genérico para users (name) e items (item)
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
    if (!validText(req.body[col])) return error(res, `El campo "${col}" es obligatorio`, 400);
    db.run(`INSERT INTO ${table} (${col}) VALUES (?)`, [req.body[col]], function (err) {
      err ? error(res, err.message, 500) : response(res, { id: this.lastID }, 201);
    });
  });

  app.put(`/${route}/:id`, (req, res) => {
    if (!validId(req.params.id)) return error(res, 'ID inválido', 400);
    if (!validText(req.body[col])) return error(res, `El campo "${col}" es obligatorio`, 400);
    db.run(`UPDATE ${table} SET ${col} = ? WHERE id = ?`, [req.body[col], req.params.id], function (err) {
      if (err) return error(res, err.message, 500);
      this.changes === 0 ? error(res, 'No encontrado', 404) : response(res, { updated: Number(req.params.id) });
    });
  });

  app.delete(`/${route}/:id`, (req, res) => {
    if (!validId(req.params.id)) return error(res, 'ID inválido', 400);
    db.run(`DELETE FROM ${table} WHERE id = ?`, [req.params.id], function (err) {
      if (err) return error(res, err.message, 500);
      this.changes === 0 ? error(res, 'No encontrado', 404) : response(res, { deleted: Number(req.params.id) });
    });
  });
};

crud('users', 'users', 'name');
crud('items', 'items', 'item');

// Logs (solo GET y POST)
app.get('/logs', (req, res) =>
  db.all("SELECT * FROM logs", (err, rows) => err ? error(res, err.message, 500) : response(res, rows)));
app.post('/logs', (req, res) => {
  if (!validText(req.body.action)) return error(res, 'El campo "action" es obligatorio', 400);
  db.run("INSERT INTO logs (action) VALUES (?)", [req.body.action], function (err) {
    err ? error(res, err.message, 500) : response(res, { id: this.lastID }, 201);
  });
});

// Backup: genera el archivo
app.post('/backup', (req, res) => {
  try {
    fs.copyFileSync('./data.sqlite', './backup.sqlite');
    response(res, { message: 'Backup ejecutado con éxito en CI/CD' });
  } catch (e) {
    error(res, 'No se pudo generar el backup', 500);
  }
});

// Backup: descarga el archivo a tu PC
app.get('/backup/download', (req, res) => {
  const file = path.resolve('./backup.sqlite');
  if (!fs.existsSync(file)) return error(res, 'Primero genera un backup con POST /backup', 404);
  res.download(file, 'backup.sqlite');
});

app.delete('/truncate', (req, res) => {
  db.exec("DELETE FROM users; DELETE FROM items; DELETE FROM logs;", (err) =>
    err ? error(res, err.message, 500) : response(res, { message: 'Base de datos vaciada' }));
});

// JSON mal formado
app.use((err, req, res, next) => error(res, 'JSON inválido', 400));