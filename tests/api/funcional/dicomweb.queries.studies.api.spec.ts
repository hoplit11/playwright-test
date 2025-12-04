// Test API DICOMWeb QIDO-RS: verifica autenticación, status 200, estructura de estudios DICOM y genera evidencia en reporte HTML.

import { test, expect, request } from '@playwright/test';
import { loginAndGetCookie } from '../utils/loginforCookies';
import fs from 'fs';
import path from 'path';

/**
 * Pruebas API para el endpoint DICOMWeb QIDO-RS:
 *     GET /pacs/studies
 * Objetivo:
 *  - Verificar que el endpoint está protegido y solo accesible tras login
 *  - Confirmar que el PACS devuelve un arreglo JSON válido
 *  - Validar que la estructura corresponde a DICOMweb (tags estándar)
 */

test.describe('DICOMWeb - QIDO Básico', () => {

  test('GET /pacs/studies Devuelve 200, lista de estudios en el servidor y adjunta evidencia', async ({ page }) => {

    // 1️⃣ LOGIN VIA UI (OAUTH2 REDIRECT + KEYCLOAK) y 2️⃣ EXTRAER COOKIES DE SESIÓN AUTENTICADA
    // Esto es necesario porque:
    // - oauth2-proxy no permite autenticación directa por API
    // - la única forma oficial de obtener cookies válidas es mediante login real
    const cookieHeader = await loginAndGetCookie(page, 'viewer', 'viewer'); // Realiza login y obtiene cookies válidas
    // Aquí tomamos las cookies del navegador luego del login gracias al helper "loginforCookies.ts" y 
    // se las pasamos al contexto API por medio del header "Cookie" (cookieHeader).
    
    // 3️⃣ CREAR UN CONTEXTO API AUTENTICADO (NO HEADLESS)
    // Esto permite hacer llamadas API directas SIN volver a usar la UI.
    const api = await request.newContext({  // Crear un nuevo contexto de request
      baseURL: 'https://pacs.viewneurocirugiahuv.org', // Base URL del PACS con oauth2-proxy y nginx
      extraHTTPHeaders: { Cookie: cookieHeader}  // Enviar las cookies de sesión para que oauth2-proxy y nginx permitan acceso
    });


    // 4️⃣ PETICIÓN AL ENDPOINT DICOMWEB
    // Esta URL en tu NGINX: /pacs  --> proxy_pass  orthanc:8042/dicom-web/  // Por tanto: GET /pacs/studies   == GET /dicom-web/studies  (en Orthanc)
    const resStudies = await api.get('/pacs/studies'); // res guarda la respuesta, es decir, el objeto HTTP Response, en texto. Esta respuesta incluye status, headers y body.
    // -------------------------------------------------------------------------------------------------------
    // 5️⃣ VALIDACIONES DE RESPUESTA
    // Validar que el servidor respondió OK
    expect( resStudies.status(), 'El endpoint /pacs/studies devuelve 200 si el usuario está autenticado').toBe(200);

    // Parsear respuesta JSON
    const studies = await resStudies.json(); // Parsear respuesta JSON
    expect(Array.isArray(studies), 'La respuesta DICOMweb QIDO debe ser un array de estudios').toBe(true); // Verificar que es un arreglo
    expect(studies.length, 'El PACS debe contener al menos 1 estudio para validar su estructura.').toBeGreaterThan(0); // Exigir al menos un estudio


    // Validaciones mínimas de estructura (solo si hay estudios) , para evitar errores si el PACS está vacío
    // Leer tags DICOM obligatorios en un estudio DICOMweb QIDO-RS son 9 tags mínimos
    if (studies.length > 0) {  // Si hay al menos un estudio 
      const study = studies[0]; // Primer estudio del arreglo
      expect(study).toHaveProperty('00080005'); // Specific Character Set o conjunto de caracteres específico
      expect(study).toHaveProperty('00080050'); // Accession Number o número de registro del estudio
      expect(study).toHaveProperty('00080061'); // Modalities in Study o modalidades utilizadas en el estudio
      expect(study).toHaveProperty('00081190'); // Retriever URL o URL de recuperación de datos
      expect(study).toHaveProperty('00100010'); // Patient's Name o nombre del paciente
      expect(study).toHaveProperty('00100020'); // Patient ID o identificador del paciente
      expect(study).toHaveProperty('0020000D'); // Study Instance UID o identificador único del estudio
      expect(study).toHaveProperty('00201206'); // Number of Study Related Series o número de series relacionadas
      expect(study).toHaveProperty('00201208'); // Number of Study Related Instances o número de instancias/imágenes relacionadas
      // Validar valores reales Value[0]
      expect(study['0020000D']?.Value?.[0]).toBeTruthy(); // StudyInstanceUID real
      expect(study['00080061']?.Value?.[0]).toBeTruthy(); // Modalities real
      expect(study['00100020']?.Value?.[0]).toBeTruthy(); // Patient ID real
    }
   
    // 6️⃣ EVIDENCIAS EN REPORTE HTML
    // Para facilitar debugging, adjuntamos detalles de la respuesta al reporte HTML de Playwright. Esto se hace creando 3 constantes distintas: status, headers y raw (texto sin parsear).
    const Studiesstatus = resStudies.status(); // Código de estado HTTP. Contiene solo el número (200, 401, etc)
    const Studiesheaders = resStudies.headers(); // Headers HTTP como objeto clave-valor. Contiene metadatos de la respuesta, como content-type, date, etc.
    const Studiesraw = await resStudies.text(); // Texto raw de la respuesta (sin parsear). Contiene el JSON en formato texto tal cual lo envió el servidor.
    
    // Parsear JSON manualmente para adjuntarlo como texto formateado. parsedJson es una variable que puede ser null si el parseo falla.
    // Parsear significa convertir el texto JSON en un objeto JavaScript, para poder inspeccionarlo mejor.
    let parsedJson: any = null;
    try { parsedJson = JSON.parse(studies); } catch {} // Si falla, parsedJson queda como null

    // EVIDENCIA EN REPORTE HTML
    // Adjuntar status, headers, JSON formateado y raw al reporte HTML de Playwright

    test.info().attach('status.txt', { // Adjuntar el status HTTP
      body: `Status: ${Studiesstatus}`,  // Contenido del archivo
      contentType: 'text/plain' // Tipo de contenido
    });
 
    test.info().attach('headers.json', { // Adjuntar los headers HTTP
      body: JSON.stringify(Studiesheaders, null, 2),  // Formatear JSON con indentación
      contentType: 'application/json' // Tipo de contenido
    });

    if (parsedJson) { // Si el parseo fue exitoso, adjuntar el JSON formateado
      test.info().attach('response.json', {
        body: JSON.stringify(parsedJson, null, 2),  // Formatear JSON con indentación
        contentType: 'application/json'
      });
    }
    test.info().attach('raw.txt', {body: Studiesraw,contentType: 'text/plain'});     // Adjuntar el texto raw sin parsear




   // Evidencia para la carpeta evidence/api/studies
   // === 📂 Ruta local donde guardar evidencia ===
    const evidenceDir = path.join(process.cwd(), 'evidence', 'api','queries', 'studies');

   // Crear la carpeta si NO existe
    fs.mkdirSync(evidenceDir, { recursive: true });

  // === 📤 Guardar evidencias ===
  // Se guardan 3 archivos: status.txt, raw.txt, response.json
  fs.writeFileSync(path.join(evidenceDir, 'Studiesstatus.txt'), Studiesstatus.toString() );
  fs.writeFileSync(path.join(evidenceDir, 'Studiesraw.txt'),Studiesraw);
  fs.writeFileSync(path.join(evidenceDir, 'StudiesResponse.json'),JSON.stringify(studies, null, 2) );
  // Guardar un estudio
  fs.writeFileSync(path.join(evidenceDir, 'Study_Primero.json'), JSON.stringify(studies[0], null, 2) );

  await api.dispose(); // Cerrar el contexto API 

  });

});
