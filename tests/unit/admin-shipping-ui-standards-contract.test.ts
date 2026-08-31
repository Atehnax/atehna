import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const shippingPageSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/shipping/components/AdminShippingPageClient.tsx'
  ),
  'utf8'
).replace(/\r\n?/gu, '\n');

const adminUnitInputSource = readFileSync(
  resolve(
    process.cwd(),
    'src/shared/ui/admin-controls/AdminUnitInput.tsx'
  ),
  'utf8'
).replace(/\r\n?/gu, '\n');

const orderPriceSummarySource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/artikli/components/pricing/OrderPriceSummaryCard.tsx'
  ),
  'utf8'
).replace(/\r\n?/gu, '\n');

test('shipping admin uses the shared page shell with one rules workspace and one preview window', () => {
  assert.doesNotMatch(shippingPageSource, /Aktivna pravila so urejena/u);
  assert.match(shippingPageSource, /import \{ AdminPageHeader \} from '@\/shared\/ui\/admin-primitives';/u);
  assert.match(shippingPageSource, /<AdminPageHeader/u);
  assert.match(
    shippingPageSource,
    /<fieldset[\s\S]*?className="m-0 min-w-0 w-full space-y-4 border-0 p-0 font-\['Inter',system-ui,sans-serif\]"/u
  );
  assert.doesNotMatch(shippingPageSource, /<main\b/u);
  assert.doesNotMatch(shippingPageSource, /<header\b/u);
  assert.equal(
    shippingPageSource.match(
      /className=\{(?:adminWindowCardClassName|`\$\{adminWindowCardClassName\}[^`]*`)\}/gu
    )?.length,
    2
  );
  assert.equal(
    shippingPageSource.match(/style=\{adminWindowCardStyle\}/gu)?.length,
    2
  );
  assert.match(shippingPageSource, /data-testid="shipping-rules-workspace"/u);
  assert.match(shippingPageSource, /data-testid="shipping-preview"/u);
  assert.match(shippingPageSource, /data-testid="shipping-workspace-layout"/u);
  assert.match(shippingPageSource, /data-testid="shipping-rule-groups"/u);
  assert.match(shippingPageSource, /data-testid="shipping-order-value-discounts"/u);
  assert.match(shippingPageSource, /data-testid="shipping-multi-piece-discounts"/u);
  assert.doesNotMatch(shippingPageSource, /shipping-draft-rules/u);
  assert.doesNotMatch(shippingPageSource, /Osnutki dodatnih pravil/u);
  assert.match(
    shippingPageSource,
    /min-\[1180px\]:grid-cols-\[minmax\(0,3fr\)_minmax\(380px,2fr\)\]/u
  );
  assert.match(shippingPageSource, /min-\[1180px\]:items-stretch/u);
  assert.match(shippingPageSource, /className="divide-y divide-slate-200 bg-white"/u);
  assert.match(
    shippingPageSource,
    /className="min-w-0">\s*<section[\s\S]*?min-\[1180px\]:sticky min-\[1180px\]:top-4 min-\[1180px\]:h-full min-\[1180px\]:max-h-\[calc\(100vh-2rem\)\] min-\[1180px\]:!overflow-y-auto/u
  );
  assert.match(
    shippingPageSource,
    /className="overflow-x-auto bg-white pb-4"[\s\S]*?aria-label="Popusti za pošiljanje v več kosih"/u
  );
  assert.doesNotMatch(shippingPageSource, /xl:grid-cols-\[minmax\(0,0\.92fr\)/u);
  assert.doesNotMatch(shippingPageSource, /xl:col-span-2/u);
  assert.match(shippingPageSource, /data-testid="shipping-save-status"/u);
  assert.match(
    shippingPageSource,
    /isDirty \? 'bg-amber-500' : 'bg-emerald-500'/u
  );
  assert.match(
    shippingPageSource,
    /\{isDirty \? 'Neshranjeno' : 'Shranjeno'\}/u
  );
  assert.match(shippingPageSource, /const isDirty = editingSnapshot !== savedEditingSnapshot/u);
  assert.match(shippingPageSource, /setSavedEditingSnapshot\(/u);
  assert.match(shippingPageSource, /disabled=\{isSaving \|\| isReloading \|\| !isDirty\}/u);
  assert.match(shippingPageSource, /updatedAt[\s\S]*?`Shranjeno: \$\{formatTimestamp\(updatedAt\)\}`[\s\S]*?: 'Shranjeno'/u);
  assert.doesNotMatch(shippingPageSource, /shipping-version-status/u);
  assert.doesNotMatch(
    shippingPageSource,
    /Izračun \{configuration\.version\} · revizija \{revision\}/u
  );
  assert.doesNotMatch(shippingPageSource, /description=\{`Izračun/u);
  assert.doesNotMatch(shippingPageSource, /tež/iu);
});

test('shipping admin exposes readiness and disables controls until hydration completes', () => {
  assert.match(shippingPageSource, /import \{ useEffect, useMemo, useState \} from 'react';/u);
  assert.match(
    shippingPageSource,
    /const \[isClientReady, setIsClientReady\] = useState\(false\);/u
  );
  assert.match(
    shippingPageSource,
    /useEffect\(\(\) => \{\s*setIsClientReady\(true\);\s*\}, \[\]\);/u
  );
  assert.match(shippingPageSource, /disabled=\{!isClientReady\}/u);
  assert.match(shippingPageSource, /aria-busy=\{!isClientReady\}/u);
  assert.match(
    shippingPageSource,
    /data-client-ready=\{isClientReady \? 'true' : 'false'\}/u
  );
  assert.match(shippingPageSource, /data-testid="shipping-client-surface"/u);
});

test('shipping admin composes shared controls instead of raw one-off controls', () => {
  for (const componentName of [
    'Button',
    'AdminTablePrimaryActionButton',
    'IconButton',
    'Input',
    'AdminUnitInput',
    'AdminSwitch',
    'Badge',
    'EmptyState'
  ]) {
    assert.match(shippingPageSource, new RegExp(`<${componentName}\\b`, 'u'));
  }

  assert.doesNotMatch(shippingPageSource, /<(?:button|input|select)\b/u);
  assert.doesNotMatch(
    shippingPageSource,
    /const (?:inputClassName|buttonClassName|sectionClassName)\b/u
  );
});

test('shipping save action uses the shared admin primary-button typography', () => {
  assert.match(
    shippingPageSource,
    /<AdminTablePrimaryActionButton[\s\S]*?data-testid="shipping-settings-save"[\s\S]*?Shrani nastavitve[\s\S]*?<\/AdminTablePrimaryActionButton>/u
  );
});

test('shipping numeric drafts keep editable blanks while persisting canonical zero values', () => {
  assert.match(shippingPageSource, /function getShippingNumericInputValue\(/u);
  assert.match(shippingPageSource, /const updateNumericInputDraft = \(/u);
  assert.match(
    shippingPageSource,
    /return JSON\.stringify\(\{ configuration, weightIntervalDrafts, numericInputDrafts \}\);/u
  );
  assert.match(
    shippingPageSource,
    /serializeShippingEditingState\(\s*configuration,\s*weightIntervalDrafts,\s*numericInputDrafts\s*\)/u
  );
  assert.match(
    shippingPageSource,
    /\[configuration, numericInputDrafts, weightIntervalDrafts\]/u
  );

  const persistedNumericDraftKeys = [
    '`weight-band:${band.id}:price`',
    '`dimension:${rule.id}:threshold`',
    '`dimension:${rule.id}:adjustment`',
    '`order-value:${rule.id}:minimum`',
    '`order-value:${rule.id}:adjustment`',
    '`multi-piece:${rule.id}:minimum`',
    '`multi-piece:${rule.id}:adjustment`'
  ];
  for (const draftKey of persistedNumericDraftKeys) {
    assert.ok(
      shippingPageSource.split(draftKey).length >= 3,
      `${draftKey} must be shared by the input value and change handler`
    );
  }
  assert.equal(
    shippingPageSource.match(/value=\{getShippingNumericInputValue\(/gu)?.length,
    persistedNumericDraftKeys.length
  );
  assert.equal(
    shippingPageSource.match(/updateNumericInputDraft\(`/gu)?.length,
    persistedNumericDraftKeys.length
  );

  assert.match(
    shippingPageSource,
    /function numberInputOrZero\([\s\S]*?rawValue\.trim\(\) === ''\) return 0;/u
  );
  assert.equal(
    shippingPageSource.match(/adjustmentValue: rule\.adjustmentValue \?\? 0/gu)?.length,
    3
  );
  assert.match(
    shippingPageSource,
    /const configurationForSave = normalizeBlankShippingNumbersForSave\(configuration\);[\s\S]*?setNumericInputDrafts\(\{\}\);[\s\S]*?configuration: configurationForSave/u
  );
  assert.ok(
    (shippingPageSource.match(/setNumericInputDrafts\(\{\}\)/gu)?.length ?? 0) >= 3,
    'save, successful response, and reload must clear persisted numeric drafts'
  );
  assert.equal(
    shippingPageSource.match(/current\.trim\(\) === '' \? '0' : current/gu)?.length,
    4
  );
});

test('shipping simulator keeps raw numeric strings and derives zero only for calculation', () => {
  const previewInputs = [
    ['previewWeightGramsInput', 'setPreviewWeightGramsInput', '4999'],
    ['previewLargestDimensionMmInput', 'setPreviewLargestDimensionMmInput', '900'],
    [
      'previewMerchandiseSubtotalEurosInput',
      'setPreviewMerchandiseSubtotalEurosInput',
      '100'
    ],
    ['previewParcelCountInput', 'setPreviewParcelCountInput', '1']
  ] as const;

  for (const [valueName, setterName, initialValue] of previewInputs) {
    assert.match(
      shippingPageSource,
      new RegExp(
        `\\[${valueName}, ${setterName}\\][\\s\\S]{0,80}?useState\\('${initialValue}'\\)`,
        'u'
      )
    );
    assert.ok(shippingPageSource.includes(`value={${valueName}}`));
    assert.match(
      shippingPageSource,
      new RegExp(
        `value=\\{${valueName}\\}[\\s\\S]{0,220}?${setterName}\\(\\s*event\\.target\\.value`,
        'u'
      )
    );
  }

  assert.match(shippingPageSource, /numberInputOrZero\(previewWeightGramsInput\)/u);
  assert.match(shippingPageSource, /numberInputOrZero\(\s*previewLargestDimensionMmInput/u);
  assert.match(
    shippingPageSource,
    /numberInputOrZero\(previewMerchandiseSubtotalEurosInput\) \* 100/u
  );
  assert.match(
    shippingPageSource,
    /previewParcelCountInput\.trim\(\) === ''\s*\? 0/u
  );
  assert.doesNotMatch(
    shippingPageSource,
    /onChange=\{\(event\) => setPreview\w+\((?:Number|Math\.)/u
  );
});

test('shipping admin compact rule tables and dynamic feedback retain shared accessible structure', () => {
  for (const componentName of ['Table', 'THead', 'TBody', 'TR', 'TH', 'TD']) {
    assert.match(shippingPageSource, new RegExp(`<${componentName}\\b`, 'u'));
  }

  assert.doesNotMatch(
    shippingPageSource,
    /<(?:table|thead|tbody|tr|th|td)\b/u
  );
  assert.equal(shippingPageSource.match(/<caption className="sr-only">/gu)?.length, 4);
  assert.equal(shippingPageSource.match(/role="region"/gu)?.length, 4);
  assert.equal(shippingPageSource.match(/tabIndex=\{0\}/gu)?.length, 4);
  assert.equal(shippingPageSource.match(/aria-labelledby=/gu)?.length, 6);
  assert.match(shippingPageSource, /aria-live="assertive"/u);
  assert.match(shippingPageSource, /aria-live="polite"/u);
});

test('mass bands use one validated mathematical gram interval with in-field units', () => {
  assert.match(shippingPageSource, /formatShippingWeightIntervalGrams/u);
  assert.match(shippingPageSource, /parseShippingWeightIntervalGrams/u);
  assert.match(shippingPageSource, /placeholder="\[5000, 30000\)"/u);
  assert.match(shippingPageSource, /aria-invalid=\{!intervalResult\.ok\}/u);
  assert.match(shippingPageSource, /title="Osnovna poštnina po masi"/u);
  assert.match(shippingPageSource, />Interval<\/TH>/u);
  assert.match(shippingPageSource, />\s*Dodaj interval/u);
  assert.match(shippingPageSource, /unit="g"/u);
  assert.match(shippingPageSource, /unit="€"/u);
  assert.match(shippingPageSource, /unit="mm"/u);
  assert.match(shippingPageSource, /prefixSelect=\{\{/u);
  assert.match(shippingPageSource, /SHIPPING_DIMENSION_COMPARISON_OPERATORS/u);
  assert.equal(shippingPageSource.match(/<AdminSwitch\b/gu)?.length, 4);
  assert.equal(
    shippingPageSource.match(/<AdminTablePrimaryActionButton\b/gu)?.length,
    5
  );
  assert.doesNotMatch(shippingPageSource, /Odprt konec/u);
  assert.doesNotMatch(shippingPageSource, />Območje \(kg\)</u);
  assert.doesNotMatch(shippingPageSource, />Cena \(€\)</u);
  assert.doesNotMatch(shippingPageSource, />Strogo nad \(mm\)</u);
  assert.match(shippingPageSource, />Največja dimenzija<\/TH>/u);
  assert.doesNotMatch(shippingPageSource, /<PlusIcon\b/u);
  assert.doesNotMatch(shippingPageSource, /razpon/iu);
  assert.doesNotMatch(
    shippingPageSource,
    /Območje vnesite z oklepaji/u
  );
});

test('value and multi-piece discount thresholds are editable without row-order precedence', () => {
  assert.match(shippingPageSource, /title="Popust glede na vrednost naročila"/u);
  assert.match(shippingPageSource, /title="Popust za pošiljanje v več kosih"/u);
  assert.match(
    shippingPageSource,
    /pogoj z najvišjo mejno vrednostjo/u
  );
  assert.match(
    shippingPageSource,
    /najvišji aktivni prag, ki ga doseže število paketov/u
  );
  assert.match(shippingPageSource, /minMerchandiseValueCents/u);
  assert.match(shippingPageSource, /minParcelCount/u);
  assert.match(shippingPageSource, /SHIPPING_MAX_PARCEL_COUNT/u);
  assert.match(shippingPageSource, /function ShippingDeleteAction/u);
  assert.match(
    shippingPageSource,
    /data-testid="shipping-order-value-discounts"[\s\S]*?<ShippingDeleteAction/u
  );
  assert.match(
    shippingPageSource,
    /data-testid="shipping-multi-piece-discounts"[\s\S]*?<ShippingDeleteAction/u
  );

  const orderValueStart = shippingPageSource.indexOf(
    'data-testid="shipping-order-value-discounts"'
  );
  const multiPieceStart = shippingPageSource.indexOf(
    'data-testid="shipping-multi-piece-discounts"'
  );
  const previewStart = shippingPageSource.indexOf('data-testid="shipping-preview"');
  const orderValueSection = shippingPageSource.slice(orderValueStart, multiPieceStart);
  const multiPieceSection = shippingPageSource.slice(multiPieceStart, previewStart);
  assert.match(orderValueSection, />Pogoj vrednosti blaga<\/TH>/u);
  assert.match(orderValueSection, /prefixSelect=\{\{/u);
  assert.match(
    orderValueSection,
    /operator primerjave vrednosti blaga z DDV/u
  );
  assert.match(orderValueSection, /value: rule\.comparisonOperator/u);
  assert.match(orderValueSection, /comparisonOperator: '>='/u);
  assert.doesNotMatch(orderValueSection, /<ShippingRowActions/u);
  assert.doesNotMatch(multiPieceSection, /<ShippingRowActions/u);
  assert.match(multiPieceSection, />Naziv<\/TH>/u);
  assert.match(multiPieceSection, /aria-label=\{`Večkosovni prag \$\{index \+ 1\}: naziv`\}/u);
  assert.match(multiPieceSection, /value=\{rule\.name\}/u);
  assert.match(multiPieceSection, /name: event\.target\.value/u);
});

test('all shipping rule tables use one aligned five-column grid', () => {
  assert.equal(
    shippingPageSource.match(/<Table className=\{shippingRuleTableClassName\}>/gu)?.length,
    4
  );
  assert.match(
    shippingPageSource,
    /const shippingRuleTableClassName = 'min-w-\[650px\] table-fixed text-\[12px\]';/u
  );
  for (const [columnClassName, expectedDefinition] of [
    ['shippingRuleNameColumnClassName', "'w-[26%] px-3'"],
    ['shippingRuleConditionColumnClassName', "'w-[24%] px-3'"],
    ['shippingRuleAdjustmentColumnClassName', "'w-[20%] px-3'"],
    ['shippingRuleEnabledColumnClassName', "'w-[12%] px-3 text-center'"],
    ['shippingRuleActionsColumnClassName', "'w-[18%] px-3 text-right'"]
  ] as const) {
    assert.ok(
      shippingPageSource.includes(`const ${columnClassName} = ${expectedDefinition};`)
    );
    assert.equal(
      shippingPageSource.match(new RegExp(`className=\\{${columnClassName}\\}`, 'gu'))?.length,
      4
    );
  }
  assert.match(
    shippingPageSource,
    /aria-label="Popusti za pošiljanje v več kosih"[\s\S]*?<TD colSpan=\{5\}/u
  );
});

test('comparison and surcharge controls use narrow arrowless segmented selects', () => {
  assert.match(shippingPageSource, /'<=': '≤'/u);
  assert.match(shippingPageSource, /'>=': '≥'/u);
  assert.match(
    shippingPageSource,
    /\(value\) => \(\{ value, label: dimensionalComparisonLabels\[value\] \}\)/u
  );
  assert.equal(adminUnitInputSource.match(/w-\[30px\]/gu)?.length, 2);
  assert.match(adminUnitInputSource, /prefixSelect\?: AdminUnitInputSegmentSelect/u);
  assert.match(adminUnitInputSource, /suffixSelect\?: AdminUnitInputSegmentSelect/u);
  assert.match(adminUnitInputSource, /const segmentSelectClassName =/u);
  assert.match(adminUnitInputSource, /cursor-pointer appearance-none/u);
  assert.doesNotMatch(adminUnitInputSource, /<svg\b/u);
  assert.equal(shippingPageSource.match(/prefixSelect=\{\{/gu)?.length, 2);
  assert.match(shippingPageSource, /suffixSelect=\{\{/u);
  assert.match(shippingPageSource, /\{ value: 'fixed', label: '€' \}/u);
  assert.match(shippingPageSource, /\{ value: 'percentage', label: '%' \}/u);
  assert.match(shippingPageSource, /className="min-w-0 max-w-\[160px\]"/u);
  assert.doesNotMatch(
    shippingPageSource,
    /unit=\{rule\.adjustmentType === 'fixed' \? '€' : '%'\}/u
  );
  assert.doesNotMatch(shippingPageSource, /<CustomSelect\b/u);
  assert.doesNotMatch(shippingPageSource, /Fiksni €|Odstotek %/u);
});

test('calculation preview uses one aligned input row without duplicate summaries', () => {
  assert.match(shippingPageSource, /data-testid="shipping-preview-inputs"/u);
  assert.match(
    shippingPageSource,
    /className="mt-4 grid max-w-\[220px\] items-end gap-3 sm:max-w-\[452px\] sm:grid-cols-2"/u
  );
  assert.equal(shippingPageSource.match(/className="h-9 w-full"/gu)?.length, 4);
  assert.match(shippingPageSource, />\s*Skupna masa/u);
  assert.match(shippingPageSource, />\s*Največja posamezna dimenzija/u);
  assert.match(shippingPageSource, />\s*Vrednost blaga z DDV/u);
  assert.match(shippingPageSource, />\s*Število paketov/u);
  assert.match(
    shippingPageSource,
    /merchandiseSubtotalCents: previewMerchandiseSubtotalCents/u
  );
  assert.match(shippingPageSource, /parcelCount: previewParcelCount/u);
  assert.match(
    shippingPageSource,
    /Število paketov[\s\S]*?min="1"[\s\S]*?max=\{SHIPPING_MAX_PARCEL_COUNT\}/u
  );
  assert.doesNotMatch(shippingPageSource, /Normalizirana masa/u);
  assert.doesNotMatch(shippingPageSource, /Preverjena (?:mera|dimenzija)/u);
});

test('calculation preview shows three aligned mathematical steps without prose', () => {
  assert.match(shippingPageSource, /function buildShippingCalculationSteps/u);
  assert.match(
    shippingPageSource,
    /S = \$\{formatCents\(preview\.basePriceCents\)\}/u
  );
  assert.match(shippingPageSource, /Sₙ = 1 ×/u);
  assert.match(shippingPageSource, /Sₖ = max\(0,/u);
  assert.match(shippingPageSource, /preview\.parcelCountGrossAmountCents/u);
  assert.match(shippingPageSource, /preview\.multiPieceDiscountAmountCents/u);
  assert.match(shippingPageSource, /preview\.orderValueDiscountAmountCents/u);
  assert.match(shippingPageSource, /× max\(0,/u);
  assert.match(shippingPageSource, /× \(1 −/u);
  assert.match(
    shippingPageSource,
    /data-testid="shipping-preview-calculation-breakdown"/u
  );
  assert.match(shippingPageSource, /aria-label="Matematični koraki izračuna poštnine"/u);
  assert.match(shippingPageSource, /data-shipping-formula-step=\{step\.id\}/u);
  assert.match(shippingPageSource, /id: 'single-parcel'/u);
  assert.match(shippingPageSource, /id: 'multi-piece'/u);
  assert.match(shippingPageSource, /id: 'final'/u);
  assert.doesNotMatch(shippingPageSource, /zato poštnina ostane/u);
  assert.doesNotMatch(shippingPageSource, /return `\$\{singleParcelFormula\};/u);
});

test('calculated shipping result follows the item simulator summary hierarchy', () => {
  assert.match(shippingPageSource, /data-testid="shipping-preview-calculated-result"/u);
  assert.match(shippingPageSource, /function ShippingPreviewSummaryRow/u);
  assert.match(shippingPageSource, /className="h-full rounded-2xl border border-slate-200/u);
  assert.match(shippingPageSource, /variant === 'detail' \? 'h-8' : 'py-0\.5'/u);
  assert.match(shippingPageSource, /<dl className="mt-2">/u);
  assert.match(shippingPageSource, /<dt className=/u);
  assert.match(shippingPageSource, /<dd className=/u);

  for (const sharedStyle of [
    'text-[12px] font-semibold leading-4 text-slate-950',
    'border-t border-slate-200/90 pt-3',
    'mt-3 flex items-center justify-between gap-4 border-t border-slate-200/90 pt-3',
    'text-[15px] font-semibold leading-5 text-[#1982bf]',
    'text-[18px] font-semibold leading-6 text-[#1982bf]'
  ]) {
    assert.ok(orderPriceSummarySource.includes(sharedStyle));
    assert.ok(shippingPageSource.includes(sharedStyle));
  }

  const breakdownIndex = shippingPageSource.indexOf(
    'data-testid="shipping-preview-calculation-breakdown"'
  );
  const totalIndex = shippingPageSource.indexOf('Končna poštnina', breakdownIndex);
  assert.ok(
    breakdownIndex >= 0
      && totalIndex > breakdownIndex
  );
  assert.doesNotMatch(
    shippingPageSource.slice(breakdownIndex, totalIndex),
    /Konfiguracija|pri popustih se uporabi/u
  );
  assert.match(shippingPageSource, /: 'Brez dodatka'/u);
});
