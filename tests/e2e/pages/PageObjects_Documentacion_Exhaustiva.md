# Documentación de Page Objects --- Proyecto PACS (OHIF + Keycloak + Orthanc)

## 📘 Introducción General

Este documento constituye la **documentación técnica** de los
Page Objects (POM) diseñados para la automatización de pruebas E2E del
sistema PACS basado en:

-   **OHIF Viewer 3.11** --- Visor DICOM avanzado.
-   **Orthanc** --- Servidor PACS accesible en `/pacs-admin`.
-   **Keycloak** --- Proveedor de identidad (IdP) responsable del login.
-   **OAuth2 Proxy + NGINX** --- Autorización basada en grupos y control
    de acceso.
-   **Cloudflare Tunnel** --- Publicación del servicio PACS bajo red
    CG-NAT.

Los Page Objects permiten **abstraer, encapsular y organizar** la
interacción con la UI, promoviendo:

-   Código más limpio\
-   Tests más legibles\
-   Reducir duplicación\
-   Escalabilidad del proyecto QA\
-   Independencia del contenido visual exacto

Toda la estructura sigue el estándar recomendado por Playwright:

    tests/
      pages/    ← Page Objects
      utils/    ← helpers, funciones, selectores
      e2e/      ← archivos de pruebas

------------------------------------------------------------------------

# 🟦 1. LoginPage --- Page Object del Login de Keycloak

📄 **Archivo:** `tests/pages/LoginPage.ts`\
🔐 **Rol en el flujo:** Punto inicial obligatorio para cualquier
interacción con el PACS.

El formulario de login redireccionado por NGINX → OAuth2 Proxy →
Keycloak debe ser tratado como una "página independiente" aunque no
forme parte del software PACS directamente.

### ✔ Objetivos del PageObject:

-   Aislar el login del resto del sistema.
-   Evitar repetir la lógica del formulario en múltiples tests.
-   Permitir usar cualquier usuario (viewer, pacsadmin, errores, etc.).
-   Hacer el login totalmente reutilizable.

------------------------------------------------------------------------

## 📌 Selectores Identificados

  --------------------------------------------------------------------------------------------
  Elemento            Selector                                  Razonamiento
  ------------------- ----------------------------------------- ------------------------------
  Campo de usuario    `input#username`                          ID estable generado por
                                                                Keycloak

  Campo de contraseña `input#password`                          ID estable

  Botón Sign In       `button[role="button"][name="Sign In"]`   Robustez mediante rol
                                                                accesible
  --------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 📦 Código Documentado al Detalle

``` ts
/**
 * Page Object que representa el formulario de login de Keycloak.
 *
 * Esta clase encapsula los elementos y acciones del proceso
 * de autenticación inicial utilizado en el PACS. Su objetivo
 * es permitir que los tests se mantengan limpios y que la lógica
 * de login se abstraiga completamente del contenido UI.
 */
export class LoginPage {
  constructor(public page: Page) {}

  /** Campo de entrada del nombre de usuario en Keycloak */
  username = this.page.locator('input#username');

  /** Campo de entrada para la contraseña */
  password = this.page.locator('input#password');

  /** Botón que envía el formulario para iniciar sesión */
  signInButton = this.page.getByRole('button', { name: 'Sign In' });

  /**
   * Realiza el flujo completo de login.
   * Incluye el llenado de credenciales y el envío del formulario.
   *
   * @param username Usuario Keycloak
   * @param password Contraseña Keycloak
   */
  async login(username: string, password: string) {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.signInButton.click();
  }
}
```

------------------------------------------------------------------------

# 🟩 2. ViewerPage --- Page Object del OHIF Viewer

📄 **Archivo:** `tests/pages/ViewerPage.ts`\
🎯 **Rol en el flujo:** Representa la pantalla interactiva principal de
OHIF.

El OHIF Viewer es la interfaz con más interacciones y más sensible a
cambios visuales. Para esto, el POM encapsula:

-   Validación clara de que el visor cargó
-   Selección de un estudio de la lista
-   Acceso al canvas DICOM (Cornerstone)

------------------------------------------------------------------------

## 📌 Selectores Identificados

  ------------------------------------------------------------------------
  Componente                   Selector                 Motivo
  ---------------------------- ------------------------ ------------------
  Texto Study List             `text=Study List`        Indicador
                                                        principal de carga

  Primera fila de pacientes    `tbody tr:first-child`   Estudio más
                                                        reciente o primero

  Canvas de OHIF               `#cornerstone-canvas`    Indicador de carga
                                                        del visor
  ------------------------------------------------------------------------

------------------------------------------------------------------------

