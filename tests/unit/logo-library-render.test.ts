import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const run = (body: string) => execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '--eval', `
  import assert from 'node:assert/strict';
  import sharp from 'sharp';
  import { renderLogoProject, decodeLogoImport } from './src/shared/server/logoLibraryRender.ts';
  const base = { id:'shape', name:'Shape', x:10,y:12,width:30,height:20,rotation:0,opacity:1,visible:true,locked:false };
  const rectangle = { ...base,type:'shape',shape:'rectangle',fill:'#123456',stroke:'none',strokeWidth:0,radius:0 };
  const project = layers => ({version:1,canvas:{width:120,height:80},layers});
  const noAsset = async()=>{throw new Error('unexpected asset');};
  const raw = async bytes => sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  ${body}`], { cwd: process.cwd(), encoding: 'utf8', timeout: 30000 });

test('logo exports share deterministic glyph paths and exact SVG/PNG pixels', () => {
  run(`
    const text={...base,id:'text',type:'text',x:3,y:2,width:112,height:50,text:'ČŽš & Atehna',fontFamily:'Inter',fontSize:17,fontWeight:600,fontStyle:'italic',fill:'#112233',textAlign:'left',lineHeight:1.2,letterSpacing:.3};
    const a=await renderLogoProject(project([text]),[],noAsset);
    const b=await renderLogoProject(project([text]),[],noAsset);
    assert.equal(a.svg,b.svg); assert.deepEqual(a.png,b.png);
    assert.match(a.svg,/<path d=/); assert.doesNotMatch(a.svg,/<text|font-family|https?:[^/]/);
    assert.deepEqual((await raw(a.png)).data,(await raw(await sharp(Buffer.from(a.svg)).png().toBuffer())).data);
    const doubled=await sharp(a.png2x).metadata(); assert.equal(doubled.width,240);assert.equal(doubled.height,160);
    assert.ok(a.bounds.width>0);assert.ok(a.bounds.height>0);
  `);
});

test('layers preserve group coordinates, opacity, visibility and shadow bounds', () => {
  run(`
    const plain=await renderLogoProject(project([rectangle]),[],noAsset);
    assert.deepEqual(plain.bounds,{x:10,y:12,width:30,height:20});
    const group={...base,id:'group',type:'group',x:20,y:10,width:70,height:50,opacity:.5,children:[rectangle,{...rectangle,id:'hidden',x:90,visible:false}]};
    const grouped=await renderLogoProject(project([group]),[],noAsset);
    assert.deepEqual(grouped.bounds,{x:30,y:22,width:30,height:20});
    const pixels=await raw(grouped.png);assert.ok(pixels.data[(25*120+35)*4+3]>=127&&pixels.data[(25*120+35)*4+3]<=128);
    const effect=await renderLogoProject(project([{...rectangle,shadow:{color:'#000000',opacity:1,blur:0,offsetX:10,offsetY:5}}]),[],noAsset);
    assert.ok(effect.bounds.width>=40);assert.ok(effect.bounds.height>=25);
  `);
});

test('image cropping and masks preserve the immutable original bytes', () => {
  run(`
    const bytes=await sharp({create:{width:20,height:10,channels:4,background:'#FF0000'}}).composite([{input:{create:{width:10,height:10,channels:4,background:'#0000FF'}},left:10,top:0}]).png().toBuffer();
    const before=Buffer.from(bytes);
    const asset={id:'source',name:'original',url:'',pathname:'private',mimeType:'image/png',width:20,height:10,bytes:bytes.length,bounds:{x:0,y:0,width:20,height:10},warnings:[]};
    const image={...base,type:'image',assetId:'source',mask:'ellipse',crop:{x:.5,y:0,width:.5,height:1}};
    const output=await renderLogoProject(project([image]),[asset],async()=>bytes);
    const pixels=await raw(output.png);const center=(22*120+25)*4;
    assert.deepEqual([...pixels.data.subarray(center,center+4)],[0,0,255,255]);
    assert.equal(pixels.data[(12*120+10)*4+3],0);assert.deepEqual(bytes,before);
  `);
});

