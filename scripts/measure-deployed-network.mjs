#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

const DEFAULT_BASE_URL = 'https://atehna.vercel.app/';
const DEFAULT_ROUTE_TEMPLATES = [
  '/',
  '/products',
  '/products/[category]',
  '/index',
  '/admin/kategorije',
  '/admin/kategorije/predogled',
  '/admin/kategorije/miller-view',
  '/admin/orders',
  '/admin/orders/[orderId]'
];
const DEFAULT_OUTPUT_DIR = path.join('artifacts', 'measurements');
const WAIT_AFTER_NETWORK_IDLE_MS = 2_000;
const DEFAULT_REPEAT_WINDOW_LENGTHS = [2048, 1024, 512, 256];
const FALLBACK_CHROMIUM_EXECUTABLES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

function printHelp() {
  console.log(`Measure deployed Chromium network usage for Atehna routes.

Usage:
  npm run measure:deployed-network -- [options]

Options:
  --base-url <url>           Base URL to measure. Default: ${DEFAULT_BASE_URL}
  --route <path>             Route to measure. Repeatable.
  --routes-file <file>       Read route list from a JSON or newline-delimited text file.
  --category <slug>          Substitute value for /products/[category].
  --order-id <id>            Substitute value for /admin/orders/[orderId].
  --output-dir <dir>         Directory for JSON/Markdown outputs. Default: ${DEFAULT_OUTPUT_DIR}
  --storage-state <file>     Optional Playwright storage state JSON for authenticated/admin routes.
  --headless <true|false>    Launch Chromium headless or headed. Default: true
  --timeout <ms>             Navigation timeout in milliseconds. Default: 60000
  --settle-ms <ms>           Extra wait after networkidle. Default: ${WAIT_AFTER_NETWORK_IDLE_MS}
  --save-html <true|false>   Save main document HTML responses. Default: true
  --help                     Show this help.

Examples:
  npm run measure:deployed-network
  npm run measure:deployed-network -- --category kovine --order-id 123
  npm run measure:deployed-network -- --base-url https://atehna.vercel.app --output-dir artifacts/measurements/manual-run
  npm run measure:deployed-network -- --routes-file ./routes.txt
`);
}


