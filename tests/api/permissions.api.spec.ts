import { test, expect } from '@playwright/test';
import { loginToPACS } from '../utils/authHelper';

test.describe('API - Permisos (AuthZ)', () => {
  test('viewer NO puede acceder a /pacs-admin (403)', async ({ page, request }) => {
    await loginToPACS(page, 'viewer', 'viewer');
    const cookies = await page.context().cookies();

    const api = await request.newContext({
      extraHTTPHeaders: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') }
    });

    const res = await api.get('/pacs-admin');
    // NGINX/OAuth2 Proxy suele devolver 403 o redirección -> permitimos 401/403/302 según ambiente
    expect([401,403,302]).toContain(res.status());
  });

  test('pacsadmin SÍ puede acceder a /pacs-admin (200)', async ({ page, request }) => {
    await loginToPACS(page, 'pacsadmin', 'pacsadmin');
    const cookies = await page.context().cookies();

    const api = await request.newContext({
      extraHTTPHeaders: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') }
    });

    const res = await api.get('/pacs-admin');
    expect(res.status()).toBe(200);
  });
});
