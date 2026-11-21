import { test, expect } from '@playwright/test';

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
    const passwordInput = page.locator('#login-password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('3. Denegación de acceso y despliegue de alerta con credenciales inválidas', async ({ page }) => {
    await page.fill('#login-username', 'usuario_invalido');
    await page.fill('#login-password', 'clave_erronea');
    await page.click('#btn-login');
    
    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).toHaveText('Credenciales incorrectas');
    await expect(page.locator('#dashboard-screen')).toBeHidden();
  });

  test('4. Autenticación exitosa y transición hacia la pantalla principal', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await expect(page.locator('#dashboard-screen')).toBeVisible();
    await expect(page.locator('#login-screen')).toBeHidden();
  });

  test('5. Envío de formulario de login mediante tecla Enter', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.press('#login-password', 'Enter');

    await expect(page.locator('#dashboard-screen')).toBeVisible();
  });

  test('6. Cierre de sesión y retorno seguro a la pantalla de login', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await page.click('#btn-logout');
    await expect(page.locator('#login-screen')).toBeVisible();
    await expect(page.locator('#dashboard-screen')).toBeHidden();
  });

  test('7. Limpieza de credenciales al cerrar sesión', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');
    await page.click('#btn-logout');

    await expect(page.locator('#login-username')).toHaveValue('');
    await expect(page.locator('#login-password')).toHaveValue('');
  });

  // =========================================================================
  // BLOQUE 2: CRUD DE USUARIOS Y BOTONES DE INTERACCIÓN (6 PRUEBAS)
  // =========================================================================
  test('8. Inserción exitosa de nuevo usuario en el sistema', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await page.fill('#input-user-name', 'Carlos Mendoza');
    await page.click('#btn-add-user');

    await expect(page.locator('#users-list')).toContainText('Carlos Mendoza');
  });

  test('9. Limpieza del campo de texto tras registrar usuario', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await page.fill('#input-user-name', 'Beatriz Silva');
    await page.click('#btn-add-user');

    await expect(page.locator('#input-user-name')).toHaveValue('');
  });

  test('10. Registro múltiple y acumulación de usuarios en la lista', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    // Inserción 1
    await page.fill('#input-user-name', 'Usuario Uno');
    await page.click('#btn-add-user');
    await expect(page.locator('#users-list')).toContainText('Usuario Uno');

    // Inserción 2
    await page.fill('#input-user-name', 'Usuario Dos');
    await page.click('#btn-add-user');
    await expect(page.locator('#users-list')).toContainText('Usuario Dos');

    const items = page.locator('#users-list li');
    await expect(items).toHaveCount(2);
  });

  test('11. Eliminación de usuario específico mediante botón de acción', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await page.fill('#input-user-name', 'Usuario A Borrar');
    await page.click('#btn-add-user');
    await expect(page.locator('#users-list')).toContainText('Usuario A Borrar');

    await page.click('#users-list li:has-text("Usuario A Borrar") button');
    await expect(page.locator('#users-list')).not.toContainText('Usuario A Borrar');
  });

  test('12. Inserción de usuario presionando la tecla Enter en el input', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await page.fill('#input-user-name', 'Usuario Enter');
    await page.press('#input-user-name', 'Enter');

    await expect(page.locator('#users-list')).toContainText('Usuario Enter');
  });

  test('13. Presencia y habilitación del botón "Agregar Usuario"', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await expect(page.locator('#btn-add-user')).toBeVisible();
    await expect(page.locator('#btn-add-user')).toBeEnabled();
  });

  // =========================================================================
  // BLOQUE 3: CRUD DE PRODUCTOS (ITEMS) Y BOTONES DE INTERACCIÓN (6 PRUEBAS)
  // =========================================================================
  test('14. Inserción exitosa de nuevo producto en el catálogo', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await page.fill('#input-item-name', 'Servidor Dell PowerEdge');
    await page.click('#btn-add-item');

    await expect(page.locator('#items-list')).toContainText('Servidor Dell PowerEdge');
  });

  test('15. Limpieza del campo de texto tras registrar un producto', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await page.fill('#input-item-name', 'Switch Cisco 24 Puertos');
    await page.click('#btn-add-item');

    await expect(page.locator('#input-item-name')).toHaveValue('');
  });

  test('16. Registro múltiple de productos en la lista del DOM', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    // Inserción 1
    await page.fill('#input-item-name', 'Producto A');
    await page.click('#btn-add-item');
    await expect(page.locator('#items-list')).toContainText('Producto A');

    // Inserción 2
    await page.fill('#input-item-name', 'Producto B');
    await page.click('#btn-add-item');
    await expect(page.locator('#items-list')).toContainText('Producto B');

    const items = page.locator('#items-list li');
    await expect(items).toHaveCount(2);
  });

  test('17. Eliminación de producto mediante botón de acción', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await page.fill('#input-item-name', 'Item Temporal');
    await page.click('#btn-add-item');
    await expect(page.locator('#items-list')).toContainText('Item Temporal');

    await page.click('#items-list li:has-text("Item Temporal") button');
    await expect(page.locator('#items-list')).not.toContainText('Item Temporal');
  });

  test('18. Inserción de producto presionando la tecla Enter', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await page.fill('#input-item-name', 'Monitor LG 27 Pulgadas');
    await page.press('#input-item-name', 'Enter');

    await expect(page.locator('#items-list')).toContainText('Monitor LG 27 Pulgadas');
  });

  test('19. Presencia y habilitación del botón "Agregar Producto"', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await expect(page.locator('#btn-add-item')).toBeVisible();
    await expect(page.locator('#btn-add-item')).toBeEnabled();
  });

  // =========================================================================
  // BLOQUE 4: SALUD DEL SISTEMA, DASHBOARD Y GRÁFICAS (6 PRUEBAS)
  // =========================================================================
  test('20. Verificación de la barra de salud del sistema (/health)', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await expect(page.locator('#health-status')).toContainText('Sistema Activo');
  });

  test('21. Renderizado y visibilidad del contenedor de la gráfica de métricas', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await expect(page.locator('#metricsChart')).toBeVisible();
  });

  test('22. Verificación del título general del Dashboard', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await expect(page.locator('h1')).toContainText('Panel de Control - WebApp DevOps');
  });

  test('23. Renderizado correcto del botón de cierre de sesión en el encabezado', async ({ page }) => {
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#btn-login');

    await expect(page.locator('#btn-logout')).toBeVisible();
    await expect(page.locator('#btn-logout')).toHaveText('Cerr