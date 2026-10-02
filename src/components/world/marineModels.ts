import { BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, Float32BufferAttribute, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Tint=(x:number,angle:number)=>string;
function paint(geometry:BufferGeometry,color:string){
  geometry.deleteAttribute('uv');const tint=new Color(color),count=geometry.attributes.position.count,colors=new Float32Array(count*3);
  for(let i=0;i<count;i++)colors.set([tint.r,tint.g,tint.b],i*3);
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));return geometry;
}
function join(parts:BufferGeometry[]){const result=mergeGeometries(parts)!;parts.forEach(part=>part.dispose());result.computeBoundingSphere();result.computeBoundingBox();return result;}
const oval=(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string,segments=12)=>paint(new SphereGeometry(1,segments,Math.max(4,Math.round(segments*2/3))).scale(sx,sy,sz).translate(x,y,z),color);
function profileGeometry(profile:number[][],sides:number,tint:Tint){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  profile.forEach(([x,ry,rz,offset=0],ring)=>{
    for(let side=0;side<=sides;side++){
      const a=side/sides*Math.PI*2,c=new Color(tint(x,a)),shade=.96+.04*Math.sin(x*57+a*31)**2;
      positions.push(x,Math.cos(a)*ry+offset,Math.sin(a)*rz);colors.push(c.r*shade,c.g*shade,c.b*shade);
      if(ring&&side){const i=ring*(sides+1)+side;indices.push(i,i-1,i-sides-1,i-1,i-sides-2,i-sides-1);}
    }
  });
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function thickFin(outline:number[][],thickness:number,color:string,axis:'y'|'z'='y'){
  const positions:number[]=[],indices:number[]=[],n=outline.length;
  for(const side of [-1,1])for(const [x,y,z]of outline)positions.push(x,y+(axis==='y'?side*thickness:0),z+(axis==='z'?side*thickness:0));
  for(let i=1;i<n-1;i++)indices.push(0,i+1,i,n,n+i,n+i+1);
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,n+i,j,n+j,n+i);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return paint(g,color);
}
export function octopusMantleGeometry(variant=0){
  const profile=variant%2? [[-.32,.045,.063,.20],[-.22,.13,.15,.23],[-.02,.19,.195,.24],[.19,.177,.20,.24],[.37,.13,.155,.23],[.47,.052,.07,.23],[.49,.001,.001,.23]] : [[-.32,.04,.06,.20],[-.24,.12,.13,.23],[-.04,.172,.183,.24],[.18,.18,.196,.25],[.35,.15,.17,.25],[.49,.075,.093,.24],[.53,.001,.001,.24]];
  const body=profileGeometry(profile,24,(x,a)=>Math.cos(a)<-.25?'#e7c9ba':Math.sin(x*87+a*6)*Math.cos(x*32-a*13)>.38?'#a88574':'#ddc1b0');
  const papillae=Array.from({length:15},(_,i)=>{
    const x=-.17+(i%5)*.13,a=-.85+Math.floor(i/5)*.85;
    const r=.135*Math.sqrt(Math.max(.12,1-((x-.08)/.47)**2));
    return oval(x,.245+Math.cos(a)*r,Math.sin(a)*r,.015,.011,.012,'#d3b19c',6);
  });
  return join([body,...papillae]);
}

