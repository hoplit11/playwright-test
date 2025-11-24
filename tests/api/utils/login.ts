// tests/utils/login.ts

export async function loginToPACS(page, username, password) {
  // Ir al viewer (esto dispara el login)
  await page.goto('https://pacs.viewneurocirugiahuv.org/ohif-viewer');

  // Esperar Keycloak
  await page.getByLabel('Username').fill(username);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Esperar redirección al viewer
  await page.waitForURL('**/ohif-viewer/**');
  
  // Confirmar que OHIF cargó
    // Esperar que cargue la interfaz OHIF Viewer
  await page.waitForSelector('text=Study List');
  await page.waitForTimeout(1000); // pequeña pausa para estabilidad
  
}
