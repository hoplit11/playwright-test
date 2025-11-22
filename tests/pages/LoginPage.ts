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
   * Realiza login completando usuario y contraseña y enviando el formulario.
   *  @param username Usuario de Keycloak
   * @param password Contraseña del usuario
   */
  async login(username: string, password: string) {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.signInButton.click();
  }
}
