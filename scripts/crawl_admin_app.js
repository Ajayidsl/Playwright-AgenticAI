const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '..', 'env', '.env.prod'),
});

const credentials = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'Utils', 'userCredentials.json'), 'utf8')
);

const loginUrl = process.env.STAGING_URL || 'https://kbm.argus.idsil.in/login';
const baseUrl = loginUrl.replace(/\/login\/?$/, '');
const appOrigin = new URL(baseUrl).origin;
const outputPath = path.resolve(
  __dirname,
  '..',
  'ai_knowledge',
  'ai_Knowledge_Admin',
  'app_graph.json'
);

const fallbackRouteSeeds = [
  { via: 'Direct route seed: Divisions', url: `${baseUrl}/admin/divisions` },
  { via: 'Direct route seed: Departments', url: `${baseUrl}/admin/departments` },
  { via: 'Direct route seed: Locations', url: `${baseUrl}/admin/locations` },
  { via: 'Direct route seed: User Management', url: `${baseUrl}/admin/users` },
  { via: 'Direct route seed: Filename|Attachments', url: `${baseUrl}/admin/file` },
  { via: 'Direct route seed: Process Name', url: `${baseUrl}/admin/process` },
  { via: 'Direct route seed: Review Process Manual', url: `${baseUrl}/process-review-draft` },
  { via: 'Direct route seed: Review RMF', url: `${baseUrl}/rmf-review-draft` },
];

const destructiveLabelPattern =
  /\b(delete|remove|logout|log out|sign out|signoff|sign off|approve|reject|submit|save|create|add|update|upload|import|export|download)\b/i;
const nonPageHrefPattern = /^(javascript:|mailto:|tel:|#)/i;

function normalizeWhitespace(value) {
  return value ? value.replace(/\s+/g, ' ').trim() : '';
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function normalizeUrl(candidate, currentUrl = baseUrl) {
  if (!candidate || nonPageHrefPattern.test(candidate)) {
    return null;
  }

  try {
    const url = new URL(candidate, currentUrl);
    if (url.origin !== appOrigin) {
      return null;
    }

    url.hash = '';
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }

    const sortedParams = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) {
        return leftValue.localeCompare(rightValue);
      }
      return leftKey.localeCompare(rightKey);
    });
    url.search = '';
    for (const [key, value] of sortedParams) {
      url.searchParams.append(key, value);
    }

    return url.toString();
  } catch {
    return null;
  }
}

function toKey(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function uniquePageKey(preferredKey, usedKeys, fallbackIndex) {
  const baseKey = preferredKey || `page_${fallbackIndex}`;
  if (!usedKeys.has(baseKey)) {
    usedKeys.add(baseKey);
    return baseKey;
  }

  let suffix = 2;
  while (usedKeys.has(`${baseKey}_${suffix}`)) {
    suffix += 1;
  }

  const resolvedKey = `${baseKey}_${suffix}`;
  usedKeys.add(resolvedKey);
  return resolvedKey;
}

function isSafeNavLabel(label) {
  return Boolean(label) && !destructiveLabelPattern.test(label);
}

function pageNameFromRecord(record) {
  if (record.heading) {
    return record.heading;
  }

  if (record.title) {
    return record.title;
  }

  try {
    const url = new URL(record.final_url);
    return url.pathname.split('/').filter(Boolean).pop() || 'landing';
  } catch {
    return 'landing';
  }
}

async function dismissTransientUi(page) {
  const dismissors = [
    page.getByRole('button', { name: /close/i }).first(),
    page.getByRole('button', { name: /cancel/i }).first(),
  ];

  for (const locator of dismissors) {
    try {
      if (await locator.isVisible({ timeout: 500 })) {
        await locator.click({ timeout: 1000 });
      }
    } catch {}
  }
}

async function settlePage(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await dismissTransientUi(page);
}

async function login(page) {
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(credentials.admin);
  await page.locator('#password').fill(credentials.password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL((url) => !/\/login\/?$/i.test(url.pathname), {
    timeout: 30000,
  });
  await settlePage(page);
}

async function readVisibleHeadings(page) {
  return page
    .locator('h1, h2, h3')
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const element = node;
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
        })
        .map((node) => node.textContent?.trim())
        .filter(Boolean)
        .slice(0, 8)
    )
    .catch(() => []);
}

