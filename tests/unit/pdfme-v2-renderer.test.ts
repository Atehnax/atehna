import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

interface ProbeResult {
  scenarios: Array<{
    documentType: string;
    rowCount: number;
    pageCount: number;
    byteLength: number;
  }>;
  route: {
    status: number;
    byteLength: number;
  };
}

test('pdfme v2 server renderer proves all document types and pagination boundaries', () => {
  const output = execFileSync(
    process.execPath,
    [
      '--conditions=react-server',
      '--import',
      'tsx',
      'tests/unit/fixtures/pdfme-v2-renderer-probe.ts'
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 5 * 1024 * 1024,
      timeout: 180_000
    }
  );
  const result = JSON.parse(output) as ProbeResult;

  assert.deepEqual(
    result.scenarios.map(({ documentType, rowCount }) => ({ documentType, rowCount })),
    [
      { documentType: 'order_summary', rowCount: 0 },
      { documentType: 'dobavnica', rowCount: 1 },
      { documentType: 'predracun', rowCount: 27 },
      { documentType: 'invoice', rowCount: 100 }
    ]
  );
  assert.equal(result.route.status, 200);
  assert.ok(result.route.byteLength > 5);
  for (const scenario of result.scenarios) {
    assert.ok(scenario.pageCount >= 1);
    assert.ok(scenario.byteLength > 5);
  }
});

test('pdfme v2 preview stays Node-only and shares the Designer font assets', () => {
  const appRoute = readFileSync(
    resolve(
      process.cwd(),
      'src/app/api/admin/order-document-templates-v2/preview/route.ts'
    ),
    'utf8'
  );
  const implementation = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/api/order-document-templates-v2/preview/route.ts'
    ),
    'utf8'
  );
  const designer = readFileSync(
    resolve(process.cwd(), 'src/admin/features/urejevalnik-v2/PdfmeV2Editor.tsx'),
    'utf8'
  );
  const serverFonts = readFileSync(
    resolve(process.cwd(), 'src/shared/server/pdfmeV2/fonts.ts'),
    'utf8'
  );
  const serverRenderer = readFileSync(
    resolve(process.cwd(), 'src/shared/server/pdfmeV2/renderer.ts'),
    'utf8'
  );

  assert.match(appRoute, /import 'server-only';/u);
  assert.match(appRoute, /export const runtime = 'nodejs';/u);
  assert.match(implementation, /import 'server-only';/u);
  assert.match(implementation, /export const runtime = 'nodejs';/u);
  assert.match(implementation, /'Cache-Control': 'no-store,/u);
  assert.match(implementation, /'X-Content-Type-Options': 'nosniff'/u);
  assert.match(designer, /fetchFont\('\/fonts\/NotoSans-Regular\.ttf'/u);
  assert.match(designer, /fetchFont\('\/fonts\/NotoSans-Bold\.ttf'/u);
  assert.equal((designer.match(/fallback:\s*true/gu) ?? []).length, 1);
  assert.equal((serverFonts.match(/fallback:\s*true/gu) ?? []).length, 2);
  assert.match(serverFonts, /NotoSansBold:[\s\S]*?fallback: false/u);
  assert.doesNotMatch(designer, /@pdfme\/generator/u);
  assert.doesNotMatch(serverRenderer, /@pdfme\/ui/u);
});
