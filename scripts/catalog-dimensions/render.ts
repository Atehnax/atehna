import type { DimensionProduct, Geometry } from './geometry';

const ink = '#273638';
const teal = '#147e80';
const muted = '#65736f';
const paper = '#f7f6f2';
export const escapeXml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[c]!));
const fmt = (n: number) => new Intl.NumberFormat('sl-SI', { maximumFractionDigits: 3 }).format(n);
const text = (x: number, y: number, value: string, size = 36, extra = '') =>
  '<text x="'+x+'" y="'+y+'" font-size="'+size+'" '+extra+'>'+escapeXml(value)+'</text>';
const line = (x1: number, y1: number, x2: number, y2: number) =>
  '<path d="M'+x1+' '+y1+' L'+x2+' '+y2+'" fill="none" stroke="#87928d" stroke-width="2"/>';
function wrap(x: number, y: number, value: string, limit: number, size = 32, center = true) {
  const rows: string[] = [];
  let row = '';
  for (const word of value.split(/\s+/)) {
    if (row && (row+' '+word).length > limit) { rows.push(row); row = word; }
    else row += (row ? ' ' : '') + word;
  }
  if (row) rows.push(row);
  return rows.map((s, i) => text(x, y+i*(size+7), s, size, (center ? 'text-anchor="middle" ' : '')+'font-weight="600"')).join('');
}
/** Keep every label horizontal, including dimensions on vertical sides. */
function horizontal(x1: number, x2: number, edgeY: number, y: number, value: string) {
  return line(x1,edgeY,x1,y+8)+line(x2,edgeY,x2,y+8)+line(x1,y,x2,y)+
    text((x1+x2)/2,y+43,value,38,'text-anchor="middle" font-weight="600"');
}
function vertical(y1: number, y2: number, edgeX: number, x: number, value: string) {
  return line(edgeX,y1,x+8,y1)+line(edgeX,y2,x+8,y2)+line(x,y1,x,y2)+
    text(x+20,(y1+y2)/2+13,value,38,'font-weight="600"');
}
function finishColour(g:Geometry,slug:string) {
  const name=(g.colour??'').toLocaleLowerCase('sl');
  const colours:Record<string,string>={'belo':'#efeee6','zlata':'#c9af6b','kraljevsko modra':'#49658e','temno modra':'#3e526e','bela':'#efeee6','strukturno bela':'#eae8e1','črna':'#343a3c','siva':'#a5abad','srebrna':'#c7ccce','svetlo rjava':'#baa58b','temno rjava':'#715b4c','rjava':'#927157','lila':'#b6a1c4','temno lila':'#8c709d','vijoličasta':'#9076a2','roza':'#d5a8b6','travno zelena':'#80a578','temno zelena':'#536f5f','zelena':'#7e9d83','svetlo zelena':'#a0b98c','oranžna':'#d79d68','modra':'#789db4','nebesno modra':'#a4c6d3','kalifornijsko modra':'#7eabc6','svetlo modra':'#b2cdda','temno rdeča':'#8d5353','vinsko rdeča':'#92565e','karmin rdeča':'#b56367','rdeča':'#c27e71','koruzno rumena':'#d7bd6f','marelična':'#d8b08d','intenzivno rumena':'#ddc164','rumena':'#e2d18d'};
  if(colours[name])return colours[name];
  if(slug==='bakrena-plosca')return '#c9916d';
  if(slug==='medeninasta-plosca')return '#c7ae6d';
  if(slug==='aluminijasta-plosca'||slug==='pocinkana-plocevina')return '#c8ced0';
  if(slug==='vezana-plosca')return '#d8c19d';
  if(slug==='podlaga-za-rezanje')return '#8aa79a';
  return '#e2e5df';
}

