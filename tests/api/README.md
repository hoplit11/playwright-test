# Paquete recomendado de pruebas API para Proyecto PACS

Carpeta creada: `tests/api/`

Incluye:
- `auth.api.spec.ts` : health-checks y prueba básica autenticada.
- `permissions.api.spec.ts` : valida permisos entre `viewer` y `pacsadmin`.
- `dicomweb.api.spec.ts` : pruebas QIDO/WADO básicas (listar estudios, obtener metadata).
- `utils/apiClient.ts` : helper para crear contexto API autenticado basado en cookies del `page`.

## Requisitos / Consideraciones

1. Estos tests usan tu helper `loginToPACS(page, username, password)` ubicado en `tests/utils/authHelper.ts`.
   Asegúrate que la ruta relativa sea correcta desde `tests/api/...` -> `../../utils/authHelper`.

2. Playwright `baseURL` debe estar configurado en `playwright.config.ts` para resolver rutas relativas como `/pacs/dicom-web/studies`.

3. Los endpoints están protegidos por Keycloak + OAuth2 Proxy. El enfoque usado:
   - Hacer login por UI (Keycloak).
   - Extraer cookies del contexto de `page`.
   - Crear un `request` context con dichas cookies (`request.newContext({ extraHTTPHeaders: { Cookie: '...'}})`).
   - Hacer peticiones autenticadas a DICOMWeb u otros endpoints.

4. Tests pueden devolver diferentes códigos (302/401/403) según tu entorno (redirecciones, proxies).
   Se permiten variantes razonables en las aserciones para aumentar robustez.

## Cómo ejecutar

Desde la raíz del proyecto:

```bash
npx playwright test tests/api --project=chromium
```

O ejecutar archivos individuales:

```bash
npx playwright test tests/api/permissions.api.spec.ts
```

## Extensiones sugeridas

- Añadir un fixture que haga login programático y devuelva un contexto API.
- Añadir pruebas STOW-RS (upload) si quieres testear almacenamiento.
- Añadir pruebas de performance con herramientas separadas (k6, artillery) para cargas altas.
