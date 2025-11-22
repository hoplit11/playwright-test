import { Page, expect } from '@playwright/test';

export class ViewerPage {
  constructor(public page: Page) {}

  studyListLabel = this.page.getByText('Study List');
  firstPatientRow = this.page.locator('tbody tr').first();
  canvas = this.page.locator('#cornerstone-canvas');

  async expectLoaded() {
    await expect(this.studyListLabel).toBeVisible();
  }

  async openFirstPatient() {
    await this.firstPatientRow.click();
  }
}
