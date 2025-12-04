// tests/utils/authHelper.ts
import { Page } from '@playwright/test';

/**
 * Realiza login en el visor PACS (OHIF / Keycloak)
 * @param page Instancia de Playwright Page
 * @param username Usuario de Keycloak
 * @param password Contraseña de Keycloak
 */
export async function loginToPACS(page: Page, username: string, password: string) {
  // Ir al sitio principal (usa baseURL del config)
  await page.goto('/');

  // Esperar redirección al formulario de Keycloak
  await page.waitForSelector('input#username');

  // Completar el formulario
  await page.fill('input#username', username);
  await page.fill('input#password', password);
  //await page.click('button[name="Sign In"]');
  await page.getByRole('button', { name: 'Sign In' }).click() // Buscar el botón por el rol "button" y el nombre "Sign In", y hacer click en él


  // Esperar que cargue la interfaz OHIF Viewer
  await page.waitForSelector('text=Study List');
  await page.waitForTimeout(1000); // pequeña pausa para estabilidad
}
