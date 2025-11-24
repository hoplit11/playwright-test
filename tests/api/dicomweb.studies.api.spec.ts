// Test API DICOMWeb QIDO-RS: verifica autenticación, status 200, estructura de estudios DICOM y genera evidencia en reporte HTML.

import { test, expect, request } from '@playwright/test';
import { loginToPACS } from './utils/login';

/**
 * Pruebas API para el endpoint DICOMWeb QIDO-RS:
 *     GET /pacs/studies
 * Objetivo:
 *  - Verificar que el endpoint está protegido y solo accesible tras login
 *  - Confirmar que el PACS devuelve un arreglo JSON válido
 *  - Validar que la estructura corresponde a DICOMweb (tags estándar)
 */

test.describe('DICOMWeb - QIDO Básico', () => {

  test('GET /pacs/studies Devuelve 200, lista de estudios y adjunta evidencia', async ({ page }) => {

    // 1️⃣ LOGIN VIA UI (OAUTH2 REDIRECT + KEYCLOAK)
    // ---------------------------------------------------------
    // Esto es necesario porque:
    // - oauth2-proxy no permite autenticación directa por API
    // - la única forma oficial de obtener cookies válidas es mediante login real
    await loginToPACS(page, 'viewer', 'viewer');

    // 2️⃣ EXTRAER COOKIES DE SESIÓN AUTENTICADA
    // ---------------------------------------------------------
    // Aquí tomamos las cookies del navegador luego del login.
    const cookies = await page.context().cookies();
    // Playwright requiere un header "Cookie" en formato:
    // name=value; name2=value2; ...
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // 3️⃣ CREAR UN CONTEXTO API AUTENTICADO (NO HEADLESS)
    // ---------------------------------------------------------
    // Esto permite hacer llamadas API directas SIN volver a usar la UI.
    const api = await request.newContext({
      baseURL: 'https://pacs.viewneurocirugiahuv.org',
      extraHTTPHeaders: { Cookie: cookieHeader}  // Enviar las cookies de sesión para que oauth2-proxy y nginx permitan acceso
    });


    // 4️⃣ PETICIÓN AL ENDPOINT DICOMWEB
    // Esta URL en tu NGINX: /pacs  --> proxy_pass  orthanc:8042/dicom-web/  // Por tanto: GET /pacs/studies   == GET /dicom-web/studies  (en Orthanc)
    const res = await api.get('/pacs/studies'); // res guarda la respuesta, es decir, el objeto HTTP Response. Esta respuesta incluye status, headers y body.


    // 5️⃣ VALIDACIONES DE RESPUESTA
    // Validar que el servidor respondió OK
    expect( res.status(), 'El endpoint /pacs/studies devuelve 200 si el usuario está autenticado').toBe(200);


    // Convertir respuesta JSON
    const json = await res.json(); // json guarda el body parseado como JSON

    // Validar que es un arreglo QIDO-RS
    expect( // Esperamos que la respuesta sea un arreglo
      Array.isArray(json), // isArray devuelve true si el argumento es un array
      'La respuesta DICOMweb QIDO debe ser un array de estudios' // Mensaje de error si falla
    ).toBe(true);


    // Validaciones mínimas de estructura (solo si hay estudios)
    if (json.length > 0) {
      const study = json[0];

      // Tag StudyInstanceUID
      expect( study, 'La respuesta debe incluir el tag DICOM 0020000D (StudyInstanceUID)').toHaveProperty('0020000D');
      expect(study).toHaveProperty('00100020'); // PatientID
      expect(study).toHaveProperty('00100010'); // PatientName

      // PatientID
      //expect( study, 'La respuesta debe incluir el tag DICOM 00080020 (StudyDate)').toHaveProperty('00080020');
    }


    
    // 6️⃣ EVIDENCIAS EN REPORTE HTML
    // Para facilitar debugging, adjuntamos detalles de la respuesta al reporte HTML de Playwright. Esto se hace creando 3 constantes distintas: status, headers y raw (texto sin parsear).
    const status = res.status();
    const headers = res.headers();
    const raw = await res.text();
    
    // Parsear JSON manualmente para adjuntarlo como texto formateado. parsedJson es una variable que puede ser null si el parseo falla.
    // Parsear significa convertir el texto JSON en un objeto JavaScript, para poder inspeccionarlo mejor.
    let parsedJson: any = null;
    try { parsedJson = JSON.parse(raw); } catch {} // Si falla, parsedJson queda como null

    // Si el parseo fue exitoso, adjuntar algunas propiedades del primer estudio (si existe)
    if (parsedJson.length > 0) {
      const study = parsedJson[0]; // Primer estudio
      expect(study).toHaveProperty('0020000D'); // StudyInstanceUID
      expect(study).toHaveProperty('00100010'); // PatientName
      expect(study).toHaveProperty('00100020'); // PatientID
    }

    // EVIDENCIA EN REPORTE HTML
    test.info().attach('status.txt', { // Adjuntar el status HTTP
      body: `Status: ${status}`,  // Contenido del archivo
      contentType: 'text/plain' // Tipo de contenido
    });
 
    test.info().attach('headers.json', { // Adjuntar los headers HTTP
      body: JSON.stringify(headers, null, 2),  // Formatear JSON con indentación
      contentType: 'application/json' // Tipo de contenido
    });

    if (parsedJson) { // Si el parseo fue exitoso, adjuntar el JSON formateado
      test.info().attach('response.json', {
        body: JSON.stringify(parsedJson, null, 2),
        contentType: 'application/json'
      });
    }
    // Adjuntar el texto raw sin parsear
    test.info().attach('raw.txt', {
      body: raw,
      contentType: 'text/plain'
    });


  });

});
