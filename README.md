# Peter wird 70 – Website mit geschützter Fotogalerie

Dieses Projekt enthält die bestehende Einladungsseite und eine separate Fotogalerie.

## Funktionen

- Die Einladungsseite bleibt öffentlich.
- `/erinnerungen/` ist die Gäste-Fotogalerie mit gemeinsamem Passwort.
- Gäste können Fotos hochladen, ansehen und herunterladen.
- Vor dem Upload werden ausgewählte Fotos direkt als Vorschau angezeigt; einzelne Bilder lassen sich aus der Auswahl entfernen.
- Die Galerie zeigt die neuesten Uploads zuerst.
- `/erinnerungen/admin.html` ist der separate Organisatoren-Zugang.
- Nur angemeldete Organisatoren können Fotos löschen.
- Die Bilddateien werden in Netlify Blobs in der Region Frankfurt (`eu-central-1`) gespeichert und nur über angemeldete Funktionen ausgeliefert.
- Fotos werden im Browser bei Bedarf verkleinert. Upload-Limit pro Foto: 4 MB.

## Netlify-Einrichtung

1. Das Repository mit Netlify verbinden.
2. In Netlify unter **Project configuration → Environment variables** diese drei Variablen anlegen:
   - `GALLERY_PASSWORD` – gemeinsames Passwort für Gäste (mindestens 12 Zeichen)
   - `ADMIN_PASSWORD` – separates Passwort für Organisatoren (mindestens 12 Zeichen; muss anders sein)
   - `SESSION_SECRET` – zufälliger, geheimer Wert mit mindestens 32 Zeichen
3. Die Variablen für den Production-Kontext aktivieren und speichern.
4. Anschließend einen neuen Deploy starten, damit die Functions die Variablen übernehmen.

**Wichtig:** Passwörter und `SESSION_SECRET` niemals in GitHub-Dateien oder in den Website-Code schreiben. Sie gehören ausschließlich in die Netlify-Umgebungsvariablen. Nicht per Chat verschicken.

## Adressen

- Öffentliche Einladung: `/`
- Gäste-Galerie: `/erinnerungen/`
- Organisatoren: `/erinnerungen/admin.html`

## Technische Hinweise

- Netlify Functions liegen außerhalb des veröffentlichten Verzeichnisses `public/`.
- `@netlify/blobs` speichert die Fotos dauerhaft über neue Deploys hinweg.
- Die Galerie-API prüft bei jedem Aufruf die signierte, HttpOnly-Session-Cookie.
- Die Löschfunktion prüft zusätzlich die Rolle `admin` serverseitig.
