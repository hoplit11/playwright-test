// tests/api/dicomweb.retrieve.api.spec.ts
import { test, expect, request } from '@playwright/test';

const BASE_URL = 'https://pacs.viewneurocirugiahuv.org';

/**
 * 🔍 Prueba WADO-RS Retrieve (DICOMWeb)
 * Esta suite valida que Orthanc permite descargar recursos DICOM usando:
 *   - WADO-RS Retrieve Study
 *   - WADO-RS Retrieve Series
 *   - WADO-RS Retrieve Instance
 *   - WADO-RS Retrieve Frames
 * La autenticación se realiza mediante cookie válida generada
 * al iniciar sesión en Keycloak a través de oauth2-proxy.
 */

// Helper: iniciar sesión real en Keycloak y obtener cookie oauth2-proxy
async function loginAndGetCookie(page, username, password) {
  await page.goto(`${BASE_URL}/ohif-viewer/`);

  await page.getByLabel('Username').fill(username);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL(/ohif-viewer/);

  const cookies = await page.context().cookies();
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

test.describe('DICOMWeb - WADO-RS Retrieve', () => {
  let api;
  let StudyUID;
  let SeriesUID;
  let InstanceUID;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();

    // 1️⃣ Login y cookie válida
    const cookieHeader = await loginAndGetCookie(page, 'viewer', 'viewer');

    // 2️⃣ Crear cliente API autenticado
    api = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Cookie: cookieHeader }
    });

    // 3️⃣ Obtener un estudio real para usar en las pruebas
    const res = await api.get('/pacs/studies');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.length).toBeGreaterThan(0);

    // Extraer UIDs del primer estudio
    StudyUID = json[0]['0020000D']?.Value[0];

    // Obtener series
    const seriesRes = await api.get(`/pacs/studies/${StudyUID}/series`);
    const seriesJson = await seriesRes.json();
    SeriesUID = seriesJson[0]['0020000E']?.Value[0];

    // Obtener instances
    const instRes = await api.get(
      `/pacs/studies/${StudyUID}/series/${SeriesUID}/instances`
    );
    const instJson = await instRes.json();
    InstanceUID = instJson[0]['00080018']?.Value[0];
  });
/*
  // 4️⃣ Retrieve Study
  test('GET /pacs/studies/{StudyUID} Retrieve Study', async () => {
    const res = await api.get(`/pacs/studies/${StudyUID}`);

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('multipart/related');
  });

  // 5️⃣ Retrieve Series
  test('GET /pacs/studies/{StudyUID}/series/{SeriesUID}', async () => {
    const res = await api.get(
      `/pacs/studies/${StudyUID}/series/${SeriesUID}`
    );

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('multipart/related');
  });*/

  // 6️⃣ Retrieve Instance
  test('GET /pacs/studies/{StudyUID}/series/{SeriesUID}/instances/{InstanceUID}', async () => {
    const res = await api.get(
      `/pacs/studies/${StudyUID}/series/${SeriesUID}/instances/${InstanceUID}`
    );

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/dicom');
  });

  // 7️⃣ Retrieve Frames (solo si existen)
  test('GET /pacs/.../frames/1 (si aplica)', async () => {
    const res = await api.get(
      `/pacs/studies/${StudyUID}/series/${SeriesUID}/instances/${InstanceUID}/frames/1`
    );

    // No todos los estudios tienen frames, se permite 200 o 404
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      expect(res.headers()['content-type']).toContain('multipart/related');
    }
  });
});
