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

async function sha256Digest(input: string): Promise<ArrayBuffer> {
  const data = new TextEncoder().encode(input);
  const subtle = globalThis.crypto?.subtle;
  if (subtle?.digest) {
    try {
      return await subtle.digest("SHA-256", data);
    } catch {
      // http://IP 不是 Secure Context，subtle 会不可用或抛错
    }
  }
  return sha256Fallback(data);
}

function sha256Fallback(message: Uint8Array): ArrayBuffer {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  const bitLen = message.length * 8;
  const withPad = new Uint8Array(((message.length + 9 + 63) & ~63));
  withPad.set(message);
  withPad[message.length] = 0x80;
  const view = new DataView(withPad.buffer);
  view.setUint32(withPad.length - 4, bitLen >>> 0);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let offset = 0; offset < withPad.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new ArrayBuffer(32);
  const outView = new DataView(out);
  outView.setUint32(0, h0);
  outView.setUint32(4, h1);
  outView.setUint32(8, h2);
  outView.setUint32(12, h3);
  outView.setUint32(16, h4);
  outView.setUint32(20, h5);
  outView.setUint32(24, h6);
  outView.setUint32(28, h7);
  return out;
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
  return toBase64Url(await sha256Digest(codeVerifier));
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
