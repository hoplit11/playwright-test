import { defineConfig, devices } from '@playwright/test';

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
  testDir: './tests',/* Ejecuta los tests en paralelo, que estan en el directorio tests */
  fullyParallel: true,  /* Permitir solo la ejecucion de tests marcados como .only en CI, donde CI significa entorno de integracion continua */
  forbidOnly: !!process.env.CI,  /* Retry on CI only */ /* Reintenta los tests fallidos 2 veces en CI, 0 veces en local */
  retries: process.env.CI ? 2 : 0,  /* Opt out of parallel tests on CI. */ /* Limita la ejecucion a un solo worker en CI */
  workers: process.env.CI ? 1 : undefined,  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  
  /* Reportes HTML en carpeta playwright-report */
  reporter: [['html', {
     open: 'never',
     outputFolder: 'playwright-report',
     inlineAssets: false       // 👈 Esto fuerza carpetas data/asset
     }]],  
  
  // Settings aplicables a todos los tests
  use: {
    baseURL: 'https://pacs.viewneurocirugiahuv.org/', /* Base URL for the PACS application */
    headless: true, /* Corre los tests en modo headles, es decir, sin abrir una ventana del navegador */
    screenshot: 'only-on-failure', /* Toma capturas de pantalla solo cuando un test falla */
    video: 'retain-on-failure', /* Graba videos solo cuando un test falla */
    trace: 'on-first-retry',/* Graba un rastro de la ejecución del test en el primer reintento */
  },

  /* Configure projects for major browsers */
  projects: [
    /** 2e2 proyectos(UI) */
    { name: 'chromium-e2e', testMatch: /tests\/e2e\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] },},
    { name: 'firefox-e2e', testMatch: /tests\/e2e\/.*\.spec\.ts/, use: { ...devices['Desktop Firefox'] },},
    { name: 'edge-e2e', testMatch: /tests\/e2e\/.*\.spec\.ts/, use: { ...devices['Desktop Edge'] },},
    //{ name: 'webkit-e2e',testMatch: /tests\/e2e\/.*\.spec\.ts/, use: { ...devices['Desktop Safari'] },},

 /** 📌 API PROJECTS (REST/DICOMWeb) */
    { name: 'chromium-api', testMatch: /tests\/api\/.*\.api\.spec\.ts/, use: { ...devices['Desktop Chrome'] },},
    { name: 'firefox-api', testMatch: /tests\/api\/.*\.api\.spec\.ts/, use: { ...devices['Desktop Firefox'] },},
    { name: 'edge-api', testMatch: /tests\/api\/.*\.api\.spec\.ts/, use: { ...devices['Desktop Edge'] },},
    //{ name: 'webkit-api', testMatch: /tests\/api\/.*\.api\.spec\.ts/, use: { ...devices['Desktop Safari'] },},
  ],

});
