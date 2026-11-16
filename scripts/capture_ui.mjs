import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';

const PORT = 3008;
const LOCAL_URL = `http://127.0.0.1:${PORT}/dev/ui`;
const OUT_DIR = path.resolve(process.cwd(), '.screenshots', 'ui');

if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(process.cwd(), '.browsers');
}

function waitForServer(url, maxRetries = 60) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const interval = setInterval(() => {
      http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          clearInterval(interval);
          resolve();
        }
      }).on('error', () => {
        retries++;
        if (retries >= maxRetries) {
          clearInterval(interval);
          reject(new Error(`Servidor en ${url} no respondió a tiempo.`));
        }
      });
    }, 500);
  });
}

async function capture() {
  console.log('📸 Iniciando batería de capturas visuales de EHUntis UI...');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`📡 Levantando Next.js en entorno de desarrollo en puerto ${PORT}...`);
  const serverProcess = spawn('node', ['./node_modules/next/dist/bin/next', 'dev', '-p', String(PORT), '-H', '127.0.0.1'], {
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'development' },
  });

  serverProcess.stdout.on('data', (d) => {
    const s = d.toString();
    if (s.includes('Ready in') || s.includes('Local:')) {
      console.log(`[Next.js Dev] ${s.trim()}`);
    }
  });

  serverProcess.stderr.on('data', () => {});

  let browser;

  try {
    await waitForServer(LOCAL_URL);
    console.log(`⚡ Conectado con éxito a ${LOCAL_URL}!`);

    let executablePath = path.resolve(process.cwd(), '.browsers/chromium-1248/chrome-win64/chrome.exe');
    if (!fs.existsSync(executablePath)) {
      executablePath = path.resolve(process.cwd(), '.browsers/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe');
    }

    browser = await chromium.launch({
      headless: true,
      executablePath: fs.existsSync(executablePath) ? executablePath : undefined,
    });

    const configs = [
      { name: 'desktop', width: 1280, height: 800, isMobile: false },
      { name: 'mobile', width: 390, height: 844, isMobile: true },
    ];

    const themes = ['light', 'dark'];

    for (const theme of themes) {
      for (const cfg of configs) {
        console.log(`\n📷 Capturando matriz: Tema=${theme.toUpperCase()} | Vista=${cfg.name.toUpperCase()} (${cfg.width}x${cfg.height})...`);

        const context = await browser.newContext({
          viewport: { width: cfg.width, height: cfg.height },
          isMobile: cfg.isMobile,
          hasTouch: cfg.isMobile,
          colorScheme: theme,
        });

        const page = await context.newPage();
        await page.goto(LOCAL_URL, { waitUntil: 'networkidle', timeout: 30000 });

        // Sincronizar tema con el botón de la página si es necesario
        const isCurrentlyDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
        if (theme === 'dark' && !isCurrentlyDark) {
          await page.evaluate(() => {
            document.documentElement.classList.add('dark');
          });
        } else if (theme === 'light' && isCurrentlyDark) {
          await page.evaluate(() => {
            document.documentElement.classList.remove('dark');
          });
        }
        await page.waitForTimeout(300);

        // 1. Captura de Componentes Base
        const compPath = path.join(OUT_DIR, `${theme}-${cfg.name}-01-components.png`);
        await page.screenshot({ path: compPath, fullPage: false });
        console.log(`  ✓ Guardado: ${path.basename(compPath)}`);

        // 2. Captura de Pickers
        await page.locator('#tab-pickers').click();
        await page.waitForTimeout(300);
        const pickersPath = path.join(OUT_DIR, `${theme}-${cfg.name}-02-pickers.png`);
        await page.screenshot({ path: pickersPath, fullPage: false });
        console.log(`  ✓ Guardado: ${path.basename(pickersPath)}`);

        // 3. Modales
        await page.locator('#tab-modals').click();
        await page.waitForTimeout(300);

        const modalTriggers = [
          { label: 'Crear Evento', file: '03-modal-new-event' },
          { label: 'Editar Evento Recurrente', file: '04-modal-edit-recurring' },
          { label: 'Detalle de Evento', file: '05-modal-detail' },
          { label: 'Detalle de Clase', file: '06-modal-lesson' },
          { label: 'Clase con Remote Drift', file: '07-modal-lesson-drift' },
          { label: 'Editar Clase', file: '08-modal-edit-lesson' },
          { label: 'Intercambiar Clase', file: '09-modal-swap-lesson' },
          { label: 'ConfirmDialog Estándar', file: '10-modal-confirm' },
        ];

        for (const m of modalTriggers) {
          const btn = page.getByText(m.label, { exact: true });
          if (await btn.isVisible()) {
            await btn.click();
            await page.waitForTimeout(400);

            const mPath = path.join(OUT_DIR, `${theme}-${cfg.name}-${m.file}.png`);
            await page.screenshot({ path: mPath, fullPage: false });
            console.log(`  ✓ Guardado: ${path.basename(mPath)}`);

            // Cerrar el modal mediante botón de cerrar, cancelar o Escape
            const closeBtn = page.locator('button[aria-label="Cerrar"]').last();
            if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
              await closeBtn.click();
            } else {
              const cancelBtn = page.getByRole('button', { name: 'Cancelar' }).last();
              if (await cancelBtn.isVisible({ timeout: 500 }).catch(() => false)) {
                await cancelBtn.click();
              } else {
                await page.keyboard.press('Escape');
              }
            }
            await page.waitForTimeout(300);
          }
        }

        await context.close();
      }
    }

    console.log('\n🎉 ¡Batería de capturas completada con éxito en .screenshots/ui/!');
  } finally {
    if (browser) await browser.close();
    serverProcess.kill();
    try {
      process.kill(serverProcess.pid);
    } catch (_) {}
  }
}

capture().catch((err) => {
  console.error('❌ Error durante la generación de capturas:', err);
  process.exit(1);
});
