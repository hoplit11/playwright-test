// tests/api/utils/keycloak.ts
import { APIRequestContext } from '@playwright/test'; // Importa el tipo APIRequestContext, que es el objeto que Playwright usa para hacer peticiones HTTP (request.get, request.post, etc.).
// Este helper depende de ese contexto para llamar al endpoint de Keycloak.

/*Define un tipo TypeScript que describe la estructura prevista de la respuesta de Keycloak.
Esto te permite que tus tests tengan autocompletado y type safety.*/
export type TokenResponse = {
  access_token: string; // obligatorio — el token JWT que usarás para autenticación.
  refresh_token?: string; // opcional — solo existe si el cliente está configurado con refresh tokens.
  expires_in?: number; // segundos de duración del token.
  token_type?: string; // normalmente "Bearer".
};

/**
 * Obtiene un access_token directamente desde Keycloak (Direct Grant / Resource Owner Password Credentials).Es directo: username + password → Keycloak → token.
 * Ajusta REALM, CLIENT_ID y CLIENT_SECRET según tu configuración.
 */
export async function getKeycloakToken(request: APIRequestContext, opts: { //
  baseUrl: string; // baseURL (p.e. https://pacs.viewneurocirugiahuv.org)
  realm?: string;  // opcional, por defecto 'ohif' o variable de entorno KEYCLOAK_REALM
  clientId?: string; // opcional, por defecto 'ohif-viewer' o variable de entorno KEYCLOAK_CLIENT_ID
  clientSecret?: string | null; // opcional. Keycloak lo exige solo si el cliente es "Confidential". Por defecto null o variable de entorno KEYCLOAK_CLIENT_SECRET
  username: string; // nombre de usuario del usuario
  password: string; // contraseña del usuario
}): Promise<TokenResponse> {  // La función devuelve una promesa que resuelve a un TokenResponse. Devuelve: una Promise<TokenResponse>.
  const realm = opts.realm ?? (process.env.KEYCLOAK_REALM ?? 'ohif'); //
  const clientId = opts.clientId ?? (process.env.KEYCLOAK_CLIENT_ID ?? 'api-testing-client');
  const clientSecret = opts.clientSecret ?? (process.env.KEYCLOAK_CLIENT_SECRET ?? null);

  // Construimos la URL del token (nota: el proxy de nginx expone /keycloak/ al Keycloak interno)
  const tokenUrl = `${opts.baseUrl.replace(/\/$/, '')}/keycloak/realms/${realm}/protocol/openid-connect/token`;
  // Preparamos el body del formulario para la petición POST
  const form: Record<string, string> = {
    grant_type: 'password',
    client_id: clientId,
    username: opts.username,
    password: opts.password,
  };
  if (clientSecret) form.client_secret = clientSecret; // Añadimos client_secret solo si existe.

  // Hacemos la petición POST a Keycloak
  const resp = await request.post(tokenUrl, { form}); // Enviamos el body como form-urlencoded
  // Si la respuesta no es OK, lanzamos un error con el status y el texto de la respuesta
  if (!resp.ok()) {
    const text = await resp.text(); // Leemos el texto de la respuesta para el mensaje de error
    throw new Error(`Keycloak token request failed ${resp.status()}: ${text}`); // Lanzamos un error con detalles
  }
  // Parseamos la respuesta JSON y la devolvemos como TokenResponse
  const json = await resp.json(); // Parseamos la respuesta JSON
  return json as TokenResponse; // Devolvemos el JSON parseado como TokenResponse
}
