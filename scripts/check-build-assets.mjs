#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';

const DEFAULT_BUILD_DIR = '.next';
const DEFAULT_PUBLIC_DIR = 'public';
const DEFAULT_TOP_FILES = 15;

const FONT_EXTENSIONS = new Set([
  '.eot',
  '.otf',
  '.ttc',
  '.ttf',
  '.woff',
  '.woff2'
]);

const STATIC_MEDIA_EXTENSIONS = new Set([
  '.apng',
  '.avif',
  '.bmp',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.tif',
  '.tiff',
  '.webp',
  '.aac',
  '.flac',
  '.m4a',
  '.mp3',
  '.ogg',
  '.wav',
  '.webm',
  '.m4v',
  '.mov',
  '.mp4',
  '.pdf'
]);

const METRICS = [
  {
    key: 'clientJs.rawBytes',
    label: 'Client JS raw',
    option: 'maxClientJsRawBytes'
  },
  {
    key: 'clientJs.gzipBytes',
    label: 'Client JS gzip',
    option: 'maxClientJsGzipBytes'
  },
  {
    key: 'fonts.rawBytes',
    label: 'Fonts',
    option: 'maxFontBytes'
  },
  {
    key: 'staticMedia.rawBytes',
    label: 'Static media',
    option: 'maxStaticMediaBytes'
  }
];

function printHelp() {
  console.log(`Report and optionally enforce deterministic post-build asset budgets.

Usage:
  npm run check:build-assets -- [options]

Options:
  --build-dir <dir>                    Next build directory. Default: ${DEFAULT_BUILD_DIR}
  --public-dir <dir>                   Public directory. Default: ${DEFAULT_PUBLIC_DIR}
  --output <file>                      Write the deterministic JSON report.
  --baseline <file>                    Fail when totals exceed this report.
  --baseline-allow-bytes <bytes>       Additive baseline tolerance. Default: 0
  --baseline-allow-percent <percent>   Additive baseline tolerance. Default: 0
  --max-client-js-raw-bytes <bytes>    Raw client-JS ceiling.
  --max-client-js-gzip-bytes <bytes>   Level-9 gzip client-JS ceiling.
  --max-font-bytes <bytes>             Emitted and public font ceiling.
  --max-static-media-bytes <bytes>     Emitted and public media ceiling.
  --top-files <count>                  Largest files retained per group. Default: ${DEFAULT_TOP_FILES}
  --help                               Show this help.

Without --baseline or --max-* options, this is report-only and exits successfully.
The gzip figure is a deterministic comparison proxy; deployed compression may differ.
`);
}

function parseNumber(raw, option, { integer = true } = {}) {
  const value = Number(raw);

  if (
    !Number.isFinite(value)
    || value < 0
    || (integer && !Number.isInteger(value))
  ) {
    throw new Error(
      `${option} requires a non-negative ${integer ? 'integer' : 'number'}.`
    );
  }

  return value;
}

