import { test, expect } from '@playwright/test';
import { loginToPACS } from './utils/login';

test.describe('API – Orthanc PACS (autenticado vía Keycloak)', () => {

  test('GET /pacs/studies debe responder 200 con cookies válidas', async ({ page }) => {

    // 1. Login ONE TIME via UI
    await loginToPACS(page, 'viewer', 'viewer');

    // 2. Obtener API client ya autenticado
    const api = page.context().request;

    // 3. Consumir endpoint de Orthanc
    const response = await api.get('https://pacs.viewneurocirugiahuv.org/pacs/studies');

    // 4. Validaciones profesionales
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);

    console.log('Número de estudios:', data.length);
  });

});