async function readNavItems(page) {
  return page
    .locator('nav, aside, [role="navigation"]')
    .locator('button, a')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const element = node;
          return (
            element.textContent?.replace(/\s+/g, ' ').trim() ||
            element.getAttribute('data-tooltip-content') ||
            element.getAttribute('aria-label') ||
            element.getAttribute('title') ||
            ''
          );
        })
        .filter(Boolean)
        .slice(0, 30)
    )
    .catch(() => []);
}

async function captureCurrentPage(page, requestedUrl, discoveredFrom, via) {
  const visibleHeadings = await readVisibleHeadings(page);
  const title = await page.title().catch(() => null);
  const finalUrl = normalizeUrl(page.url()) || page.url();
  const metadata = await page
    .evaluate(() => ({
      forms: document.querySelectorAll('form').length,
      buttons: document.querySelectorAll('button').length,
      tables: document.querySelectorAll('table').length,
      inputs: document.querySelectorAll('input, textarea, select').length,
    }))
    .catch(() => ({ forms: 0, buttons: 0, tables: 0, inputs: 0 }));

  return {
    page_name: visibleHeadings[0] || title || null,
    requested_url: requestedUrl,
    final_url: finalUrl,
    discovered_from: discoveredFrom,
    via,
    reachable: !/\/login\/?$/i.test(new URL(finalUrl, baseUrl).pathname),
    title,
    heading: visibleHeadings[0] || null,
    visible_headings: visibleHeadings,
    navigation_items: await readNavItems(page),
    metadata,
  };
}

async function extractNavTargets(page) {
  const roots = page.locator('nav, aside, [role="navigation"]');
  const controls = roots.locator('button, a');
  const count = await controls.count();
  const items = [];

  for (let index = 0; index < count; index += 1) {
    const locator = controls.nth(index);
    const isVisible = await locator.isVisible().catch(() => false);
    if (!isVisible) {
      continue;
    }

    const label = firstNonEmpty(
      await locator.innerText().catch(() => ''),
      await locator.getAttribute('data-tooltip-content').catch(() => ''),
      await locator.getAttribute('aria-label').catch(() => ''),
      await locator.getAttribute('title').catch(() => '')
    );
    const href = normalizeUrl(await locator.getAttribute('href').catch(() => null), page.url());

    if (!href && !isSafeNavLabel(label)) {
      continue;
    }

    if (href && label && destructiveLabelPattern.test(label)) {
      continue;
    }

    items.push({
      label: label || href,
      href,
      index,
      type: href ? 'nav_href' : 'nav_click',
    });
  }

  return dedupeTargets(items);
}

async function extractInternalAnchors(page) {
  const anchors = page.locator('main a[href], section a[href], article a[href]');
  const count = await anchors.count();
  const items = [];

  for (let index = 0; index < count; index += 1) {
    const locator = anchors.nth(index);
    const isVisible = await locator.isVisible().catch(() => false);
    if (!isVisible) {
      continue;
    }

    const label = normalizeWhitespace(await locator.innerText().catch(() => ''));
    const href = normalizeUrl(await locator.getAttribute('href').catch(() => null), page.url());
    if (!href || destructiveLabelPattern.test(label)) {
      continue;
    }

    items.push({
      label: label || href,
      href,
      type: 'content_href',
    });
  }

  return dedupeTargets(items).slice(0, 20);
}