async function resolveChromiumLaunchOptions(options) {
  for (const executablePath of FALLBACK_CHROMIUM_EXECUTABLES) {
    try {
      await fs.access(executablePath);
      return { headless: options.headless, executablePath };
    } catch {
      // Try the next candidate.
    }
  }
  return { headless: options.headless };
}

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    routes: [],
    routesFile: null,
    category: process.env.MEASURE_CATEGORY ?? null,
    orderId: process.env.MEASURE_ORDER_ID ?? null,
    outputDir: DEFAULT_OUTPUT_DIR,
    storageState: process.env.MEASURE_STORAGE_STATE ?? null,
    headless: true,
    timeout: 60_000,
    settleMs: WAIT_AFTER_NETWORK_IDLE_MS,
    saveHtml: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--base-url') {
      args.baseUrl = next;
      index += 1;
      continue;
    }
    if (token === '--route') {
      args.routes.push(next);
      index += 1;
      continue;
    }
    if (token === '--routes-file') {
      args.routesFile = next;
      index += 1;
      continue;
    }
    if (token === '--category') {
      args.category = next;
      index += 1;
      continue;
    }
    if (token === '--order-id') {
      args.orderId = next;
      index += 1;
      continue;
    }
    if (token === '--output-dir') {
      args.outputDir = next;
      index += 1;
      continue;
    }
    if (token === '--storage-state') {
      args.storageState = next;
      index += 1;
      continue;
    }
    if (token === '--headless') {
      args.headless = next !== 'false';
      index += 1;
      continue;
    }
    if (token === '--timeout') {
      args.timeout = Number(next);
      index += 1;
      continue;
    }
    if (token === '--settle-ms') {
      args.settleMs = Number(next);
      index += 1;
      continue;
    }
    if (token === '--save-html') {
      args.saveHtml = next !== 'false';
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

async function loadRoutesFromFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  if (filePath.endsWith('.json')) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected JSON array in ${filePath}`);
    }
    return parsed.map(String);
  }

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'));
}

function normalizeBaseUrl(baseUrl) {
  const url = new URL(baseUrl);
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  return url.toString();
}

function classifyRequest(record, baseOrigin) {
  const url = new URL(record.url);
  const pathname = url.pathname;
  const requestType = record.resourceType ?? '';
  const mimeType = (record.mimeType ?? '').toLowerCase();
  const sameOrigin = url.origin === baseOrigin;

  if (requestType === 'document' || mimeType.includes('text/html')) return 'HTML';
  if (url.searchParams.has('_rsc') || mimeType.includes('text/x-component')) return 'RSC';
  if (requestType === 'stylesheet' || pathname.endsWith('.css') || mimeType.includes('text/css')) return 'CSS';
  if (requestType === 'image' || mimeType.startsWith('image/')) return 'image';
  if (requestType === 'font' || mimeType.startsWith('font/') || mimeType.includes('woff')) return 'font';
  if (requestType === 'xhr' || requestType === 'fetch' || mimeType.includes('json')) return 'fetch/XHR/data';
  if (requestType === 'script' || pathname.endsWith('.js')) {
    if (sameOrigin && /^\/_next\/static\/chunks\/(app|pages)\//.test(pathname)) return 'route JS';
    return 'shared JS';
  }
  return 'other';
}

function classifyParty(urlString, baseOrigin) {
  try {
    return new URL(urlString).origin === baseOrigin ? 'same-origin' : 'third-party';
  } catch {
    return 'other';
  }
}

function buildTopRequests(records, key, limit = 10) {
  return [...records]
    .sort((left, right) => (right[key] ?? 0) - (left[key] ?? 0))
    .slice(0, limit)
    .map((record) => ({
      url: record.url,
      method: record.method,
      status: record.status,
      requestType: record.requestType,
      classification: record.classification,
      party: record.party,
      fromCache: record.fromCache,
      transferredBytes: record.transferredBytes,
      resourceSizeBytes: record.resourceSizeBytes
    }));
}

function sumBy(records, predicate, field) {
  return records.filter(predicate).reduce((total, record) => total + (record[field] ?? 0), 0);
}

function summarizeByClassification(records) {
  const summary = {};
  for (const record of records) {
    const bucket = summary[record.classification] ?? {
      requestCount: 0,
      transferredBytes: 0,
      resourceSizeBytes: 0,
      networkTransferredBytes: 0,
      cacheHits: 0
    };
    bucket.requestCount += 1;
    bucket.transferredBytes += record.transferredBytes;
    bucket.resourceSizeBytes += record.resourceSizeBytes;
    bucket.networkTransferredBytes += record.fromCache ? 0 : record.transferredBytes;
    bucket.cacheHits += record.fromCache ? 1 : 0;
    summary[record.classification] = bucket;
  }
  return summary;
}

function summarizeByParty(records) {
  return {
    sameOrigin: {
      requestCount: records.filter((record) => record.party === 'same-origin').length,
      transferredBytes: sumBy(records, (record) => record.party === 'same-origin', 'transferredBytes'),
      resourceSizeBytes: sumBy(records, (record) => record.party === 'same-origin', 'resourceSizeBytes')
    },
    thirdParty: {
      requestCount: records.filter((record) => record.party === 'third-party').length,
      transferredBytes: sumBy(records, (record) => record.party === 'third-party', 'transferredBytes'),
      resourceSizeBytes: sumBy(records, (record) => record.party === 'third-party', 'resourceSizeBytes')
    }
  };
}

function createRouteResult(routeTemplate, resolvedPath, mode, records) {
  const totalResourceSize = records.reduce((total, record) => total + record.resourceSizeBytes, 0);
  const totalTransferredBytes = records.reduce((total, record) => total + record.transferredBytes, 0);
  const totalOriginTransferredBytes = sumBy(records, (record) => record.party === 'same-origin', 'transferredBytes');
  const cachedRequestCount = records.filter((record) => record.fromCache).length;
  const networkRequestCount = records.length - cachedRequestCount;

  return {
    routeTemplate,
    resolvedPath,
    mode,
    requestCount: records.length,
    cachedRequestCount,
    networkRequestCount,
    totals: {
      resourceSizeBytes: totalResourceSize,
      transferredBytes: totalTransferredBytes,
      originTransferredBytes: totalOriginTransferredBytes
    },
    byClassification: summarizeByClassification(records),
    byParty: summarizeByParty(records),
    biggestByTransferredBytes: buildTopRequests(records, 'transferredBytes'),
    biggestByResourceSizeBytes: buildTopRequests(records, 'resourceSizeBytes'),
    requests: records
  };
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while (true) {
    index = haystack.indexOf(needle, index);
    if (index === -1) break;
    count += 1;
    index += needle.length;
  }
  return count;
}

function collectLargestInlineScripts(html, limit = 10) {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  return scripts
    .map((match, index) => {
      const content = match[1] ?? '';
      let kind = 'inline-script';
      if (content.includes('__next_f.push')) kind = 'next-flight';
      else if (content.includes('self.__next_f=')) kind = 'next-flight-bootstrap';
      return {
        index,
        kind,
        bytes: Buffer.byteLength(content, 'utf8'),
        snippet: content.trim().slice(0, 240)
      };
    })
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, limit);
}

function collectRepeatedSubstrings(html, limit = 10) {
  const normalized = html.replace(/\s+/g, ' ');
  const results = [];

  for (const windowLength of DEFAULT_REPEAT_WINDOW_LENGTHS) {
    const counts = new Map();
    const step = Math.max(32, Math.floor(windowLength / 4));
    for (let index = 0; index + windowLength <= normalized.length; index += step) {
      const sample = normalized.slice(index, index + windowLength);
      if (!/[{\[]/.test(sample) && !sample.includes('__next_f.push')) continue;
      if (new Set(sample).size < 12) continue;
      counts.set(sample, (counts.get(sample) ?? 0) + 1);
    }

    for (const [sample, count] of counts.entries()) {
      if (count < 2) continue;
      results.push({
        length: windowLength,
        occurrences: count,
        repeatedBytes: windowLength * count,
        snippet: sample.slice(0, 240)
      });
    }
  }

  return results
    .sort((left, right) => right.repeatedBytes - left.repeatedBytes)
    .slice(0, limit);
}

function collectLargeJsonLikeRegions(html, limit = 10) {
  const matches = [...html.matchAll(/(__next_f\.push\([\s\S]{120,}?<\/script>|initialPayload[\s\S]{120,}?[\]\}])/gi)];
  return matches
    .map((match) => ({
      bytes: Buffer.byteLength(match[0], 'utf8'),
      snippet: match[0].slice(0, 240)
    }))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, limit);
}

function analyzeDocumentHtml(html) {
  return {
    htmlBytes: Buffer.byteLength(html, 'utf8'),
    inlineScriptCount: countOccurrences(html, '<script'),
    nextFlightPushCount: countOccurrences(html, '__next_f.push'),
    suspiciousMarkerCounts: {
      categories: countOccurrences(html, 'categories'),
      subcategories: countOccurrences(html, 'subcategories'),
      items: countOccurrences(html, 'items'),
      search: countOccurrences(html.toLowerCase(), 'search'),
      payload: countOccurrences(html, 'payload'),
      initialPayload: countOccurrences(html, 'initialPayload'),
      __next_f_push: countOccurrences(html, '__next_f.push')
    },
    largestInlineScripts: collectLargestInlineScripts(html),
    repeatedSubstrings: collectRepeatedSubstrings(html),
    largeJsonLikeRegions: collectLargeJsonLikeRegions(html)
  };
}

async function autoResolveCategory(page, baseUrl, timeout) {
  const productsUrl = new URL('/products', baseUrl).toString();
  await page.goto(productsUrl, { waitUntil: 'networkidle', timeout });
  const href = await page.locator('a[href^="/products/"]').evaluateAll((anchors) => {
    const candidate = anchors
      .map((anchor) => anchor.getAttribute('href'))
      .find((value) => value && value.startsWith('/products/') && value.split('/').filter(Boolean).length === 2);
    return candidate ?? null;
  });

  if (!href) {
    throw new Error('Could not auto-resolve [category] from /products. Pass --category <slug>.');
  }

  return href.split('/').filter(Boolean)[1];
}

async function autoResolveOrderId(page, baseUrl, timeout) {
  const ordersUrl = new URL('/admin/orders', baseUrl).toString();
  await page.goto(ordersUrl, { waitUntil: 'networkidle', timeout });
  const href = await page.locator('a[href^="/admin/orders/"]').evaluateAll((anchors) => {
    const candidate = anchors
      .map((anchor) => anchor.getAttribute('href'))
      .find((value) => value && /^\/admin\/orders\/[^/?#]+$/.test(value));
    return candidate ?? null;
  });

  if (!href) {
    throw new Error('Could not auto-resolve [orderId] from /admin/orders. Pass --order-id <id>.');
  }

  return href.split('/').filter(Boolean).at(-1);
}

async function resolveRouteTemplates(browser, options) {
  const routeTemplates = options.routes.length > 0
    ? options.routes
    : options.routesFile
      ? await loadRoutesFromFile(options.routesFile)
      : [...DEFAULT_ROUTE_TEMPLATES];

  const needsCategory = routeTemplates.some((route) => route.includes('[category]')) && !options.category;
  const needsOrderId = routeTemplates.some((route) => route.includes('[orderId]')) && !options.orderId;

  if (!needsCategory && !needsOrderId) {
    return {
      routeTemplates,
      params: {
        category: options.category,
        orderId: options.orderId
      }
    };
  }

  const page = await browser.newPage();
  try {
    const params = {
      category: options.category,
      orderId: options.orderId
    };
    if (needsCategory) {
      params.category = await autoResolveCategory(page, options.baseUrl, options.timeout);
    }
    if (needsOrderId) {
      params.orderId = await autoResolveOrderId(page, options.baseUrl, options.timeout);
    }
    return { routeTemplates, params };
  } finally {
    await page.close();
  }
}

function materializeRoute(routeTemplate, params) {
  return routeTemplate
    .replaceAll('[category]', params.category ?? '[category]')
    .replaceAll('[orderId]', params.orderId ?? '[orderId]');
}

function createCollector(baseOrigin) {
  const requests = new Map();

  const onRequest = (request) => {
    const frame = request.frame();
    if (!frame || frame.parentFrame()) return;

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url: request.url(),
      method: request.method(),
      startTime: Date.now(),
      resourceType: request.resourceType(),
      requestHeaders: request.headers(),
      status: null,
      mimeType: null,
      fromCache: false,
      failed: false,
      failureText: null,
      transferSize: 0,
      decodedBodySize: 0,
      encodedBodySize: 0
    };
    requests.set(request, entry);

  };

  const onResponse = async (response) => {
    const request = response.request();
    const entry = requests.get(request);
    if (!entry) return;

    const timing = await response.serverAddr().catch(() => null);
    entry.status = response.status();
    entry.mimeType = response.headers()['content-type'] ?? null;
    entry.remoteAddress = timing?.ipAddress ?? null;
    entry.responseHeaders = response.headers();
    entry.fromServiceWorker = response.fromServiceWorker();
  };

  const onRequestFinished = async (request) => {
    const entry = requests.get(request);
    if (!entry) return;

    const sizes = await request.sizes().catch(() => null);
    entry.transferSize = sizes?.responseBodySize != null && sizes?.responseHeadersSize != null
      ? sizes.responseBodySize + sizes.responseHeadersSize
      : sizes?.responseBodySize ?? 0;
    entry.encodedBodySize = sizes?.responseBodySize ?? 0;
    entry.requestHeaderSize = sizes?.requestHeadersSize ?? 0;
    entry.requestBodySize = sizes?.requestBodySize ?? 0;
  };

  const onRequestFailed = (request) => {
    const entry = requests.get(request);
    if (!entry) return;
    entry.failed = true;
    entry.failureText = request.failure()?.errorText ?? 'unknown';
  };

  return {
    attach(page) {
      page.on('request', onRequest);
      page.on('response', onResponse);
      page.on('requestfinished', onRequestFinished);
      page.on('requestfailed', onRequestFailed);
    },
    detach(page) {
      page.off('request', onRequest);
      page.off('response', onResponse);
      page.off('requestfinished', onRequestFinished);
      page.off('requestfailed', onRequestFailed);
    },
    async buildRecords(page) {
      const performanceEntries = await page.evaluate(() => {
        const navigationEntries = performance.getEntriesByType('navigation').map((entry) => ({
          entryType: entry.entryType,
          name: entry.name,
          initiatorType: 'navigation',
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
          nextHopProtocol: entry.nextHopProtocol,
          startTime: entry.startTime,
          duration: entry.duration,
          deliveryType: 'deliveryType' in entry ? entry.deliveryType ?? null : null
        }));
        const resourceEntries = performance.getEntriesByType('resource').map((entry) => ({
          entryType: entry.entryType,
          name: entry.name,
          initiatorType: entry.initiatorType,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
          nextHopProtocol: entry.nextHopProtocol,
          startTime: entry.startTime,
          duration: entry.duration,
          deliveryType: 'deliveryType' in entry ? entry.deliveryType ?? null : null
        }));
        return [...navigationEntries, ...resourceEntries];
      });

      const perfQueue = new Map();
      for (const entry of performanceEntries) {
        const key = entry.name;
        const bucket = perfQueue.get(key) ?? [];
        bucket.push(entry);
        perfQueue.set(key, bucket);
      }

      return [...requests.values()].map((entry) => {
        const bucket = perfQueue.get(entry.url) ?? [];
        const perf = bucket.shift() ?? null;
        perfQueue.set(entry.url, bucket);
        const transferredBytes = perf?.transferSize ?? entry.transferSize ?? 0;
        const resourceSizeBytes = perf?.decodedBodySize ?? perf?.encodedBodySize ?? entry.encodedBodySize ?? 0;
        const fromCache = transferredBytes === 0 && !!perf && (perf.decodedBodySize > 0 || perf.encodedBodySize > 0);
        const record = {
          ...entry,
          transferredBytes,
          resourceSizeBytes,
          fromCache,
          performance: perf,
          party: classifyParty(entry.url, baseOrigin)
        };
        record.classification = classifyRequest(record, baseOrigin);
        return record;
      });
    }
  };
}

async function measureRoute(browser, baseUrl, routeTemplate, resolvedPath, options) {
  const url = new URL(resolvedPath, baseUrl).toString();
  const baseOrigin = new URL(baseUrl).origin;
  const context = await browser.newContext({
    ignoreHTTPSErrors: false,
    storageState: options.storageState ?? undefined
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');

  const measureOnce = async (mode, navigate) => {
    const collector = createCollector(baseOrigin);
    collector.attach(page);
    try {
      const response = await navigate();
      await page.waitForLoadState('networkidle', { timeout: options.timeout });
      if (options.settleMs > 0) {
        await page.waitForTimeout(options.settleMs);
      }
      const records = await collector.buildRecords(page);
      const result = createRouteResult(routeTemplate, resolvedPath, mode, records);
      if (options.saveHtml && response) {
        const html = await response.text().catch(() => '');
        const htmlBaseName = `${routeSlug(resolvedPath)}-${mode}.html`;
        const htmlPath = path.join(options.outputDir, 'html', htmlBaseName);
        await fs.mkdir(path.dirname(htmlPath), { recursive: true });
        await fs.writeFile(htmlPath, html, 'utf8');
        result.documentHtml = {
          path: htmlPath,
          savedHtmlPath: htmlPath,
          status: response.status(),
          url: response.url(),
          analysis: analyzeDocumentHtml(html)
        };
      }
      return result;
    } finally {
      collector.detach(page);
    }
  };

  try {
    const cold = await measureOnce('cold', async () => {
      await client.send('Network.setCacheDisabled', { cacheDisabled: false });
      return page.goto(url, { waitUntil: 'networkidle', timeout: options.timeout });
    });

    const warm = await measureOnce('reload', async () => {
      await client.send('Network.setCacheDisabled', { cacheDisabled: false });
      return page.reload({ waitUntil: 'networkidle', timeout: options.timeout });
    });

    const hardReload = await measureOnce('hard-reload', async () => {
      await client.send('Network.setCacheDisabled', { cacheDisabled: true });
      try {
        return await page.reload({ waitUntil: 'networkidle', timeout: options.timeout });
      } finally {
        await client.send('Network.setCacheDisabled', { cacheDisabled: false });
      }
    });

    return { routeTemplate, resolvedPath, url, runs: [cold, warm, hardReload] };
  } finally {
    await context.close();
  }
}

function routeSlug(routePath) {
  return routePath === '/'
    ? 'root'
    : routePath.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${bytes} B`;
}

