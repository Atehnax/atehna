import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('logo migration keeps current artwork, deduplicates shared contain designs and retains explicit fallbacks', () => {
  const result = JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    import sharp from 'sharp';
    import { randomUUID } from 'node:crypto';
    import { normalizeSiteLogoConfig, SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID } from './src/shared/domain/logo/siteLogo.ts';
    import { migrateLegacyLogoConfig, renderLegacyLogoPlacement } from './src/shared/server/logoLibraryMigration.ts';
    import { renderLogoProject, decodeLogoImport } from './src/shared/server/logoLibraryRender.ts';
    const old=normalizeSiteLogoConfig({});
    old.placements['header-desktop'].masterId=SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID;
    old.placements['footer-desktop'].masterId=SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID;
    old.placements['footer-desktop'].presentation.primaryTextColor='#123456';
    old.placements['footer-mobile'].enabled=false;
    const original=JSON.stringify(old), saved=new Map();
    const callbacks={
      saveSource:async(name,bytes,mimeType)=>{const meta=await decodeLogoImport(bytes,mimeType);const id=randomUUID();saved.set(id,Buffer.from(bytes));return{id,name,url:'/private/'+id,pathname:id,mimeType,width:meta.width,height:meta.height,bytes:bytes.length,bounds:meta.bounds,warnings:meta.warnings};},
      publish:async(project,assets)=>{const out=await renderLogoProject(project,assets,async asset=>saved.get(asset.id));const id=randomUUID();const asset={url:'/published/'+id,pathname:id,width:out.width,height:out.height,mimeType:'image/png'};return{id,createdAt:new Date().toISOString(),project,png:asset,png2x:{...asset,width:out.width*2,height:out.height*2},svg:{...asset,mimeType:'image/svg+xml'},bounds:out.bounds};}
    };
    const migrated=await migrateLegacyLogoConfig(old,callbacks);
    assert.equal(JSON.stringify(old),original);
    assert.equal(migrated.placements['header-desktop'].variantId,migrated.placements.standalone.variantId);
    assert.notEqual(migrated.placements['footer-desktop'].variantId,migrated.placements.standalone.variantId);
    assert.equal(migrated.placements['header-mobile'].fallback,'brand');
    assert.equal(migrated.placements['footer-mobile'].fallback,'none');
    assert.equal(migrated.placements['footer-tablet'].fallback,'original');
    const pdf=migrated.variants.find(v=>v.id===migrated.placements['pdf-document'].variantId);
    assert.ok(pdf?.published);assert.equal(pdf.draft.layers[0].type,'image');
    const wanted=await sharp(await renderLegacyLogoPlacement(old,'pdf-document')).raw().toBuffer();
    const kept=await sharp(saved.get(pdf.draft.layers[0].assetId)).raw().toBuffer();assert.deepEqual(kept,wanted);
    console.log(JSON.stringify({variants:migrated.variants.length,assets:migrated.assets.length}));
  `], { cwd: process.cwd(), encoding: 'utf8', timeout: 60000 })) as {variants:number;assets:number};
  assert.equal(result.variants,3);assert.equal(result.assets,3);
});
