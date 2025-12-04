// Test API DICOMWeb QIDO-RS: LISTAR SERIES de un estudio seleccionado.
// Endpoint: GET /pacs/studies/{StudyInstanceUID}/series
// Objetivo:
//  - Verificar autenticación vía cookies generadas por login UI
//  - Confirmar que devuelve 200
//  - Validar que responde un arreglo de series
//  - Validar que la estructura contiene tags DICOM mínimos obligatorios
//  - Generar evidencia en reporte HTML

import { test, expect, request } from '@playwright/test';
import { loginAndGetCookie } from '../utils/loginforCookies.ts';
import fs from 'fs';
import path from 'path';

test.describe('DICOMWeDICOMWeb - QIDO-RS - Series por Estudio', () => {

  test('GET /pacs/studies/{StudyUID}/series devuelve 200 y lista de series', async ({ page }) => 
  {
    // 1️⃣ LOGIN A TRAVÉS DEL VIEWER (OAuth2 + Keycloak) y 2️⃣ EXTRAER COOKIES DE SESIÓN
    const cookieHeader = await loginAndGetCookie(page, 'viewer', 'viewer'); // Realiza login y obtiene cookies válidas
    //  Aquí tomamos las cookies del navegador luego del login gracias al helper "loginforCookies.ts" y
    // 3️⃣ CREAR CONTEXTO API AUTENTICADO
    const api = await request.newContext({
      baseURL: 'https://pacs.viewneurocirugiahuv.org',
      extraHTTPHeaders: { Cookie: cookieHeader }
    });

    // 4️⃣ OBTENER ESTUDIOS
    const resStudies = await api.get('/pacs/studies');
    expect(resStudies.status(), 'El endpoint /pacs/studies debe devolver 200').toBe(200);

    const studies = await resStudies.json(); // Parsear respuesta JSON
    expect(Array.isArray(studies), 'La respuesta debe ser un array de estudios').toBe(true);
    expect(studies.length, 'Debe existir al menos un estudio para continuar con la prueba').toBeGreaterThan(0);

    // Elegir el primer estudio
    const study = studies[0]; // Primer estudio del arreglo. No necesariamente es el primero que aparece en el visualizador DICOM.
    // Extraer StudyInstanceUID del primer estudio
    const StudyUID = study['0020000D']?.Value?.[0] // Obtener StudyInstanceUID
    // fallback: campos no codificados (varía según Orthanc/config). Sirve para varios formatos posibles
    || study?.StudyInstanceUID
    || study?.studyInstanceUid
    || study?.['StudyInstanceUID'];
    expect(StudyUID, `El estudio NO contiene StudyInstanceUID (tag 0020000D). Estudio: ${JSON.stringify(study)}`).toBeTruthy();

    // 5️⃣ QIDO-RS → OBTENER SERIES DEL ESTUDIO
    const resSeries = await api.get(`/pacs/studies/${StudyUID}/series`);
    expect(resSeries.status(), 'El endpoint de series debe devolver 200').toBe(200);
    // Parsear respuesta JSON, para validar que es un arreglo
    const series = await resSeries.json(); // Parsear respuesta JSON
    expect(Array.isArray(series), 'La respuesta debe ser un array de series').toBe(true);

    // 6️⃣ VALIDAR ESTRUCTURA (si hay series)
     // Exigir que haya al menos una serie (parte del objetivo del test)
    expect(series.length, 'Debe existir al menos una serie en el estudio').toBeGreaterThan(0);
    
    const serie = series[0]; // Tomar la primera serie para validar estructura
    // Validar tags DICOM estándar y obligatorio para el nivel de la serie , la serie DICOMweb QIDO-RS tiene al menos estos tags
    expect(serie).toHaveProperty('0020000E'); // Series Instance UID (UID de instancia de la serie)
    expect(serie).toHaveProperty('0020000D'); // Study Instance UID (UID de instancia del estudio)
    expect(serie).toHaveProperty('00080060'); // Modality (Modalidad)
    expect(serie).toHaveProperty('00080005'); // Specific Character Set (Conjunto de caracteres específicos)
    expect(serie).toHaveProperty('0008103E'); // Series Description (Descripción de la serie)
    expect(serie).toHaveProperty('00100020'); // Patient ID (ID del paciente)
    expect(serie).toHaveProperty('00080050'); // Accession Number (Número de acceso)
    expect(serie).toHaveProperty('00081190'); // Retrieve URI (Web link to the series) (URI de recuperación - Enlace web a la serie)
    expect(serie).toHaveProperty('00100010'); // Patient Name (Nombre del paciente)      
    expect(serie).toHaveProperty('00200011'); // Series Number (Número de serie)
    expect(serie).toHaveProperty('00201209'); // Number of Series Related Instances (Número de instancias relacionadas con la serie)
    
   // Validar que los valores de los tag obligatorios tengan contenido real (Value[0]
    expect(serie['0020000E']?.Value?.[0]).toBeTruthy(); // Valor real obligatorio
    expect(serie['0020000D']?.Value?.[0]).toBeTruthy(); // Valor real obligatorio
    expect(serie['00080060']?.Value?.[0]).toBeTruthy(); // Valor real obligatorio

    // 7️⃣ EVIDENCIAS EN REPORTE HTML
    const Seriesstatus = resSeries.status(); // Código de estado HTTP. Contiene solo el número (200, 401, etc)
    const Seriesheaders = resSeries.headers(); // Headers HTTP como objeto clave-valor. Contiene metadatos de la respuesta, como content-type, date, etc.
    const SeriesText = await resSeries.text();

    //Adjuntar status, headers y body de la respuesta de series, tanto raw como parseado JSON

    test.info().attach('StudySelected.json', {
      body: JSON.stringify(study, null, 2),
      contentType: 'application/json'
    });

    test.info().attach('SeriesStatus.txt', {
      body: `Status: ${Seriesstatus}`,
      contentType: 'text/plain'
    });

    test.info().attach('SeriesHeaders.txt', {
      body: JSON.stringify(Seriesheaders, null, 2), 
      contentType: 'application/json'
    });

    test.info().attach('SeriesRaw.txt', {
      body: SeriesText,
      contentType: 'text/plain'
    });

    test.info().attach('SeriesResponse.json', {
      body: JSON.stringify(series, null, 2),
      contentType: 'application/json'
    });



    // 8 Guardar evidencias en archivos locales para revisión manual posterior
    // === 📂 Ruta local donde guardar evidencia ===
    const evidenceDir = path.join(process.cwd(), 'evidence', 'api','queries','series');
    fs.mkdirSync(evidenceDir, { recursive: true });// Crear la carpeta si NO existe

    // === 📤 Guardar evidencias ===
    // Se guardan 3 archivos: status.txt, raw.txt, response.json

    // STATUS
    fs.writeFileSync(path.join(evidenceDir, 'SeriesStatus.txt'),`Status: ${resSeries.status()}` );
    // RAW
    fs.writeFileSync(path.join(evidenceDir, 'SeriesRaw.txt'), SeriesText );
    // RESPONSE JSON    
    fs.writeFileSync(path.join(evidenceDir, 'SeriesResponse.json'),JSON.stringify(series, null, 2) );  
    
    await api.dispose(); // Cerrar el contexto API 

  });

});
