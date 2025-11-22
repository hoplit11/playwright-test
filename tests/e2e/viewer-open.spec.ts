import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import { loginToPACS } from '../utils/authHelper';
import { selectors } from '../utils/selectors';

test('El usuario puede abrir un estudio y visualizar imágenes DICOM en modos basico', async ({ page }, testInfo) => {

  // Crear una sola carpeta fija: evidence/viewer-open
  const evidenceDir = path.join('evidence', 'viewer-open'); // Carpeta fija para este test
  fs.mkdirSync(evidenceDir, { recursive: true }); //

  // Login
  await loginToPACS(page, 'viewer', 'viewer');
  // Esperar lista de estudios
  await expect(page.locator(selectors.studyList)).toBeVisible();
  // Hacer clic en el paciente 6
  await page.getByRole('row').nth(11).click(); // 6 paciente (index inicia en 0)
  await page.screenshot({ path: `${evidenceDir}/1_after-patient-click.png`, fullPage: true }); // Tomar captura de pantalla después de hacer click en el paciente

  await page.getByRole('button', { name: 'Basic Viewer' }).click();
  // Esperar a que aparezca el canvas de OHIF
  await page.waitForSelector('canvas', { state: 'visible' });
  await page.screenshot({ path: `${evidenceDir}/2_viewer-opened.png`, fullPage: true });
  //  
  await page.getByRole('button', { name: 'Skip all' }).click(); // Hacer click en el botón 'Skip all' para omitir tutoriales o mensajes iniciales
  await page.screenshot({ path: `${evidenceDir}/3_after-skip-all.png`, fullPage: true }); // Tomar captura de pantalla después de omitir todos los tutoriales

  await page.getByRole('button', { name: 'Confirm and hide' }).click();        // Hacer click en el botón 'Confirm and hide' para cerrar cualquier notificación
  await page.screenshot({ path: `${evidenceDir}/4_after-confirm-and-hide.png`, fullPage: true }); // Tomar captura de pantalla después de confirmar y ocultar notificaciones
  
  // Verificar que el visor OHIF se cargó correctamente
  await expect(page.locator('canvas')).toBeVisible(); // Verificar que el canvas del visor esté visible
  // Tomar evidencia  
  await page.screenshot({ path: `${evidenceDir}/5_viewer-opened_final.png`, fullPage: true });
});
