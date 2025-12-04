import { test, expect, request } from '@playwright/test';
import { loginAndGetCookie } from '../utils/loginforCookies';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://pacs.viewneurocirugiahuv.org';

/**
 * Parser correcto para extraer un DICOM del multipart/related
 * SIN CONVERTIR NADA A TEXTO (evita dañar el archivo)
 */
function extractDicomFromMultipart(buffer: Buffer, contentType: string): Buffer {
  const boundary = contentType.split('boundary=')[1].replace(/"/g, '');
  const boundaryBuffer = Buffer.from(`--${boundary}`);

  // 📌 Buscar inicio del primer boundary
  let start = buffer.indexOf(boundaryBuffer);
  if (start === -1) throw new Error("Boundary no encontrado.");

  start += boundaryBuffer.length;

  // 📌 Buscar fin de headers (doble salto de línea)
  const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), start);
  if (headerEnd === -1) throw new Error("No se encontraron headers MIME.");

  const dicomStart = headerEnd + 4;

  // 📌 Buscar siguiente boundary
  const nextBoundary = buffer.indexOf(boundaryBuffer, dicomStart);

  // -2 para quitar "\r\n" antes del boundary
  const dicomEnd = nextBoundary !== -1 ? nextBoundary - 2 : buffer.length;

  return buffer.slice(dicomStart, dicomEnd);
}

test.describe('DICOMWeb - WADO-RS Retrieve con Evidencia DICOM (sin /file)', () => {
  let api;
  let StudyUID;
  let SeriesUID;
  let InstanceUID;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const cookieHeader = await loginAndGetCookie(page, 'viewer', 'viewer');

    api = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Cookie: cookieHeader }
    });

    // Obtener metadata real mediante llamadas DICOMWeb QIDO-RS 
    const studies = await (await api.get('/pacs/studies')).json();
    StudyUID = studies[0]['0020000D'].Value[0]; // Obtener el primer StudyInstanceUID

    const series = await (await api.get(`/pacs/studies/${StudyUID}/series`)).json();
    SeriesUID = series[0]['0020000E'].Value[0]; // Obtener el primer SeriesInstanceUID

    const instances = await (await api.get(`/pacs/studies/${StudyUID}/series/${SeriesUID}/instances`)).json();
    InstanceUID = instances[10]['00080018'].Value[0]; // Obtener el primer SOPInstanceUID
  });

  test('Retrieve Instance DICOM REAL desde multipart WADO-RS (compatible con Weasis)', async () => {
    const res = await api.get(`/pacs/studies/${StudyUID}/series/${SeriesUID}/instances/${InstanceUID}`);

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('multipart/related');

    const contentType = res.headers()['content-type'];
    const rawBuffer = await res.body();

    // 🎯 EXTRAER ARCHIVO DICOM LIMPIO (binario)
    const dicomBuffer = extractDicomFromMultipart(rawBuffer, contentType);

    // Validar magic bytes (offset 128)
    expect(dicomBuffer.slice(128, 132).toString()).toBe("DICM"); // Validar que es un DICOM válido

    // 📁 Guardar evidencia
    const evidenceDir = path.join(process.cwd(), 'evidence', 'api', 'retrieve', 'instance');
    fs.mkdirSync(evidenceDir, { recursive: true });

    const filePath = path.join(evidenceDir, `instance-${InstanceUID}.dcm`);
    fs.writeFileSync(filePath, dicomBuffer);

    // Adjuntar al reporte
    test.info().attach('Archivo DICOM extraído (Al descargar cambiar extensión de .dat a .dcm)', {
      body: dicomBuffer,
      contentType: 'application/dicom',
      fileName: `instance-${InstanceUID}.dcm`
    });
  });
});
