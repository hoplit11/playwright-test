// tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test';
import { loginToPACS } from '../utils/authHelper';
import { selectors } from '../utils/selectors';

test.describe('Login al sistema PACS', () => { //
  test('El usuario puede iniciar sesión y ver la lista de estudios', async ({ page }) => {
    // Ejecutar login con usuario válido
    await loginToPACS(page, 'viewer', 'viewer');

    // Verificar que se muestra la lista de estudios
    await expect(page.locator(selectors.studyList)).toBeVisible();
    
    // Confirmar que al menos hay un paciente en la lista
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThan(0);
  });

test('No permite ingresar a administración con credenciales inválidas', async ({ page }) => {
  // Ir a la página principal
  await page.goto('/');

  // Esperar formulario de Keycloak
  await page.waitForSelector('input#username');

  // Llenar con usuario y contraseña de usuario sin permisos de admin
  await page.fill('input#username', 'viewer');
  await page.fill('input#password', 'viewer');

  // Iniciar sesión
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Capturar la respuesta HTTP al entrar a /pacs-admin
  const response = await page.goto('/pacs-admin');

  // Validar que devuelve 403 Forbidden
  expect(response?.status()).toBe(403);

  // Validar que se muestre el heading Forbidden
  await expect(
    page.getByRole('heading', { name: 'Forbidden' })
  ).toBeVisible();
});

test('Permite  ingresar a administración con credenciales válidas', async ({ page }) => {
  // Ir a la página principal
  await page.goto('/');

  // Esperar formulario de Keycloak
  await page.waitForSelector('input#username');

  // Llenar con usuario y contraseña con permisos de admin
  await page.fill('input#username', 'pacsadmin');
  await page.fill('input#password', 'pacsadmin');

  // Iniciar sesión
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Capturar la respuesta HTTP al entrar a /pacs-admin
  const response = await page.goto('/pacs-admin');

  // Validar que se carga correctamente (200 OK)
  expect(response?.status()).toBe(200);

  // Validar que Orthanc (la interfaz de admin PACS) cargó
  await expect(page.getByText('Orthanc')).toBeVisible();

});



  test('No permite iniciar sesión con credenciales inválidas', async ({ page }) => {
  // Ir a la página principal
  await page.goto('/');

  // Esperar formulario de Keycloak
  await page.waitForSelector('input#username');

  // Llenar con usuario y contraseña incorrectos
  await page.fill('input#username', 'usuario_invalido');
  await page.fill('input#password', 'clave_erronea');

  // Intentar iniciar sesión
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Esperar el mensaje de error (Keycloak muestra un span o div con mensaje tipo "Invalid username or password")
  const errorMessage = page.locator('text=Invalid username or password');

  // Verificar que se muestre el mensaje
  await expect(errorMessage).toBeVisible();

  // Además, confirmar que NO redirige al visor OHIF
  await expect(page).not.toHaveURL(/.*studyList.*/);
});



});
