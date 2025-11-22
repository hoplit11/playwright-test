import { test, expect } from '@playwright/test';
import { loginToPACS } from '../utils/authHelper';
import { OrthancAdminPage } from '../pages/OrthancAdminPage';

test('Pacsadmin puede acceder a administración', async ({ page }) => {
  await loginToPACS(page, 'pacsadmin', 'pacsadmin');

  const response = await page.goto('/pacs-admin');
  expect(response?.status()).toBe(200);

  const admin = new OrthancAdminPage(page);
  await admin.expectLoaded();
});
