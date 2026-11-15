import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "p70_session";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

function readSession(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  const cookieHeader = req.headers.get("cookie") || "";
  const pair = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!pair) return null;
  const token = pair.slice(COOKIE_NAME.length + 1);
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!["guest", "admin"].includes(data.role) || !Number.isInteger(data.exp) || data.exp < Math.floor(Date.now() / 1000)) return null;
    return { role: data.role, exp: data.exp };
  } catch {
    return null;
  }
}

function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export default async function handler(req) {
  const path = new URL(req.url).pathname;
  if (path === "/api/logout" && req.method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
  }
  if (path === "/api/session" && req.method === "GET") {
    const session = readSession(req);
    return json({ role: session?.role ?? null, expiresAt: session?.exp ?? null });
  }
  return json({ error: "Nicht gefunden." }, 404);
}

export const config = {
  path: ["/api/session", "/api/logout"],
};
