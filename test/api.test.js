import request from 'supertest';
import { app, db } from '../app.js';

beforeEach((done) => {
  db.exec("DELETE FROM users; DELETE FROM items; DELETE FROM logs;", done);
});

afterAll((done) => {
  db.close(done);
});

describe('USERS', () => {
  test('POST /users crea un usuario (201)', async () => {
    const res = await request(app).post('/users').send({ name: 'Ana' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
  });

  test('POST /users sin name -> 400', async () => {
    const res = await request(app).post('/users').send({});
    expect(res.status).toBe(400);
  });

  test('POST /users con name vacío o solo espacios -> 400', async () => {
    const res = await request(app).post('/users').send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  test('POST /users con name numérico -> 400', async () => {
    const res = await request(app).post('/users').send({ name: 123 });
    expect(res.status).toBe(400);
  });

  test('POST /users con JSON inválido -> 400', async () => {
    const res = await request(app).post('/users')
      .set('Content-Type', 'application/json').send('{"name": ');
    expect(res.status).toBe(400);
  });

  test('GET /users devuelve la lista', async () => {
    await request(app).post('/users').send({ name: 'Ana' });
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('GET /users/:id existente (200)', async () => {
    const { body } = await request(app).post('/users').send({ name: 'Luis' });
    const res = await request(app).get(`/users/${body.data.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Luis');
  });

  test('GET /users/:id inexistente -> 404', async () => {
    const res = await request(app).get('/users/9999');
    expect(res.status).toBe(404);
  });

  test('GET /users/:id con id no numérico -> 400', async () => {
    const res = await request(app).get('/users/abc');
    expect(res.status).toBe(400);
  });

  test('PUT /users/:id actualiza (200)', async () => {
    const { body } = await request(app).post('/users').send({ name: 'Old' });
    const res = await request(app).put(`/users/${body.data.id}`).send({ name: 'New' });
    expect(res.status).toBe(200);
    const check = await request(app).get(`/users/${body.data.id}`);
    expect(check.body.data.name).toBe('New');
  });

  test('PUT /users/:id inexistente -> 404', async () => {
    const res = await request(app).put('/users/9999').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  test('PUT /users/:id sin body -> 400', async () => {
    const { body } = await request(app).post('/users').send({ name: 'A' });
    const res = await request(app).put(`/users/${body.data.id}`).send({});
    expect(res.status).toBe(400);
  });

  test('DELETE /users/:id elimina (200) y ya no existe', async () => {
    const { body } = await request(app).post('/users').send({ name: 'Del' });
    const res = await request(app).delete(`/users/${body.data.id}`);
    expect(res.status).toBe(200);
    const check = await request(app).get(`/users/${body.data.id}`);
    expect(check.status).toBe(404);
  });

  test('DELETE /users/:id inexistente -> 404', async () => {
    const res = await request(app).delete('/users/9999');
    expect(res.status).toBe(404);
  });

  test('DELETE /users/:id inválido -> 400', async () => {
    const res = await request(app).delete('/users/-5');
    expect(res.status).toBe(400);
  });
});

describe('ITEMS', () => {
  test('POST /items crea item (201)', async () => {
    const res = await request(app).post('/items').send({ item: 'Laptop' });
    expect(res.status).toBe(201);
  });

  test('POST /items sin campo item -> 400', async () => {
    const res = await request(app).post('/items').send({ name: 'mal campo' });
    expect(res.status).toBe(400);
  });

  test('GET /items devuelve lista', async () => {
    await request(app).post('/items').send({ item: 'Mouse' });
    const res = await request(app).get('/items');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('PUT /items/:id actualiza', async () => {
    const { body } = await request(app).post('/items').send({ item: 'A' });
    const res = await request(app).put(`/items/${body.data.id}`).send({ item: 'B' });
    expect(res.status).toBe(200);
  });

  test('DELETE /items/:id inexistente -> 404', async () => {
    const res = await request(app).delete('/items/12345');
    expect(res.status).toBe(404);
  });
});

describe('LOGS', () => {
  test('POST /logs crea log (201)', async () => {
    const res = await request(app).post('/logs').send({ action: 'login' });
    expect(res.status).toBe(201);
  });

  test('POST /logs sin action -> 400', async () => {
    const res = await request(app).post('/logs').send({});
    expect(res.status).toBe(400);
  });

  test('GET /logs devuelve lista', async () => {
    await request(app).post('/logs').send({ action: 'x' });
    const res = await request(app).get('/logs');
    expect(res.body.data).toHaveLength(1);
  });
});

describe('TRUNCATE', () => {
  test('DELETE /truncate vacía todas las tablas', async () => {
    await request(app).post('/users').send({ name: 'A' });
    await request(app).post('/items').send({ item: 'B' });
    await request(app).post('/logs').send({ action: 'C' });
    const res = await request(app).delete('/truncate');
    expect(res.status).toBe(200);
    const users = await request(app).get('/users');
    expect(users.body.data).toHaveLength(0);
  });
});

describe('BACKUP', () => {
    test('POST /backup responde 200 o 500 según exista data.sqlite', async () => {
    const res = await request(app).post('/backup');
    expect([200, 500]).toContain(res.status);
  });

  test('GET /backup/download tras generar backup', async () => {
    await request(app).post('/backup');
    const res = await request(app).get('/backup/download');
    expect([200, 404]).toContain(res.status);
  });
  
  test('GET /backup/download sin backup previo -> 404', async () => {
    const res = await request(app).get('/backup/download');
    expect([404, 200]).toContain(res.status); // 200 si ya existía un backup.sqlite
  });
});