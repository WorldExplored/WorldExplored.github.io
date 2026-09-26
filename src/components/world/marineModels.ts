import { BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, Float32BufferAttribute, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Tint=(x:number,angle:number)=>string;
function paint(geometry:BufferGeometry,color:string){
  geometry.deleteAttribute('uv');const tint=new Color(color),count=geometry.attributes.position.count,colors=new Float32Array(count*3);
  for(let i=0;i<count;i++)colors.set([tint.r,tint.g,tint.b],i*3);
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));return geometry;
}
function join(parts:BufferGeometry[]){const result=mergeGeometries(parts)!;parts.forEach(part=>part.dispose());result.computeBoundingSphere();result.computeBoundingBox();return result;}
const oval=(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string)=>paint(new SphereGeometry(1,12,8).scale(sx,sy,sz).translate(x,y,z),color);
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
export function crawlingOctopusBodyGeometry(){
  return join([oval(-.13,.20,0,.30,.16,.235,'#ead3c5'),oval(.22,.135,0,.17,.10,.15,'#ead3c5'),
    paint(new CylinderGeometry(.021,.035,.10,9).rotateX(Math.PI/2).translate(.14,.13,.14),'#d6bcae'),
    ...[-1,1].map(side=>oval(.23,.172,side*.139,.021,.017,.007,'#142b2b'))]);
}
export function crawlingOctopusArmGeometry(){
  const path=new CatmullRomCurve3([new Vector3(),new Vector3(.14,-.05,0),new Vector3(.32,-.063,.04),new Vector3(.49,-.054,.10),new Vector3(.55,-.025,.16),new Vector3(.51,.008,.20)]);
  const arm=new TubeGeometry(path,18,.048,7,false),p=arm.attributes.position,uv=arm.attributes.uv;
  for(let i=0;i<p.count;i++){const t=uv.getX(i),c=path.getPointAt(t),r=1-.91*t;p.setXYZ(i,c.x+(p.getX(i)-c.x)*r,c.y+(p.getY(i)-c.y)*r,c.z+(p.getZ(i)-c.z)*r);}
  arm.computeVertexNormals();
  return join([paint(arm,'#e4c7b7'),...Array.from({length:4},(_,i)=>{const c=path.getPointAt(.22+i*.17);return oval(c.x,c.y-.030,c.z,.019,.008,.018,'#f4dfcd');})]);
}
export function seaSnakeGeometry(){
  const profile=Array.from({length:43},(_,i)=>{const t=i/42,x=-1.05+t*1.98,r=(.075*Math.sin(Math.PI*t*.92)+.016)*(t<.82?1:.83);return[x,r,r*.80,0];});
  const body=profileGeometry(profile,10,(x)=>Math.sin((x+1.05)*23)>.20?'#d5c99d':'#4d6862');
  return join([body,oval(.87,0,0,.12,.068,.070,'#627b63'),...[-1,1].map(side=>oval(.922,.025,side*.054,.010,.010,.004,'#152b2a')),
    thickFin([[-1.02,0,0],[-1.20,.03,.05],[-1.29,0,0],[-1.20,-.03,-.05]],.008,'#829377')]);
}
export function squidGeometry(){
  const body=profileGeometry([[-.47,.07,.08,0],[-.34,.11,.105,0],[-.23,.13,.12,0],[.02,.14,.13,0],[.33,.12,.11,0],[.60,.08,.07,0],[.79,.005,.005,0]],18,(x,a)=>Math.cos(a)<-.35?'#eed9ca':Math.sin(x*82+a*7)>.65?'#9d677c':'#c79bac');
  const parts=[body,...[-1,1].map(side=>thickFin([[.20,0,side*.11],[.43,.012,side*.32],[.73,0,side*.04],[.50,-.012,side*.08]],.01,'#d4a3b8')),
    ...[-1,1].map(side=>oval(-.365,.028,side*.095,.031,.027,.009,'#173343'))];
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2,length=i<2?.72:.38+(i%3)*.04,path=new CatmullRomCurve3([new Vector3(-.45,Math.cos(a)*.046,Math.sin(a)*.055),new Vector3(-.58,Math.cos(a)*.058,Math.sin(a)*.078),new Vector3(-.45-length,Math.cos(a)*.026,Math.sin(a)*.025)]);
    const arm=new TubeGeometry(path,10,.012,5,false);parts.push(paint(arm,'#d8b0b6'));
  }
  return join(parts);
}
export function whaleBodyGeometry(){
  const profile=[[-4.65,.04,.065,0],[-4.05,.19,.24,0],[-3.1,.40,.48,.01],[-2,.71,.70,.02],[-.7,.96,.90,.04],[.7,1.05,1.02,.025],[1.8,.99,.93,0],[2.75,.80,.77,-.025],[3.40,.51,.52,-.07],[3.75,.23,.27,-.08],[3.87,.005,.005,-.08]];
  const body=profileGeometry(profile,30,(x,a)=>Math.cos(a)<-.33?(x>.2&&Math.sin(a*24)>.6?'#9caaa4':'#d3d9c8'):Math.cos(a)>.6?'#46636a':'#63818a');
  const dorsal=thickFin([[-2.15,.58,0],[-1.72,1.25,0],[-1.47,.70,0]],.035,'#46636a','z');
  return join([body,dorsal,oval(1.60,1.006,0,.12,.012,.069,'#233e42'),...[-1,1].map(side=>oval(2.77,.08,side*.763,.037,.027,.013,'#142c30'))]);
}
export function whalePectoralGeometry(){
  return thickFin([[.25,0,0],[-.05,-.18,.7],[-1.07,-.46,2.65],[-1.38,-.44,2.81],[-1.25,-.32,1.35],[-.62,-.13,.23]],.065,'#a4bdbb');
}
export function whaleFlukeGeometry(){
  return thickFin([[.1,0,0],[-.30,.02,.65],[-1.24,.06,2],[-1.48,.03,1.80],[-1.06,-.01,.63],[-.86,-.01,0],[-1.06,-.01,-.63],[-1.48,.03,-1.80],[-1.24,.06,-2],[-.30,.02,-.65]],.065,'#527c83');
}