function requireValue(argv, index, option) {
  const value = argv[index + 1];

  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function parseArgs(argv) {
  const options = {
    buildDir: DEFAULT_BUILD_DIR,
    publicDir: DEFAULT_PUBLIC_DIR,
    output: null,
    baseline: null,
    baselineAllowBytes: 0,
    baselineAllowPercent: 0,
    maxClientJsRawBytes: null,
    maxClientJsGzipBytes: null,
    maxFontBytes: null,
    maxStaticMediaBytes: null,
    topFiles: DEFAULT_TOP_FILES,
    help: false
  };

  const definitions = new Map([
    ['--build-dir', ['buildDir', String]],
    ['--public-dir', ['publicDir', String]],
    ['--output', ['output', String]],
    ['--baseline', ['baseline', String]],
    [
      '--baseline-allow-bytes',
      [
        'baselineAllowBytes',
        (value) => parseNumber(value, '--baseline-allow-bytes')
      ]
    ],
    [
      '--baseline-allow-percent',
      [
        'baselineAllowPercent',
        (value) => parseNumber(
          value,
          '--baseline-allow-percent',
          { integer: false }
        )
      ]
    ],
    [
      '--max-client-js-raw-bytes',
      [
        'maxClientJsRawBytes',
        (value) => parseNumber(value, '--max-client-js-raw-bytes')
      ]
    ],
    [
      '--max-client-js-gzip-bytes',
      [
        'maxClientJsGzipBytes',
        (value) => parseNumber(value, '--max-client-js-gzip-bytes')
      ]
    ],
    [
      '--max-font-bytes',
      [
        'maxFontBytes',
        (value) => parseNumber(value, '--max-font-bytes')
      ]
    ],
    [
      '--max-static-media-bytes',
      [
        'maxStaticMediaBytes',
        (value) => parseNumber(value, '--max-static-media-bytes')
      ]
    ],
    [
      '--top-files',
      [
        'topFiles',
        (value) => parseNumber(value, '--top-files')
      ]
    ]
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }

    const definition = definitions.get(token);
    if (!definition) {
      throw new Error(`Unknown argument: ${token}`);
    }

    const raw = requireValue(argv, index, token);
    const [key, convert] = definition;
    options[key] = convert(raw);
    index += 1;
  }

  if (
    !options.baseline
    && (options.baselineAllowBytes > 0 || options.baselineAllowPercent > 0)
  ) {
    throw new Error(
      '--baseline-allow-bytes and --baseline-allow-percent require --baseline.'
    );
  }

  return options;
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function displayPath(filePath) {
  return normalizePath(path.relative(process.cwd(), filePath));
}

async function validateBuildManifest(buildDir) {
  const manifestPath = path.join(buildDir, 'build-manifest.json');

  try {
    JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new Error(
      `Missing or invalid ${displayPath(manifestPath)}. Run npm run build first.${detail}`
    );
  }
}

async function listFiles(root, { required = false } = {}) {
  let entries;

  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if (!required && error?.code === 'ENOENT') {
      return [];
    }

    if (required && error?.code === 'ENOENT') {
      throw new Error(
        `Required build directory is missing: ${displayPath(root)}. Run npm run build first.`
      );
    }

    throw error;
  }

  const files = [];

  for (const entry of entries.sort(
    (left, right) => compareText(left.name, right.name)
  )) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath, { required: true }));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function measureFiles(filePaths, { gzip = false } = {}) {
  const measured = [];

  for (const filePath of [...filePaths].sort(compareText)) {
    const content = await fs.readFile(filePath);
    const file = {
      path: displayPath(filePath),
      rawBytes: content.byteLength
    };

    if (gzip) {
      file.gzipBytes = gzipSync(content, { level: 9 }).byteLength;
    }

    measured.push(file);
  }

  return measured;
}

function summarizeFiles(files, topFileCount, { gzip = false } = {}) {
  const largestFiles = [...files]
    .sort(
      (left, right) =>
        right.rawBytes - left.rawBytes
        || compareText(left.path, right.path)
    )
    .slice(0, topFileCount);

  const summary = {
    fileCount: files.length,
    rawBytes: files.reduce(
      (total, file) => total + file.rawBytes,
      0
    ),
    largestFiles
  };

  if (gzip) {
    summary.gzipBytes = files.reduce(
      (total, file) => total + file.gzipBytes,
      0
    );
  }

  return summary;
}

async function createReport(options) {
  const buildDir = path.resolve(options.buildDir);
  const publicDir = path.resolve(options.publicDir);
  const staticDir = path.join(buildDir, 'static');
  const emittedMediaDir = path.join(buildDir, 'static', 'media');

  await validateBuildManifest(buildDir);

  const [staticFiles, emittedMediaFiles, publicFiles] = await Promise.all([
    listFiles(staticDir, { required: true }),
    listFiles(emittedMediaDir),
    listFiles(publicDir, { required: true })
  ]);

  const clientJsPaths = staticFiles.filter(
    (filePath) => path.extname(filePath).toLowerCase() === '.js'
  );

  if (clientJsPaths.length === 0) {
    throw new Error(
      `No client JavaScript found under ${displayPath(staticDir)}. Run npm run build first.`
    );
  }

  const deployableAssets = [
    ...new Set([...emittedMediaFiles, ...publicFiles])
  ];

  const fontPaths = deployableAssets.filter(
    (filePath) =>
      FONT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
  );

  const staticMediaPaths = deployableAssets.filter(
    (filePath) =>
      STATIC_MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase())
  );

  const [clientJs, fonts, staticMedia] = await Promise.all([
    measureFiles(clientJsPaths, { gzip: true }),
    measureFiles(fontPaths),
    measureFiles(staticMediaPaths)
  ]);

  return {
    schemaVersion: 1,
    inputs: {
      buildDir: displayPath(buildDir) || '.',
      publicDir: displayPath(publicDir) || '.'
    },
    compression: {
      clientJsGzip: {
        algorithm: 'gzip',
        level: 9,
        zlibVersion: process.versions.zlib
      }
    },
    clientJs: summarizeFiles(
      clientJs,
      options.topFiles,
      { gzip: true }
    ),
    fonts: summarizeFiles(fonts, options.topFiles),
    staticMedia: summarizeFiles(staticMedia, options.topFiles)
  };
}

