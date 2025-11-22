// tests/api/auth.api.spec.ts

import { test, expect } from '@playwright/test';
import { getKeycloakToken } from './utils/keycloak';

const BASE_URL = 'https://pacs.viewneurocirugiahuv.org';

test.describe('API - Auth y Disponibilidad', () => {

  test('Keycloak está disponible (OpenID config)', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/keycloak/realms/ohif/.well-known/openid-configuration`);
    expect(res.status()).toBe(200);
  });

  test('DICOMWeb /studies responde 200 para viewer autenticado', async ({ request }) => {
    // 🔐 Obtener token real
    const token = await getKeycloakToken(request, {
      baseUrl: BASE_URL,
      username: 'viewer',
      password: 'viewer',
      clientId: 'api-testing-client',
      clientSecret: 'BGrbksHF9nncGu82cNt1fmqJGH89b6ny'
    });

    // Usar request.fetch directamente con Authorization
    const res = await request.fetch(`${BASE_URL}/pacs/dicom-web/studies`, {
      headers: {
        Authorization: `Bearer ${token.access_token}`
      }
    });

    expect(res.status()).toBe(200);
  });

});
