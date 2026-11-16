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
  if (fs.existsSync(OUT_DIR)) {
    for (const f of fs.readdirSync(OUT_DIR)) {
      if (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) {
        try {
          fs.unlinkSync(path.join(OUT_DIR, f));
        } catch (_) {}
      }
    }
    console.log('🧹 Limpieza de capturas anteriores completada.');
  } else {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

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

        // Sincronizar tema con localStorage y clase en html
        await page.evaluate((targetTheme) => {
          try {
            localStorage.setItem('ehuntis_theme', targetTheme);
          } catch (_) {}
          if (targetTheme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.style.colorScheme = 'dark';
          } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.style.colorScheme = 'light';
          }
        }, theme);

        // Si el botón de toggle en la UI indica el estado inverso, pulsarlo para sincronizar estado de React
        const toggleBtn = page.getByRole('button', { name: /Modo (Oscuro|Claro)/i });
        if (await toggleBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          const btnText = await toggleBtn.textContent();
          if (theme === 'dark' && btnText.includes('Modo Oscuro')) {
            await toggleBtn.click();
          } else if (theme === 'light' && btnText.includes('Modo Claro')) {
            await toggleBtn.click();
          }
        }

        // Ocultar cualquier portal residual o indicador de desarrollo de Next.js
        await page.addStyleTag({
          content: 'nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }',
        });
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
          { id: '#btn-modal-custom-new', file: '03-modal-new-event' },
          { id: '#btn-modal-custom-edit', file: '04-modal-edit-recurring' },
          { id: '#btn-modal-custom-detail', file: '05-modal-detail' },
          { id: '#btn-modal-lesson', file: '06-modal-lesson' },
          { id: '#btn-modal-lesson-drift', file: '07-modal-lesson-drift' },
          { id: '#btn-modal-lesson-edit', file: '08-modal-edit-lesson' },
          { id: '#btn-modal-lesson-swap', file: '09-modal-swap-lesson' },
          { id: '#btn-modal-confirm', file: '10-modal-confirm' },
        ];

        for (const m of modalTriggers) {
          const btn = page.locator(m.id);
          await btn.click({ force: true });
          await page.waitForTimeout(500);

          const mPath = path.join(OUT_DIR, `${theme}-${cfg.name}-${m.file}.png`);
          await page.screenshot({ path: mPath, fullPage: false });
          console.log(`  ✓ Guardado: ${path.basename(mPath)}`);

          // Cerrar el modal mediante botón de cerrar, cancelar exacto o Escape
          const closeBtn = page.locator('button[aria-label="Cerrar"]').last();
          if (await closeBtn.isVisible({ timeout: 400 }).catch(() => false)) {
            await closeBtn.click({ force: true });
          } else {
            const cancelBtn = page.getByRole('button', { name: /^Cancelar$/i }).last();
            if (await cancelBtn.isVisible({ timeout: 400 }).catch(() => false)) {
              await cancelBtn.click({ force: true });
            } else {
              await page.keyboard.press('Escape');
            }
          }
          await page.waitForTimeout(200);
          if ((await page.locator('[role="dialog"]').count()) > 0) {
            await page.keyboard.press('Escape');
          }
          await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(300);
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
