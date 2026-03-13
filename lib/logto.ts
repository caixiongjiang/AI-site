import { AuthSession, AuthUser } from "@/lib/auth";

interface OpenIdConfiguration {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
  userinfo_endpoint?: string;
  issuer: string;
}

interface PkceState {
  codeVerifier: string;
  state: string;
  nextPath: string;
}

interface TokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  expires_in?: number;
  token_type?: string;
}

const PKCE_STORAGE_KEY = "ai_site_logto_pkce";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
}

function getRedirectUri(): string {
  return (
    process.env.NEXT_PUBLIC_LOGTO_REDIRECT_URI || `${getBaseUrl()}/callback`
  );
}

function getPostLogoutRedirectUri(): string {
  return process.env.NEXT_PUBLIC_LOGTO_POST_LOGOUT_REDIRECT_URI || getBaseUrl();
}

function getClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_LOGTO_APP_ID;

  if (!clientId) {
    throw new Error("缺少 NEXT_PUBLIC_LOGTO_APP_ID 配置");
  }

  return clientId;
}

function getEndpoint(): string {
  const endpoint = process.env.NEXT_PUBLIC_LOGTO_ENDPOINT;

  if (!endpoint) {
    throw new Error("缺少 NEXT_PUBLIC_LOGTO_ENDPOINT 配置");
  }

  return endpoint.replace(/\/$/, "");
}

function getScopes(): string {
  return (
    process.env.NEXT_PUBLIC_LOGTO_SCOPES || "openid profile email offline_access"
  );
}

function getResource(): string | null {
  return process.env.NEXT_PUBLIC_LOGTO_RESOURCE || null;
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  if (typeof atob === "function") {
    return atob(padded);
  }

  throw new Error("当前环境不支持 atob");
}

function parseJwtPayload(token?: string): Record<string, any> | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    return JSON.parse(decodeBase64Url(parts[1])) as Record<string, any>;
  } catch {
    return null;
  }
}

function toAuthUser(payload?: Record<string, any> | null): AuthUser | null {
  if (!payload) return null;

  return {
    id: payload.sub,
    user_id: payload.sub,
    sub: payload.sub,
    name: payload.name,
    given_name: payload.given_name,
    family_name: payload.family_name,
    username: payload.username,
    preferred_username: payload.preferred_username,
    email: payload.email,
    avatar: payload.picture,
    picture: payload.picture,
  };
}

function randomString(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("");
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier)
  );

  return toBase64Url(digest);
}

async function getOpenIdConfiguration(): Promise<OpenIdConfiguration> {
  const response = await fetch(
    `${getEndpoint()}/oidc/.well-known/openid-configuration`
  );

  if (!response.ok) {
    throw new Error("无法读取 Logto OIDC 配置");
  }

  return (await response.json()) as OpenIdConfiguration;
}

function savePkceState(state: PkceState): void {
  sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(state));
}

function loadPkceState(): PkceState | null {
  const raw = sessionStorage.getItem(PKCE_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PkceState;
  } catch {
    return null;
  }
}

function clearPkceState(): void {
  sessionStorage.removeItem(PKCE_STORAGE_KEY);
}

async function fetchUserInfo(
  config: OpenIdConfiguration,
  accessToken: string
): Promise<AuthUser | null> {
  if (!config.userinfo_endpoint) {
    return null;
  }

  const response = await fetch(config.userinfo_endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Record<string, any>;
  return toAuthUser(payload);
}

export async function startLogtoSignIn(nextPath = "/"): Promise<void> {
  if (!isBrowser()) return;

  const config = await getOpenIdConfiguration();
  const codeVerifier = randomString(96);
  const state = randomString(48);
  const codeChallenge = await createCodeChallenge(codeVerifier);

  savePkceState({
    codeVerifier,
    state,
    nextPath,
  });

  const url = new URL(config.authorization_endpoint);
  url.searchParams.set("client_id", getClientId());
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", getScopes());
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  const resource = getResource();
  if (resource) {
    url.searchParams.set("resource", resource);
  }

  window.location.assign(url.toString());
}

export async function handleLogtoCallback(search: URLSearchParams): Promise<{
  session: AuthSession;
  nextPath: string;
}> {
  const code = search.get("code");
  const returnedState = search.get("state");
  const error = search.get("error");
  const errorDescription = search.get("error_description");

  if (error) {
    throw new Error(errorDescription || `Logto 登录失败: ${error}`);
  }

  if (!code || !returnedState) {
    throw new Error("回调参数不完整，缺少 code 或 state");
  }

  const pkceState = loadPkceState();
  if (!pkceState) {
    throw new Error("登录状态已丢失，请重新发起登录");
  }

  if (pkceState.state !== returnedState) {
    throw new Error("登录状态校验失败，请重新登录");
  }

  const config = await getOpenIdConfiguration();
  const tokenRequest = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: getClientId(),
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: pkceState.codeVerifier,
  });

  const resource = getResource();
  if (resource) {
    tokenRequest.set("resource", resource);
  }

  const response = await fetch(config.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenRequest.toString(),
  });

  const payload = (await response.json().catch(() => null)) as TokenResponse | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error("Logto token 交换失败");
  }

  const idTokenPayload = parseJwtPayload(payload.id_token);
  const accessTokenPayload = parseJwtPayload(payload.access_token);
  const user =
    (await fetchUserInfo(config, payload.access_token)) ||
    toAuthUser(idTokenPayload) ||
    toAuthUser(accessTokenPayload);

  const session: AuthSession = {
    accessToken: payload.access_token,
    idToken: payload.id_token,
    refreshToken: payload.refresh_token,
    scope: payload.scope,
    expiresAt: payload.expires_in
      ? Date.now() + payload.expires_in * 1000
      : undefined,
    user,
  };

  clearPkceState();

  return {
    session,
    nextPath: pkceState.nextPath || "/",
  };
}

export async function buildLogtoLogoutUrl(idToken?: string): Promise<string> {
  const config = await getOpenIdConfiguration();
  const url = new URL(
    config.end_session_endpoint || `${getEndpoint()}/oidc/session/end`
  );

  url.searchParams.set("client_id", getClientId());
  url.searchParams.set("post_logout_redirect_uri", getPostLogoutRedirectUri());

  if (idToken) {
    url.searchParams.set("id_token_hint", idToken);
  }

  return url.toString();
}