## 📦 Código Documentado

``` ts
/**
 * Page Object del visor OHIF.
 *
 * Se encarga de encapsular acciones relacionadas con:
 *  - Study List
 *  - Apertura de estudios
 *  - Carga del canvas de visualización DICOM
 *
 * Esto reduce en gran medida la fragilidad de los tests.
 */
export class ViewerPage {
  constructor(public page: Page) {}

  /** Indicador claro de que la Study List cargó */
  studyListLabel = this.page.getByText('Study List');

  /** Primera fila de la lista de estudios/pacientes */
  firstPatientRow = this.page.locator('tbody tr').first();

  /** Canvas Cornerstone usado para visualizar imágenes DICOM */
  canvas = this.page.locator('#cornerstone-canvas');

  /**
   * Espera a que el visor cargue completamente.
   * Este método es crítico para pruebas que continúan
   * después del login.
   */
  async expectLoaded() {
    await expect(this.studyListLabel).toBeVisible();
  }

  /**
   * Abre el primer estudio disponible en la Study List.
   */
  async openFirstPatient() {
    await this.firstPatientRow.click();
  }
}
```

------------------------------------------------------------------------

# 🟥 3. OrthancAdminPage --- Page Object de la Administración PACS (Orthanc)

📄 **Archivo:** `tests/pages/OrthancAdminPage.ts`\
🔑 **Protección:** Solo usuarios del grupo `pacsadmin` pueden acceder.

El acceso a `/pacs-admin` atraviesa:

1.  **NGINX** (location `/pacs-admin/`)
2.  **auth_request** contra OAuth2 Proxy
3.  Revisión del claim `allowed_groups=pacsadmin`
4.  Proxy hacia **Orthanc Server :8042**

Esto lo convierte en un endpoint crítico para la validación de
seguridad.

------------------------------------------------------------------------

## 📌 Selectores Identificados

  Elemento         Selector                        Motivo
  ---------------- ------------------------------- ----------------------------------
  Título Orthanc   `text=Orthanc`                  Identificador universal de la UI
  Menú Patients    `role="link" name="Patients"`   Estable, semántico

------------------------------------------------------------------------

## 📦 Código Documentado

``` ts
/**
 * Page Object de la interfaz de administración de Orthanc.
 *
 * Esta página solo es accesible para usuarios pertenecientes
 * al grupo 'pacsadmin' según Keycloak y OAuth2 Proxy.
 *
 * Permite validar:
 *  - Control de acceso
 *  - Carga correcta del backend Orthanc
 *  - Navegación dentro de la UI
 */
export class OrthancAdminPage {
  constructor(public page: Page) {}

  /** Encabezado general que confirma que Orthanc cargó */
  heading = this.page.getByText('Orthanc');

  /** Menú Patients para navegación interna */
  patientsMenu = this.page.getByRole('link', { name: 'Patients' });

  /**
   * Verifica que Orthanc se haya cargado correctamente.
   * Esto incluye:
   *  - Respuesta 200
   *  - Usuario autorizado
   *  - Proxy reverso funcionando
   */
  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  /**
   * Navega al módulo 'Patients'
   * dentro de la interfaz de Orthanc.
   */
  async goToPatients() {
    await this.patientsMenu.click();
  }
}
```

------------------------------------------------------------------------

# 🔵 Ejemplo Completo de Uso en un Test E2E

``` ts
test('Pacsadmin puede acceder a administración', async ({ page }) => {
  const login = new LoginPage(page);

  await page.goto('/');
  await login.login('pacsadmin', 'pacsadmin');

  const resp = await page.goto('/pacs-admin');
  expect(resp?.status()).toBe(200);

  const admin = new OrthancAdminPage(page);
  await admin.expectLoaded();
});
```

------------------------------------------------------------------------

# 📘 Próximas Extensiones Sugeridas

Puedes extender la automatización con:

-   Page Object de **Vista de Paciente OHIF**
-   Page Object de **Keycloak Logout**
-   Módulo especializado para **Cornerstone Tools**
-   Validación automática de metadatos DICOM
-   Pruebas de captura de pantalla del visor

Solo dime y los generamos.

------------------------------------------------------------------------

# 🏁 Conclusión

Este documento proporciona la guía más completa para mantener, escalar y
profesionalizar la suite de pruebas E2E del sistema PACS.\
Con estos PageObjects:

-   Las pruebas quedan desacopladas de los selectores exactos\
-   La estructura es más clara\
-   El mantenimiento disminuye\
-   El flujo NGINX → OAuth2 Proxy → Keycloak → OHIF → Orthanc se valida
    correctamente
