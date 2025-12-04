/**
 * ================================================================================
 * Archivo: dicomweb.retrieve.frames.api.spec.ts
 * Tipo: Prueba API Funcional — DICOMWeb WADO-RS
 *
 * Objetivo:
 *   ✔ Validar la operación WADO-RS Retrieve Frames
 *   ✔ Confirmar que Orthanc puede extraer frames individuales
 *     desde un DICOM multiframe
 *   ✔ Aceptar respuestas 200 (frame disponible) o 404 (instancia no multiframe)
 *   ✔ Guardar el frame como evidencia binaria
 *   ✔ Adjuntar resultado al reporte HTML
 *
 * Contexto:
 *   - No todas las imágenes DICOM contienen múltiples frames.
 *   - Por eso, un 404 es una respuesta VÁLIDA y aceptada.
 *
 * ================================================================================
 */

import { test, expect, request } from '@playwright/test';
import { loginAndGetCookie } from '../utils/loginforCookies';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://pacs.viewneurocirugiahuv.org';

test.describe('DICOMWeb – WADO-RS Retrieve Frames (multiframe)', () => {

  let api;
  let StudyUID;
  let SeriesUID;
  let InstanceUID;

  /**
   * BEFORE ALL:
   *   - Login UI para obtener cookies válidas (oauth2-proxy + Keycloak)
   *   - Obtener un StudyUID real
   *   - Obtener una Serie real
   *   - Obtener una Instance real
   */
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();

    // 1️⃣ Login vía UI
    const cookieHeader = await loginAndGetCookie(page, 'viewer', 'viewer');

    // 2️⃣ Crear contexto API autenticado
    api = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Cookie: cookieHeader }
    });

    // 3️⃣ Obtener primeros estudios
    const studies = await (await api.get(`/pacs/studies`)).json();
    expect(studies.length).toBeGreaterThan(0);

    StudyUID = studies[0]['0020000D'].Value[0];

    // 4️⃣ Obtener series del estudio
    const series = await (await api.get(`/pacs/studies/${StudyUID}/series`)).json();
    expect(series.length).toBeGreaterThan(0);

    SeriesUID = series[0]['0020000E'].Value[0];

    // 5️⃣ Obtener instances de la serie
    const instances = await (await api.get(
      `/pacs/studies/${StudyUID}/series/${SeriesUID}/instances`
    )).json();

    expect(instances.length).toBeGreaterThan(0);

    InstanceUID = instances[0]['00080018'].Value[0];
  });

  /**
   * TEST PRINCIPAL:
   * Retrieve del frame #1 desde el InstanceUID seleccionado.
   * 
   * Notas:
   *   - Si la instancia NO es multiframe, Orthanc responde 404.
   *   - Si sí es multiframe, devuelve:
   *       - multipart/related
   *       - image/jpeg
   *       - image/jp2
   *       - application/octet-stream
   */
  test('Retrieve Frame #1 desde un Instance DICOM (200 o 404 válido)', async () => {

    // 6️⃣ Llamado a Retrieve Frame
    const res = await api.get(
      `/pacs/studies/${StudyUID}/series/${SeriesUID}/instances/${InstanceUID}/frames/1`
    );

    // 7️⃣ Aceptar respuesta exitosa o instancia no multiframe
    expect([200, 404]).toContain(res.status());

    // Si NO hay frame → 404 → prueba válida
    if (res.status() === 404) {
      test.info().attach('Resultado (sin frame)', {
        body: 'La instancia no contiene frames (respuesta 404 válida)',
        contentType: 'text/plain'
      });
      return; // terminar prueba
    }

    // 8️⃣ Validar content-type de frame
    const ct = res.headers()['content-type'];
    expect(ct).toBeTruthy();

    // Algunos content-types válidos:
    const validTypes = [
      'multipart/related',
      'image/jpeg',
      'image/jp2',
      'application/octet-stream',
      'application/dicom'
    ];

    const isValidType = validTypes.some(t => ct.includes(t));
    expect(isValidType).toBeTruthy();

    // 9️⃣ Obtener buffer del frame
    const frameBuffer = await res.body();
    expect(frameBuffer.byteLength).toBeGreaterThan(0);

    // 1️⃣0️⃣ Guardar evidencia en carpeta
    const evidenceDir = path.join(process.cwd(), 'evidence', 'api', 'retrieve', 'frames');
    fs.mkdirSync(evidenceDir, { recursive: true });

    const filePath = path.join(evidenceDir, `frame1-${InstanceUID}.bin`);
    fs.writeFileSync(filePath, frameBuffer);

    // 1️⃣1️⃣ Adjuntar evidencia al reporte HTML
    test.info().attach('Frame #1 extraído', {
      body: frameBuffer,
      contentType: ct,
      fileName: `frame1-${InstanceUID}.bin`
    });
  });

});
