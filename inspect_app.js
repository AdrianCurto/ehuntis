const { chromium } = require('playwright');
const path = require('path');

const SAVE_DIR = 'C:\\Users\\adric\\.gemini\\antigravity\\brain\\cc481ba7-e6ab-47c8-b52c-d4cfa4921a55';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // --- Mobile viewport ---
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await mobileCtx.newPage();

  console.log('Step 1: Navigating to http://localhost:3000');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
  await sleep(1500);

  console.log('Step 2: screenshot_01_home.png');
  await page.screenshot({ path: path.join(SAVE_DIR, 'screenshot_01_home.png'), fullPage: false });

  // --- Click header button ---
  console.log('Step 3: Clicking header button EHUntis ▾');
  // Try various selectors
  const headerBtn = await page.$('button:has-text("EHUntis")') ||
    await page.$('button:has-text("▾")') ||
    await page.$('[class*="header"] button') ||
    await page.$('header button');
  if (headerBtn) {
    await headerBtn.click();
  } else {
    // Try clicking by text
    await page.click('text=EHUntis');
  }
  await sleep(1000);

  console.log('Step 4: screenshot_02_search.png');
  await page.screenshot({ path: path.join(SAVE_DIR, 'screenshot_02_search.png'), fullPage: false });

  // --- Type in search box ---
  console.log('Step 5: Typing GITECX301 in search box');
  const searchInput = await page.$('input[type="search"]') ||
    await page.$('input[placeholder*="Buscar"]') ||
    await page.$('input[placeholder*="buscar"]') ||
    await page.$('input[placeholder*="Search"]') ||
    await page.$('input[placeholder*="search"]') ||
    await page.$('input[placeholder*="grupo"]') ||
    await page.$('input[placeholder*="Grupo"]') ||
    await page.$('input');
  if (searchInput) {
    await searchInput.fill('GITECX301');
  } else {
    await page.keyboard.type('GITECX301');
  }
  await sleep(1500);

  console.log('Step 6: screenshot_03_results.png');
  await page.screenshot({ path: path.join(SAVE_DIR, 'screenshot_03_results.png'), fullPage: false });

  // --- Click first result ---
  console.log('Step 7: Clicking first result');
  const firstResult = await page.$('[class*="result"] li:first-child') ||
    await page.$('[class*="list"] li:first-child') ||
    await page.$('ul li:first-child') ||
    await page.$('[class*="item"]:first-child');
  if (firstResult) {
    await firstResult.click();
  } else {
    // Try clicking text that matches GITECX
    const results = await page.$$('li, [role="option"], [class*="result"]');
    if (results.length > 0) await results[0].click();
  }
  await sleep(1000);

  // --- Close modal ---
  console.log('Step 8: Closing modal');
  const closeBtn = await page.$('button[aria-label*="close"]') ||
    await page.$('button[aria-label*="Close"]') ||
    await page.$('button:has-text("✕")') ||
    await page.$('button:has-text("×")') ||
    await page.$('button:has-text("X")') ||
    await page.$('[class*="close"]');
  if (closeBtn) {
    await closeBtn.click();
  } else {
    // Click outside modal
    await page.keyboard.press('Escape');
  }
  await sleep(1000);

  console.log('Step 9: screenshot_04_calendar.png');
  await page.screenshot({ path: path.join(SAVE_DIR, 'screenshot_04_calendar.png'), fullPage: false });

  // --- Click a lesson block ---
  console.log('Step 10: Clicking a lesson block');
  const lessonBlock = await page.$('[class*="lesson"]') ||
    await page.$('[class*="event"]') ||
    await page.$('[class*="block"]') ||
    await page.$('[class*="cell"]:not([class*="header"]):not([class*="time"])');
  if (lessonBlock) {
    await lessonBlock.click();
    await sleep(800);
    console.log('Step 11: screenshot_05_modal.png');
    await page.screenshot({ path: path.join(SAVE_DIR, 'screenshot_05_modal.png'), fullPage: false });

    // Close modal
    const closeBtn2 = await page.$('button[aria-label*="close"]') ||
      await page.$('button[aria-label*="Close"]') ||
      await page.$('button:has-text("✕")') ||
      await page.$('button:has-text("×")') ||
      await page.$('[class*="close"]');
    if (closeBtn2) {
      await closeBtn2.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await sleep(600);
  } else {
    console.log('No lesson block found, saving placeholder screenshot');
    await page.screenshot({ path: path.join(SAVE_DIR, 'screenshot_05_modal.png'), fullPage: false });
  }

  // --- Click Ajustes tab ---
  console.log('Step 12: Clicking Ajustes tab');
  const ajustesTab = await page.$('button:has-text("Ajustes")') ||
    await page.$('a:has-text("Ajustes")') ||
    await page.$('[role="tab"]:has-text("Ajustes")') ||
    await page.$('text=Ajustes');
  if (ajustesTab) {
    await ajustesTab.click();
  } else {
    // Try nav items
    const navItems = await page.$$('nav a, nav button, [class*="tab"]');
    for (const item of navItems) {
      const text = await item.textContent();
      if (text && text.includes('Ajuste')) {
        await item.click();
        break;
      }
    }
  }
  await sleep(1000);

  console.log('Step 13: screenshot_06_settings.png');
  await page.screenshot({ path: path.join(SAVE_DIR, 'screenshot_06_settings.png'), fullPage: false });

  await mobileCtx.close();

  // --- Desktop viewport ---
  console.log('Step 14: Desktop viewport 1280x800');
  const desktopCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const desktopPage = await desktopCtx.newPage();
  await desktopPage.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
  await sleep(1500);
  console.log('Step 14: screenshot_07_desktop.png');
  await desktopPage.screenshot({ path: path.join(SAVE_DIR, 'screenshot_07_desktop.png'), fullPage: false });

  await desktopCtx.close();
  await browser.close();

  console.log('All screenshots saved!');
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
