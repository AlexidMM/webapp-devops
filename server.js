import net from 'net';
import { app, db } from './app.js';

app.listen(80, () => console.log('Servidor HTTP en puerto 80'));

// --- Servidor TCP Socket en puerto 6061 ---
const tcpServer = net.createServer((socket) => {
    console.log('Cliente conectado por TCP Socket');

    socket.on('data', (data) => {
        const message = data.toString().trim();
        console.log(`Mensaje recibido: ${message}`);

        // Formato: {insert:<element>}
        if (message.startsWith('{insert:') && message.endsWith('}')) {
            const content = message.slice(8, -1).trim();
            try {
                const parsedData = JSON.parse(content);
                if (parsedData.name) {
                    db.run("INSERT INTO users (name) VALUES (?)", [parsedData.name], function() {
                        socket.write(JSON.stringify({ statusCode: 200, data: { id: this.lastID, inserted: parsedData } }) + '\n');
                    });
                } else if (parsedData.item) {
                    db.run("INSERT INTO items (item) VALUES (?)", [parsedData.item], function() {
                        socket.write(JSON.stringify({ statusCode: 200, data: { id: this.lastID, inserted: parsedData } }) + '\n');
                    });
                } else if (parsedData.action) {
                    db.run("INSERT INTO logs (action) VALUES (?)", [parsedData.action], function() {
                        socket.write(JSON.stringify({ statusCode: 200, data: { id: this.lastID, inserted: parsedData } }) + '\n');
                    });
                } else {
                    socket.write(JSON.stringify({ statusCode: 400, error: "Elemento no reconocido" }) + '\n');
                }
            } catch (e) {
                socket.write(JSON.stringify({ statusCode: 400, error: "JSON inválido" }) + '\n');
            }
        }
        // Formato: {get:<element>}
        else if (message.startsWith('{get:') && message.endsWith('}')) {
            const tableName = message.slice(5, -1).trim();
            if (['users', 'items', 'logs'].includes(tableName)) {
                db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
                    if (err) {
                        socket.write(JSON.stringify({ statusCode: 500, error: err.message }) + '\n');
                    } else {
                        socket.write(JSON.stringify({ statusCode: 200, data: rows }) + '\n');
                    }
                });
            } else {
                socket.write(JSON.stringify({ statusCode: 404, error: "Tabla no encontrada" }) + '\n');
            }
        } else {
            socket.write(JSON.stringify({ statusCode: 400, error: "Formato no válido. Use {insert:<element>} o {get:<element>}" }) + '\n');
        }
    });

    socket.on('error', (err) => {
        console.log(`Error en Socket TCP: ${err.message}`);
    });
});

tcpServer.listen(6061, () => {
    console.log('Servidor TCP Socket escuchando en puerto 6061');
});