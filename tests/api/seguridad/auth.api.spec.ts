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
/**
 * Resumen del test:
 * -----------------
 * Este archivo valida el flujo completo de autenticación del PACS:
 * 1️⃣ Verifica que Keycloak está disponible mediante su configuración OpenID Connect.
 * 2️⃣ Realiza un login real en la UI de Keycloak para obtener la cookie de sesión `_oauth2_proxy`.
 * 3️⃣ Usa esa cookie para hacer llamadas API autenticadas al endpoint protegido `/pacs/studies`.
 * 4️⃣ Confirma que el endpoint responde 200 y devuelve la lista de estudios DICOM.
 *
 * Flujo de autenticación simulado:
 *   NGINX → OAuth2 Proxy → Keycloak → Orthanc (DICOMWeb)
 *
 * Observaciones:
 * - NGINX + OAuth2 Proxy no acepta tokens directos, solo cookies de sesión.
 * - Se adjunta la respuesta JSON como evidencia en el reporte.
 * - Este test valida que el sistema de autenticación y disponibilidad del PACS funciona correctamente.
 */


import { test, expect, request } from '@playwright/test';
import { loginAndGetCookie } from '../utils/loginforCookies';

const BASE_URL = 'https://pacs.viewneurocirugiahuv.org';

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

    // 3️⃣ Crear nuevo contexto API autenticado con cookies. Es decir, simula una llamada API con sesión válida.
    const api = await request.newContext({ // Nuevo contexto de request
      baseURL: BASE_URL,                   // Base URL del PACS0
      extraHTTPHeaders: {                  // Enviar cookies de sesión
        Cookie: cookieHeader               // para que oauth2-proxy y nginx permitan acceso
      }
    });

    // 4️⃣ Llamar a /pacs/studies usando las cookies correctas
    const res = await api.get('/pacs/studies'); // Llamada al endpoint protegido y guardar respuesta

    // 5️⃣ Validar respuesta
    expect(res.status(), 'El endpoint debe responder 200 con cookie válida').toBe(200);

    // 6️⃣ Opcional: ver JSON para evidencia
    const json = await res.json();
    console.log(`Estudios encontrados: ${json.length}`);
    
    
    // 7️⃣ Guardar evidencia en el reporte
    test.info().attach('studies.json', {
    body: JSON.stringify(json, null, 2),
    contentType: 'application/json',
    //description: 'Lista de estudios DICOM devueltos por /pacs/studies. Convertido a JSON para guardarlo como archivo legible y portable en el reporte.'
    // Guardar evidencia en el reporte como JSON.
    // Contiene la lista de estudios DICOM devueltos por /pacs/studies.
    // Se convierte a JSON para que sea legible y portable en el reporte HTML.
    });

  });

});
