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

async function checkUpdate(meta, timeoutSec) {
  try {
    const req = new Request(\`\${CORE_URL}?t=\${Date.now()}\`);
    req.timeoutInterval = timeoutSec;
    req.headers = { "Cache-Control": "no-cache" };
    if (meta.etag) req.headers["If-None-Match"] = meta.etag;

    const body = await req.loadString();
    const status = req.response ? req.response.statusCode : 0;
    const resHeaders = (req.response && req.response.headers) ? req.response.headers : {};
    const newEtag = resHeaders["ETag"] || resHeaders["etag"] || null;

    if (status === 304 || (newEtag && newEtag === meta.etag)) {
      saveMeta({ ...meta, lastCheck: Date.now() });
      return null;
    }

    if (status === 200 && typeof body === "string" && body.startsWith(CORE_MARKER)) {
      FM.writeString(CORE_PATH, body);
      saveMeta({ etag: newEtag, lastCheck: Date.now() });
      return body;
    }
  } catch (_) {}
  return null;
}

async function run() {
  const hasCache = FM.fileExists(CORE_PATH);
  const meta = readMeta();
  const inWidget = typeof config !== "undefined" && (config.runsInWidget || config.runsInAccessoryWidget);
  const shouldCheck = !hasCache || !inWidget || (Date.now() - (meta.lastCheck || 0) > UPDATE_INTERVAL_MS);

  let code = hasCache ? FM.readString(CORE_PATH) : null;

  if (shouldCheck) {
    const updatedCode = await checkUpdate(meta, hasCache ? 4 : 10);
    if (updatedCode) code = updatedCode;
  }

  if (!code) {
    if (inWidget) {
      const w = new ListWidget();
      w.backgroundColor = new Color("#0B0F17");
      const t = w.addText("EHUntis: sin conexión para la descarga inicial. Abre Scriptable con internet.");
      t.font = Font.systemFont(12);
      t.textColor = new Color("#F8FAFC");
      Script.setWidget(w);
    } else {
      const a = new Alert();
      a.title = "Sin conexión";
      a.message = "Necesitas conexión a internet la primera vez para descargar EHUntis Widget.";
      await a.presentAlert();
    }
    Script.complete();
    return;
  }

  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction("args", "config", "Script", code)(
    typeof args !== "undefined" ? args : undefined,
    typeof config !== "undefined" ? config : undefined,
    typeof Script !== "undefined" ? Script : undefined
  );
}

await run();
`;
