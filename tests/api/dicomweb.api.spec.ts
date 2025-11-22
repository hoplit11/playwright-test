import { test, expect } from '@playwright/test';
import { loginToPACS } from '../utils/authHelper';

test.describe('API - DICOMWeb (QIDO/WADO basics)', () => {
  test('QIDO-RS: listar estudios (viewer)', async ({ page, request }) => {
    await loginToPACS(page, 'viewer', 'viewer');
    const cookies = await page.context().cookies();
    const api = await request.newContext({
      extraHTTPHeaders: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') }
    });

    const qido = await api.get('/pacs/dicom-web/studies');
    expect(qido.status()).toBe(200);
    const json = await qido.json();
    // al menos esperar un array
    expect(Array.isArray(json)).toBeTruthy();
  });

  test('WADO-RS: obtener metadata de un estudio (si existe)', async ({ page, request }) => {
    await loginToPACS(page, 'viewer', 'viewer');
    const cookies = await page.context().cookies();
    const api = await request.newContext({
      extraHTTPHeaders: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') }
    });

    const qido = await api.get('/pacs/dicom-web/studies');
    expect(qido.status()).toBe(200);
    const studies = await qido.json();
    if (Array.isArray(studies) && studies.length > 0) {
      const studyId = studies[0].StudyInstanceUID || studies[0]['0020000D'] || studies[0].StudyInstanceUID;
      const wado = await api.get(`/pacs/dicom-web/studies/${studyId}`);
      expect([200,404]).toContain(wado.status());
    } else {
      test.skip('No hay estudios disponibles para probar WADO-RS');
    }
  });
});
