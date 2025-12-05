/**
 * ================================================================================
 * Archivo: dicomweb.retrieve.study.api.spec.ts
 * Prueba: WADO-RS Retrieve Study (multipart → DICOM)
 * Optimizada para estudios grandes (tiempo extendido y extracción limitada)
 * ================================================================================
 */
import { test, expect, request } from '@playwright/test';
import { loginAndGetCookie } from '../utils/loginforCookies';
import { extractDicomFromMultipart } from '../utils/dicomMultipart';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://pacs.viewneurocirugiahuv.org';
const MAX_FILES = 20;   // Máximo de DICOM a extraer (evita timeout)

test.describe('DICOMWeb - Retrieve Study completo (multipart → DICOM)', () => {
  let api; // Contexto API autenticado
  let StudyUID; // UID del estudio a recuperar

  // Antes de todas las pruebas, hacer login y obtener StudyUID
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage(); // Nueva página para login
    const cookieHeader = await loginAndGetCookie(page, 'viewer', 'viewer'); // Login y obtener cookies
    api = await request.newContext({baseURL: BASE_URL,extraHTTPHeaders: { Cookie: cookieHeader }}); // Contexto API autenticado
    const studies = await (await api.get('/pacs/studies')).json(); // Obtener lista de estudios y parsear JSON  
    StudyUID = studies[0]['0020000D'].Value[0]; // Tomar el Study Instance UID del primer estudio
  });

  test('Retrieve Study (WADO-RS) y extracción parcial de DICOM', async () => {
    // Aumentar timeout SOLO en esta prueba
    test.setTimeout(240000); 

    const res = await api.get(`/pacs/studies/${StudyUID}`);

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('multipart/related');

    const raw = await res.body(); // buffer del multipart

    // Extraer boundary
    const ct = res.headers()['content-type'];
    const boundaryMatch = ct.match(/boundary="?([^=";]+)"?/);
    expect(boundaryMatch).not.toBeNull();

    const boundary = boundaryMatch[1];
    const delimiter = `--${boundary}`;

    // Convertir multipart a texto (inevitable pero controlado)
    const text = raw.toString('binary');

    const parts = text.split(delimiter).filter(p => p.includes('Content-Type'));
    expect(parts.length).toBeGreaterThan(0);

    // Directorio de evidencia
    const evidenceDir = path.join(process.cwd(), 'evidence', 'api', 'retrieve', 'study');
    fs.mkdirSync(evidenceDir, { recursive: true });

    let dicomCount = 0;

    for (const part of parts) {
      if (dicomCount >= MAX_FILES) break;
      if (!part.includes('application/dicom')) continue;

      const dicomRaw = part.split('\r\n\r\n')[1];
      if (!dicomRaw) continue;

      const dicomBuffer = Buffer.from(dicomRaw, 'binary');

      // Validación mínima
      expect(dicomBuffer.indexOf('DICM')).toBeGreaterThan(-1);

      dicomCount++;
      fs.writeFileSync(
        path.join(evidenceDir, `study-${StudyUID}-img${dicomCount}.dcm`),
        dicomBuffer
      );
    }

    expect(dicomCount).toBeGreaterThan(0);

    test.info().attach('Resumen DICOM extraídos del estudio', {
      body: Buffer.from(`Se extrajeron ${dicomCount} archivos DICOM del StudyUID ${StudyUID}.`),
      contentType: 'text/plain'
    });
  });
});


/**“Debido a las características propias del protocolo DICOMWeb WADO-RS, el endpoint Retrieve Study entrega un objeto multipart que puede superar los cientos de megabytes. Por esta razón, y siguiendo buenas prácticas en pruebas para PACS, esta operación se validó manualmente mediante herramientas de inspección DICOM (curl, Postman, Weasis) en lugar de automatizarse con Playwright, que no está optimizado para descargas masivas ni para decodificación de MIME multipart de gran tamaño.” */