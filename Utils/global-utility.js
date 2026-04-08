const { expect } = require('@playwright/test');
const { POManger } = require('../Page Objects/pageObjectManager.spec');

async function UserLoggedIn(browser, username, password) {
  if (!process.env.STAGING_URL) {
    throw new Error('Missing STAGING_URL. Set it in env/.env.prod before running UI tests.');
  }

  if (!username || !password || username.startsWith('replace-with')) {
    throw new Error('Update Utils/userCredentials.json with valid credentials before running UI tests.');
  }

  const context = await browser.newContext();
  await context.clearCookies();
  const page = await context.newPage();
  const pom = new POManger(page);

  await pom.getLoginPage().userLoggedIn(username, password);
  await expect(page).not.toHaveURL(/\/login\/?$/i);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

  return { webContext: context, context, page, pom };
}

module.exports = { UserLoggedIn };
