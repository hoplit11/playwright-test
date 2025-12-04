# Documentación Completa de Page Objects --- Proyecto PACS (OHIF + Keycloak + Orthanc)

## 📘 Introducción

Este documento describe en detalle los **Page Objects** utilizados en el
proyecto de pruebas automatizadas Playwright para el sistema PACS
desplegado con: - Keycloak (autenticación) - OAuth2 Proxy + NGINX
(autorización y proxy) - OHIF Viewer (visor DICOM) - Orthanc
(administración PACS)

Los Page Objects encapsulan la lógica de interacción con las páginas,
facilitando pruebas mantenibles, limpias y escalables.

------------------------------------------------------------------------

## 🟦 1. LoginPage

**Archivo:** `tests/pages/LoginPage.ts`\
**Función:** Representar el formulario de login de Keycloak.

### ✔ Funcionalidades

-   Completar usuario y contraseña.
-   Hacer clic en "Sign In".
-   Abstraer el proceso de autenticación.

### 📦 Código Documentado

``` ts
import { Page } from '@playwright/test';

/**
 * Page Object que representa el formulario de login de Keycloak.
 * Se encarga de encapsular los elementos y acciones necesarios
 * para iniciar sesión en el sistema PACS.
 */
export class LoginPage {
  constructor(public page: Page) {}

  // Selectores principales del formulario
  username = this.page.locator('input#username');
  password = this.page.locator('input#password');
  signInButton = this.page.getByRole('button', { name: 'Sign In' });

  /**
   * Realiza login completando usuario y contraseña y
   * enviando el formulario.
   *
   * @param username Usuario de Keycloak
   * @param password Contraseña del usuario
   */
  async login(username: string, password: string) {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.signInButton.click();
  }
}
```

------------------------------------------------------------------------

## 🟩 2. ViewerPage

**Archivo:** `tests/pages/ViewerPage.ts`\
**Función:** Modelar el visor OHIF tras el login.

### ✔ Funcionalidades

-   Validar carga correcta del OHIF Viewer.
-   Interactuar con la Study List.
-   Abrir estudios.
-   Identificar el canvas Cornerstone.

### 📦 Código Documentado

``` ts
import { Page, expect } from '@playwright/test';

/**
 * Page Object del visor OHIF.
 * Permite validar que la Study List está visible,
 * interactuar con pacientes y verificar el área del visor.
 */
export class ViewerPage {
  constructor(public page: Page) {}

  // Selectores del visor
  studyListLabel = this.page.getByText('Study List');
  firstPatientRow = this.page.locator('tbody tr').first();
  canvas = this.page.locator('#cornerstone-canvas');

  /**
   * Espera explícitamente a que la Study List cargue.
   * Esto confirma que el login y redirección funcionaron correctamente.
   */
  async expectLoaded() {
    await expect(this.studyListLabel).toBeVisible();
  }

  /**
   * Abre el primer estudio de paciente en la lista.
   */
  async openFirstPatient() {
    await this.firstPatientRow.click();
  }
}
```

------------------------------------------------------------------------

## 🟥 3. OrthancAdminPage

**Archivo:** `tests/pages/OrthancAdminPage.ts`\
**Función:** Representar la página de administración del PACS (Orthanc),
protegida por OAuth2 Proxy.

### ✔ Funcionalidades

-   Validar permisos del usuario (pacsadmin).
-   Verificar que Orthanc Admin cargó.
-   Navegar a módulos como "Patients".

### 📦 Código Documentado

``` ts
import { Page, expect } from '@playwright/test';

/**
 * Page Object de la interfaz de administración de Orthanc,
 * accesible a través de la ruta /pacs-admin en el entorno PACS.
 *
 * Esta ruta está protegida por OAuth2 Proxy y NGINX,
 * y solo los usuarios con el grupo "pacsadmin" tienen acceso.
 */
export class OrthancAdminPage {
  constructor(public page: Page) {}

  // Elementos representativos de la interfaz de Orthanc
  heading = this.page.getByText('Orthanc');
  patientsMenu = this.page.getByRole('link', { name: 'Patients' });

  /**
   * Valida que la interfaz de Orthanc se cargó correctamente.
   * Implica que:
   *  - el usuario tiene permisos
   *  - el proxy reverso funcionó
   *  - Orthanc respondió con éxito
   */
  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  /**
   * Navega al módulo de pacientes en Orthanc Admin.
   */
  async goToPatients() {
    await this.patientsMenu.click();
  }
}
```

------------------------------------------------------------------------

## 🧩 Integración con authHelper

El Page Object `LoginPage` puede combinarse con tu helper actual
`loginToPACS()`.

------------------------------------------------------------------------

## 📚 Ejemplo completo de un test usando Page Objects

``` ts
import { LoginPage } from '../pages/LoginPage';
import { OrthancAdminPage } from '../pages/OrthancAdminPage';
import { test, expect } from '@playwright/test';

test('Pacsadmin puede acceder a administración', async ({ page }) => {
  const login = new LoginPage(page);

  await page.goto('/');
  await login.login('pacsadmin', 'pacsadmin');

  const response = await page.goto('/pacs-admin');
  expect(response?.status()).toBe(200);

  const adminPage = new OrthancAdminPage(page);
  await adminPage.expectLoaded();
});
```

------------------------------------------------------------------------

## 🏁 Conclusión

Los Page Objects permiten:

-   Reutilización de código
-   Mantenimiento más fácil
-   Pruebas más limpias y legibles
-   Separación clara entre lógica de tests y UI

Este patrón es fundamental para proyectos QA profesionales y escalables.
