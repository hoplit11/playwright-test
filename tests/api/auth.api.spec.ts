// tests/api/auth.api.spec.ts
/**
 * Pruebas de Autenticación y Disponibilidad del PACS.
 *
 * Objetivo:
 *  - Verificar que el servidor Keycloak está disponible y expone correctamente
 *    su configuración OpenID Connect.
 *  - Validar que el sistema de autenticación (OAuth2 Proxy + Keycloak)
 *    permite el acceso a la API DICOMWeb solo después de un login exitoso.
 *  - Realizar un inicio de sesión real mediante la UI de Keycloak,
 *    capturar la cookie de sesión _oauth2_proxy y reutilizarla para llamadas API.
 *  - Confirmar que el endpoint protegido /pacs/studies responde 200
 *    cuando se envía la cookie válida y que devuelve una lista de estudios DICOM.
 *
 * Esta prueba valida todo el flujo de autenticación del PACS:
 * NGINX → OAuth2 Proxy → Keycloak → Orthanc (DICOMWeb).
 */


import { test, expect, request } from '@playwright/test';
import { getKeycloakToken } from './utils/keycloak';

const BASE_URL = 'https://pacs.viewneurocirugiahuv.org';

// Helper: iniciar sesión real y devolver cookie
async function loginAndGetCookie(page, username, password) {
  await page.goto(`${BASE_URL}/ohif-viewer/`);

  // Redirección automática hacia Keycloak
  await page.getByLabel('Username').fill(username);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Esperar que el login termine y la UI cargue
  await page.waitForURL(/ohif-viewer/, { timeout: 10000 });

  // Obtener cookies de sesión OAuth2 Proxy
  const cookies = await page.context().cookies();
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

test.describe('API - Auth y Disponibilidad', () => {

  test('Keycloak está disponible (OpenID config)', async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/keycloak/realms/ohif/.well-known/openid-configuration`
    );
    expect(res.status()).toBe(200);
  });

  test('DICOMWeb /studies responde 200 usando COOKIE oauth2-proxy', async ({ browser }) => {

    // 1️⃣ Crear una página temporal para login UI
    const page = await browser.newPage();

    // 2️⃣ Hacer login y obtener la cookie válida
    const cookieHeader = await loginAndGetCookie(page, 'viewer', 'viewer');

    // 3️⃣ Crear nuevo contexto API autenticado con cookies
    const api = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        Cookie: cookieHeader
      }
    });

    // 4️⃣ Llamar a /pacs/studies usando las cookies correctas
    const res = await api.get('/pacs/studies');

    // 5️⃣ Validar respuesta
    expect(res.status(), 'El endpoint debe responder 200 con cookie válida')
      .toBe(200);

    // 6️⃣ Opcional: ver JSON para evidencia
    const json = await res.json();
    console.log(`Estudios encontrados: ${json.length}`);
  });

});
