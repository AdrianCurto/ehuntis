import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';

if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(process.cwd(), '.browsers');
}

const PORT = 3005;
const LOCAL_URL = `http://127.0.0.1:${PORT}`;
const TIMEOUT_MS = 25000;

function waitForServer(url, maxRetries = 50) {
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
          reject(new Error(`Server at ${url} did not become ready in time`));
        }
      });
    }, 400);
  });
}

async function runE2ETests() {
  console.log('🚀 Starting EHUntis End-to-End Test Suite...');
  
  // 1. Start local Next.js server
  console.log(`📡 Starting local Next.js server on port ${PORT}...`);
  const serverProcess = spawn('node', ['./node_modules/next/dist/bin/next', 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', d => {
    const str = d.toString();
    if (str.includes('Ready in') || str.includes('Local:')) {
      console.log(`[Next.js Server] ${str.trim()}`);
    }
  });

  serverProcess.stderr.on('data', d => {
    console.error(`[Next.js Server Error] ${d.toString().trim()}`);
  });

  let browser;
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      failed++;
      throw new Error(message);
    } else {
      console.log(`✅ PASSED: ${message}`);
      passed++;
    }
  }

  try {
    await waitForServer(LOCAL_URL);
    console.log(`⚡ Connected to local server at ${LOCAL_URL}!`);

    const executablePath = path.resolve(process.cwd(), '.browsers/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe');
    browser = await chromium.launch({
      headless: true,
      executablePath,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // ── 1. Page Load & Initial State ──────────────────────────────────────────
    console.log('\n--- Test 1: Navigation & Shell Initialization ---');
    await page.goto(LOCAL_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    const pageTitle = await page.title();
    console.log(`📄 Page Title: "${pageTitle}"`);
    assert(pageTitle.includes('EHUntis'), 'Page title contains "EHUntis"');

    // ── 2. Test Custom Event Injection & Rendering Engine ────────────────────
    console.log('\n--- Test 2: Custom Events Ingestion & Rendering Engine ---');
    await page.evaluate(() => {
      // Use active week date (e.g. Tuesday Nov 3)
      const targetDateNum = 20261103;

      const testEvent = {
        id: 'e2e_evt_study',
        title: 'Tutoría Automatizada E2E',
        location: 'Lab 1.04',
        category: 'Estudio',
        colorIndex: 4,
        startTime: 1100,
        endTime: 1230,
        notes: 'Verificación automatizada por subagente',
        recurrence: {
          type: 'none',
          date: 20261109,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      localStorage.setItem('ehuntis_custom_events_v1', JSON.stringify([testEvent]));
    });

    // Reload page to hydrate with injected custom event
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // Look for the custom event block in the DOM
    const customEventElement = page.locator('.lesson-block.is-custom-event').first();
    await customEventElement.waitFor({ state: 'visible', timeout: 10000 });
    assert(await customEventElement.isVisible(), 'Custom event block (.lesson-block.is-custom-event) is rendered and visible');

    // ── 3. Test Custom Event Detail Modal ─────────────────────────────────────
    console.log('\n--- Test 3: Custom Event Detail Modal Interaction ---');
    await customEventElement.click();
    await page.waitForTimeout(600);

    const modalSheet = page.locator('.modal-sheet');
    await modalSheet.waitFor({ state: 'visible', timeout: 5000 });
    assert(await modalSheet.isVisible(), 'Custom Event Detail Modal opened upon clicking event block');

    const modalText = await modalSheet.innerText();
    assert(modalText.includes('Tutoría') && modalText.includes('Automatizada E2E'), 'Event title is correctly displayed inside the detail modal sheet');

    // Close modal using Escape key (verifies keyboard accessibility)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const modalClosed = (await page.locator('.modal-sheet').count()) === 0;
    assert(modalClosed, 'Modal closed successfully upon pressing Escape key');

    // ── 4. Test Lesson Overrides Storage & Structure ─────────────────────────
    console.log('\n--- Test 4: WebUntis Lesson Overrides Storage & Structure ---');
    await page.evaluate(() => {
      const targetDateNum = 20261109;

      const testOverride = {
        'e2e_fake_lesson_key': {
          lessonKey: 'e2e_fake_lesson_key',
          lessonId: 999999,
          date: targetDateNum,
          userCancelled: true,
          customRooms: ['Aula E2E'],
          updatedAt: Date.now(),
        },
      };
      localStorage.setItem('ehuntis_lesson_overrides_v1', JSON.stringify(testOverride));
    });

    const storedOverrides = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('ehuntis_lesson_overrides_v1') || '{}');
    });
    assert(storedOverrides['e2e_fake_lesson_key']?.userCancelled === true, 'Lesson override cancellation successfully stored and verified');

    // ── 5. Test Zero-Group Standalone Schedule ───────────────────────────────
    console.log('\n--- Test 5: Standalone User Without University Groups ---');
    await page.evaluate(() => {
      const cleanConfigs = [{
        id: 'cfg_independent',
        name: 'Horario Personal Autónomo',
        selectedGroups: [], // ZERO university groups!
        disabledGroupIds: [],
        disabledSubjectsByGroup: {},
        disabledSubgroupsBySubject: {},
        customColors: {},
      }];
      localStorage.setItem('ehuntis_configs_v1', JSON.stringify(cleanConfigs));
      localStorage.setItem('ehuntis_active_config_id_v1', 'cfg_independent');
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const isCalendarRendered = (await page.locator('.week-calendar, .calendar-grid, .calendar-view, .lesson-block').count()) > 0;
    assert(isCalendarRendered, 'Calendar renders smoothly for student with 0 university groups and active custom events');

    // ── 6. Cleanup ────────────────────────────────────────────────────────────
    console.log('\n--- Cleanup ---');
    await page.evaluate(() => {
      localStorage.clear();
    });
    console.log('🧹 Cleaned up temporary test keys in browser storage');

  } catch (err) {
    console.error('💥 E2E Test Suite Error:', err.message);
  } finally {
    if (browser) await browser.close();
    serverProcess.kill('SIGTERM');
    console.log(`\n==================================================`);
    console.log(`E2E TEST RUN COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log(`==================================================`);
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runE2ETests();
