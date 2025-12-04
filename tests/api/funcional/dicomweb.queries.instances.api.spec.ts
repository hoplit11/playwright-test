// Test API DICOMWeb QIDO-RS: LISTAR INSTANCIAS de una serie.
// Endpoint QIDO-RS:
//   GET /pacs/studies/{StudyUID}/series/{SeriesUID}/instances
//
// Objetivo:
//  - Validar autenticación vía OAuth2 + Keycloak (cookies vía login UI)
//  - Confirmar que QIDO devuelve 200 y un arreglo de instancias
//  - Validar estructura mínima de tags DICOM JSON (QIDO-RS)
//  - Generar evidencias (estudio, serie, instancias)
//  - NO descargar archivos DICOM (NO WADO-RS en esta prueba)
import { test, expect, request } from '@playwright/test';
import { loginAndGetCookie } from '../utils/loginforCookies.ts';
import fs from 'fs';
import path from 'path';


test.describe('DICOMWeb - QIDO-RS - Instances por serie', () => {

  test('GET /pacs/studies/{StudyUID}/series/{SeriesUID}/instances devuelve lista de instancias y la primera instacia ', async ({ page }) => {

    // 1️⃣ LOGIN A TRAVÉS DEL VIEWER (OAuth2 + Keycloak) y 2️⃣ EXTRAER COOKIES DE SESIÓN
    const cookieHeader = await loginAndGetCookie(page, 'viewer', 'viewer'); // Realiza login y obtiene cookies válidas
    //  Aquí tomamos las cookies del navegador luego del login gracias al helper "loginforCookies.ts" y
    // 3️⃣ CREAR CONTEXTO API AUTENTICADO
    const api = await request.newContext({
      baseURL: 'https://pacs.viewneurocirugiahuv.org',
      extraHTTPHeaders: { Cookie: cookieHeader }
    });


    // 4️⃣ OBTENER ESTUDIOS → QIDO-RS (Query based on ID for DICOM Objects-Retrieve Service) → 
    const resStudies = await api.get('/pacs/studies');
    expect(resStudies.status(), 'El endpoint /pacs/studies debe devolver 200').toBe(200);

    const studies = await resStudies.json();
    expect(Array.isArray(studies), 'La respuesta debe ser un array de estudios').toBe(true);
    expect(studies.length, 'Debe existir al menos un estudio para continuar con la prueba').toBeGreaterThan(0);
    
    // Elegir el primer estudio
    const study = studies[0]; // Primer estudio del arreglo. No necesariamente es el primero que aparece en el visualizador DICOM.
    const StudyUID = study['0020000D']?.Value?.[0] // Obtener StudyInstanceUID
    // fallback: campos no codificados (varía según Orthanc/config). Sirve para varios formatos posibles
    || study?.StudyInstanceUID
    || study?.studyInstanceUid
    || study?.['StudyInstanceUID'];
    expect(StudyUID, `El estudio NO contiene StudyInstanceUID (tag 0020000D). Estudio: ${JSON.stringify(study)}`).toBeTruthy();


    // 5️⃣ QIDO-RS → OBTENER SERIES DEL ESTUDIO
    const resSeries = await api.get(`/pacs/studies/${StudyUID}/series`);
    expect(resSeries.status()).toBe(200);

    const series = await resSeries.json();
    expect(Array.isArray(series)).toBe(true);
    expect(series.length).toBeGreaterThan(0);

    const serie = series[0]; // Primera serie del primer estudio
    const SeriesUID = serie['0020000E']?.Value?.[0]; // Obtener SeriesInstanceUID de la serie para obtener las instancias
    expect(SeriesUID, 'La serie no contiene SeriesInstanceUID (0020000E)').toBeTruthy();


    // 6️⃣ QIDO-RS → OBTENER INSTANCES
    const resInstances = await api.get(`/pacs/studies/${StudyUID}/series/${SeriesUID}/instances`); // QIDO-RS para instancias. Guarda todas las instancias (data de las imágenes) de la serie
    expect(resInstances.status(), 'GET instances debe responder 200').toBe(200);

    const instances = await resInstances.json(); // Parsear respuesta JSON
    expect(Array.isArray(instances), 'Debe devolver arreglo de instancias').toBe(true);
    
    //VALIDAR ESTRUCTURA (si hay instancias)
     // Exigir que haya al menos una instancia en las erie  (parte del objetivo del test)
    expect(instances.length, 'Debe existir al menos una instancia en la serie').toBeGreaterThan(0);
    // Validaciones mínimas QIDO-RS (solo metadata)
    
    expect(instances[0]).toHaveProperty('00080005'); // Specific Character Set (Conjunto de caracteres específicos)
    expect(instances[0]).toHaveProperty('00080016'); // SOP Class UID (UID de clase SOP - Identificador del tipo de objeto DICOM)
    expect(instances[0]).toHaveProperty('00080018'); // SOP Instance UID (UID de instancia SOP - Identificador único global de esta imagen/archivo)
    expect(instances[0]).toHaveProperty('00080050'); // Accession Number (Número de acceso)
    expect(instances[0]).toHaveProperty('00080056'); // Instance Availability (Disponibilidad de la instancia)
    expect(instances[0]).toHaveProperty('00080060'); // Modality (Modalidad - Tipo de equipo, ej: MR para Resonancia Magnética)
    expect(instances[0]).toHaveProperty('0008103E'); // Series Description (Descripción de la serie)
    expect(instances[0]).toHaveProperty('00081190'); // Retrieve URI (Web link to the instance) (URI de recuperación - Enlace web a la instancia)
    expect(instances[0]).toHaveProperty('00100010'); // Patient Name (Nombre del paciente)
    expect(instances[0]).toHaveProperty('00100020'); // Patient ID (ID del paciente)
    expect(instances[0]).toHaveProperty('0020000D'); // Study Instance UID (UID de instancia del estudio - Identificador único de todo el estudio)
    expect(instances[0]).toHaveProperty('0020000E'); // Series Instance UID (UID de instancia de la serie - Identificador único del conjunto de imágenes)
    expect(instances[0]).toHaveProperty('00200011'); // Series Number (Número de serie)
    expect(instances[0]).toHaveProperty('00200013'); // Instance Number (Número de instancia - Posición de esta imagen dentro de la serie)
    expect(instances[0]).toHaveProperty('00280010'); // Rows (Filas - Dimensión vertical de la imagen en píxeles)
    expect(instances[0]).toHaveProperty('00280011'); // Columns (Columnas - Dimensión horizontal de la imagen en píxeles)
    expect(instances[0]).toHaveProperty('00280100'); // Bits Allocated (Bits asignados - Profundidad de color/información por píxel)
    
    // Validar que los valores tengan contenido real (Value[0])
    expect(instances[0]['00080016']?.Value?.[0]).toBeTruthy(); // SOP Class UID real
    expect(instances[0]['00080018']?.Value?.[0]).toBeTruthy(); // SOP Instance UID real
    expect(instances[0]['0020000D']?.Value?.[0]).toBeTruthy(); // Study Instance UID real
    expect(instances[0]['0020000E']?.Value?.[0]).toBeTruthy(); // Series Instance UID real
    expect(instances[0]['00200013']?.Value?.[0]).toBeTruthy(); // Instance Number real
    expect(instances[0]['00280010']?.Value?.[0]).toBeTruthy(); // Rows real
    expect(instances[0]['00280011']?.Value?.[0]).toBeTruthy(); // Columns real

    const instance = instances[0]; // Primera instancia para validar estructura de la serie (primera)
    expect(instance, 'No se obtuvo ninguna instancia de la serie').toBeTruthy();
 
  
    // 7️⃣ Evidencias en reporte HTML
    test.info().attach('StudySelected.json', {
      body: JSON.stringify(study, null, 2),
      contentType: 'application/json'
    });

    test.info().attach('SeriesSelected.json', {
      body: JSON.stringify(serie, null, 2),
      contentType: 'application/json'
    });

    test.info().attach('InstancesResponse.json', {
      body: JSON.stringify(instances, null, 2),
      contentType: 'application/json'
    });

    test.info().attach('InstancesCount.txt', {
      body: `Número de instancias obtenidas: ${instances.length}`,
      contentType: 'text/plain'
    });

    test.info().attach('FirstInstance.json', {
      body: JSON.stringify(instance, null, 2),
      contentType: 'application/json'
    });


    // 8️⃣  Evidencia para la carpeta evidence/api/studies
    // === 📂 Ruta local donde guardar evidencia ===
    const evidenceDir = path.join(process.cwd(), 'evidence', 'api', 'queries','instances');

    // Crear la carpeta si NO existe
    fs.mkdirSync(evidenceDir, { recursive: true });
    
    // === 📤 Guardar evidencias en la carpeta ===
    
    fs.writeFileSync(path.join(evidenceDir, 'study.json'),JSON.stringify(study, null, 2));
    fs.writeFileSync(path.join(evidenceDir, 'series.json'),JSON.stringify(serie, null, 2));
    fs.writeFileSync(path.join(evidenceDir, 'instances.json'),JSON.stringify(instances, null, 2));
    fs.writeFileSync(path.join(evidenceDir, 'FirstInstance.json'),JSON.stringify(instance, null, 2));

    fs.writeFileSync(path.join(evidenceDir, 'InstancesCount.txt'), `Número de instancias obtenidas: ${instances.length}`);


    // Cerrar contexto API
    await api.dispose();

  });

});