function renderSummaryMarkdown(report) {
  const lines = [];
  lines.push(`# Deployed network measurement summary`);
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Base URL: ${report.baseUrl}`);
  lines.push(`- Resolved params: ${JSON.stringify(report.resolvedParams)}`);
  lines.push('');
  lines.push('## Routes');
  lines.push('');

  for (const route of report.routes) {
    lines.push(`### ${route.resolvedPath}`);
    lines.push('');
    lines.push(`- Template: ${route.routeTemplate}`);
    lines.push(`- URL: ${route.url}`);
    lines.push('');

    for (const run of route.runs) {
      lines.push(`#### ${run.mode}`);
      lines.push('');
      lines.push(`- Requests: ${run.requestCount} total (${run.networkRequestCount} network, ${run.cachedRequestCount} cached)`);
      lines.push(`- Total resource size: ${formatBytes(run.totals.resourceSizeBytes)}`);
      lines.push(`- Total transferred bytes: ${formatBytes(run.totals.transferredBytes)}`);
      lines.push(`- Total origin-served transferred bytes: ${formatBytes(run.totals.originTransferredBytes)}`);
      if (run.documentHtml) {
        lines.push(`- HTML document bytes: ${formatBytes(run.documentHtml.analysis.htmlBytes)}`);
        lines.push(`- Saved HTML: ${run.documentHtml.path}`);
      }
      lines.push('');
      lines.push('| Metric | Same-origin | Third-party |');
      lines.push('| --- | ---: | ---: |');
      lines.push(`| Requests | ${run.byParty.sameOrigin.requestCount} | ${run.byParty.thirdParty.requestCount} |`);
      lines.push(`| Transferred | ${formatBytes(run.byParty.sameOrigin.transferredBytes)} | ${formatBytes(run.byParty.thirdParty.transferredBytes)} |`);
      lines.push(`| Resource size | ${formatBytes(run.byParty.sameOrigin.resourceSizeBytes)} | ${formatBytes(run.byParty.thirdParty.resourceSizeBytes)} |`);
      lines.push('');
      lines.push('| Classification | Requests | Transferred | Resource size | Cache hits |');
      lines.push('| --- | ---: | ---: | ---: | ---: |');
      for (const [classification, bucket] of Object.entries(run.byClassification)) {
        lines.push(`| ${classification} | ${bucket.requestCount} | ${formatBytes(bucket.transferredBytes)} | ${formatBytes(bucket.resourceSizeBytes)} | ${bucket.cacheHits} |`);
      }
      lines.push('');
      if (run.documentHtml) {
        lines.push('HTML analysis:');
        lines.push('');
        lines.push(`- Saved HTML path: ${run.documentHtml.savedHtmlPath ?? run.documentHtml.path}`);
        lines.push(`- HTML document bytes: ${formatBytes(run.documentHtml.analysis.htmlBytes)}`);
        lines.push(`- Inline script count: ${run.documentHtml.analysis.inlineScriptCount}`);
        lines.push(`- __next_f.push count: ${run.documentHtml.analysis.nextFlightPushCount}`);
        lines.push('');
        lines.push('Suspicious marker counts:');
        lines.push('');
        lines.push('| Marker | Count |');
        lines.push('| --- | ---: |');
        for (const [marker, count] of Object.entries(run.documentHtml.analysis.suspiciousMarkerCounts)) {
          lines.push(`| ${marker} | ${count} |`);
        }
        lines.push('');
        lines.push('Largest inline script blocks:');
        lines.push('');
        lines.push('| Index | Kind | Bytes | Snippet |');
        lines.push('| ---: | --- | ---: | --- |');
        for (const script of run.documentHtml.analysis.largestInlineScripts) {
          lines.push(`| ${script.index} | ${script.kind} | ${formatBytes(script.bytes)} | ${script.snippet.replace(/\|/g, '\\|')} |`);
        }
        lines.push('');
        lines.push('Repeated substring heuristics:');
        lines.push('');
        lines.push('| Window bytes | Occurrences | Repeated bytes | Snippet |');
        lines.push('| ---: | ---: | ---: | --- |');
        for (const repeated of run.documentHtml.analysis.repeatedSubstrings) {
          lines.push(`| ${repeated.length} | ${repeated.occurrences} | ${formatBytes(repeated.repeatedBytes)} | ${repeated.snippet.replace(/\|/g, '\\|')} |`);
        }
        lines.push('');
        lines.push('Large JSON-like regions:');
        lines.push('');
        lines.push('| Bytes | Snippet |');
        lines.push('| ---: | --- |');
        for (const region of run.documentHtml.analysis.largeJsonLikeRegions) {
          lines.push(`| ${formatBytes(region.bytes)} | ${region.snippet.replace(/\|/g, '\\|')} |`);
        }
        lines.push('');
      }
      lines.push('Top 10 by transferred bytes:');
      lines.push('');
      lines.push('| URL | Classification | Party | Cache | Transferred | Resource size | Status |');
      lines.push('| --- | --- | --- | --- | ---: | ---: | ---: |');
      for (const request of run.biggestByTransferredBytes) {
        lines.push(`| ${request.url} | ${request.classification} | ${request.party} | ${request.fromCache ? 'cache' : 'network'} | ${formatBytes(request.transferredBytes)} | ${formatBytes(request.resourceSizeBytes)} | ${request.status ?? ''} |`);
      }
      lines.push('');
      lines.push('Top 10 by resource size:');
      lines.push('');
      lines.push('| URL | Classification | Party | Cache | Transferred | Resource size | Status |');
      lines.push('| --- | --- | --- | --- | ---: | ---: | ---: |');
      for (const request of run.biggestByResourceSizeBytes) {
        lines.push(`| ${request.url} | ${request.classification} | ${request.party} | ${request.fromCache ? 'cache' : 'network'} | ${formatBytes(request.transferredBytes)} | ${formatBytes(request.resourceSizeBytes)} | ${request.status ?? ''} |`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  options.baseUrl = normalizeBaseUrl(options.baseUrl);
  await fs.mkdir(options.outputDir, { recursive: true });

  const browser = await chromium.launch(await resolveChromiumLaunchOptions(options));
  try {
    const { routeTemplates, params } = await resolveRouteTemplates(browser, options);
    const routes = routeTemplates.map((routeTemplate) => ({
      routeTemplate,
      resolvedPath: materializeRoute(routeTemplate, params)
    }));

    const unresolved = routes.find((route) => route.resolvedPath.includes('['));
    if (unresolved) {
      throw new Error(`Unresolved route placeholder remained for ${unresolved.routeTemplate}. Pass the required --category/--order-id options.`);
    }

    const measuredRoutes = [];
    for (const route of routes) {
      console.log(`Measuring ${route.resolvedPath}...`);
      measuredRoutes.push(await measureRoute(browser, options.baseUrl, route.routeTemplate, route.resolvedPath, options));
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `network-report-${timestamp}`;
    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: options.baseUrl,
      resolvedParams: params,
      options: {
        timeout: options.timeout,
        settleMs: options.settleMs,
        headless: options.headless,
        storageState: options.storageState,
        saveHtml: options.saveHtml
      },
      routes: measuredRoutes
    };

    const jsonPath = path.join(options.outputDir, `${baseName}.json`);
    const markdownPath = path.join(options.outputDir, `${baseName}.md`);
    await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await fs.writeFile(markdownPath, renderSummaryMarkdown(report), 'utf8');

    console.log(`Wrote JSON report to ${jsonPath}`);
    console.log(`Wrote Markdown summary to ${markdownPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
