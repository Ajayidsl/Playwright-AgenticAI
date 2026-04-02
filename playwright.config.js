// @ts-check
const { defineConfig } = require('@playwright/test');
const os = require('node:os');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, 'env/.env.prod'),
});

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 4 : 2,
  timeout: 120 * 1000,
  expect: {
    timeout: 30 * 1000,
  },
  reporter: process.env.CI
    ? [['blob', { outputDir: 'blob-reports' }]]
    : [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['list'],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        [
          'allure-playwright',
          {
            detail: true,
            outputFolder: 'allure-results',
            suiteTitle: 'Starter Regression',
            environmentInfo: {
              OS: os.platform(),
              Architecture: os.arch(),
              NodeVersion: process.version,
            },
          },
        ],
      ],
  use: {
    ignoreHTTPSErrors: true,
    actionTimeout: 30 * 1000,
    navigationTimeout: 60 * 1000,
    // always record a trace so that it’s available in reports
    // (set to "on" globally; you can override per-test with test.use)
    trace: 'on',
    // capture a screenshot after every test – failures will also be
    // included in generated reports such as the HTML/Allure output
    screenshot: 'on',
    // video can also be enabled if desired; uncomment to use
    // video: 'on',
    video: 'off',
    permissions: ['notifications'],
    baseURL: process.env.STAGING_URL || undefined,
    launchOptions: {
      args: ['--start-maximized'],
    },
  },
  projects: [
    {
      name: 'chrome_Browser',
      use: {
        channel: 'chromium',
        viewport: null,
      },
    },
  ],
});
