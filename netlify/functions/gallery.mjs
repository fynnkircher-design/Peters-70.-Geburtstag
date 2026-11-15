import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "p70_session";
const STORE_NAME = "peter-70-gallery";
const STORE_REGION = "eu-central-1";
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
]);

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
    return { role: data.role };
  } catch {
    return null;
  }
}

function safeFilename(name) {
  const cleaned = String(name || "foto").replace(/[\\/\0\r\n]/g, "_").replace(/[<>:"|?*]/g, "_").trim();
  return (cleaned || "foto").slice(0, 120);
}

function validId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || "");
}

function contentDisposition(filename, disposition) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export default async function handler(req) {
  const session = readSession(req);
  if (!session) return json({ error: "Bitte zuerst mit dem Galerie-Passwort anmelden." }, 401);

  const url = new URL(req.url);
  const path = url.pathname;
  const parts = path.split("/").filter(Boolean);
  const id = parts.length === 3 ? parts[2] : null;
  const store = getStore(STORE_NAME, { region: STORE_REGION });

  if (path === "/api/photos" && req.method === "GET") {
    const { blobs } = await store.list({ prefix: "photos/" });
    const photos = await Promise.all(blobs.map(async ({ key }) => {
      const result = await store.getMetadata(key);
      const metadata = result?.metadata || {};
      return {
        id: key.slice("photos/".length),
        filename: metadata.filename || "Foto",
        contentType: metadata.contentType || "application/octet-stream",
        uploadedAt: metadata.uploadedAt || "1970-01-01T00:00:00.000Z",
        size: metadata.size || null,
      };
    }));
    photos.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    return json({ photos });
  }

  if (path === "/api/photos" && req.method === "POST") {
    let form;
    try {
      form = await req.formData();
    } catch {
      return json({ error: "Die Datei konnte nicht gelesen werden." }, 400);
    }
    const file = form.get("photo");
    if (!file || typeof file.arrayBuffer !== "function") return json({ error: "Bitte zuerst ein Foto auswählen." }, 400);
    if (!ALLOWED_TYPES.has(file.type)) return json({ error: "Erlaubt sind JPG, PNG, WebP, GIF und HEIC/HEIF." }, 415);
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) return json({ error: "Das Foto darf nach der Verkleinerung höchstens 4 MB groß sein." }, 413);

    const id = randomUUID();
    const filename = safeFilename(file.name);
    const uploadedAt = new Date().toISOString();
    const key = `photos/${id}`;
    await store.set(key, await file.arrayBuffer(), {
      metadata: { filename, contentType: file.type, uploadedAt, size: file.size },
    });
    return json({ ok: true, photo: { id, filename, contentType: file.type, uploadedAt, size: file.size } }, 201);
  }

  if (id && validId(id) && req.method === "GET") {
    const key = `photos/${id}`;
    const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!result?.data) return json({ error: "Foto nicht gefunden." }, 404);
    const metadata = result.metadata || {};
    const filename = safeFilename(metadata.filename || "Foto");
    const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new Response(result.data, {
      status: 200,
      headers: {
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": String(result.data.byteLength),
        "Content-Disposition": contentDisposition(filename, disposition),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (id && validId(id) && req.method === "DELETE") {
    if (session.role !== "admin") return json({ error: "Nur Organisatoren dürfen Fotos löschen." }, 403);
    await store.delete(`photos/${id}`);
    return json({ ok: true });
  }

  return json({ error: "Nicht gefunden." }, 404);
}

export const config = {
  path: ["/api/photos", "/api/photos/:id"],
};
