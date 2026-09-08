import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LogoLibraryError } from '@/shared/server/logoLibraryOperations';
import { loadBoundServerModule } from './support/loadBoundServerModule';

const run = (body: string) => execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '--eval', `
  import assert from 'node:assert/strict';
  import { randomUUID } from 'node:crypto';
  import sharp from 'sharp';
  import { authorizeLogoRequest, boundedLogoBody } from './src/shared/server/logoLibraryRequest.ts';
  import { isLocalLogoStorage, storeLogoSource, readLogoSource, readLogoPublishedOutput, createLogoPublication, imageLogoProject } from './src/shared/server/logoLibraryStorage.ts';
  ${body}`], { cwd: process.cwd(), encoding: 'utf8', timeout: 30000, env: {
    ...process.env, NODE_ENV: 'test', VERCEL: '', E2E_MODE: '1', E2E_LOCAL_PRIVATE_BLOB: '1',
    E2E_STORAGE_NAMESPACE: 'logo-security-' + Date.now() + '-' + Math.random().toString(16).slice(2),
    ADMIN_USERNAME: 'logo-test-admin', ADMIN_PASSWORD: 'test-only-password', ADMIN_SESSION_SECRET: 'isolated-logo-security-test-secret'
  } });

test('logo API awaits a server session and rejects cross-origin writes', async () => {
  const { requestOriginMatchesHost } = loadBoundServerModule<{ requestOriginMatchesHost: (request: Request) => boolean }>('src/shared/server/requestSecurity.ts', {});
  const { authorizeLogoRequest } = loadBoundServerModule<{ authorizeLogoRequest: (request: Request, mutation?: boolean) => Promise<void> }>('src/shared/server/logoLibraryRequest.ts', {
    hasValidAdminSession: async (request: Request) => request.headers.get('x-test-session') === 'active',
    requestOriginMatchesHost, LogoLibraryError
  });
  const url = 'https://atehna.test/api/admin/logo-library';
  await assert.rejects(() => authorizeLogoRequest(new Request(url)), (error: unknown) => error instanceof LogoLibraryError && error.status === 401);
  await assert.rejects(() => authorizeLogoRequest(new Request(url, { headers: { cookie: 'atehna_admin_session=forged' } })), (error: unknown) => error instanceof LogoLibraryError && error.status === 401);
  const session = { 'x-test-session': 'active' };
  await authorizeLogoRequest(new Request(url, { headers: session }));
  await authorizeLogoRequest(new Request(url, { method: 'POST', headers: { ...session, host: 'atehna.test', origin: 'https://atehna.test', 'sec-fetch-site': 'same-origin' } }), true);
  for (const headers of [
    { ...session, host: 'atehna.test', origin: 'https://attacker.test' },
    { ...session, host: 'atehna.test', origin: 'http://atehna.test', 'x-forwarded-proto': 'https' },
    { ...session, 'sec-fetch-site': 'cross-site' }
  ]) await assert.rejects(() => authorizeLogoRequest(new Request(url, { method: 'POST', headers }), true), (error: unknown) => error instanceof LogoLibraryError && error.status === 403);
});

test('logo request limits reject both advertised size and actual streamed overflow', () => {
  run(`
    const url = 'https://atehna.test/api/admin/logo-library';
    await assert.rejects(() => boundedLogoBody(new Request(url,{method:'POST',headers:{'content-length':'1025'},body:'x'}),1024),error=>error.status===413);
    await assert.rejects(() => boundedLogoBody(new Request(url,{method:'POST',headers:{'content-length':'0'},body:'x'.repeat(1025)}),1024),error=>error.status===413);
    await assert.rejects(() => boundedLogoBody(new Request(url,{method:'POST',headers:{'content-length':'NaN'},body:'x'}),1024),error=>error.status===413);
    assert.equal((await boundedLogoBody(new Request(url,{method:'POST',body:'valid'}),1024)).toString(),'valid');
  `);
});

test('source originals stay private while published outputs are immutable and readable', () => {
  run(`
    const original = await sharp({create:{width:32,height:16,channels:4,background:'#123456'}}).png().toBuffer();
    const source = await storeLogoSource('Original PNG',original,'image/png');
    assert.match(source.url,/^\\/api\\/admin\\/logo-library\\/assets\\//);
    assert.match(source.pathname,/^logo-library\\/sources\\//);
    assert.deepEqual(Buffer.from(await readLogoSource(source)),original);
    const project=imageLogoProject(source);
    const a=await createLogoPublication(project,[source]);
    const b=await createLogoPublication(project,[source]);
    assert.notEqual(a.id,b.id);assert.notEqual(a.png.pathname,b.png.pathname);
    assert.match(a.png.url,/^\\/api\\/site-logo\\/assets\\//);
    const png=await readLogoPublishedOutput(a.png);const png2x=await readLogoPublishedOutput(a.png2x);const svg=await readLogoPublishedOutput(a.svg);
    assert.equal((await sharp(png).metadata()).width,32);assert.equal((await sharp(png2x).metadata()).width,64);
    assert.match(svg.toString(),/<svg/);assert.doesNotMatch(svg.toString(),/logo-library\\/sources|api\\/admin/);
    assert.deepEqual(Buffer.from(await readLogoSource(source)),original);
    await assert.rejects(()=>readLogoSource({...source,bytes:source.bytes+1}),/spremenila/u);
  `);
});

test('source traversal and test storage in production are refused before any network access', () => {
  run(`
    const source={id:randomUUID(),name:'Invalid',url:'',pathname:'../../secret',mimeType:'image/png',width:1,height:1,bytes:1,bounds:{x:0,y:0,width:1,height:1},warnings:[]};
    await assert.rejects(()=>readLogoSource(source),/Pot logotipa/u);
    await assert.rejects(()=>readLogoPublishedOutput({...source,pathname:'logo-library/sources/'+source.id+'.png'}),/Pot logotipa/u);
    process.env.VERCEL='1';assert.throws(()=>isLocalLogoStorage(),/not permitted/);
    process.env.VERCEL='';process.env.E2E_STORAGE_NAMESPACE='../escape';
    await assert.rejects(()=>readLogoSource({...source,pathname:'logo-library/sources/'+source.id+'.png'}),/namespace is invalid/);
    process.env.E2E_MODE='0';assert.equal(isLocalLogoStorage(),false);
  `);
});
