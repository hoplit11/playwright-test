/**
 * ================================================================================
 * Archivo: dicomweb.retrieve.series.api.spec.ts
 * Tipo: Prueba API Funcional — DICOMWeb WADO-RS
 *
 * Objetivo:
 *   ✔ Validar operación WADO-RS Retrieve Series
 *   ✔ Confirmar que Orthanc retorna multipart/related válido
 *   ✔ Extraer los objetos DICOM encapsulados
 *   ✔ Guardar evidencia de varios archivos .dcm
 *   ✔ Adjuntar evidencia al reporte HTML
 *
 * Por qué esta prueba es importante:
 *   - Retrieve Series es **fundamental** para flujos PACS-OHIF.
 *   - A diferencia de Retrieve Study, Retrieve Series es ligera y estable.
 *   - Perfecta para pruebas automáticas en tu tesis.
 *
 * ================================================================================
 */

import { test, expect, request, APIRequestContext } from '@playwright/test';
import { loginAndGetCookie } from '../utils/loginforCookies';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://pacs.viewneurocirugiahuv.org';
const MAX_FILES = 3; // Máximo de DICOM a extraer del multipart

test.describe('DICOMWeb - WADO-RS Retrieve Series (multipart → DICOM)', () => {

  let api: APIRequestContext;
  let studyUID: string;
  let seriesUID: string;

  test.beforeAll(async ({ browser }) => {

    // Login UI
    const page = await browser.newPage();
    const cookieHeader = await loginAndGetCookie(page, 'viewer', 'viewer');
    await page.close();

    // Contexto API autenticado
    api = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Cookie: cookieHeader }
    });

    // Obtener un estudio real
    const studies = await (await api.get(`/pacs/studies`)).json();
    expect(studies.length).toBeGreaterThan(0);

    studyUID = studies[0]['0020000D'].Value[0];

    // Obtener series del estudio
    const series = await (await api.get(`/pacs/studies/${studyUID}/series`)).json();
    expect(series.length).toBeGreaterThan(0);

    seriesUID = series[0]['0020000E'].Value[0];
  });

  test('Retrieve Series completo y extracción de múltiples DICOM', async () => {
    test.setTimeout(180000); // 3 minutos máximo

    // Endpoint WADO-RS
    const retrieveSeriesEndpoint = `/pacs/studies/${studyUID}/series/${seriesUID}`;
    const wadoResponse = await api.get(retrieveSeriesEndpoint);

    // Validaciones iniciales
    expect(wadoResponse.status()).toBe(200);
    expect(wadoResponse.headers()['content-type']).toContain('multipart/related');

    const contentType = wadoResponse.headers()['content-type'];
    const multipartBuffer = await wadoResponse.body(); // Buffer crudo

    // Extraer boundary del header
    const boundaryMatch = contentType.match(/boundary="?([^=";]+)"?/);
    expect(boundaryMatch).not.toBeNull();
    const boundary = boundaryMatch![1];

    // Separar partes del multipart SIN convertir a texto
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

    const parts: Buffer[] = [];
    let start = multipartBuffer.indexOf(boundaryBuffer);

    while (start !== -1) {
      const next = multipartBuffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);

      // Obtener el fragmento que va entre dos boundaries
      const part = multipartBuffer.slice(
        start + boundaryBuffer.length,
        next === -1 ? multipartBuffer.indexOf(endBoundaryBuffer) : next
      );

      parts.push(part);
      start = next;
    }

    // Crear directorio de evidencia
    const evidenceDir = path.join(process.cwd(), 'evidence', 'api', 'retrieve', 'series');
    fs.mkdirSync(evidenceDir, { recursive: true });

    let dicomCount = 0;

    // Procesar cada parte MIME
    for (const part of parts) {
      if (dicomCount >= MAX_FILES) break;

      const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
      if (headerEnd === -1) continue;

      const headerText = part.slice(0, headerEnd).toString();
      if (!headerText.includes('application/dicom')) continue;

      // Extraer el DICOM puro
      const dicomBuffer = part.slice(headerEnd + 4);

      // Validar magic bytes
      expect(dicomBuffer.indexOf('DICM')).toBeGreaterThan(-1);

      dicomCount++;

      fs.writeFileSync(
        path.join(evidenceDir, `series-${seriesUID}-img${dicomCount}.dcm`),
        dicomBuffer
      );
    }

    expect(dicomCount).toBeGreaterThan(0);

    // Adjuntar evidencia al reporte
    test.info().attach('WADO-RS Retrieve Series — Resultados', {
      body: Buffer.from(
        `Se extrajeron ${dicomCount} imágenes DICOM de la serie ${seriesUID} (máximo permitido ${MAX_FILES}).`
      ),
      contentType: 'text/plain'
    });

    test.info().attach('WADO-RS Series Headers', {
      body: JSON.stringify(wadoResponse.headers(), null, 2),
      contentType: 'application/json'
    });
  });

});
