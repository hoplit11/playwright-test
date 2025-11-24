// Test API DICOMWeb QIDO-RS: LISTAR SERIES de un estudio seleccionado.
// Endpoint: GET /pacs/studies/{StudyInstanceUID}/series
// Objetivo:
//  - Verificar autenticación vía cookies generadas por login UI
//  - Confirmar que devuelve 200
//  - Validar que responde un arreglo de series
//  - Validar que la estructura contiene tags DICOM estándar
//  - Generar evidencia en reporte HTML

import { test, expect, request } from '@playwright/test';
import { loginToPACS } from './utils/login';

test.describe('DICOMWeb - Series por Estudio', () => {

  test('GET /pacs/studies/{StudyUID}/series devuelve 200 y lista de series', async ({ page }) => {

    // 1️⃣ LOGIN A TRAVÉS DEL VIEWER (OAuth2 + Keycloak)
    await loginToPACS(page, 'viewer', 'viewer');

    // 2️⃣ EXTRAER COOKIES DE SESIÓN
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // 3️⃣ CREAR CONTEXTO API AUTENTICADO
    const api = await request.newContext({
      baseURL: 'https://pacs.viewneurocirugiahuv.org',
      extraHTTPHeaders: { Cookie: cookieHeader }
    });

    // 4️⃣ OBTENER ESTUDIOS
    const resStudies = await api.get('/pacs/studies');
    expect(resStudies.status(), 'El endpoint /pacs/studies debe devolver 200').toBe(200);

    const studies = await resStudies.json();
    expect(Array.isArray(studies), 'La respuesta debe ser un array de estudios').toBe(true);
    expect(studies.length, 'Debe existir al menos un estudio para continuar con la prueba').toBeGreaterThan(0);

    // Elegir el primer estudio
    const study = studies[0]; // Primer estudio del arreglo
    const StudyUID = study['0020000D']?.Value?.[0]; // Obtener StudyInstanceUID
    expect(StudyUID, 'El StudyInstanceUID debe estar presente (tag 0020000D)').toBeTruthy(); 

    // 5️⃣ OBTENER SERIES DEL ESTUDIO
    const resSeries = await api.get(`/pacs/studies/${StudyUID}/series`);
    expect(resSeries.status(), 'El endpoint de series debe devolver 200').toBe(200);

    const series = await resSeries.json(); // Parsear respuesta JSON
    expect(Array.isArray(series), 'La respuesta debe ser un array de series').toBe(true);

    // 6️⃣ VALIDAR ESTRUCTURA (si hay series)
    if (series.length > 0) {
      const serie = series[0];
      expect(serie).toHaveProperty('0020000E'); // SeriesInstanceUID
      expect(serie).toHaveProperty('00080060'); // Modality
    }

    // 7️⃣ EVIDENCIAS EN REPORTE HTML
    test.info().attach('SeriesResponse.json', {
      body: JSON.stringify(series, null, 2),
      contentType: 'application/json'
    });

  });

});
