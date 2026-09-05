import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const implementationSource = (relativeDirectory: string): string => {
  const directory = resolve(process.cwd(), relativeDirectory);
  return readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      const relativePath = join(relativeDirectory, entry.name);
      if (entry.isDirectory()) return implementationSource(relativePath);
      return /\.(?:sql|ts|tsx)$/u.test(entry.name) ? source(relativePath) : '';
    })
    .join('\n');
};

test('public customer codes use a migration-only cutover with no runtime aliases', () => {
  const runtime = [
    source('src/shared/domain/emailTemplateRichText.ts'),
    source('src/shared/domain/order/orderEmailSettings.ts'),
    source('src/shared/domain/order/orderDocumentTemplates.ts'),
    source('src/shared/domain/quote/quoteEmailSettings.ts')
  ].join('\n');
  const readme = source('README.md');
  const rollout = source('docs/quote-workflow-rollout.md');

  assert.doesNotMatch(
    runtime,
    /remapEmailTemplateVariables|migrateCustomerOrderNumber|migrateCustomerVariables|legacyQuoteCustomerVariableReplacements|migratePublicCodeRows/u
  );
  assert.doesNotMatch(
    [readme, rollout].join('\n'),
    /normalization bridge|pre-v8\/pre-v2 settings-normalization aliases/u
  );
  assert.match(
    rollout,
    /guarded database rewrite[\s\S]*?sole transition mechanism/u
  );
});

