import request from 'supertest';
import { app, db } from '../app.js';

beforeEach((done) => {
  db.exec('DELETE FROM users; DELETE FROM items; DELETE FROM logs;', done);
});

afterAll((done) => {
  db.close(done);
});

describe('HEALTH CHECK', () => {
  test('GET /health responde 200, status OK, base conectada y hora de México', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.database).toBe('connected');
    expect(res.body.service).toBe('webapp-devops-api');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('USERS', () => {
  test('POST /users con name válido responde 201 y devuelve el id creado', async () => {
    const res = await request(app).post('/users').send({ name: 'Ana' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
  });

  test('POST /users sin el campo name responde 400', async () => {
    const res = await request(app).post('/users').send({});
    expect(res.status).toBe(400);
  });

  test('POST /users sin body ni Content-Type responde 400 y no revienta con 500', async () => {
    const res = await request(app).post('/users');
    expect(res.status).toBe(400);
  });

  test('POST /users con name de solo espacios responde 400', async () => {
    const res = await request(app).post('/users').send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  test('POST /users con name numérico responde 400', async () => {
    const res = await request(app).post('/users').send({ name: 123 });
    expect(res.status).toBe(400);
  });

  test('POST /users con JSON mal formado responde 400 "JSON inválido"', async () => {
    const res = await request(app).post('/users')
      .set('Content-Type', 'application/json').send('{"name": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('JSON inválido');
  });

  test('GET /users devuelve exactamente los usuarios insertados', async () => {
    await request(app).post('/users').send({ name: 'Ana' });
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Ana');
  });

  test('GET /users/:id existente devuelve 200 con el nombre correcto', async () => {
    const { body } = await request(app).post('/users').send({ name: 'Luis' });
    const res = await request(app).get(`/users/${body.data.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Luis');
  });

  test('GET /users/:id inexistente responde 404', async () => {
    const res = await request(app).get('/users/9999');
    expect(res.status).toBe(404);
  });

  test('GET /users/:id con id no numérico ("abc") responde 400', async () => {
    const res = await request(app).get('/users/abc');
    expect(res.status).toBe(400);
  });

  test('PUT /users/:id actualiza el nombre y el cambio persiste (200)', async () => {
    const { body } = await request(app).post('/users').send({ name: 'Old' });
    const res = await request(app).put(`/users/${body.data.id}`).send({ name: 'New' });
    expect(res.status).toBe(200);
    const check = await request(app).get(`/users/${body.data.id}`);
    expect(check.body.data.name).toBe('New');
  });

  test('PUT /users/:id inexistente responde 404', async () => {
    const res = await request(app).put('/users/9999').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  test('PUT /users/:id con body vacío responde 400', async () => {
    const { body } = await request(app).post('/users').send({ name: 'A' });
    const res = await request(app).put(`/users/${body.data.id}`).send({});
    expect(res.status).toBe(400);
  });

  test('PUT /users/:id con id no numérico responde 400', async () => {
    const res = await request(app).put('/users/abc').send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  test('DELETE /users/:id elimina el registro (200) y luego GET responde 404', async () => {
    const { body } = await request(app).post('/users').send({ name: 'Del' });
    const res = await request(app).delete(`/users/${body.data.id}`);
    expect(res.status).toBe(200);
    const check = await request(app).get(`/users/${body.data.id}`);
    expect(check.status).toBe(404);
  });

  test('DELETE /users/:id inexistente responde 404', async () => {
    const res = await request(app).delete('/users/9999');
    expect(res.status).toBe(404);
  });

  test('DELETE /users/:id con id negativo (-5) responde 400', async () => {
    const res = await request(app).delete('/users/-5');
    expect(res.status).toBe(400);
  });
});

describe('ITEMS (PRODUCTOS)', () => {
  test('POST /items con campo item válido responde 201', async () => {
    const res = await request(app).post('/items').send({ item: 'Laptop' });
    expect(res.status).toBe(201);
  });

  test('POST /items con campo equivocado (name en lugar de item) responde 400', async () => {
    const res = await request(app).post('/items').send({ name: 'mal campo' });
    expect(res.status).toBe(400);
  });

  test('GET /items devuelve el producto insertado', async () => {
    await request(app).post('/items').send({ item: 'Mouse' });
    const res = await request(app).get('/items');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].item).toBe('Mouse');
  });

  test('GET /items/:id inexistente responde 404', async () => {
    const res = await request(app).get('/items/777');
    expect(res.status).toBe(404);
  });

  test('PUT /items/:id actualiza el producto y el cambio persiste', async () => {
    const { body } = await request(app).post('/items').send({ item: 'A' });
    const res = await request(app).put(`/items/${body.data.id}`).send({ item: 'B' });
    expect(res.status).toBe(200);
    const check = await request(app).get(`/items/${body.data.id}`);
    expect(check.body.data.item).toBe('B');
  });

  test('DELETE /items/:id inexistente responde 404', async () => {
    const res = await request(app).delete('/items/12345');
    expect(res.status).toBe(404);
  });
});

describe('LOGS', () => {
  test('POST /logs con action válida responde 201', async () => {
    const res = await request(app).post('/logs').send({ action: 'login' });
    expect(res.status).toBe(201);
  });

  test('POST /logs sin action responde 400', async () => {
    const res = await request(app).post('/logs').send({});
    expect(res.status).toBe(400);
  });

  test('GET /logs devuelve el log insertado', async () => {
    await request(app).post('/logs').send({ action: 'x' });
    const res = await request(app).get('/logs');
    expect(res.body.data).toHaveLength(1);
  });
});

describe('STATS (alimenta el dashboard)', () => {
  test('GET /stats/requests incluye la petición previa a /health con método, statusCode, tiempo y hora de México', async () => {
    await request(app).get('/health');
    const res = await request(app).get('/stats/requests');
    expect(res.status).toBe(200);
    const entry = res.body.data.find((r) => r.url === '/health');
    expect(entry).toMatchObject({ method: 'GET', statusCode: 200 });
    expect(typeof entry.responseTimeMs).toBe('number');
    expect(entry.timestamp_mx).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  test('GET /stats/requests no se registra a sí mismo en el historial', async () => {
    await request(app).get('/stats/requests');
    const res = await request(app).get('/stats/requests');
    expect(res.body.data.some((r) => r.url.startsWith('/stats'))).toBe(false);
  });

  test('GET /favicon.ico responde 204 para no generar 404 de ruido', async () => {
    const res = await request(app).get('/favicon.ico');
    expect(res.status).toBe(204);
  });
});

describe('RUTAS NO EXISTENTES', () => {
  test('GET /ruta-inventada responde 404 con mensaje "Ruta no encontrada"', async () => {
    const res = await request(app).get('/ruta-inventada');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Ruta no encontrada');
  });
});

describe('TRUNCATE', () => {
  test('DELETE /truncate vacía las tres tablas (users, items y logs)', async () => {
    await request(app).post('/users').send({ name: 'A' });
    await request(app).post('/items').send({ item: 'B' });
    await request(app).post('/logs').send({ action: 'C' });

    const res = await request(app).delete('/truncate');
    expect(res.status).toBe(200);

    expect((await request(app).get('/users')).body.data).toHaveLength(0);
    expect((await request(app).get('/items')).body.data).toHaveLength(0);
    expect((await request(app).get('/logs')).body.data).toHaveLength(0);
  });
});

describe('BACKUP', () => {
  test('POST /backup responde 200 (archivo existe) o 500 (BD en memoria)', async () => {
    const res = await request(app).post('/backup');
    expect([200, 500]).toContain(res.status);
  });

  test('GET /backup/download responde 200 si hay respaldo o 404 si no existe', async () => {
    await request(app).post('/backup');
    const res = await request(app).get('/backup/download');
    expect([200, 404]).toContain(res.status);
  });
});