import net from 'net';
import { app, db } from './app.js';
import { log } from './logger.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => log('info', `Servidor HTTP en puerto ${PORT}`));

// --- Servidor TCP Socket en puerto 6061 ---
// Comandos:  {insert:{"name":"Ana"}}  |  {insert:{"item":"Mouse"}}  |  {insert:{"action":"x"}}
//            {get:users}  |  {get:items}  |  {get:logs}
const INSERT_TARGETS = {
  name: { table: 'users', col: 'name' },
  item: { table: 'items', col: 'item' },
  action: { table: 'logs', col: 'action' },
};
const GET_TABLES = ['users', 'items', 'logs'];

const send = (socket, payload) => socket.write(JSON.stringify(payload) + '\n');

function handleMessage(socket, message) {
  if (message.startsWith('{insert:') && message.endsWith('}')) {
    let parsed;
    try {
      parsed = JSON.parse(message.slice(8, -1).trim());
    } catch {
      return send(socket, { statusCode: 400, error: 'JSON inválido' });
    }

    const key = Object.keys(INSERT_TARGETS).find((k) => parsed && parsed[k]);
    if (!key) return send(socket, { statusCode: 400, error: 'Elemento no reconocido' });

    const { table, col } = INSERT_TARGETS[key];
    return db.run(`INSERT INTO ${table} (${col}) VALUES (?)`, [parsed[key]], function (err) {
      if (err) return send(socket, { statusCode: 500, error: err.message });
      send(socket, { statusCode: 200, data: { id: this.lastID, inserted: parsed } });
    });
  }

  if (message.startsWith('{get:') && message.endsWith('}')) {
    const table = message.slice(5, -1).trim();
    if (!GET_TABLES.includes(table)) {
      return send(socket, { statusCode: 404, error: 'Tabla no encontrada' });
    }
    return db.all(`SELECT * FROM ${table}`, (err, rows) =>
      err ? send(socket, { statusCode: 500, error: err.message })
          : send(socket, { statusCode: 200, data: rows }));
  }

  send(socket, { statusCode: 400, error: 'Formato no válido' });
}

const tcpServer = net.createServer((socket) => {
  log('info', 'Cliente conectado por TCP Socket');

  socket.on('data', (data) => {
    data.toString().split('\n').map((l) => l.trim()).filter(Boolean)
      .forEach((line) => handleMessage(socket, line));
  });

  socket.on('error', (err) => log('warn', `Error en Socket TCP: ${err.message}`));
});

tcpServer.listen(6061, () => log('info', 'Servidor TCP Socket escuchando en puerto 6061'));