test('database setup has one canonical schema and ordered reviewed deployment artifacts', () => {
  const schemaPath = resolve(process.cwd(), 'database', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');
  const tableNames = Array.from(
    schema.matchAll(/create table\s+([a-z0-9_]+)/giu),
    (match) => match[1]
  );
  const schemaSqlFiles = readdirSync(resolve(process.cwd(), 'database'))
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();
  const deploymentArtifacts = readdirSync(
    resolve(process.cwd(), 'database', 'migrations')
  )
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();
  const quoteDeployment = source(
    'database/migrations/20260828_quote_workflow_and_order_contract.sql'
  );
  const quoteDetailsDeployment = source(
    'database/migrations/20260829_quote_request_admin_details.sql'
  );
  const quoteManagementDeployment = source(
    'database/migrations/20260829_quote_request_management.sql'
  );
  const quoteManualDocumentsDeployment = source(
    'database/migrations/20260830_quote_manual_documents.sql'
  );
  const quoteAdminTitleDeployment = source(
    'database/migrations/20260830_quote_request_admin_title.sql'
  );
  const quoteClarificationEmailDeployment = source(
    'database/migrations/20260830_quote_clarification_email.sql'
  );
  const orderItemDeliveryPlanDeployment = source(
    'database/migrations/20260831_order_item_delivery_plan.sql'
  );
  const inventoryPolicyDeployment = source(
    'database/migrations/20260901_inventory_policy_settings.sql'
  );
  const orderStockEnforcementMarkerDeployment = source(
    'database/migrations/20260901_order_stock_enforcement_marker.sql'
  );
  const quoteOptionalAcceptanceTermsDeployment = source(
    'database/migrations/20260901_quote_optional_acceptance_terms.sql'
  );
  const quoteOutboxCancellationDeployment = source(
    'database/migrations/20260901_quote_outbox_cancellation.sql'
  );
  const gursAddressPrefixDeployment = source(
    'database/migrations/20260903_gurs_address_prefix_search.sql'
  );
  const gursPostalLookupIndexesDeployment = source(
    'database/migrations/20260904_gurs_postal_lookup_indexes.sql'
  );
  const orderDocumentEmailEventsDeployment = source(
    'database/migrations/20260903_order_document_email_events.sql'
  );
  const schemaContractV1Deployment = source(
    'database/migrations/20260903_schema_contract_v1.sql'
  );
  const publicCustomerCodesDeployment = source(
    'database/migrations/20260904_public_customer_codes.sql'
  );
  const schemaContractDeployment = source(
    'database/migrations/20260904_schema_contract_v2.sql'
  );
  const publicCodeEmailTemplatesPostdeploy = source(
    'database/migrations/20260905_public_code_email_templates_postdeploy.sql'
  );

  assert.equal(existsSync(resolve(process.cwd(), 'migrations')), false);
  assert.deepEqual(schemaSqlFiles, ['schema.sql']);
  assert.deepEqual(deploymentArtifacts, [
    '20260828_quote_workflow_and_order_contract.sql',
    '20260829_quote_request_admin_details.sql',
    '20260829_quote_request_management.sql',
    '20260830_quote_clarification_email.sql',
    '20260830_quote_manual_documents.sql',
    '20260830_quote_request_admin_title.sql',
    '20260831_order_item_delivery_plan.sql',
    '20260901_inventory_policy_settings.sql',
    '20260901_order_stock_enforcement_marker.sql',
    '20260901_quote_optional_acceptance_terms.sql',
    '20260901_quote_outbox_cancellation.sql',
    '20260903_gurs_address_prefix_search.sql',
    '20260903_order_document_email_events.sql',
    '20260903_schema_contract_v1.sql',
    '20260904_gurs_postal_lookup_indexes.sql',
    '20260904_public_customer_codes.sql',
    '20260904_schema_contract_v2.sql',
    '20260905_analytics_geography.sql',
    '20260905_analytics_retirement.sql',
    '20260905_business_analytics.sql',
    '20260905_public_code_email_templates_postdeploy.sql',
    '20260905_schema_contract_v3.sql',
    '20260905_schema_contract_v4.sql'
  ]);
  assert.equal(tableNames.length, 68);
  assert.equal(new Set(tableNames).size, 68);
  assert.equal(schema.match(/^\s*alter\s+table\b/gimu)?.length, 2);
  assert.match(
    schema,
    /alter table catalog_items[\s\S]*?catalog_items_default_variant_id_fkey[\s\S]*?catalog_items_default_variant_same_item_fkey/u
  );
  assert.match(
    schema,
    /alter table orders[\s\S]*?orders_source_quote_offer_version_id_fkey/u
  );
  assert.doesNotMatch(
    schema,
    /create\s+(?:unique\s+)?(?:table|index)\s+if\s+not\s+exists|create\s+or\s+replace\s+function|drop\s+trigger\s+if\s+exists|on\s+conflict[^;]*do\s+nothing|add\s+column\s+if\s+not\s+exists|drop\s+constraint\s+if\s+exists|not\s+valid|validate\s+constraint|\bdo\s+\$\$|\b(?:upgrade|retrofit|migration)\w*\b/iu
  );
  for (const deployment of [
    quoteDeployment,
    quoteDetailsDeployment,
    quoteManagementDeployment,
    quoteClarificationEmailDeployment,
    quoteManualDocumentsDeployment,
    quoteAdminTitleDeployment,
    orderItemDeliveryPlanDeployment,
    inventoryPolicyDeployment,
    orderStockEnforcementMarkerDeployment,
    quoteOptionalAcceptanceTermsDeployment,
    quoteOutboxCancellationDeployment,
    gursAddressPrefixDeployment,
    gursPostalLookupIndexesDeployment,
    orderDocumentEmailEventsDeployment,
    schemaContractV1Deployment,
    publicCustomerCodesDeployment,
    schemaContractDeployment,
    publicCodeEmailTemplatesPostdeploy
  ]) {
    assert.match(deployment, /begin;/u);
    assert.match(deployment, /set local search_path = public, pg_temp/u);
    assert.match(deployment, /set local lock_timeout = '10s'/u);
    assert.match(deployment, /set local statement_timeout = '15min'/u);
    assert.match(deployment, /pg_advisory_xact_lock/u);
    assert.match(deployment, /commit;/u);
  }
  assert.match(quoteDeployment, /add column contract_status/u);
  assert.match(quoteDeployment, /legacy_unknown/u);
  assert.match(quoteDeployment, /inventoryChangedByMigration', false/u);
  assert.match(quoteDetailsDeployment, /quote_request_details_changed/u);
  assert.match(quoteDetailsDeployment, /Customer details on a current issued offer are immutable\./u);
  assert.match(quoteManagementDeployment, /add column if not exists intake_source/u);
  assert.match(quoteManagementDeployment, /add column if not exists voided_at/u);
  assert.match(quoteManagementDeployment, /request_voided/u);
  assert.match(quoteManagementDeployment, /Quote requests are durable records and cannot be deleted\./u);
  assert.match(quoteManualDocumentsDeployment, /quote_manual_documents/u);
  assert.match(quoteManualDocumentsDeployment, /quote_documents_id_seq/u);
  assert.match(quoteManualDocumentsDeployment, /quote_manual_documents_append_only/u);
  assert.match(quoteAdminTitleDeployment, /add column if not exists admin_title text/u);
  assert.match(quoteAdminTitleDeployment, /quote_requests_admin_title_check/u);
  assert.match(quoteAdminTitleDeployment, /'admin_title'/u);
  assert.match(
    quoteClarificationEmailDeployment,
    /quote_email_jobs_event_type_check/u
  );
  assert.match(
    quoteClarificationEmailDeployment,
    /quote_clarification_requested/u
  );
  assert.match(orderItemDeliveryPlanDeployment, /ship_later boolean not null default false/u);
  assert.match(orderItemDeliveryPlanDeployment, /delivery_plan_revision integer not null default 1/u);
  assert.match(orderItemDeliveryPlanDeployment, /order_delivery_plan_revision integer not null default 1/u);
  assert.match(orderItemDeliveryPlanDeployment, /idx_order_items_order_id_ship_later/u);
  assert.match(publicCustomerCodesDeployment, /generate_public_code_base/u);
  assert.match(publicCustomerCodesDeployment, /idx_orders_public_code_base/u);
  assert.match(publicCustomerCodesDeployment, /idx_quote_requests_public_code_base/u);
  assert.match(publicCustomerCodesDeployment, /guard_order_public_code_lineage/u);
  assert.doesNotMatch(
    publicCustomerCodesDeployment,
    /(?:order|quote)_email_(?:settings|jobs)|migrate_(?:order|quote)_customer_templates/iu
  );
  assert.match(
    publicCodeEmailTemplatesPostdeploy,
    /atehna\.public_code_email_templates_app_ready/u
  );
  assert.match(
    publicCodeEmailTemplatesPostdeploy,
    /where key = 'order-email-notifications'/u
  );
  assert.match(publicCodeEmailTemplatesPostdeploy, /where key = 'default'/u);
  assert.match(
    publicCodeEmailTemplatesPostdeploy,
    /legacy_customer_envelope_gate/u
  );
  assert.doesNotMatch(
    publicCodeEmailTemplatesPostdeploy,
    /(?:update|delete\s+from)\s+public\.(?:order_email_jobs|quote_email_jobs)/iu
  );
  assert.match(inventoryPolicyDeployment, /create table inventory_policy_settings/u);
  assert.match(
    orderStockEnforcementMarkerDeployment,
    /add column if not exists stock_enforcement_applied boolean/u
  );
  assert.match(
    quoteOptionalAcceptanceTermsDeployment,
    /drop constraint quote_offer_versions_issue_identity_check/u
  );
  assert.match(
    gursAddressPrefixDeployment,
    /pg_advisory_xact_lock\(hashtext\('gurs-address-sync-publish'\)\)[\s\S]+?lock table public\.gurs_address_sync_state[\s\S]+?lock table public\.gurs_addresses in share mode/u
  );
  assert.match(
    gursPostalLookupIndexesDeployment,
    /pg_advisory_xact_lock\(hashtext\('gurs-address-sync-publish'\)\)[\s\S]+?lock table public\.gurs_address_sync_state[\s\S]+?lock table public\.gurs_addresses in share mode/u
  );
  assert.match(
    gursPostalLookupIndexesDeployment,
    /postal_code collate "C"[\s\S]+?regexp_replace\(translate\(lower\(postal_name\)[\s\S]+?postal_name collate "C"/u
  );
  assert.match(
    gursAddressPrefixDeployment,
    /lock_token is not null\s+and \(lock_expires_at is null or lock_expires_at <= now\(\)\)[\s\S]+?set lock_token = null,[\s\S]+?update public\.gurs_address_sync_runs[\s\S]+?where status = 'running'[\s\S]+?where key = 'active'\s+and lock_token is not null/u
  );
  assert.match(
    gursAddressPrefixDeployment,
    /installed\.indrelid = active_table[\s\S]+?installed\.indcollation\[0\][\s\S]+?to_regcollation\('pg_catalog\."C"'\)[\s\S]+?installed\.indcollation\[1\][\s\S]+?create index %I on public\.gurs_addresses/u
  );
  assert.match(
    orderDocumentEmailEventsDeployment,
    /order_email_jobs_event_type_check[\s\S]*?predracun_issued[\s\S]*?invoice_issued/u
  );
  assert.match(
    quoteOptionalAcceptanceTermsDeployment,
    /btrim\(delivery_terms\)[\s\S]*?btrim\(payment_terms\)[\s\S]*?btrim\(terms_version\)[\s\S]*?terms_hash[\s\S]*?content_hash/u
  );

  const setup = source('scripts/e2e-database.mjs');
  assert.match(setup, /resolve\(projectRoot, 'database', 'schema\.sql'\)/u);
  assert.doesNotMatch(
    setup,
    /loadMigrations|applyMigrations|e2e_schema_migrations|migrationCount|migrationsDirectory/u
  );
  assert.match(setup, /create table e2e_schema_state/u);
  assert.match(setup, /canonical-schema fingerprint is missing or stale/u);
  assert.match(
    setup,
    /from '\.\/check-database-schema\.mjs'/u
  );
  assert.match(
    setup,
    /verifyContract = verifyDatabaseContract/u
  );
  assert.match(
    setup,
    /const manifest = await loadManifest\(\);[\s\S]*?await verifyContract\(pool, manifest\);/u
  );

  for (const delegatedTerminalProbe of [
    'has_order_access_tokens',
    'has_inventory_policy_settings',
    'has_quote_manual_documents',
    'has_order_contract_status',
    'has_order_delivery_plan_revision',
    'has_order_stock_enforcement_applied',
    'has_order_item_ship_later',
    'has_order_document_delivery_plan_revision',
    'has_quote_request_intake_source',
    'has_quote_request_voided_at',
    'has_quote_email_cancelled_at',
    'has_order_items_ship_later_index',
    'has_quote_offer_optional_acceptance_terms',
    'quote_offer_versions_issue_identity_check',
    'quote_email_jobs_cancellation_check'
  ]) {
    assert.doesNotMatch(
      setup,
      new RegExp(delegatedTerminalProbe, 'u')
    );
  }

  const health = source('src/app/api/e2e/health/route.ts');
  assert.match(health, /E2E_SCHEMA_SHA256/u);
  assert.match(health, /row\.schema_sha256 !== expectedSchemaSha256/u);
  assert.match(
    health,
    /to_regclass\('public\.app_schema_contracts'\)[\s\S]*?has_schema_contract_table/u
  );
  assert.match(
    health,
    /from public\.app_schema_contracts where contract_id = \$1 and contract_sha256 = \$2/u
  );
  assert.match(
    health,
    /\[schemaContract\.contractId, schemaContract\.contractSha256\]/u
  );
  assert.match(health, /row\.has_schema_contract_table !== true/u);
  assert.match(health, /!hasExactSchemaContract/u);
  assert.match(health, /has_seed/u);
  assert.match(health, /has_reference_product/u);
  assert.doesNotMatch(
    health,
    /requiredSchemaChecks|information_schema\.columns|pg_constraint|order_access_tokens|inventory_policy_settings|quote_email_jobs/u
  );
  assert.doesNotMatch(
    health,
    /verifyDatabaseContract|schemaContract\.requirements/u
  );
});

test('fresh deployments install the complete schema without an obsolete partial reset tool', () => {
  const rollout = source('docs/shipping-rollout.md');

  assert.equal(
    existsSync(resolve(process.cwd(), 'scripts/reset-commerce-database.mjs')),
    false
  );
  assert.doesNotMatch(
    rollout,
    /reset-commerce-database|ATEHNA_ALLOW_COMMERCE_RESET|ATEHNA_COMMERCE_RESET_TARGET|--verify-build/u
  );
  assert.match(rollout, /verified empty\s+database/u);
  assert.match(rollout, /--set=ON_ERROR_STOP=1[\s\S]*?--file=database\/schema\.sql/u);
  assert.match(rollout, /npm run check:database-schema/u);
  assert.match(rollout, /Never run `tests\/fixtures\/e2e-seed\.sql`/u);
  assert.match(rollout, /post-deploy template rewrite is unnecessary/u);
});

test('canonical schema contains real category defaults but no test category fixture', () => {
  const schema = source('database/schema.sql');

  assert.match(schema, /'materiali'/u);
  assert.match(schema, /'kovine'/u);
  assert.doesNotMatch(schema, /testna-kategorija|testna kategorija|2d876cd4-f0ff-4007-86b4-c99f89c060c8/iu);
});

test('order persistence has no removed address or amount columns', () => {
  const implementation = `${source('database/schema.sql')}\n${implementationSource('src')}`;
  assert.doesNotMatch(implementation, /\b(?:delivery_address|unit_price|total_price)\b/u);
});

test('catalog media has one canonical variant-assignment model', () => {
  const schema = source('database/schema.sql');
  const catalogItems = source('src/shared/server/catalogItems.ts');
  const orderCommerce = source('src/shared/server/orderCommerce.ts');
  const catalogMediaTable = schema.match(
    /create table catalog_media\s*\(([\s\S]*?)\n\);/u
  );

  assert.ok(catalogMediaTable, 'the base schema must create catalog_media');
  assert.doesNotMatch(
    catalogMediaTable[1],
    /\bvariant_id\b/u,
    'variant assignment belongs exclusively to catalog_variant_media'
  );
  assert.match(schema, /create table catalog_variant_media/u);
  assert.doesNotMatch(
    schema,
    /\bcm\.variant_id\b|update\s+catalog_media\b/iu,
    'fresh setup must not translate direct media assignments'
  );

  for (const [label, runtimeSource] of [
    ['catalog item runtime', catalogItems],
    ['order pricing runtime', orderCommerce]
  ] as const) {
    assert.doesNotMatch(
      runtimeSource,
      /catalog_media\.variant_id|\bcm\.variant_id\b|\bmedia\.variant_id\b/iu,
      `${label} must read assignments through catalog_variant_media`
    );
    assert.match(runtimeSource, /catalog_variant_media/u);
  }
});

test('the browser cart starts from one current persisted contract', () => {
  const cartStore = source('src/commercial/cart/store.ts');

  assert.match(cartStore, /name: 'atehna-cart-v3'/u);
  assert.doesNotMatch(cartStore, /\bmigrate:\s*\(|\blegacyItem\b|name: 'atehna-cart'/u);
});

test('storefront media and selectors consume only current catalog fields', () => {
  const storefront = source('src/commercial/features/products/storefrontProduct.ts');

  assert.doesNotMatch(storefront, /\brow\.variantId\b|\bitem\.images\b|\bitem\.image\b/u);
  assert.doesNotMatch(storefront, /legacy-(?:image|variant|value)/u);
  assert.match(storefront, /derived-variant/u);
});

test('quantity discounts and confirmation totals do not reconcile old formats', () => {
  const quantityDiscounts = source('src/shared/server/orderQuantityDiscount.ts');
  const confirmationSummary = source(
    'src/commercial/order/components/OrderConfirmationSummary.tsx'
  );

  assert.doesNotMatch(quantityDiscounts, /allvariants|applies_to|min_quantity|discount_percent/iu);
  assert.match(quantityDiscounts, /\bvariants\b/u);
  assert.match(quantityDiscounts, /\bcustomers\b/u);
  assert.doesNotMatch(
    confirmationSummary,
    /reconciledListNet|everyDiscountHasProvenance|unclassified|legacy/iu
  );
});

test('removed route and helper aliases cannot become a second API contract', () => {
  const catalogCategories = source('src/shared/server/catalogCategories.ts');
  const adminOrderItems = source('src/admin/api/orders/[orderId]/items/route.ts');

  assert.doesNotMatch(catalogCategories, /updateTopLevelCategoryImages/u);
  assert.doesNotMatch(adminOrderItems, /legacy|linked only when unambiguous/iu);
  assert.equal(
    existsSync(resolve(process.cwd(), 'src/commercial/api/orders/[orderId]/purchase-order/route.ts')),
    false
  );
  assert.equal(
    existsSync(resolve(process.cwd(), 'src/app/api/orders/[orderId]/purchase-order/route.ts')),
    false
  );

  for (const obsoleteAdminPage of [
    'src/admin/pages/kupci/page.tsx',
    'src/app/admin/kupci/page.tsx',
    'src/admin/pages/analitika/narocila/page.tsx',
    'src/app/admin/analitika/narocila/page.tsx',
    'src/admin/pages/stranke/nedavni/page.tsx',
    'src/app/admin/stranke/nedavni/page.tsx'
  ]) {
    assert.equal(
      existsSync(resolve(process.cwd(), obsoleteAdminPage)),
      false,
      `${obsoleteAdminPage} must not remain as a redirect-only alias`
    );
  }
});

test('fresh schema setup never transforms pre-existing catalog or customer rows', () => {
  const schema = source('database/schema.sql');

  assert.doesNotMatch(
    schema,
    /update\s+catalog_items\b/iu,
    'fresh catalog setup must not backfill products from an older schema'
  );
  assert.doesNotMatch(
    schema,
    /(?:alter\s+table|update)\s+customer_directory_profiles\b/iu,
    'the current customer profile shape must be created directly'
  );
});

test('runtime server modules assume the canonical schema instead of mutating it', () => {
  const canonicalSchemaConsumers = [
    'src/shared/server/customerDirectory.ts',
    'src/shared/server/schoolDirectory.ts',
    'src/shared/server/globalStyle.ts',
    'src/shared/server/landingPage.ts',
    'src/shared/server/productAppearance.ts',
    'src/shared/server/shipping.ts',
    'src/shared/server/siteLogo.ts',
    'src/shared/server/siteNavigation.ts'
  ];

  for (const relativePath of canonicalSchemaConsumers) {
    const runtimeSource = source(relativePath);
    assert.match(runtimeSource, /\bgetPool\(\)/u);
    assert.doesNotMatch(
      runtimeSource,
      /\b(?:create|alter|drop)\s+(?:table|index|schema|extension)\b|\badd\s+column\b/iu,
      relativePath + ' must never mutate the core database schema at runtime'
    );
    assert.doesNotMatch(
      runtimeSource,
      /\btableSql\b|\bensure(?:CustomerDirectory|SchoolDirectory|GlobalStyleTable|LandingPageTable|ProductAppearanceTable|SiteLogoTable|SiteNavigationTable)\b/u,
      relativePath + ' must not retain a second schema-bootstrap path'
    );
  }

  const schoolDirectory = source('src/shared/server/schoolDirectory.ts');
  assert.match(schoolDirectory, /if \(metaResult\.rowCount\) return;/u);
  assert.match(schoolDirectory, /insert into school_directory_meta/u);
  assert.doesNotMatch(
    schoolDirectory,
    /currentSeedVersion|seed_version\s*<|replace\(cells\s*->>\s*'naziv'/iu,
    'runtime school initialization may first-seed an empty directory but must not upgrade existing data'
  );
});
test('admin catalog tools use only current server-backed records and keys', () => {
  const archivedItems = source(
    'src/admin/features/arhiv/components/AdminArchivedItemsTable.tsx'
  );
  const itemEditor = source(
    'src/admin/features/artikli/components/AdminItemEditorPage.tsx'
  );
  const itemManager = source(
    'src/admin/features/artikli/components/AdminItemsManager.tsx'
  );

  for (const [label, adminSource] of [
    ['archive table', archivedItems],
    ['item editor', itemEditor],
    ['item manager', itemManager]
  ] as const) {
    assert.doesNotMatch(
      adminSource,
      /admin-items-crud|legacyOnly|serverBacked|restorePayload|archiveItemClient|fetchCatalogItemRestorePayload|readArchivedItemStorage|writeArchivedItemStorage/u,
      `${label} must not maintain a browser-side article archive`
    );
  }
  assert.match(archivedItems, /fetch\('\/api\/admin\/artikli\/archived'/u);
  assert.equal(
    existsSync(resolve(process.cwd(), 'src/admin/features/artikli/lib/archiveItemClient.ts')),
    false
  );
  assert.doesNotMatch(itemEditor, /getLegacyDimensionVariantKey/u);
  assert.match(
    itemEditor,
    /variantDeliveryTimes\[getDimensionVariantKey\(variant\)\]/u
  );
});

test('catalog product metadata is required instead of inferred from old rows', () => {
  const catalogItems = source('src/shared/server/catalogItems.ts');
  const orderCommerce = source('src/shared/server/orderCommerce.ts');

  assert.doesNotMatch(catalogItems, /inferCatalogEditorProductType/u);
  assert.doesNotMatch(catalogItems, /left join catalog_item_editor_details/u);
  assert.match(catalogItems, /requireCatalogEditorProductType/u);
  assert.doesNotMatch(orderCommerce, /left join catalog_item_editor_details/u);
  assert.doesNotMatch(orderCommerce, /editor_product_type\s*\?\?/u);
});
