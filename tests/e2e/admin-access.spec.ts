import { test, expect } from '@playwright/test';
import { loginToPACS } from '../utils/authHelper';
import { OrthancAdminPage } from '../pages/OrthancAdminPage';

test('Pacsadmin puede acceder a administración', async ({ page }) => {
  await loginToPACS(page, 'pacsadmin', 'pacsadmin');

  const response = await page.goto('/pacs-admin');
  expect(response?.status()).toBe(200); // Verifica que la página carga correctamente (con status 200)

  const admin = new OrthancAdminPage(page); // Crea una instancia de la página de administración de Orthanc, lo hace para interactuar con ella.
  await admin.expectLoaded(); // Espera a que la página de administración esté completamente cargada.
});