export function crawlingOctopusBodyGeometry(){
  const mantle=octopusMantleGeometry().rotateY(Math.PI).scale(.82,.87,1).translate(-.02,-.012,0);
  return join([mantle,oval(.22,.135,0,.17,.10,.15,'#e1bfae'),oval(.20,.092,0,.235,.031,.205,'#e1bfae'),
    paint(new CylinderGeometry(.021,.035,.10,9).rotateX(Math.PI/2).translate(.14,.13,.14),'#d6bcae'),
    ...[-1,1].flatMap(side=>[oval(.23,.172,side*.131,.041,.026,.019,'#c4a28f'),oval(.244,.177,side*.146,.020,.004,.004,'#142b2b')])]);
}
export function crawlingOctopusArmGeometry(){
  const path=new CatmullRomCurve3([new Vector3(),new Vector3(.14,-.05,0),new Vector3(.32,-.063,.04),new Vector3(.49,-.054,.10),new Vector3(.55,-.025,.16),new Vector3(.51,.008,.20)]);
  const arm=new TubeGeometry(path,20,.055,8,false),p=arm.attributes.position,uv=arm.attributes.uv;
  for(let i=0;i<p.count;i++){const t=uv.getX(i),c=path.getPointAt(t),r=1-.95*t;p.setXYZ(i,c.x+(p.getX(i)-c.x)*r,c.y+(p.getY(i)-c.y)*r,c.z+(p.getZ(i)-c.z)*r);}
  arm.computeVertexNormals();
  return join([paint(arm,'#e4c7b7'),...Array.from({length:7},(_,i)=>[-1,1].map(side=>{const t=.16+i*.103,c=path.getPointAt(t);return oval(c.x,c.y-.042*(1-t),c.z+side*.018*(1-t),.014*(1-t*.55),.006,.012*(1-t*.55),'#f4dfcd',6);})).flat()]);
}
export function seaSnakeGeometry(){
  const profile=Array.from({length:61},(_,i)=>{const t=i/60,x=-1.05+t*1.98,r=(.071*Math.sin(Math.PI*t*.92)+.014)*(t<.82?1:.83);return[x,r,r*.80,0];});
  const body=profileGeometry(profile,14,(x,a)=>Math.cos(a)<-.45?'#d7cdb0':Math.sin((x+1.05)*23)>.20?'#b7b298':'#465b54');
  return join([body,oval(.87,0,0,.12,.066,.067,'#73816b'),
    ...[-1,1].flatMap(side=>[oval(.922,.025,side*.054,.010,.006,.004,'#152b2a'),oval(.965,.026,side*.023,.006,.003,.004,'#3e5148'),oval(.91,-.027,side*.052,.060,.002,.005,'#43564c')]),
    thickFin([[-.96,.025,0],[-1.17,.11,0],[-1.28,.05,0],[-1.31,-.01,0],[-1.17,-.13,0],[-.96,-.025,0]],.009,'#677869','z')]);
}
export function squidGeometry(){
  const body=profileGeometry([[-.47,.07,.08,0],[-.34,.11,.105,0],[-.23,.13,.12,0],[.02,.14,.13,0],[.33,.12,.11,0],[.60,.08,.07,0],[.79,.005,.005,0]],18,(x,a)=>Math.cos(a)<-.35?'#f3e8dd':Math.sin(x*82+a*7)>.65?'#997d87':'#ddd0d5');
  const parts=[body,...[-1,1].map(side=>thickFin([[.20,0,side*.11],[.43,.012,side*.32],[.73,0,side*.04],[.50,-.012,side*.08]],.01,'#e4d2d9')),
    ...[-1,1].map(side=>oval(-.365,.028,side*.095,.031,.027,.009,'#173343'))];
  for(let i=0;i<10;i++){
    const tentacle=i>=8,a=(tentacle?(i-8)*Math.PI+.35:i/8*Math.PI*2),length=tentacle?.72:.32+(i%3)*.055;
    const path=new CatmullRomCurve3([new Vector3(-.45,Math.cos(a)*.046,Math.sin(a)*.055),new Vector3(-.58,Math.cos(a)*.058,Math.sin(a)*.078),new Vector3(-.45-length,Math.cos(a)*.026,Math.sin(a)*.025)]);
    const arm=new TubeGeometry(path,10,tentacle?.009:.014,5,false);parts.push(paint(arm,'#e5d0d1'));
    if(tentacle){const end=path.getPoint(1);parts.push(oval(end.x,end.y,end.z,.058,.018,.021,'#cfadb9',8));}
  }
  const geometry=join(parts);geometry.userData.armCount=8;geometry.userData.feedingTentacles=2;return geometry;
}
export function whaleBodyGeometry(){
  // A broad flattened rostrum, stocky chest, low rear hump and pleated throat
  // distinguish the humpback from the pointed fusiform reef fish.
  const profile=[[-4.65,.04,.065,0],[-4.05,.18,.24,0],[-3.1,.39,.49,.01],[-2,.72,.74,.02],[-.7,1.04,1.0,.04],[.7,1.13,1.10,.025],[1.8,1.01,1.09,0],[2.75,.72,1.0,-.045],[3.4,.43,.79,-.08],[3.80,.24,.47,-.09],[3.92,.12,.16,-.1],[3.94,.005,.005,-.1]];
  const body=profileGeometry(profile,36,(x,a)=>Math.cos(a)<-.24?(x>-.5&&Math.sin(a*24)>.56?'#87928d':'#dce1d5'):Math.cos(a)>.45?'#273d47':'#47606a');
  const dorsal=thickFin([[-2.46,.58,0],[-2.08,.91,0],[-1.86,1.18,0],[-1.66,1.10,0],[-1.66,.77,0],[-1.26,.78,0]],.045,'#2d4650','z');
  const tubercles=Array.from({length:18},(_,i)=>{const x=2.0+(i%6)*.31,z=(Math.floor(i/6)-1)*(.32+(3.55-x)*.15);return oval(x,.94-(x-2.0)*.34,z,.075,.055,.073,'#73837f',8);});
  const mouth=[-1,1].map(side=>paint(new TubeGeometry(new CatmullRomCurve3([new Vector3(1.85,-.08,side*1.075),new Vector3(2.64,-.13,side*.988),new Vector3(3.43,-.21,side*.72),new Vector3(3.88,-.16,side*.12)]),20,.015,6,false),'#182e35'));
  const pleats=Array.from({length:11},(_,i)=>{
    const a=Math.PI*.60+i/10*Math.PI*.80;
    return paint(new TubeGeometry(new CatmullRomCurve3([new Vector3(-.7,.04+Math.cos(a)*1.043,Math.sin(a)*1.004),new Vector3(.7,.025+Math.cos(a)*1.135,Math.sin(a)*1.104),new Vector3(1.8,Math.cos(a)*1.015,Math.sin(a)*1.094),new Vector3(2.75,-.045+Math.cos(a)*.725,Math.sin(a)*1.004)]),18,.012,5,false),'#738580');
  });
  return join([body,dorsal,...mouth,...pleats,...tubercles,oval(1.48,1.073,0,.13,.016,.073,'#14292d'),...[-1,1].map(side=>oval(2.65,.03,side*.998,.045,.032,.015,'#10272c'))]);
}
export function whalePectoralGeometry(){
  return thickFin([[.26,0,0],[.23,-.05,.35],[.12,-.10,.55],[.05,-.14,.76],[-.10,-.20,.97],[-.22,-.23,1.18],[-.39,-.28,1.4],[-.55,-.34,1.8],[-.76,-.40,2.34],[-1.08,-.43,2.89],[-1.35,-.43,3.10],[-1.52,-.41,2.99],[-1.31,-.32,1.71],[-.73,-.14,.40],[-.52,-.08,.04]],.071,'#cbdcd5');
}
export function whaleFlukeGeometry(){
  return thickFin([[.1,0,0],[-.26,.02,.57],[-.82,.06,1.68],[-1.15,.09,2.32],[-1.46,.04,2.08],[-1.36,.02,1.86],[-1.42,.015,1.61],[-1.26,0,1.31],[-1.32,0,1.08],[-1.04,-.01,.62],[-.72,-.01,0],[-1.04,-.01,-.62],[-1.32,0,-1.08],[-1.26,0,-1.31],[-1.42,.015,-1.61],[-1.36,.02,-1.86],[-1.46,.04,-2.08],[-1.15,.09,-2.32],[-.82,.06,-1.68],[-.26,.02,-.57]],.070,'#344e59');
}
