export const IOS_WIDGET_LOADER_CODE = `// EHUntis Widget para iOS (Scriptable) - Instalador automático
// Pega este código en Scriptable, renómbralo a "EHUntis" y se mantendrá actualizado solo.

const CORE_URL = "https://ehuntis.vercel.app/widgets/ehuntis-widget-core.js";
const CORE_MARKER = "// EHUNTIS_WIDGET_CORE";
const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas

const FM = FileManager.local();
const LIB = FM.libraryDirectory();
const CORE_PATH = FM.joinPath(LIB, "ehuntis_widget_core.cache");
const META_PATH = FM.joinPath(LIB, "ehuntis_widget_meta.json");

function readMeta() {
  try {
    if (FM.fileExists(META_PATH)) return JSON.parse(FM.readString(META_PATH)) || {};
  } catch (_) {}
  return {};
}

function saveMeta(data) {
  try {
    FM.writeString(META_PATH, JSON.stringify(data));
  } catch (_) {}
}

function getHeaderCaseInsensitive(headers, name) {
  if (!headers || typeof headers !== "object") return null;
  const target = name.toLowerCase();
  const key = Object.keys(headers).find((k) => k.toLowerCase() === target);
  return key ? headers[key] : null;
}

async function checkUpdate(meta, timeoutSec) {
  try {
    const req = new Request(CORE_URL);
    req.timeoutInterval = timeoutSec;
    req.headers = { "Cache-Control": "no-cache" };
    if (meta.etag) req.headers["If-None-Match"] = meta.etag;

    const body = await req.loadString();
    const status = req.response ? req.response.statusCode : 0;
    const newEtag = getHeaderCaseInsensitive(req.response && req.response.headers, "etag");

    if (status === 304 || (newEtag && newEtag === meta.etag)) {
      saveMeta({ ...meta, lastCheck: Date.now() });
      return null;
    }

    if (status === 200 && typeof body === "string" && body.trimStart().startsWith(CORE_MARKER)) {
      FM.writeString(CORE_PATH, body);
      saveMeta({ etag: newEtag, lastCheck: Date.now() });
      return body;
    }
  } catch (_) {}
  return null;
}

async function showError(inWidget, message) {
  if (inWidget) {
    const w = new ListWidget();
    w.backgroundColor = new Color("#0B0F17");
    const t = w.addText(message);
    t.font = Font.systemFont(12);
    t.textColor = new Color("#F8FAFC");
    Script.setWidget(w);
  } else {
    const a = new Alert();
    a.title = "EHUntis Widget";
    a.message = message;
    await a.presentAlert();
  }
}

async function run() {
  const inWidget = typeof config !== "undefined" && (config.runsInWidget || config.runsInAccessoryWidget);
  const meta = readMeta();

  let code = null;
  try {
    if (FM.fileExists(CORE_PATH)) code = FM.readString(CORE_PATH);
  } catch (_) {}

  const hasCache = Boolean(code && code.trimStart().startsWith(CORE_MARKER));
  const shouldCheck = !hasCache || !inWidget || (Date.now() - (meta.lastCheck || 0) > UPDATE_INTERVAL_MS);

  if (shouldCheck) {
    const updatedCode = await checkUpdate(meta, hasCache ? 4 : 10);
    if (updatedCode) code = updatedCode;
  }

  if (!code) {
    await showError(
      inWidget,
      inWidget
        ? "EHUntis: sin conexión para la descarga inicial. Abre Scriptable con internet."
        : "Necesitas conexión a internet la primera vez para descargar EHUntis Widget."
    );
    Script.complete();
    return;
  }

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction("args", "config", "Script", code)(
      typeof args !== "undefined" ? args : undefined,
      typeof config !== "undefined" ? config : undefined,
      typeof Script !== "undefined" ? Script : undefined
    );
  } catch (err) {
    // Limpiar ETag para forzar re-descarga en el siguiente intento si la copia local estaba dañada
    saveMeta({ etag: null, lastCheck: 0 });
    await showError(inWidget, "Error al ejecutar EHUntis: " + (err && err.message ? err.message : String(err)));
  }

  Script.complete();
}

await run();
`;