function sheet(g: Geometry, slug: string) {
  const ratio=g.a/(g.b??g.a);
  const w=Math.min(310,215*ratio), h=w/ratio;
  const x=260-w/2,y=135+(215-h)/2;
  const colour=finishColour(g,slug);
  return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+colour+'" stroke="#89958f" stroke-width="2"/>'+
    horizontal(x,x+w,y+h,y+h+24,fmt(g.a))+
    vertical(y,y+h,x+w,x+w+22,fmt(g.b??g.a));
}
function ruler(g: Geometry, slug: string) {
  const x=65,y=230,w=340,h=g.b?55:38;
  let svg='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+finishColour(g,slug)+'" stroke="#89958f" stroke-width="2"/>';
  for(let i=1;i<20;i++)svg+=line(x+i*w/20,y,x+i*w/20,y+(i%5===0?16:8));
  svg+=horizontal(x,x+w,y+h,y+h+32,fmt(g.a));
  if(g.b)svg+=vertical(y,y+h,x+w,x+w+25,fmt(g.b));
  return svg;
}
function motor(g: Geometry) {
  const x=95,y=180,w=260,h=145;
  return '<g fill="#ccd5d0" stroke="#819089" stroke-width="2"><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="9"/><ellipse cx="355" cy="252.5" rx="18" ry="72.5" fill="#e1e6df"/><path d="M355 246 H415 V259 H355 Z"/></g>'+
    horizontal(x,x+w,y+h,y+h+28,fmt(g.a))+
    vertical(y,y+h,x+w,435,'Ø '+fmt(g.b!))+
    (g.shaft?text(300,453,'Os Ø '+fmt(g.shaft)+' mm',34,'text-anchor="middle" fill="'+teal+'"'):'');
}
function triangle(g: Geometry) {
  const x=95,y=338,w=340,h=g.side==='hypotenuse'?170:196;
  const topX=g.side==='hypotenuse'?x+w/2:x+w;
  return '<path d="M'+x+' '+y+' L'+(x+w)+' '+y+' L'+topX+' '+(y-h)+' Z" fill="#dbe4df" stroke="#819089" stroke-width="2" stroke-linejoin="round"/>'+
    text(g.side==='hypotenuse'?x+90:topX-12,g.side==='hypotenuse'?y-23:y-h+88,fmt(g.angle!)+'°',36,'text-anchor="'+(g.side==='hypotenuse'?'middle':'end')+'" fill="'+teal+'"')+
    horizontal(x,x+w,y,y+27,fmt(g.a));
}
function variantHeading(g: Geometry) {
  if(g.kind==='plate') {
    const detail=[g.colour, g.material && !/ni navedena/i.test(g.material) ? g.material : undefined].filter(Boolean);
    if(g.colour) return g.colour;
    if(g.format) return g.format;
    // Pure size names are already conveyed by the large dimension labels.
    if(!/[a-zčšž]{3}/i.test(g.name.replace(/mm/g,'')))return '';
    return detail[0]??'';
  }
  if(g.kind==='triangle')return (g.side==='hypotenuse'?'Hipotenuza':'Daljša kateta')+(/magnet/i.test(g.name)?' · magneten':'');
  if(g.kind==='ruler')return g.name.replace(/^100\s*cm,?\s*/,'') || 'Navadno';
  return g.name;
}
function variantSketch(g: Geometry, slug: string) {
  const heading=variantHeading(g);
  let svg=heading?wrap(300,52,heading,27,34):'';
  svg+=g.kind==='motor'?motor(g):g.kind==='ruler'?ruler(g,slug):g.kind==='triangle'?triangle(g):sheet(g,slug);
  if(g.t)svg+=text(300,466,'Debelina '+fmt(g.t)+' mm',36,'text-anchor="middle" fill="'+teal+'" font-weight="600"');
  else if(g.kind==='plate')svg+=text(300,466,'Debelina ni navedena',26,'text-anchor="middle" fill="'+muted+'"');
  if(g.kind==='motor')svg+=text(300,510,'Mere ohišja; dolžina osi ni navedena.',23,'text-anchor="middle" fill="'+muted+'"');
  if(g.kind==='ruler' && g.b)svg+=text(300,510,'Višina ročaja ni navedena.',25,'text-anchor="middle" fill="'+muted+'"');
  return svg;
}
function titleBlock(product: DimensionProduct, count: number, size: number) {
  return wrap(64,92,product.itemName,Math.floor((size-128)/30),54,false)+text(64,151,(count>1?count+' različic · ':'')+'mere v mm',30,'fill="'+muted+'"');
}
function grid(product: DimensionProduct, geometries: Geometry[], size: number) {
  const cols=geometries.length===1?1:Math.ceil(Math.sqrt(geometries.length));
  const rows=Math.ceil(geometries.length/cols), cellW=(size-110)/cols,cellH=(size-290)/rows;
  const scale=Math.min(cellW/600,cellH/540);
  return geometries.map((g,i)=>{
    const x=55+(i%cols)*cellW+(cellW-600*scale)/2;
    const y=205+Math.floor(i/cols)*cellH+(cellH-540*scale)/2;
    return '<g data-variant-sku="'+escapeXml(g.variantSku)+'" transform="translate('+x+' '+y+') scale('+scale+')">'+variantSketch(g,product.slug)+'</g>';
  }).join('');
}
function colourOverview(product: DimensionProduct, geometries: Geometry[], size: number) {
  const g=geometries[0], x=650,y=220,w=150,h=150*g.b!/g.a;
  let svg='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="#e7e9e2" stroke="#89958f" stroke-width="2"/>'+
    horizontal(x,x+w,y+h,y+h+20,fmt(g.a))+vertical(y,y+h,x+w,x+w+35,fmt(g.b!))+
    text(1070,310,g.format??'',68,'font-weight="600" fill="'+teal+'"');
  const cols=5,rows=Math.ceil(geometries.length/cols),cellW=(size-120)/cols,cellH=(size-665)/rows;
  svg+=geometries.map((v,i)=>{
    const cx=60+(i%cols)*cellW+cellW/2,cy=570+Math.floor(i/cols)*cellH;
    return '<g data-variant-sku="'+escapeXml(v.variantSku)+'"><rect x="'+(cx-66)+'" y="'+cy+'" width="132" height="58" rx="3" fill="'+finishColour(v,product.slug)+'" stroke="#aeb7af" stroke-width="1.5"/>'+wrap(cx,cy+102,v.name,19,32)+'</g>';
  }).join('');
  return svg;
}
function compactOverview(product: DimensionProduct, geometries: Geometry[], size: number) {
  const cols=3,rows=Math.ceil(geometries.length/cols),cellW=(size-120)/cols,cellH=(size-305)/rows;
  let svg=text(64,205,'Dolžina × širina × debelina',30,'fill="'+teal+'"');
  svg+=geometries.map((g,i)=>{
    const x=60+(i%cols)*cellW,y=242+Math.floor(i/cols)*cellH;
    const ratio=g.a/(g.b??g.a),w=Math.min(65,60*ratio),h=w/ratio;
    const label=[fmt(g.a),fmt(g.b??g.a),g.t?fmt(g.t):'?'].join(' × ');
    const material=g.material&&!/ni navedena/i.test(g.material)?g.material:'Les ni naveden';
    return '<g data-variant-sku="'+escapeXml(g.variantSku)+'"><rect x="'+(x+(78-w)/2)+'" y="'+(y+20+(65-h)/2)+'" width="'+w+'" height="'+h+'" fill="'+finishColour(g,product.slug)+'" stroke="#89958f" stroke-width="1.5"/>'+text(x+100,y+47,label,36,'font-weight="600"')+text(x+100,y+86,material,27,'fill="'+muted+'"')+'</g>';
  }).join('');
  return svg;
}
export function renderDimensionOverview(product: DimensionProduct, geometries: Geometry[]) {
  const size=geometries.length>9?1800:1600;
  const colourOnly=geometries.length>9 && geometries.every(g=>g.colour && g.a===geometries[0].a && g.b===geometries[0].b && g.t===geometries[0].t);
  const body=colourOnly?colourOverview(product,geometries,size):geometries.length>9?compactOverview(product,geometries,size):grid(product,geometries,size);
  const descriptions=geometries.map(g=>g.name+': '+fmt(g.a)+(g.b?' × '+fmt(g.b):'')+(g.t?' × '+fmt(g.t):'')+' mm');
  const footer='Skica ni v merilu.'+(geometries.some(g=>g.colour)?' Barve so shematske.':'');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" role="img">'+
    '<title>'+escapeXml(product.itemName+' — mere vseh različic')+'</title><desc>'+escapeXml(descriptions.join('; '))+'</desc>'+
    '<rect width="100%" height="100%" fill="'+paper+'"/>'+
    '<g font-family="Arial, Helvetica, sans-serif" fill="'+ink+'">'+titleBlock(product,geometries.length,size)+body+
    text(64,size-40,footer+' Razpoložljivost v izbirniku različic.',24,'fill="'+muted+'"')+'</g></svg>';
  return {svg,width:size,height:size};
}
