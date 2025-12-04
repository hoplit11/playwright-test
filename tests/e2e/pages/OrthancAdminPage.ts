import { Page, expect } from '@playwright/test';

export class OrthancAdminPage {
  constructor(public page: Page) {}

  heading = this.page.getByText('Orthanc');
  patientsMenu = this.page.getByRole('link', { name: 'Patients' });

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async goToPatients() {
    await this.patientsMenu.click();
  }
}
