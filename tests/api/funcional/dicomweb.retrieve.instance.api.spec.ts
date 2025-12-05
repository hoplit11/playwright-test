import { test, expect, request, APIRequestContext } from '@playwright/test';
import { loginAndGetCookie } from '../utils/loginforCookies';
import { extractDicomFromMultipart } from '../utils/dicomMultipart';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://pacs.viewneurocirugiahuv.org';

test.describe('DICOMWeb - WADO-RS Retrieve con Evidencia DICOM (sin /file)', () => {

  // TIPADO CORRECTO
  let api: APIRequestContext;
  let StudyUID: string;
  let SeriesUID: string;
  let InstanceUID: string;

  test.beforeAll(async ({ browser }) => {
    // Login y obtener cookies
    const page = await browser.newPage();
    const cookieHeader = await loginAndGetCookie(page, 'viewer', 'viewer');
    await page.close();

    api = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Cookie: cookieHeader }
    });
    // Obtener UIDs reales
    const studies = await (await api.get('/pacs/studies')).json();
    StudyUID = studies[0]['0020000D'].Value[0];

    const series = await (await api.get(`/pacs/studies/${StudyUID}/series`)).json();
    SeriesUID = series[0]['0020000E'].Value[0];

    const instances = await (await api.get(`/pacs/studies/${StudyUID}/series/${SeriesUID}/instances`)).json();
    // Si no hay instancias, lanzar error
    if (!instances.length) throw new Error('No hay instancias en esta serie');
     // Tomar la primera instancia disponible
    InstanceUID = instances[0]['00080018'].Value[0];
  });

  test('Retrieve Instance DICOM REAL desde multipart WADO-RS', async () => {

    const wadoInstanceEndpoint  = `/pacs/studies/${StudyUID}/series/${SeriesUID}/instances/${InstanceUID}`; // Endpoint WADO-RS
    const wadoResponse = await api.get(wadoInstanceEndpoint ); // Objeto Response que contiene headers y body. 
    // wadoResponse es de tipo APIResponse y contiene métodos para acceder a Headers HTTP, Status code, Raw Body (Buffer) etc.

    // Validaciones básicas de la respuesta WADO-RS
    // Se espera un status 200 y Content-Type multipart/related, que tenga el DICOM dentro
    expect(wadoResponse.status()).toBe(200); // Verificar status 200, es decir, OK
    expect(wadoResponse.headers()['content-type']).toContain('multipart/related'); // Verificar que es multipart

    // Extraemos las 3 partes El estatus, los headers y el body (buffer)
    const instanceStatus = wadoResponse.status(); // 200
    const instanceHeaders = wadoResponse.headers(); // Headers HTTP

    // Extraer el DICOM puro del multipart  
    const contentType = wadoResponse.headers()['content-type']; // Obtener Content-Type de los headers para extraer el boundary
    const multipartBuffer  = await wadoResponse.body(); // Buffer bruto descargado via WADO-RS para esta instancia

    // Usar el helper para extraer el DICOM del multipart
    const dicomFileBuffer  = extractDicomFromMultipart(multipartBuffer , contentType);
    // Validar que el DICOM extraído comienza con "DICM" en el offset 128
    expect(dicomFileBuffer .slice(128, 132).toString()).toBe('DICM');
    //console.log(`✅ Instancia DICOM extraída correctamente: ${InstanceUID}`);

    // === Evidencia en reporte ===
    // Se adjunta el estado, headers y tamaño del DICOM extraído

    // Adjuntar estatus
    test.info().attach('WADO-RS Instance Status', {
      body: instanceStatus.toString(),
      contentType: 'text/plain'
    });

    // Adjuntar headers (formateados)
    test.info().attach('WADO-RS Instance Headers', {
      body: JSON.stringify(instanceHeaders, null, 2),
      contentType: 'application/json'
    });
    // Adjuntar DiCOM extraído
    test.info().attach('DICOM Instance Extracted', {
      body: dicomFileBuffer ,
      contentType: 'application/dicom',
    });




    // === Evidencia en carpeta ===
    const evidenceDir = path.join(process.cwd(), 'evidence', 'api', 'retrieve', 'instance');
    fs.mkdirSync(evidenceDir, { recursive: true }); // Asegurar que la carpeta existe

    fs.writeFileSync(
      path.join(evidenceDir, `instance-${InstanceUID}.dcm`),
      dicomFileBuffer 
    );
  });



});
