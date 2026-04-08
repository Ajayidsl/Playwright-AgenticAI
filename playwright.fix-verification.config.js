const base = require('./playwright.config');

module.exports = {
  ...base,
  reporter: [
    ['html', { outputFolder: 'playwright-report-fix-verification', open: 'never' }],
    ['list'],
  ],
};
