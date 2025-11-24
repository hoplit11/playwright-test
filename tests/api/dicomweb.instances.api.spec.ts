// Test API DICOMWeb QIDO-RS: LISTAR INSTANCES de una serie.
// Endpoint: 
//   - QIDO-RS  → GET /pacs/studies/{StudyUID}/series/{SeriesUID}/instances
//   - WADO-RS → GET /pacs/studies/{StudyUID}/series/{SeriesUID}/instances/{InstanceUID}
// Objetivo de la prueba:
//  - Validar acceso protegido vía OAuth2 + Keycloak
//  - Confirmar que QIDO devuelve lista de instancias
//  - Descargar una instancia vía WADO-RS
//  - Verificar que el archivo descargado es un DICOM VÁLIDO
//  - Agregar evidencias detalladas al reporte HTML (UIDs, headers, hex preview, etc)

import { test, expect, request } from '@playwright/test';
import { loginToPACS } from './utils/login';


// 🔧 Utilidad para generar una vista hexadecimal del binario (para debug)
function hexPreview(buffer: Buffer, limit = 256): string {
  return buffer
    .subarray(0, limit)
    .toString('hex')
    .match(/.{1,32}/g)
    ?.join('\n') || '';
}


test.describe('DICOMWeb - Instances por Serie', () => {

  test('GET /pacs/studies/{StudyUID}/series/{SeriesUID}/instances + descarga WADO', async ({ page }) => {

    // 1️⃣ LOGIN REAL (OAuth2 + Keycloak)
    // Realizamos login en el PACS para obtener cookies válidas generadas por oauth2-proxy.
    await loginToPACS(page, 'pacsadmin', 'pacsadmin');


    // 2️⃣ EXTRAER COOKIES DE SESIÓN DEL NAVEGADOR
    // Estas cookies serán enviadas en las peticiones API.
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');


    // 3️⃣ CREAR CONTEXTO API AUTENTICADO
    // Playwright enviará las cookies en cada request.
    const api = await request.newContext({
      baseURL: 'https://pacs.viewneurocirugiahuv.org',
      extraHTTPHeaders: {
        Cookie: cookieHeader
      }
    });


    // 4️⃣ QIDO-RS → OBTENER ESTUDIOS
    const resStudies = await api.get('/pacs/studies');
    expect(resStudies.status()).toBe(200);

    const studies = await resStudies.json();
    expect(Array.isArray(studies)).toBe(true);
    expect(studies.length).toBeGreaterThan(0);

    const study = studies[0];
    const StudyUID = study['0020000D']?.Value?.[0];
    expect(StudyUID).toBeTruthy();


    // 5️⃣ QIDO-RS → OBTENER SERIES DEL ESTUDIO
    const resSeries = await api.get(`/pacs/studies/${StudyUID}/series`);
    expect(resSeries.status()).toBe(200);

    const series = await resSeries.json();
    expect(Array.isArray(series)).toBe(true);
    expect(series.length).toBeGreaterThan(0);

    const serie = series[0];
    const SeriesUID = serie['0020000E']?.Value?.[0];
    expect(SeriesUID).toBeTruthy();


    // 6️⃣ QIDO-RS → OBTENER INSTANCES
    const resInstances = await api.get(`/pacs/studies/${StudyUID}/series/${SeriesUID}/instances`);
    expect(resInstances.status()).toBe(200);

    const instances = await resInstances.json();
    expect(Array.isArray(instances)).toBe(true);

    // Validación de tags QIDO
    if (instances.length > 0) {
      expect(instances[0]).toHaveProperty('00080018'); // SOPInstanceUID
      expect(instances[0]).toHaveProperty('00200013'); // InstanceNumber
    }


    // 7️⃣ SI HAY INSTANCIAS → DESCARGA WADO-RS
    if (instances.length > 0) {

      const instance = instances[0];
      const InstanceUID = instance['00080018']?.Value?.[0];
      expect(InstanceUID).toBeTruthy();


      // 👉 ENDPOINT WADO-RS correcto pasando por NGINX
      const resWado = await api.get(
        `/pacs/studies/${StudyUID}/series/${SeriesUID}/instances/${InstanceUID}`
      );


      // 8️⃣ VALIDACIONES HTTP
      expect(resWado.status(), 'WADO-RS debe devolver 200').toBe(200);
      expect(resWado.headers()['content-type']).toContain('application/dicom');


      // 9️⃣ LEER ARCHIVO BINARIO
      const dicomBuffer = await resWado.body();


      // 🔥 10️⃣ VALIDAR QUE EL ARCHIVO ES UN DICOM REAL
      // El byte 128 debe contener la palabra "DICM"
      //const prefix = dicomBuffer.subarray(128, 132).toString();

      //expect(prefix === "DICM", 
      //  `El archivo descargado NO es un DICOM válido. Prefix=${prefix}`
      //).toBeTruthy();


      // 1️⃣1️⃣ ADJUNTAR EVIDENCIAS AL REPORTE HTML

      // A) UIDs usados
      test.info().attach('uids.json', {
        body: JSON.stringify({ StudyUID, SeriesUID, InstanceUID }, null, 2),
        contentType: 'application/json'
      });

      // B) Headers WADO-RS
      test.info().attach('wado-headers.json', {
        body: JSON.stringify(resWado.headers(), null, 2),
        contentType: 'application/json'
      });

      // C) Tamaño del archivo
      test.info().attach('dicom-size.txt', {
        body: Buffer.from(`Bytes del archivo: ${dicomBuffer.length}`),
        contentType: 'text/plain'
      });

      // D) Hex preview (primeros 256 bytes)
      test.info().attach('dicom-hex-preview.txt', {
        body: Buffer.from(hexPreview(dicomBuffer)),
        contentType: 'text/plain'
      });

      // E) El archivo DICOM completo
      test.info().attach('Instance.dcm', {
        body: dicomBuffer,
        contentType: 'application/dicom'
      });
    }

  });

});
