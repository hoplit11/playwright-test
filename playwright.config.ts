import { defineConfig, devices } from '@playwright/test';
/**
 * Configuración de Playwright para testing de PACS/OHIF Viewer.
 * 
 * Soporta:
 * - Pruebas E2E (UI) en múltiples navegadores
 * - Pruebas API (DICOMweb endpoints)
 * - Ejecución paralela optimizada
 * - Reportes detallados con capturas y videos
 * 
 * Comandos útiles:
 * - npx playwright test                     → Ejecutar todas las pruebas
 * - npx playwright test --project=chromium-e2e → Solo E2E en Chrome
 * - npx playwright test tests/api/smoke    → Solo smoke tests API
 * - npx playwright test --grep /*@critical*/  /* → Solo tests críticos*/
 /* - npx playwright show-report             → Ver último reporte HTML
 */

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  // CONFIGURACIÓN GENERAL
  testDir: './tests',/* Ejecuta los tests en paralelo, que estan en el directorio tests */
  // Timeouts
  timeout: 60 * 1000,              // 60s por test (default: 30s)
  expect: { timeout: 10 * 1000,},// 10s para expects (default: 5s)
  // Ejecución
  fullyParallel: true,  /* Permitir solo la ejecucion de tests marcados como .only en CI (Continius Integration) */
  forbidOnly: !!process.env.CI,  /* Retry on CI only */ /* Reintenta los tests fallidos 2 veces en CI, 0 veces en local */
  retries: process.env.CI ? 2 : 0,  //  Opt out of parallel tests on CI.Limita la ejecucion a un solo worker en CI 2 reintentos en CI, 0 en local
  workers: process.env.CI ? 1 : 4,  /* 1 instancia del navegador por worker, 4 en local (antes era undefined)
  
  /* Reportes HTML en carpeta playwright-report */
  // Reporte HTML interactivo (principal)
  reporter: [['html', { 
     open: 'never', // No abrir automáticamente (usar npx playwright show-report)
     outputFolder: 'playwright-report',
     inlineAssets: false       // Separar assets en carpetas
     }],
    // Reporte de lista en consola (útil para CI/local)
    ['list', { 
      printSteps: false            // No imprimir cada paso (muy verboso)
    }],
    ],  
  
  // Settings aplicables a todos los tests
  use: {
    baseURL: 'https://pacs.viewneurocirugiahuv.org/', /* Base URL for the PACS application */
    headless: true, /* Corre los tests en modo headles, es decir, sin abrir una ventana del navegador */
    screenshot: 'only-on-failure', /* Toma capturas de pantalla solo cuando un test falla */
    video: 'retain-on-failure', /* Graba videos solo cuando un test falla */
    trace: 'on-first-retry',/* Graba un rastro de la ejecución del test en el primer reintento */
  },
  
  // PROYECTOS DE PRUEBA (Multi-browser + E2E/API)
  /* Configure projects for major browsers */
  projects: [
    // SMOKE TESTS (Ejecución rápida prioritaria), se ejecutan antes que los demás para validar la estabilidad del sistema
    {
      name: 'smoke-tests',
      testMatch: /.*smoke.*\.spec\.ts/,  // Cualquier archivo con "smoke"
      retries: 0,                        // Sin reintentos (deben pasar siempre)
      use: { 
        ...devices['Desktop Chrome'],
        trace: 'on',                     // Siempre grabar trace en smoke
      },
    },
    /** 2e2 proyectos(UI) */
    { name: 'chromium-e2e', testMatch: /tests\/e2e\/.*\.spec\.ts/, dependencies: ['smoke-tests'], use: { ...devices['Desktop Chrome'] },},
    { name: 'firefox-e2e', testMatch: /tests\/e2e\/.*\.spec\.ts/, dependencies: ['smoke-tests'], use: { ...devices['Desktop Firefox'] },},
    //{ name: 'edge-e2e', testMatch: /tests\/e2e\/.*\.spec\.ts/, dependencies: ['smoke-tests'], use: { ...devices['Desktop Edge'] },},
    //{ name: 'webkit-e2e',testMatch: /tests\/e2e\/.*\.spec\.ts/, use: { ...devices['Desktop Safari'] },},

 /** 📌 API PROJECTS (REST/DICOMWeb) */
    { name: 'chromium-api', testMatch: /tests\/api\/.*\.api\.spec\.ts/, dependencies: ['smoke-tests'], use: { ...devices['Desktop Chrome'] },},
    //{ name: 'firefox-api', testMatch: /tests\/api\/.*\.api\.spec\.ts/,dependencies: ['smoke-tests'], use: { ...devices['Desktop Firefox'] },},
    //{ name: 'edge-api', testMatch: /tests\/api\/.*\.api\.spec\.ts/, dependencies: ['smoke-tests'], use: { ...devices['Desktop Edge'] },},
    //{ name: 'webkit-api', testMatch: /tests\/api\/.*\.api\.spec\.ts/, use: { ...devices['Desktop Safari'] },},
  ],

});
