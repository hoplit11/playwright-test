// tests/api/utils/loginforCookies.ts
// Helper: iniciar sesión real y devolver cookie
/**
 * Helper de autenticación para el PACS.
 * Realiza un inicio de sesión real en Keycloak mediante la interfaz web del
 * OHIF Viewer en keycloak, permitiendo que OAuth2 Proxy genere una cookie de sesión válida.
 * 
 * Retorna todas las cookies del navegador en formato de cabecera HTTP
 * ("Cookie: a=b; c=d"), necesarias para ejecutar pruebas API contra los
 * endpoints protegidos de DICOMWeb (/pacs/*).
 *
 * Este método es indispensable porque el PACS no acepta tokens directos:
 * solo permite acceso mediante cookies emitidas por OAuth2 Proxy después
 * de un login exitoso.
 */


export async function loginAndGetCookie(page, username, password) {
  // Ir al viewer (esto dispara el login)
  await page.goto('https://pacs.viewneurocirugiahuv.org/ohif-viewer');

  // Esperar Keycloak
  await page.getByLabel('Username').fill(username);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Esperar redirección al viewer
  await page.waitForURL('**/ohif-viewer/**', { timeout: 15000 });

  // Obtener cookies de sesión OAuth2 Proxy
  const cookies = await page.context().cookies();

  // Asegurar que parece una cookie válida
  const oauthCookie = cookies.find(c => c.name.includes("oauth2"));
  if (!oauthCookie) {throw new Error("❌ No se encontró cookie oauth2-proxy después del login");}

  // Convertir cookies en formato header Cookie: a=b; c=d;
  // Playwright requiere un header "Cookie" en formato:name=value; name2=value2; ...
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  
  
  // Confirmar que OHIF cargó
  // Esperar que cargue la interfaz OHIF Viewer (Habilitar si es necesario)
  //await page.waitForSelector('text=Study List');
  //await page.waitForTimeout(1000); // pequeña pausa para estabilidad
  
}
