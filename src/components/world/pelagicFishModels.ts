import { BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, Float32BufferAttribute, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PelagicSpecies } from './pelagicFishState';

function tint(geometry:BufferGeometry,color:string){
  const c=new Color(color),count=geometry.getAttribute('position').count,colors=new Float32Array(count*3);
  for(let i=0;i<count;i++)colors.set([c.r,c.g,c.b],i*3);
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.deleteAttribute('uv');return geometry;
}
function merge(parts:BufferGeometry[]){
  const flat=parts.map(p=>p.index?p.toNonIndexed():p),geometry=mergeGeometries(flat)!;
  parts.forEach((p,i)=>{p.dispose();if(flat[i]!==p)flat[i].dispose();});geometry.computeBoundingBox();return geometry;
}
function rod(a:Vector3,b:Vector3,radius:number,color:string,end=radius*.22){
  const direction=b.clone().sub(a),geometry=new CylinderGeometry(end,radius,direction.length(),6);
  geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.normalize())).translate(...a.clone().add(b).multiplyScalar(.5).toArray());return tint(geometry,color);
}
/** Fin rays meet at their real hinge, supporting a ribbed, curved membrane. */
function fan(outline:number[][],color:string,rays=true){
  const positions:number[]=[],colors:number[]=[],c=new Color(color),root=new Vector3(...outline[0]);
  const write=(p:Vector3,shade:number)=>{positions.push(p.x,p.y,p.z);colors.push(c.r*shade,c.g*shade,c.b*shade);};
  for(let i=1;i<outline.length-1;i++){
    const a=new Vector3(...outline[i]),b=new Vector3(...outline[i+1]);
    for(let n=0;n<4;n++){
      const p=a.clone().lerp(b,n/4),q=a.clone().lerp(b,(n+1)/4),shade=n%2?.79:1;
      write(root,shade*.78);write(p,shade);write(q,shade*.96);
    }
  }
  const surface=new BufferGeometry();surface.setAttribute('position',new Float32BufferAttribute(positions,3));surface.setAttribute('color',new Float32BufferAttribute(colors,3));surface.computeVertexNormals();
  const parts=[surface];
  if(rays)for(let i=1;i<outline.length;i++)parts.push(rod(root,new Vector3(...outline[i]),.0037,'#e0d8b5',.0013));
  return merge(parts);
}
const profiles={
  marlin:[[-.73,.025,.025],[-.52,.09,.085],[-.17,.16,.13],[.23,.18,.145],[.49,.12,.09],[.67,.028,.029]],
  flying:[[-.27,.014,.016],[-.19,.048,.039],[-.05,.070,.059],[.12,.063,.055],[.24,.031,.032],[.29,.012,.014]],
  lionfish:[[-.24,.025,.024],[-.13,.115,.077],[.015,.16,.095],[.19,.133,.104],[.29,.080,.065],[.33,.025,.038]],
} as const;
function body(kind: keyof typeof profiles){
  const curve=new CatmullRomCurve3(profiles[kind].map(p=>new Vector3(...p)),false,'catmullrom',.35),p:number[]=[],colors:number[]=[],indices:number[]=[],radial=18,rings=24;
  const light=new Color(),dark=new Color();
  for(let ring=0;ring<=rings;ring++){
    const point=curve.getPoint(ring/rings);
    for(let side=0;side<=radial;side++){
      const a=side/radial*Math.PI*2,upper=Math.cos(a),y=upper*Math.max(.009,point.y),z=Math.sin(a)*Math.max(.009,point.z);
      p.push(point.x,y,z);
      if(kind==='marlin'){
        light.set(upper>.45?'#1761a0':upper<-.25?'#d5e9da':'#68bace');
        if(Math.abs(Math.sin(point.x*35))<.22&&Math.abs(upper)<.72)light.lerp(dark.set('#367392'),.45);
      }else if(kind==='flying')light.set(upper>.38?'#2e91ad':upper<-.3?'#e4efd9':'#a7cfca');
      else light.set(Math.sin(point.x*51+a*.65)>.12?'#e5d8b3':'#a44937');
      const grain=.94+.06*Math.cos(point.x*144+a*9)**2;colors.push(light.r*grain,light.g*grain,light.b*grain);
      if(ring&&side){const k=ring*(radial+1)+side;indices.push(k,k-1,k-radial-2,k,k-radial-2,k-radial-1);}
    }
  }
  for(let side=1;side<radial-1;side++){indices.push(0,side+1,side);const end=rings*(radial+1);indices.push(end,end+side,end+side+1);}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(p,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export interface PelagicAnatomy {body:BufferGeometry;tail:BufferGeometry;fins:BufferGeometry[];tailX:number;finRoot:[number,number,number]}
export function createPelagicAnatomy(kind:Exclude<PelagicSpecies,'cave-silver'>):PelagicAnatomy {
  const parts=[body(kind)],fins:BufferGeometry[]=[];
  let tail:BufferGeometry,tailX:number,finRoot:[number,number,number];
  if(kind==='marlin'){
    // The bill is a tapered upper jaw, continuous with the snout; the jaw below stays short.
    parts.push(rod(new Vector3(.64,.013,0),new Vector3(1.61,.053,0),.025,'#346f87',.0007));
    parts.push(tint(new SphereGeometry(1,10,6).scale(.16,.014,.025).translate(.66,-.013,0),'#add6d1'));
    parts.push(fan([[-.50,.09,0],[-.38,.22,0],[.09,.48,0],[.20,.19,0],[.44,.12,0]],'#225685'));
    parts.push(fan([[-.45,-.09,0],[-.33,-.23,0],[-.09,-.15,0],[.04,-.15,0]],'#377d92'));
    tail=fan([[0,0,0],[-.50,.40,0],[-.39,.37,0],[-.16,.06,0],[-.10,0,0],[-.16,-.06,0],[-.39,-.37,0],[-.50,-.40,0]],'#255a7f');tailX=-.73;finRoot=[.25,-.07,.105];
    for(const side of [-1,1])fins.push(fan([[0,0,0],[-.46,-.035,side*.47],[-.24,-.07,side*.18],[-.13,-.02,side*.03]],'#4b92a4'));
  }else if(kind==='flying'){
    parts.push(fan([[-.17,.045,0],[-.16,.14,0],[-.055,.073,0],[.01,.063,0]],'#5cafa9'));
    tail=fan([[0,0,0],[-.17,.075,0],[-.095,.01,0],[-.24,-.14,0],[-.16,-.095,0]],'#39859b');tailX=-.27;finRoot=[.075,-.018,.048];
    for(const side of [-1,1])fins.push(fan([[0,0,0],[.025,.015,side*.13],[-.035,.025,side*.36],[-.12,.005,side*.52],[-.30,-.012,side*.49],[-.42,-.018,side*.24],[-.34,-.012,side*.07],[-.12,0,side*.025]],'#93cbd0'));
  }else{
    for(let spine=0;spine<11;spine++){
      const x=-.17+spine*.034,h=.22+Math.sin(spine/10*Math.PI)*.23;
      parts.push(rod(new Vector3(x,.12,0),new Vector3(x-.11,h,0),.007,'#d4c9a3',.001));
      if(spine<10)parts.push(fan([[x,.12,0],[x-.11,h*.8,0],[x+.034-.11,(.22+Math.sin((spine+1)/10*Math.PI)*.23)*.8,0],[x+.034,.12,0]],spine%2?'#b3513f':'#e1c99d',false));
    }
    for(const side of [-1,1])parts.push(rod(new Vector3(.26,.06,side*.04),new Vector3(.30,.22,side*.074),.007,'#ad6c49',.001));
    tail=fan([[0,0,0],[-.18,.12,0],[-.25,.075,0],[-.27,0,0],[-.25,-.075,0],[-.18,-.12,0]],'#c78663');tailX=-.24;finRoot=[.10,-.016,.080];
    for(const side of [-1,1]){
      const outline:number[][]=[[0,0,0]];
      for(let ray=0;ray<13;ray++){const a=-.5+ray/12*2.12,reach=.36+.10*Math.sin(ray*.8);outline.push([-.09-Math.sin(a)*reach,Math.cos(a)*.12-.045,side*(.08+Math.cos(a)*reach)]);}
      const membrane=fan(outline,'#dcb98c');fins.push(membrane);
    }
  }
  const eyeX=kind==='marlin'?.48:kind==='flying'?.21:.24,eyeY=kind==='marlin'?.057:.04,eyeZ=kind==='marlin'?.087:kind==='flying'?.030:.073,radius=kind==='marlin'?.020:kind==='flying'?.010:.018;
  for(const side of [-1,1]){
    parts.push(tint(new SphereGeometry(radius*1.3,8,6).scale(1,1,.42).translate(eyeX,eyeY,side*eyeZ),'#c5d7b9'));
    parts.push(tint(new SphereGeometry(radius,8,6).scale(1,1,.37).translate(eyeX+.002,eyeY,side*(eyeZ+radius*.4)),'#152d34'));
    parts.push(tint(new SphereGeometry(radius*.22,6,4).translate(eyeX+radius*.22,eyeY+radius*.25,side*(eyeZ+radius*.75)),'#effbdf'));
  }
  const geometry=merge(parts);geometry.name=`${kind}-anatomical-body`;tail.name=`${kind}-articulated-tail`;
  fins.forEach((geometry,i)=>geometry.name=`${kind}-ray-supported-fin-${i}`);
  return {body:geometry,tail,fins,tailX,finRoot};
}
