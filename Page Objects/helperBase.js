const { expect } = require('@playwright/test');

class HelperBase {
  constructor(page) {
    this.page = page;
  }

  appBaseUrl() {
    const loginUrl = process.env.STAGING_URL || 'https://kbm.argus.idsil.in/login';
    return loginUrl.replace(/\/login\/?$/, '');
  }

  async gotoPath(route) {
    await this.page.goto(`${this.appBaseUrl()}${route}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(this.page).not.toHaveURL(/\/login\/?$/i);
    await this.settlePage();
  }

  async settlePage() {
    await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await this.dismissTransientUi();
  }

  async dismissTransientUi() {
    const buttons = [
      this.page.getByRole('button', { name: /close/i }).first(),
      this.page.getByRole('button', { name: /cancel/i }).first(),
    ];

    for (const button of buttons) {
      if (await this.isVisible(button, 500)) {
        await button.click({ timeout: 1000 }).catch(() => {});
      }
    }
  }

  async isVisible(locator, timeout = 1000) {
    try {
      return await locator.isVisible({ timeout });
    } catch {
      return false;
    }
  }

  matcherList(input) {
    return Array.isArray(input) ? input : [input];
  }

  regexFor(text) {
    if (text instanceof RegExp) {
      return text;
    }

    const escaped = String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
  }

  async clickAny(locators, errorMessage) {
    for (const locator of locators) {
      if (await this.isVisible(locator)) {
        await locator.click();
        await this.settlePage();
        return;
      }
    }

    throw new Error(errorMessage || 'No clickable locator was visible.');
  }

  async fillFirstVisible(locatorFactories, value) {
    for (const locator of locatorFactories) {
      if (await this.isVisible(locator)) {
        await locator.fill('');
        await locator.fill(String(value));
        return locator;
      }
    }

    return null;
  }

  async fillTextField(matchers, value, options = {}) {
    const matchList = this.matcherList(matchers);
    const scope = options.scope || this.page;
    const locators = [];

    for (const matcher of matchList) {
      const rx = this.regexFor(matcher);
      locators.push(scope.getByLabel(rx).first());
      locators.push(scope.getByPlaceholder(rx).first());
      locators.push(scope.getByRole('textbox', { name: rx }).first());
    }

    if (options.fallbackSelector) {
      locators.push(scope.locator(options.fallbackSelector).first());
    }

    locators.push(
      scope.locator('input:not([type="checkbox"]):not([type="radio"]):visible').first(),
      scope.locator('textarea:visible').first()
    );

    const filled = await this.fillFirstVisible(locators, value);
    if (!filled) {
      throw new Error(`Unable to find a visible text field for ${matchList.join(', ')}.`);
    }

    return filled;
  }

  async openCombobox(matchers, options = {}) {
    const matchList = this.matcherList(matchers);
    const scope = options.scope || this.page;
    const locators = [];

    for (const matcher of matchList) {
      const rx = this.regexFor(matcher);
      locators.push(scope.getByRole('combobox', { name: rx }).first());
      locators.push(scope.getByLabel(rx).first());
      locators.push(scope.getByPlaceholder(rx).first());
      locators.push(scope.getByText(rx).first());
    }

    if (options.fallbackSelector) {
      locators.push(scope.locator(options.fallbackSelector).first());
    }

    locators.push(
      scope.locator('[role="combobox"]:visible').first(),
      scope.locator('input[role="combobox"]:visible').first(),
      scope.locator('input[placeholder*="Select"]:visible').first()
    );

    for (const locator of locators) {
      if (await this.isVisible(locator)) {
        await locator.click().catch(async () => {
          await locator.focus().catch(() => {});
        });
        return locator;
      }
    }

    return null;
  }

  async selectOption(matchers, optionText, options = {}) {
    const scope = options.scope || this.page;
    const trigger = await this.openCombobox(matchers, options);
    if (!trigger) {
      return false;
    }

    await trigger.fill(String(optionText)).catch(() => {});
    await this.page.keyboard.type(String(optionText)).catch(() => {});

    const popups = [
      scope.locator('[role="listbox"]:visible').last(),
      scope.locator('[role="dialog"]:visible').last(),
      this.page.locator('[role="listbox"]:visible').last(),
      this.page.locator('.v-overlay__content:visible').last(),
    ];

    const optionRegex = this.regexFor(optionText);
    for (const popup of popups) {
      const candidate = popup.getByText(optionRegex, { exact: false }).first();
      if (await this.isVisible(candidate, 1500)) {
        await candidate.click();
        return true;
      }
    }

    await this.page.keyboard.press('ArrowDown').catch(() => {});
    await this.page.keyboard.press('Enter').catch(() => {});
    return true;
  }

  async clickButton(matchers, options = {}) {
    const matchList = this.matcherList(matchers);
    const scope = options.scope || this.page;
    const locators = [];

    for (const matcher of matchList) {
      const rx = this.regexFor(matcher);
      locators.push(scope.getByRole('button', { name: rx }).first());
      locators.push(scope.getByText(rx).first());
    }

    return this.clickAny(locators, `Unable to find button matching ${matchList.join(', ')}.`);
  }

  async clickPrimaryAction(scope) {
    await this.clickButton([/save/i, /submit/i, /create/i, /^add$/i, /update/i, /confirm/i], {
      scope: scope || this.page,
    });
  }

  async openCreateForm() {
    await this.clickButton(/add new/i);
  }

  async clickSearch() {
    await this.clickButton(/^search$/i);
  }

  async searchByText(term, fieldMatchers = []) {
    const searchMatchers = fieldMatchers.length ? fieldMatchers : [/name/i, /email/i, /process/i, /file/i];
    await this.fillTextField(searchMatchers, term, {
      fallbackSelector: 'input[type="text"]:visible',
    });
    await this.clickSearch();
  }

  async expectHeading(text) {
    await expect(this.page.getByRole('heading', { name: this.regexFor(text) }).first()).toBeVisible();
  }

  async expectGridContains(values) {
    const pageText = await this.page.locator('body').innerText();
    for (const value of this.matcherList(values)) {
      expect(pageText).toContain(String(value));
    }
  }

  async openFirstGridAction(actionMatcher = /edit|view|review|open/i) {
    const buttons = this.page.getByRole('button', { name: actionMatcher });
    if (await buttons.first().isVisible().catch(() => false)) {
      await buttons.first().click();
      await this.settlePage();
      return true;
    }

    const links = this.page.getByRole('link', { name: actionMatcher });
    if (await links.first().isVisible().catch(() => false)) {
      await links.first().click();
      await this.settlePage();
      return true;
    }

    return false;
  }

  async getTableRowCount() {
    return this.page.locator('table tbody tr').count().catch(() => 0);
  }

  async expectValidationMessage() {
    const validationTargets = [
      this.page.getByText(/required/i).first(),
      this.page.getByText(/please/i).first(),
      this.page.getByText(/must/i).first(),
      this.page.locator('.text-error:visible').first(),
      this.page.locator('.error--text:visible').first(),
      this.page.locator('[aria-invalid="true"]').first(),
    ];

    for (const target of validationTargets) {
      if (await this.isVisible(target, 1500)) {
        return true;
      }
    }

    return false;
  }

  async activeDialog() {
    const dialog = this.page.locator('[role="dialog"]:visible').last();
    if (await this.isVisible(dialog, 500)) {
      return dialog;
    }

    return this.page;
  }
}

module.exports = { HelperBase };
