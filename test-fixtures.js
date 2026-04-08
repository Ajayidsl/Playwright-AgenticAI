const base = require('@playwright/test');
const { POManger } = require('./Page Objects/pageObjectManager.spec');

const test = base.test.extend({
  pageManager: async ({ page }, use) => {
    await use(new POManger(page));
  },
  checkErrors: [
    async ({ page }, use) => {
      await use('');
      const pom = new POManger(page);
      await pom.getSearchMethods().checkErrors();
    },
    { auto: true },
  ],
});

module.exports = {
  test,
  expect: base.expect,
};

