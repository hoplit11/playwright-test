import { test, expect, request } from '@playwright/test';
import { loginAndGetCookie } from '../../utils/loginforCookies';
import { extractDicomFromMultipart } from '../../utils/dicomMultipart';
import fs from 'fs';
import path from 'path';
import * as dcmjs from 'dcmjs';

const BASE_URL = 'https://pacs.viewneurocirugiahuv.org';

test.describe('DICOMWeb - WADO-RS Retrieve con Validación', () => {
  // Variables globales para UIDs y contexto API
  let apiContext; // Contexto API autenticado
  let StudyUID: string; // Variables para almacenar los UIDs
  let SeriesUID: string; // de estudio, serie e instancia
  let InstanceUID: string; // de la instancia a validar
  let qidoMetadata: any; // Metadata QIDO de la instancia

  test.beforeAll(async ({ browser }) => {
    // Login y obtener cookies
    const page = await browser.newPage();
    const cookieHeader = await loginAndGetCookie(page, 'viewer', 'viewer');
    await page.close(); // Cerrar la página después del login

    // Crear contexto API
    apiContext = await request.newContext({baseURL: BASE_URL, extraHTTPHeaders: { Cookie: cookieHeader }});

    // Obtener IDs reales
    const studiesRes = await apiContext.get('/pacs/studies');
    expect(studiesRes.ok()).toBeTruthy();
    const studies = await studiesRes.json();
    StudyUID = studies[0]['0020000D']?.Value?.[0];

    const seriesRes = await apiContext.get(`/pacs/studies/${StudyUID}/series`);
    expect(seriesRes.ok()).toBeTruthy();
    const series = await seriesRes.json();
    SeriesUID = series[0]['0020000E']?.Value?.[0];

    const instancesRes = await apiContext.get(`/pacs/studies/${StudyUID}/series/${SeriesUID}/instances`);
    expect(instancesRes.ok()).toBeTruthy();
    const instances = await instancesRes.json();
    
    qidoMetadata = instances[10];
    InstanceUID = instances[10]['00080018']?.Value?.[0];
  });

  test('Retrieve Instance: Descarga y Validación DICOM', async () => {
    console.log(`\n🔍 Descargando instancia: ${InstanceUID}`);

    // 1. Descargar via WADO-RS
    const wadoRes = await apiContext.get(
      `/pacs/studies/${StudyUID}/series/${SeriesUID}/instances/${InstanceUID}`
    );

    expect(wadoRes.status()).toBe(200);
    const rawBuffer = await wadoRes.body();
    console.log(`📦 Buffer descargado: ${rawBuffer.length} bytes`);

    // 2. Extraer DICOM del multipart
    const dicomBuffer = extractDicomFromMultipart(
      rawBuffer, 
      wadoRes.headers()['content-type']
    );
    console.log(`✂️ DICOM extraído: ${dicomBuffer.length} bytes`);

    // 3. Validar magic bytes
    const magicBytes = dicomBuffer.slice(128, 132).toString();
    console.log(`🔐 Magic bytes: "${magicBytes}"`);
    expect(magicBytes).toBe('DICM');

    // 4. Parsear con dcmjs
    const dicomData = dcmjs.data.DicomMessage.readFile(dicomBuffer);
    const dicom = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
    console.log(`✅ DICOM parseado - Modality: ${dicom.Modality}`);

    // 5. Validar UIDs
    expect(dicom.SOPInstanceUID).toBe(InstanceUID);
    expect(dicom.SeriesInstanceUID).toBe(SeriesUID);
    expect(dicom.StudyInstanceUID).toBe(StudyUID);

    // 6. Guardar evidencia
    const evidenceDir = path.join(process.cwd(), 'evidence', 'api', 'retrieve', 'validation');
    fs.mkdirSync(evidenceDir, { recursive: true });

    const dicomPath = path.join(evidenceDir, `instance-${InstanceUID}.dcm`);
    fs.writeFileSync(dicomPath, dicomBuffer);
    console.log(`💾 Guardado: ${dicomPath}`);

    // 7. Adjuntar al reporte
    test.info().attach('DICOM File', {
      body: dicomBuffer,
      contentType: 'application/dicom'
    });

    console.log('✅ Test completado\n');
  });

  test('Retrieve Multiple Instances', async () => {
    const instancesRes = await apiContext.get(
      `/pacs/studies/${StudyUID}/series/${SeriesUID}/instances`
    );
    const instances = await instancesRes.json();
    const testInstances = instances.slice(0, 2); // Solo 2 para ir rápido

    console.log(`\n📦 Descargando ${testInstances.length} instancias...`);

    for (const inst of testInstances) {
      const sopUID = inst['00080018']?.Value?.[0];

      const wadoRes = await apiContext.get(
        `/pacs/studies/${StudyUID}/series/${SeriesUID}/instances/${sopUID}`
      );

      expect(wadoRes.ok()).toBeTruthy();
      
      const rawBuffer = await wadoRes.body();
      const dicomBuffer = extractDicomFromMultipart(
        rawBuffer,
        wadoRes.headers()['content-type']
      );

      const magicBytes = dicomBuffer.slice(128, 132).toString();
      expect(magicBytes).toBe('DICM');

      console.log(`  ✅ ${sopUID.substring(0, 20)}... - ${dicomBuffer.length} bytes`);
    }

    console.log(`✅ ${testInstances.length} instancias validadas\n`);
  });

  test.afterAll(async () => {
    if (apiContext) {
      await apiContext.dispose();
    }
  });
});
