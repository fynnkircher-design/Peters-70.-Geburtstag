import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_SECONDS = 60 * 60 * 24 * 7;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

function secureEqual(a, b) {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function createToken(role, secret) {
  const payload = Buffer.from(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export default async function handler(req) {
  const path = new URL(req.url).pathname;

  if (path !== "/api/login" || req.method !== "POST") {
    return json({ error: "Nicht gefunden." }, 404);
  }

  const secret = getSecret();
  const guestPassword = process.env.GALLERY_PASSWORD;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!secret || !guestPassword || !adminPassword || secureEqual(guestPassword, adminPassword)) {
    return json({ error: "Der Zugang ist noch nicht vollständig eingerichtet. Bitte später erneut versuchen." }, 503);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }

  const password = typeof body?.password === "string" ? body.password : "";
  const requestedRole = body?.role;
  if (!password || !["guest", "admin"].includes(requestedRole)) {
    return json({ error: "Bitte Passwort eingeben." }, 400);
  }

  const expectedPassword = requestedRole === "admin" ? adminPassword : guestPassword;
  if (!secureEqual(password, expectedPassword)) {
    return json({ error: "Das Passwort stimmt leider nicht." }, 401);
  }

  const token = createToken(requestedRole, secret);
  const sessionCookie = `p70_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
  return json({ ok: true, role: requestedRole }, 200, { "Set-Cookie": sessionCookie });
}

export const config = {
  path: "/api/login",
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowLimit: 100, windowSize: 900 },
};