function dedupeTargets(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.type}:${item.label || ''}:${item.href || ''}:${item.index ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function enqueue(queue, seen, candidate) {
  const key = `${candidate.type}:${candidate.href || ''}:${candidate.label || ''}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  queue.push(candidate);
}

async function openFromLanding(page, landingUrl, candidate) {
  if (candidate.type === 'fallback_url' || candidate.type === 'nav_href' || candidate.type === 'content_href') {
    await page.goto(candidate.href, { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    return;
  }

  await page.goto(landingUrl, { waitUntil: 'domcontentloaded' });
  await settlePage(page);

  const controls = page.locator('nav, aside, [role="navigation"]').locator('button, a');
  const target = controls.nth(candidate.index);
  if (!(await target.isVisible().catch(() => false))) {
    throw new Error(`Navigation control at index ${candidate.index} is no longer visible.`);
  }

  await target.click({ timeout: 10000, force: true });
  await settlePage(page);
}

function summarize(graph) {
  const reachablePages = graph.pages.filter((entry) => entry.reachable).length;
  const unreachablePages = graph.pages.filter((entry) => !entry.reachable).length;
  const uniqueUrls = new Set(graph.pages.map((entry) => entry.final_url)).size;
  return {
    reachable_pages: reachablePages,
    unreachable_pages: unreachablePages,
    unique_urls: uniqueUrls,
    edges: graph.edges.length,
  };
}

async function main() {
  console.log(`Starting admin crawl against ${loginUrl}`);
  const browser = await chromium.launch({
    channel: 'chromium',
    headless: true,
    slowMo: 0,
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: null,
  });

  const page = await context.newPage();
  const startedAt = new Date().toISOString();
  const graph = {
    generated_at: startedAt,
    role: 'Admin',
    source: {
      crawler: 'scripts/crawl_admin_app.js',
      mode: 'headless',
      login_url: loginUrl,
      base_url: baseUrl,
      strategy: 'ui_navigation_with_fallback_routes',
    },
    credentials_used: {
      username: credentials.admin,
      password_source: 'Utils/userCredentials.json',
    },
    pages: [],
    edges: [],
  };

  const pageKeyByUrl = new Map();
  const usedPageKeys = new Set();
  const queue = [];
  const queuedTargets = new Set();

  try {
    await login(page);

    const landingRecord = await captureCurrentPage(
      page,
      page.url(),
      null,
      'Post-login landing page'
    );
    landingRecord.key = 'admin_landing';
    usedPageKeys.add(landingRecord.key);
    graph.pages.push(landingRecord);
    pageKeyByUrl.set(landingRecord.final_url, landingRecord.key);

    const landingUrl = landingRecord.final_url;
    const navTargets = await extractNavTargets(page);
    const contentTargets = await extractInternalAnchors(page);

    for (const candidate of navTargets.filter((entry) => entry.href)) {
      enqueue(queue, queuedTargets, {
        ...candidate,
        from: landingRecord.key,
        discovered_from_url: landingUrl,
      });
    }

    for (const candidate of contentTargets) {
      enqueue(queue, queuedTargets, {
        ...candidate,
        from: landingRecord.key,
        discovered_from_url: landingUrl,
      });
    }

    for (const seed of fallbackRouteSeeds) {
      enqueue(queue, queuedTargets, {
        type: 'fallback_url',
        href: normalizeUrl(seed.url),
        label: seed.via,
        from: landingRecord.key,
        discovered_from_url: landingUrl,
      });
    }

    while (queue.length > 0 && graph.pages.length < 30) {
      const candidate = queue.shift();
      if (!candidate?.href && candidate?.type !== 'nav_click') {
        continue;
      }

      try {
        await openFromLanding(page, landingUrl, candidate);
      } catch (error) {
        graph.edges.push({
          from: candidate.from,
          to: null,
          action: candidate.label,
          requested_url: candidate.href || null,
          final_url: page.url(),
          status: 'navigation_error',
          error: error.message,
        });
        continue;
      }

      const record = await captureCurrentPage(
        page,
        candidate.href || landingUrl,
        candidate.from,
        candidate.label
      );

      const existingKey = pageKeyByUrl.get(record.final_url);
      const pageKey =
        existingKey ||
        uniquePageKey(toKey(pageNameFromRecord(record)), usedPageKeys, graph.pages.length + 1);
      if (!existingKey) {
        record.key = pageKey;
        graph.pages.push(record);
        pageKeyByUrl.set(record.final_url, pageKey);
      }

      graph.edges.push({
        from: candidate.from,
        to: pageKey,
        action: candidate.label,
        requested_url: candidate.href || null,
        final_url: record.final_url,
        status: record.reachable ? 'reachable' : 'redirected_to_login',
      });

      if (existingKey || !record.reachable) {
        continue;
      }

      const newNavTargets = await extractNavTargets(page);
      const newContentTargets = await extractInternalAnchors(page);
      for (const nextTarget of [...newNavTargets.filter((entry) => entry.href), ...newContentTargets]) {
        enqueue(queue, queuedTargets, {
          ...nextTarget,
          from: pageKey,
          discovered_from_url: record.final_url,
        });
      }
    }

    graph.summary = summarize(graph);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));
    console.log(`Admin crawl complete. Wrote ${graph.pages.length} pages and ${graph.edges.length} edges to ${outputPath}`);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
