import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const USUARIO = 'admin';
const CLAVE = 'admin123';

async function login(page, user = USUARIO, pass = CLAVE) {
  await page.fill('#login-username', user);
  await page.fill('#login-password', pass);
  await page.click('#btn-login');
}

async function agregarUsuario(page, nombre) {
  await page.fill('#input-user-name', nombre);
  await page.click('#btn-add-user');
}

async function agregarProducto(page, nombre) {
  await page.fill('#input-item-name', nombre);
  await page.click('#btn-add-item');
}

const datosGrafica = (page) =>
  page.evaluate(() => Chart.getChart('metricsChart')?.data.datasets[0].data ?? null);

test.describe('Suite E2E de Interfaz y Módulos - WebApp DevOps', () => {

  test.beforeEach(async ({ page, request }) => {
    // Vacía la base de datos antes de cada prueba para garantizar estado limpio
    await request.delete('/truncate');
    await page.goto('/');
  });

  // =========================================================================
  // BLOQUE 1: AUTENTICACIÓN Y CONTROL DE SESIÓN (7 PRUEBAS)
  // =========================================================================
  test('1. Verificación de presencia y visibilidad del formulario de login', async ({ page }) => {
    await expect(page.locator('#login-screen')).toBeVisible();
    await expect(page.locator('#login-username')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.locator('#btn-login')).toBeEnabled();
    await expect(page.locator('#dashboard-screen')).toBeHidden();
  });

  test('2. Validación de máscara de seguridad en campo contraseña', async ({ page }) => {
    await expect(page.locator('#login-password')).toHaveAttribute('type', 'password');
  });

  test('3. Denegación de acceso y despliegue de alerta con credenciales inválidas', async ({ page }) => {
    await login(page, 'usuario_invalido', 'clave_erronea');

    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).toHaveText('Credenciales incorrectas');
    await expect(page.locator('#dashboard-screen')).toBeHidden();
  });

  test('4. Autenticación exitosa y transición hacia la pantalla principal', async ({ page }) => {
    await login(page);

    await expect(page.locator('#dashboard-screen')).toBeVisible();
    await expect(page.locator('#login-screen')).toBeHidden();
  });

  test('5. Envío de formulario de login mediante tecla Enter', async ({ page }) => {
    await page.fill('#login-username', USUARIO);
    await page.fill('#login-password', CLAVE);
    await page.press('#login-password', 'Enter');

    await expect(page.locator('#dashboard-screen')).toBeVisible();
  });

  test('6. Cierre de sesión y retorno seguro a la pantalla de login', async ({ page }) => {
    await login(page);
    await page.click('#btn-logout');

    await expect(page.locator('#login-screen')).toBeVisible();
    await expect(page.locator('#dashboard-screen')).toBeHidden();
  });

  test('7. Limpieza de credenciales al cerrar sesión', async ({ page }) => {
    await login(page);
    await page.click('#btn-logout');

    await expect(page.locator('#login-username')).toHaveValue('');
    await expect(page.locator('#login-password')).toHaveValue('');
  });

  // =========================================================================
  // BLOQUE 2: CRUD DE USUARIOS (11 PRUEBAS)
  // =========================================================================
  test('8. Inserción exitosa de nuevo usuario en el sistema', async ({ page }) => {
    await login(page);
    await agregarUsuario(page, 'Carlos Mendoza');

    await expect(page.locator('#users-list')).toContainText('Carlos Mendoza');
  });

  test('9. Limpieza del campo de texto tras registrar usuario', async ({ page }) => {
    await login(page);
    await agregarUsuario(page, 'Beatriz Silva');

    await expect(page.locator('#users-list')).toContainText('Beatriz Silva');
    await expect(page.locator('#input-user-name')).toHaveValue('');
  });

  test('10. Registro múltiple y acumulación de usuarios en la lista', async ({ page }) => {
    await login(page);

    await agregarUsuario(page, 'Usuario Uno');
    await expect(page.locator('#users-list')).toContainText('Usuario Uno');

    await agregarUsuario(page, 'Usuario Dos');
    await expect(page.locator('#users-list')).toContainText('Usuario Dos');

    await expect(page.locator('#users-list li')).toHaveCount(2);
  });

  test('11. Eliminación de usuario específico mediante botón de acción', async ({ page }) => {
    await login(page);
    await agregarUsuario(page, 'Usuario A Borrar');
    await expect(page.locator('#users-list')).toContainText('Usuario A Borrar');

    await page.click('#users-list li:has-text("Usuario A Borrar") button');
    await expect(page.locator('#users-list')).not.toContainText('Usuario A Borrar');
  });

  test('12. Inserción de usuario presionando la tecla Enter en el input', async ({ page }) => {
    await login(page);
    await page.fill('#input-user-name', 'Usuario Enter');
    await page.press('#input-user-name', 'Enter');

    await expect(page.locator('#users-list')).toContainText('Usuario Enter');
  });

  test('13. Presencia y habilitación del botón "Agregar" de usuarios', async ({ page }) => {
    await login(page);

    await expect(page.locator('#btn-add-user')).toBeVisible();
    await expect(page.locator('#btn-add-user')).toBeEnabled();
  });

  test('14. Eliminar un usuario no afecta a los demás de la lista', async ({ page }) => {
    await login(page);
    await agregarUsuario(page, 'Se Queda');
    await expect(page.locator('#users-list li')).toHaveCount(1);
    await agregarUsuario(page, 'Se Va');
    await expect(page.locator('#users-list li')).toHaveCount(2);

    await page.click('#users-list li:has-text("Se Va") button');

    await expect(page.locator('#users-list li')).toHaveCount(1);
    await expect(page.locator('#users-list')).toContainText('Se Queda');
  });

  test('15. Un nombre de solo espacios no se registra y muestra mensaje de error', async ({ page }) => {
    await login(page);
    await agregarUsuario(page, '     ');

    await expect(page.locator('#user-error')).toBeVisible();
    await expect(page.locator('#user-error')).toContainText('no puede estar vacío');
    await expect(page.locator('#users-list li')).toHaveCount(0);
  });

  test('16. El mensaje "Sin usuarios registrados" se muestra vacío y desaparece al agregar', async ({ page }) => {
    await login(page);
    await expect(page.locator('#users-empty')).toBeVisible();

    await agregarUsuario(page, 'Primer Usuario');
    await expect(page.locator('#users-list')).toContainText('Primer Usuario');
    await expect(page.locator('#users-empty')).toBeHidden();
  });

  test('17. Un nombre con HTML se muestra como texto y no se ejecuta (protección XSS)', async ({ page }) => {
    await login(page);
    const payload = '<img src=x onerror="window.__xss=true">';
    await agregarUsuario(page, payload);

    await expect(page.locator('#users-list')).toContainText(payload);
    await expect(page.locator('#users-list img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test('18. Los usuarios persisten al cerrar sesión y volver a entrar', async ({ page }) => {
    await login(page);
    await agregarUsuario(page, 'Usuario Persistente');
    await expect(page.locator('#users-list')).toContainText('Usuario Persistente');

    await page.click('#btn-logout');
    await login(page);

    await expect(page.locator('#users-list')).toContainText('Usuario Persistente');
  });

  // =========================================================================
  // BLOQUE 3: CRUD DE PRODUCTOS / ITEMS (9 PRUEBAS)
  // =========================================================================
  test('19. Inserción exitosa de nuevo producto en el catálogo', async ({ page }) => {
    await login(page);
    await agregarProducto(page, 'Servidor Dell PowerEdge');

    await expect(page.locator('#items-list')).toContainText('Servidor Dell PowerEdge');
  });

  test('20. Limpieza del campo de texto tras registrar un producto', async ({ page }) => {
    await login(page);
    await agregarProducto(page, 'Switch Cisco 24 Puertos');

    await expect(page.locator('#items-list')).toContainText('Switch Cisco 24 Puertos');
    await expect(page.locator('#input-item-name')).toHaveValue('');
  });

  test('21. Registro múltiple de productos en la lista del DOM', async ({ page }) => {
    await login(page);

    await agregarProducto(page, 'Producto A');
    await expect(page.locator('#items-list')).toContainText('Producto A');

    await agregarProducto(page, 'Producto B');
    await expect(page.locator('#items-list')).toContainText('Producto B');

    await expect(page.locator('#items-list li')).toHaveCount(2);
  });

  test('22. Eliminación de producto mediante botón de acción', async ({ page }) => {
    await login(page);
    await agregarProducto(page, 'Item Temporal');
    await expect(page.locator('#items-list')).toContainText('Item Temporal');

    await page.click('#items-list li:has-text("Item Temporal") button');
    await expect(page.locator('#items-list')).not.toContainText('Item Temporal');
  });

  test('23. Inserción de producto presionando la tecla Enter', async ({ page }) => {
    await login(page);
    await page.fill('#input-item-name', 'Monitor LG 27 Pulgadas');
    await page.press('#input-item-name', 'Enter');

    await expect(page.locator('#items-list')).toContainText('Monitor LG 27 Pulgadas');
  });

  test('24. Presencia y habilitación del botón "Agregar" de productos', async ({ page }) => {
    await login(page);

    await expect(page.locator('#btn-add-item')).toBeVisible();
    await expect(page.locator('#btn-add-item')).toBeEnabled();
  });

  test('25. Un nombre de producto de solo espacios no se registra y muestra error', async ({ page }) => {
    await login(page);
    await agregarProducto(page, '     ');

    await expect(page.locator('#item-error')).toBeVisible();
    await expect(page.locator('#item-error')).toContainText('no puede estar vacío');
    await expect(page.locator('#items-list li')).toHaveCount(0);
  });

  test('26. El mensaje "Sin productos registrados" se muestra vacío y desaparece al agregar', async ({ page }) => {
    await login(page);
    await expect(page.locator('#items-empty')).toBeVisible();

    await agregarProducto(page, 'Primer Producto');
    await expect(page.locator('#items-list')).toContainText('Primer Producto');
    await expect(page.locator('#items-empty')).toBeHidden();
  });

  test('27. Un producto con HTML se muestra como texto y no se ejecuta (protección XSS)', async ({ page }) => {
    await login(page);
    const payload = '<b onmouseover="window.__xss2=true">negrita</b>';
    await agregarProducto(page, payload);

    await expect(page.locator('#items-list')).toContainText(payload);
    await expect(page.locator('#items-list b')).toHaveCount(0);
  });

  // =========================================================================
  // BLOQUE 4: SALUD DEL SISTEMA, DASHBOARD Y GRÁFICAS (12 PRUEBAS)
  // =========================================================================
  test('28. Verificación de la barra de salud del sistema (/health)', async ({ page }) => {
    await login(page);

    await expect(page.locator('#health-status')).toContainText('Sistema Activo');
  });

  test('29. Renderizado y visibilidad del contenedor de la gráfica de registros', async ({ page }) => {
    await login(page);

    await expect(page.locator('#metricsChart')).toBeVisible();
  });

  test('30. Verificación del título general del Dashboard', async ({ page }) => {
    await login(page);

    await expect(page.locator('h1')).toContainText('Panel de Control - WebApp DevOps');
  });

  test('31. Renderizado correcto del botón de cierre de sesión en el encabezado', async ({ page }) => {
    await login(page);

    await expect(page.locator('#btn-logout')).toBeVisible();
    await expect(page.locator('#btn-logout')).toHaveText('Cerrar Sesión');
  });

  test('32. La insignia de salud cambia a estilo verde cuando /health responde OK', async ({ page }) => {
    await login(page);

    const badge = page.locator('#health-status');
    await expect(badge).toContainText('Sistema Activo');
    await expect(badge).toHaveClass(/bg-green-100/);
  });

  test('33. La gráfica de registros inicia en 0 usuarios y 0 productos con la BD vacía', async ({ page }) => {
    await login(page);

    await expect(page.locator('#metricsChart')).toBeVisible();
    await expect.poll(() => datosGrafica(page)).toEqual([0, 0]);
  });

  test('34. La gráfica refleja 1 usuario y 1 producto tras registrarlos', async ({ page }) => {
    await login(page);
    await agregarUsuario(page, 'Usuario Gráfica');
    await expect(page.locator('#users-list li')).toHaveCount(1);
    await agregarProducto(page, 'Producto Gráfica');
    await expect(page.locator('#items-list li')).toHaveCount(1);

    await expect.poll(() => datosGrafica(page)).toEqual([1, 1]);
  });

  test('35. La gráfica baja a 0 usuarios al eliminar el único usuario registrado', async ({ page }) => {
    await login(page);
    await agregarUsuario(page, 'Temporal');
    await expect.poll(() => datosGrafica(page)).toEqual([1, 0]);

    await page.click('#users-list li:has-text("Temporal") button');
    await expect.poll(() => datosGrafica(page)).toEqual([0, 0]);
  });

  test('36. Renderizado y visibilidad de la gráfica de tiempo de respuesta', async ({ page }) => {
    await login(page);

    await expect(page.locator('#latencyChart')).toBeVisible();
    await expect.poll(() =>
      page.evaluate(() => Chart.getChart('latencyChart')?.data.datasets[0].data.length ?? 0)
    ).toBeGreaterThan(0);
  });

  test('37. La tabla de peticiones registra GET /health con status 200 y tiempo en ms', async ({ page }) => {
    await login(page);

    const fila = page.locator('#requests-table-body tr', { hasText: '/health' }).first();
    await expect(fila).toBeVisible();
    await expect(fila).toContainText('GET');
    await expect(fila).toContainText('200');
    await expect(fila).toContainText(/\d+(\.\d+)? ms/);
  });

  test('38. La tabla de peticiones muestra la hora en formato de la Ciudad de México (dd/mm/aaaa)', async ({ page }) => {
    await login(page);

    const fila = page.locator('#requests-table-body tr').first();
    await expect(fila).toContainText(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  test('39. Crear un usuario agrega una fila POST /users con status 201 en la tabla', async ({ page }) => {
    await login(page);
    await agregarUsuario(page, 'Usuario Tabla');
    await expect(page.locator('#users-list')).toContainText('Usuario Tabla');

    const fila = page.locator('#requests-table-body tr', { hasText: 'POST' }).first();
    await expect(fila).toContainText('/users');
    await expect(fila).toContainText('201');
  });
});