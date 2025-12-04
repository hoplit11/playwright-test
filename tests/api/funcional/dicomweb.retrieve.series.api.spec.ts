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

import { test, expect, request } from '@playwright/test';
import { loginAndGetCookie } from '../utils/loginforCookies';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://pacs.viewneurocirugiahuv.org';
const MAX_FILES = 15; // Limitamos evidencia para mantener rendimiento

test.describe('DICOMWeb – WADO-RS Retrieve Series (multipart → DICOM)', () => {

  let api;
  let StudyUID;
  let SeriesUID;

  /**
   * BEFORE ALL → LOGIN + obtener StudyUID & SeriesUID reales
   */
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();

    // 1️⃣ Login real vía UI (obligatorio)
    const cookieHeader = await loginAndGetCookie(page, 'viewer', 'viewer');

    // 2️⃣ Contexto API autenticado
    api = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Cookie: cookieHeader }
    });

    // 3️⃣ Obtener primer estudio disponible
    const studies = await (await api.get(`/pacs/studies`)).json();
    expect(studies.length).toBeGreaterThan(0);

    StudyUID = studies[0]['0020000D'].Value[0];

    // 4️⃣ Obtener series del estudio
    const series = await (await api.get(`/pacs/studies/${StudyUID}/series`)).json();
    expect(series.length).toBeGreaterThan(0);

    SeriesUID = series[0]['0020000E'].Value[0];
  });

  /**
   * TEST PRINCIPAL: Retrieve Series (multipart → extraer DICOM)
   */
  test('Retrieve Series completo y extracción de DICOM', async () => {
    // Aumentar timeout SOLO en esta prueba
    test.setTimeout(120000); 
    // 5️⃣ Llamado a WADO-RS Retrieve Series
    const res = await api.get(`/pacs/studies/${StudyUID}/series/${SeriesUID}`);


    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('multipart/related');

    const raw = await res.body(); // buffer binario completo del multipart

    // ======================
    // EXTRAER BOUNDARY
    // ======================
    const ct = res.headers()['content-type'];
    const boundaryMatch = ct.match(/boundary="?([^=";]+)"?/);
    expect(boundaryMatch).not.toBeNull();

    const boundary = boundaryMatch[1];
    const delimiter = `--${boundary}`;

    // Convertir a texto para dividir MIME parts
    const text = raw.toString('binary');

    // Separar cada parte MIME
    const parts = text.split(delimiter).filter(p => p.includes('Content-Type'));
    expect(parts.length).toBeGreaterThan(0);

    // ======================
    // PREPARAR CARPETA DE EVIDENCIA
    // ======================
    const evidenceDir = path.join(process.cwd(), 'evidence', 'api', 'retrieve', 'series');
    fs.mkdirSync(evidenceDir, { recursive: true });

    let dicomCount = 0;

    // ======================
    // EXTRAER Y GUARDAR DICOM
    // ======================
    for (const part of parts) {
      if (dicomCount >= MAX_FILES) break;
      if (!part.includes('application/dicom')) continue;

      const dicomRaw = part.split('\r\n\r\n')[1];
      if (!dicomRaw) continue;

      const dicomBuffer = Buffer.from(dicomRaw, 'binary');

      // Magic bytes DICM en cualquier posición
      expect(dicomBuffer.indexOf('DICM')).toBeGreaterThan(-1);

      dicomCount++;

      // Guardar evidencia .dcm
      fs.writeFileSync(
        path.join(evidenceDir, `series-${SeriesUID}-img${dicomCount}.dcm`),
        dicomBuffer
      );
    }

    expect(dicomCount).toBeGreaterThan(0);

    // Adjuntar evidencia textual al reporte
    test.info().attach(`Retrieve Series — ${dicomCount} imágenes extraídas`, {
      body: Buffer.from(
        `Se extrajeron ${dicomCount} imágenes DICOM de la serie ${SeriesUID}.`
      ),
      contentType: 'text/plain'
    });
  });

});


/**
 * Las operaciones WADO-RS de tipo Retrieve Study y Retrieve Series no son adecuadas para pruebas automatizadas con Playwright debido 
 * al gran tamaño de los objetos multipart retornados por el servidor DICOMWeb.

Los frameworks de testing web no están diseñados para flujos binarios masivos ni para parsing de multipart relacionados con imágenes DICOM. 
Por esta razón, dichas pruebas se validaron mediante herramientas especializadas (curl, Postman, dcm4che, Orthanc Explorer, Weasis), 
mientras que las pruebas automatizadas se enfocan en operaciones QIDO-RS y WADO-RS a nivel de instancia (Retrieve Instance y Retrieve Frames), 
que sí son ligeras y compatibles con automatización.
 */