function readMetric(report, key) {
  const value = key
    .split('.')
    .reduce((current, segment) => current?.[segment], report);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `Report is missing a valid non-negative integer at ${key}.`
    );
  }

  return value;
}

async function readBaseline(filePath) {
  const baseline = JSON.parse(await fs.readFile(filePath, 'utf8'));

  if (!baseline || baseline.schemaVersion !== 1) {
    throw new Error(
      `Unsupported or missing schemaVersion in baseline: ${filePath}`
    );
  }

  return baseline;
}

function validateBaselineCompatibility(report, baseline, filePath) {
  for (const key of ['buildDir', 'publicDir']) {
    if (baseline.inputs?.[key] !== report.inputs[key]) {
      throw new Error(
        `Baseline ${filePath} uses a different ${key}: `
        + `${String(baseline.inputs?.[key])} instead of ${report.inputs[key]}.`
      );
    }
  }

  const baselineGzip = baseline.compression?.clientJsGzip;
  const reportGzip = report.compression.clientJsGzip;
  const gzipMatches =
    baselineGzip?.algorithm === reportGzip.algorithm
    && baselineGzip?.level === reportGzip.level
    && baselineGzip?.zlibVersion === reportGzip.zlibVersion;

  if (!gzipMatches) {
    throw new Error(
      `Baseline ${filePath} uses incompatible client-JS gzip settings or zlib version.`
    );
  }
}

function compareBudgets(report, baseline, options) {
  const checks = [];

  for (const metric of METRICS) {
    const actual = readMetric(report, metric.key);
    const ceiling = options[metric.option];

    if (ceiling !== null) {
      checks.push({
        metric: metric.label,
        source: 'ceiling',
        actual,
        allowed: ceiling,
        passed: actual <= ceiling
      });
    }

    if (baseline) {
      const baselineValue = readMetric(baseline, metric.key);
      const percentAllowance = Math.ceil(
        baselineValue * options.baselineAllowPercent / 100
      );
      const allowed =
        baselineValue
        + options.baselineAllowBytes
        + percentAllowance;

      checks.push({
        metric: metric.label,
        source: 'baseline',
        actual,
        baseline: baselineValue,
        allowed,
        passed: actual <= allowed
      });
    }
  }

  return checks;
}

function formatBytes(bytes) {
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = unitIndex === 0 ? 0 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]} (${bytes} B)`;
}

function printReport(report, checks, outputPath) {
  console.log('Post-build asset report');
  console.log(
    `  Client JS:    ${report.clientJs.fileCount} files, `
    + `${formatBytes(report.clientJs.rawBytes)} raw, `
    + `${formatBytes(report.clientJs.gzipBytes)} gzip`
  );
  console.log(
    `  Fonts:        ${report.fonts.fileCount} files, `
    + formatBytes(report.fonts.rawBytes)
  );
  console.log(
    `  Static media: ${report.staticMedia.fileCount} files, `
    + formatBytes(report.staticMedia.rawBytes)
  );

  if (outputPath) {
    console.log(`  JSON report:  ${displayPath(outputPath)}`);
  }

  if (checks.length === 0) {
    console.log(
      '\nReport only: no explicit baseline or ceiling was supplied.'
    );
    return;
  }

  console.log('\nBudget checks');

  for (const check of checks) {
    const status = check.passed ? 'PASS' : 'FAIL';
    const baselineText = check.baseline === undefined
      ? ''
      : `, baseline ${formatBytes(check.baseline)}`;

    console.log(
      `  ${status} ${check.metric} (${check.source}): `
      + `${formatBytes(check.actual)} <= ${formatBytes(check.allowed)}`
      + baselineText
    );
  }
}

async function writeReport(filePath, report) {
  const resolvedPath = path.resolve(filePath);
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(
    resolvedPath,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  return resolvedPath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const report = await createReport(options);

  // Read before writing so --baseline and --output may intentionally reference
  // the same file without silently comparing the new report to itself.
  const baseline = options.baseline
    ? await readBaseline(options.baseline)
    : null;

  if (baseline) {
    validateBaselineCompatibility(report, baseline, options.baseline);
  }

  const checks = compareBudgets(report, baseline, options);
  const outputPath = options.output
    ? await writeReport(options.output, report)
    : null;

  printReport(report, checks, outputPath);

  if (checks.some((check) => !check.passed)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