test('SVG import retains editable groups, shapes and bundled-font text, and warns for flattening', () => {
  run(`
    const source=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><g id="mark" transform="translate(2 3)" opacity="0.5"><rect x="4" y="5" width="20" height="10" fill="#123456"/><text x="5" y="45" font-family="Inter" font-size="20" fill="#000000">Atehna</text></g></svg>');
    const imported=await decodeLogoImport(source,'image/svg+xml');assert.ok(imported.project);assert.equal(imported.warnings.length,0);
    const group=imported.project.layers[0].children[0];assert.equal(group.type,'group');assert.equal(group.opacity,.5);assert.equal(group.children[0].opacity,1);assert.equal(group.children[1].type,'text');
    const output=await renderLogoProject(imported.project,[],noAsset);assert.ok(output.bounds.width>0);
    const complex=await decodeLogoImport(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><defs><linearGradient id="g"><stop stop-color="#FF0000"/></linearGradient></defs><rect width="80" height="40" fill="url(#g)"/></svg>'),'image/svg+xml');
    assert.equal(complex.project,undefined);assert.ok(complex.warnings[0].includes('ena slikovna plast'));
  `);
});

test('unsafe, disguised and over-budget imports or projects are rejected', () => {
  run(`
    for(const fragment of ['<script>alert(1)</script>','<foreignObject/>','<image href="https://example.test/x.png"/>','<rect onload="alert(1)"/>','<rect style="fill:url(https://example.test/x)"/>']) {
      await assert.rejects(()=>decodeLogoImport(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30">'+fragment+'</svg>'),'image/svg+xml'));
    }
    await assert.rejects(()=>decodeLogoImport(Buffer.from('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"/>'),'image/svg+xml'));
    await assert.rejects(()=>decodeLogoImport(Buffer.from('not a PNG image'),'image/png'));
    await assert.rejects(()=>renderLogoProject({version:1,canvas:{width:3000,height:3000},layers:[]},[],noAsset));
    await assert.rejects(()=>renderLogoProject(project([{...rectangle,fill:'url(https://example.test)'}]),[],noAsset));
  `);
});

test('exported SVGs containing raster layers can be imported safely without losing appearance', () => {
  run(`
    const bytes=await sharp({create:{width:20,height:10,channels:4,background:'#00AA66'}}).png().toBuffer();
    const asset={id:'source',name:'original',url:'',pathname:'private',mimeType:'image/png',width:20,height:10,bytes:bytes.length,bounds:{x:0,y:0,width:20,height:10},warnings:[]};
    const input=project([{...base,type:'image',assetId:'source',mask:'rectangle',crop:{x:0,y:0,width:1,height:1}}]);
    const exported=await renderLogoProject(input,[asset],async()=>bytes);
    const imported=await decodeLogoImport(Buffer.from(exported.svg),'image/svg+xml');
    assert.equal(imported.width,120);assert.equal(imported.height,80);
    assert.ok(imported.warnings.includes('SVG vsebuje vdelane rastrske slike.'));
    assert.equal(imported.project,undefined);
    assert.deepEqual((await raw(Buffer.from(exported.svg))).data,(await raw(exported.png)).data);
    const bad=exported.svg.replace('data:image/png;base64,','data:image/svg+xml;base64,');
    await assert.rejects(()=>decodeLogoImport(Buffer.from(bad),'image/svg+xml'));
  `);
});
test('large shadow offsets and blur stay visible on small artwork and overflowing group children', () => {
  run(`
    const tiny={...rectangle,x:20,y:20,width:10,height:10,shadow:{color:'#000000',opacity:1,blur:0,offsetX:512,offsetY:0}};
    const canvas={version:1,canvas:{width:700,height:300},layers:[tiny]};
    const output=await renderLogoProject(canvas,[],noAsset),pixels=await raw(output.png);
    assert.equal(pixels.data[(25*700+537)*4+3],255);
    assert.match(output.svg,/filterUnits="userSpaceOnUse"/);
    const blurred=await renderLogoProject({...canvas,layers:[{...tiny,width:30,height:30,shadow:{...tiny.shadow,blur:128}}]},[],noAsset);
    assert.ok((await raw(blurred.png)).data[(35*700+547)*4+3]>0);
    const group={...base,id:'group',type:'group',x:0,y:0,width:10,height:10,children:[{...rectangle,x:70,y:10}],shadow:{color:'#000000',opacity:1,blur:0,offsetX:12,offsetY:5}};
    const grouped=await renderLogoProject(project([group]),[],noAsset);
    assert.equal((await raw(grouped.png)).data[(25*120+108)*4+3],255);
  `);
});

test('explicit letter spacing disables optional ligatures consistently with the editor', () => {
  run(`
    const text={...base,type:'text',text:'office',fontFamily:'Barlow',fontSize:17,fontWeight:400,fontStyle:'normal',fill:'#112233',textAlign:'left',lineHeight:1.2,letterSpacing:1};
    const output=await renderLogoProject(project([text]),[],noAsset);
    assert.equal((output.svg.match(/<path d=/g)||[]).length,6);
  `);
});
