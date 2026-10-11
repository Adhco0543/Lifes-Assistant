import crypto from "node:crypto";

type Provider = "github" | "google";

function cookieName(provider: Provider): string {
  return "life_" + provider + "_oauth_nonce";
}

function cookiePath(provider: Provider): string {
  return "/api/integrations/" + provider + "/callback";
}

export function oauthNonceCookie(
  provider: Provider,
  nonce: string,
  secure: boolean
): string {
  return cookieName(provider) + "=" + encodeURIComponent(nonce) +
    "; Path=" + cookiePath(provider) +
    "; Max-Age=600; HttpOnly; SameSite=Lax" + (secure ? "; Secure" : "");
}

export function clearOauthNonceCookie(provider: Provider, secure: boolean): string {
  return cookieName(provider) + "=; Path=" + cookiePath(provider) +
    "; Max-Age=0; HttpOnly; SameSite=Lax" + (secure ? "; Secure" : "");
}

export function assertOauthNonceCookie(
  request: Request,
  provider: Provider,
  expectedNonce: string
): void {
  const rawCookie = request.headers.get("cookie") || "";
  const key = cookieName(provider) + "=";
  const rawValue = rawCookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(key))?.slice(key.length);
  let actualNonce = "";
  try {
    actualNonce = rawValue ? decodeURIComponent(rawValue) : "";
  } catch {
    throw new Error("Invalid OAuth browser state. Start the connection again.");
  }
  const expected = Buffer.from(expectedNonce);
  const actual = Buffer.from(actualNonce);
  if (!expected.length || actual.length !== expected.length ||
      !crypto.timingSafeEqual(actual, expected)) {
    throw new Error("OAuth browser state does not match. Start the connection again.");
  }
}
