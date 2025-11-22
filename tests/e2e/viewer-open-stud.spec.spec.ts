import { test, expect } from '@playwright/test';
import { loginToPACS } from '../utils/authHelper';
import { selectors } from '../utils/selectors';

test.describe('Visualización de estudios en OHIF Viewer', () => {

  test('El usuario puede abrir un estudio y visualizar imágenes DICOM en modos basico', async ({ page }) => {
    await loginToPACS(page, 'viewer', 'viewer');

    // Esperar lista de estudios
    await expect(page.locator(selectors.studyList)).toBeVisible();

    // Hacer clic en el primer paciente
    await page.getByRole('row').nth(11).click(); // tercer paciente (index inicia en 0)
    await page.screenshot({ path: 'evidence/after-patient-click.png', fullPage: true }); // Tomar captura de pantalla después de hacer click en el paciente
    //
    await page.getByRole('button', { name: 'Basic Viewer' }).click(); // Hacer click en el botón 'Basic Viewer'
    await page.screenshot({ path: 'evidence/viewer-opened.png', fullPage: true }); // Tomar captura de pantalla después de abrir el visor
    //
    await page.getByRole('button', { name: 'Skip all' }).click(); // Hacer click en el botón 'Skip all' para omitir tutoriales o mensajes iniciales
    await page.screenshot({ path: 'evidence/after-skip-all.png', fullPage: true }); // Tomar captura de pantalla después de omitir todos los tutoriales
    // 
    await page.getByRole('button', { name: 'Confirm and hide' }).click(); // Hacer click en el botón 'Confirm and hide' para cerrar cualquier notificación
    await page.screenshot({ path: 'evidence/after-confirm-and-hide.png', fullPage: true }); // Tomar captura de pantalla después de confirmar y ocultar notificaciones

    // Verificar que el visor OHIF se cargó correctamente
    await expect(page.locator('canvas')).toBeVisible(); // Verificar que el canvas del visor esté visible
    // Tomar evidencia
    await page.screenshot({ path: 'evidence/viewer-opened.png', fullPage: true });

    await page.getByTestId('image-scrollbar-input').fill('93'); // Navegar a la imagen 70
    // 🟢 Esperar 1 segundo ANTES de tomar la captura final
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'evidence/viewer-image-93.png', fullPage: true }); // Tomar evidencia de la imagen 93



  });
});
