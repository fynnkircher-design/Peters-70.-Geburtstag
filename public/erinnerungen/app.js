(() => {
  const mode = document.body.dataset.mode === "admin" ? "admin" : "guest";
  const loginPanel = document.getElementById("login-panel");
  const galleryPanel = document.getElementById("gallery-panel");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const logoutButton = document.getElementById("logout-button");
  const photoGrid = document.getElementById("photo-grid");
  const emptyState = document.getElementById("empty-state");
  const uploadForm = document.getElementById("upload-form");
  const uploadMessage = document.getElementById("upload-message");
  const photoFiles = document.getElementById("photo-files");
  const selectedPreview = document.getElementById("selected-preview");
  const selectedGrid = document.getElementById("selected-grid");
  const selectedCount = document.getElementById("selected-count");
  const clearSelectionButton = document.getElementById("clear-selection");
  const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
  let selectedFiles = [];
  let previewUrls = [];

  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) throw new Error(data?.error || "Das hat leider nicht geklappt.");
    return data;
  }

  function showLogin(message = "") {
    galleryPanel.hidden = true;
    loginPanel.hidden = false;
    loginMessage.textContent = message;
    loginMessage.classList.toggle("error", Boolean(message));
  }

  function showGallery() {
    loginPanel.hidden = true;
    galleryPanel.hidden = false;
    loadPhotos();
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function makePhotoCard(photo) {
    const card = document.createElement("article");
    card.className = "photo-card";

    const img = document.createElement("img");
    img.src = `/api/photos/${encodeURIComponent(photo.id)}`;
    img.alt = photo.filename || "Hochgeladenes Foto";
    img.loading = "lazy";
    img.addEventListener("error", () => {
      const fallback = document.createElement("div");
      fallback.className = "no-preview";
      fallback.textContent = "Vorschau in diesem Browser nicht verfügbar. Das Foto kann heruntergeladen werden.";
      img.replaceWith(fallback);
    }, { once: true });
    card.append(img);

    const meta = document.createElement("div");
    meta.className = "photo-meta";
    const name = document.createElement("p");
    name.className = "photo-name";
    name.textContent = photo.filename || "Foto";
    name.title = photo.filename || "Foto";
    const date = document.createElement("p");
    date.className = "photo-date";
    date.textContent = formatDate(photo.uploadedAt);
    const actions = document.createElement("div");
    actions.className = "photo-actions";

    const download = document.createElement("a");
    download.href = `/api/photos/${encodeURIComponent(photo.id)}?download=1`;
    download.textContent = "Herunterladen ↓";
    download.setAttribute("download", "");
    actions.append(download);

    if (mode === "admin") {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-button";
      remove.textContent = "Löschen";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`Soll „${photo.filename || "dieses Foto"}“ wirklich gelöscht werden?`)) return;
        remove.disabled = true;
        try {
          await api(`/api/photos/${encodeURIComponent(photo.id)}`, { method: "DELETE" });
          await loadPhotos();
        } catch (error) {
          window.alert(error.message);
          remove.disabled = false;
        }
      });
      actions.append(remove);
    }

    meta.append(name, date, actions);
    card.append(meta);
    return card;
  }

  async function loadPhotos() {
    photoGrid.replaceChildren();
    emptyState.hidden = true;
    try {
      const data = await api("/api/photos");
      const photos = Array.isArray(data.photos) ? data.photos : [];
      photos.forEach((photo) => photoGrid.append(makePhotoCard(photo)));
      emptyState.hidden = photos.length > 0;
    } catch (error) {
      if (error.message.includes("anmelden")) {
        showLogin("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
      } else {
        emptyState.hidden = false;
        emptyState.textContent = error.message;
      }
    }
  }

  function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }

  function releasePreviewUrls() {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
  }

  function syncFileInput() {
    if (!photoFiles) return;
    try {
      const transfer = new DataTransfer();
      selectedFiles.forEach((file) => transfer.items.add(file));
      photoFiles.files = transfer.files;
    } catch {
      // The upload uses selectedFiles directly, so previews and uploads still work
      // in browsers that do not allow assigning to input.files.
    }
  }

  function renderSelectedFiles() {
    if (!selectedPreview || !selectedGrid) return;
    releasePreviewUrls();
    selectedGrid.replaceChildren();
    selectedPreview.hidden = selectedFiles.length === 0;
    if (!selectedFiles.length) return;

    selectedCount.textContent = selectedFiles.length === 1
      ? "1 Foto ausgewählt"
      : `${selectedFiles.length} Fotos ausgewählt`;

    selectedFiles.forEach((file, index) => {
      const card = document.createElement("article");
      card.className = "selected-photo";

      const imageWrap = document.createElement("div");
      imageWrap.className = "selected-image-wrap";
      const img = document.createElement("img");
      const previewUrl = URL.createObjectURL(file);
      previewUrls.push(previewUrl);
      img.src = previewUrl;
      img.alt = `Vorschau: ${file.name}`;
      img.decoding = "async";
      img.addEventListener("error", () => {
        const fallback = document.createElement("div");
        fallback.className = "selected-no-preview";
        fallback.textContent = "Vorschau nicht verfügbar";
        img.replaceWith(fallback);
      }, { once: true });
      imageWrap.append(img);

      const meta = document.createElement("div");
      meta.className = "selected-photo-meta";
      const name = document.createElement("p");
      name.className = "selected-photo-name";
      name.textContent = file.name;
      name.title = file.name;
      const size = document.createElement("p");
      size.className = "selected-photo-size";
      size.textContent = formatFileSize(file.size);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "selected-remove";
      remove.textContent = "Entfernen";
      remove.setAttribute("aria-label", `${file.name} aus der Auswahl entfernen`);
      remove.addEventListener("click", () => {
        selectedFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index);
        syncFileInput();
        renderSelectedFiles();
      });

      meta.append(name, size, remove);
      card.append(imageWrap, meta);
      selectedGrid.append(card);
    });
  }

  async function preparePhoto(file) {
    if (!file.type.startsWith("image/")) throw new Error(`${file.name}: Bitte nur Bilddateien auswählen.`);
    if (file.size <= MAX_UPLOAD_BYTES) return file;
    if (["image/gif", "image/heic", "image/heif"].includes(file.type.toLowerCase())) {
      throw new Error(`${file.name}: Diese Datei ist größer als 4 MB. Bitte als JPG exportieren oder ein kleineres Bild wählen.`);
    }

    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error(`${file.name}: Das Bild konnte nicht verkleinert werden. Bitte als JPG oder PNG speichern.`);
    }

    const maxDimension = 2200;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    let quality = 0.84;
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.42) {
      quality -= 0.1;
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    }
    if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name}: Das Bild ist auch nach dem Verkleinern noch zu groß.`);
    const base = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = new FormData(loginForm).get("password");
      const button = loginForm.querySelector("button[type=submit]");
      button.disabled = true;
      loginMessage.textContent = "Wird geprüft …";
      loginMessage.classList.remove("error");
      try {
        await api("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, role: mode }),
        });
        loginForm.reset();
        showGallery();
      } catch (error) {
        loginMessage.textContent = error.message;
        loginMessage.classList.add("error");
      } finally {
        button.disabled = false;
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try { await api("/api/logout", { method: "POST" }); } catch { /* show login either way */ }
      showLogin();
    });
  }

  if (photoFiles) {
    photoFiles.addEventListener("change", () => {
      selectedFiles = Array.from(photoFiles.files || []);
      renderSelectedFiles();
      uploadMessage.textContent = "";
      uploadMessage.classList.remove("error");
    });
  }

  if (clearSelectionButton) {
    clearSelectionButton.addEventListener("click", () => {
      selectedFiles = [];
      photoFiles.value = "";
      renderSelectedFiles();
      uploadMessage.textContent = "";
      uploadMessage.classList.remove("error");
    });
  }

  if (uploadForm) {
    uploadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const files = selectedFiles.slice();
      if (!files.length) {
        uploadMessage.textContent = "Bitte zuerst ein oder mehrere Fotos auswählen.";
        uploadMessage.classList.add("error");
        return;
      }
      const button = uploadForm.querySelector("button[type=submit]");
      button.disabled = true;
      photoFiles.disabled = true;
      if (clearSelectionButton) clearSelectionButton.disabled = true;
      selectedGrid.querySelectorAll("button").forEach((item) => { item.disabled = true; });
      uploadMessage.classList.remove("error");
      let uploaded = 0;
      try {
        for (const original of files) {
          uploadMessage.textContent = `Bereite Foto ${uploaded + 1} von ${files.length} vor …`;
          const file = await preparePhoto(original);
          const form = new FormData();
          form.append("photo", file, file.name);
          uploadMessage.textContent = `Lade Foto ${uploaded + 1} von ${files.length} hoch …`;
          await api("/api/photos", { method: "POST", body: form });
          uploaded += 1;
        }
        selectedFiles = [];
        photoFiles.value = "";
        renderSelectedFiles();
        uploadMessage.textContent = `${uploaded} Foto(s) erfolgreich hochgeladen.`;
        await loadPhotos();
      } catch (error) {
        uploadMessage.textContent = uploaded ? `${uploaded} Foto(s) hochgeladen. ${error.message}` : error.message;
        uploadMessage.classList.add("error");
        await loadPhotos();
      } finally {
        button.disabled = false;
        photoFiles.disabled = false;
        if (clearSelectionButton) clearSelectionButton.disabled = false;
      }
    });
  }

  async function init() {
    try {
      const session = await api("/api/session");
      if (session.role === mode) showGallery();
      else showLogin();
    } catch {
      showLogin("Der Zugang ist momentan nicht erreichbar. Bitte später erneut versuchen.");
    }
  }

  init();
})();
