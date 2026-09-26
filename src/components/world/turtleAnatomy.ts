import { BufferGeometry, Float32BufferAttribute } from 'three';

function surface(positions:number[],indices:number[]){
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function turtleShellHeight(x:number,z:number){
  const q=((x+.08)/.66)**2+(z/.47)**2;
  return .15+.29*Math.sqrt(Math.max(0,1-q));
}
/** A continuous rounded carapace meets the plastron along a narrow supporting rim. */
export function turtleCarapaceGeometry(){
  const positions:number[]=[],indices:number[]=[],rings=14,sides=36;
  for(let ring=0;ring<=rings;ring++)for(let side=0;side<=sides;side++){
    const r=ring/rings,a=side/sides*Math.PI*2,x=-.08+Math.cos(a)*.66*r,z=Math.sin(a)*.47*r;
    positions.push(x,turtleShellHeight(x,z),z);
    if(ring&&side){const i=ring*(sides+1)+side;indices.push(i,i-1,i-sides-1,i-1,i-sides-2,i-sides-1);}
  }
  const rimStart=positions.length/3;
  for(let side=0;side<=sides;side++){
    const a=side/sides*Math.PI*2;positions.push(-.08+Math.cos(a)*.65,.117,Math.sin(a)*.46);
    if(side){const a=rings*(sides+1)+side,b=rimStart+side;indices.push(a,b,a-1,a-1,b,b-1);}
  }
  return surface(positions,indices);
}
export function turtlePlastronGeometry(){
  const positions:number[]=[],indices:number[]=[],rings=8,sides=36;
  for(let ring=0;ring<=rings;ring++)for(let side=0;side<=sides;side++){
    const r=ring/rings,a=side/sides*Math.PI*2;
    positions.push(-.08+Math.cos(a)*.65*r,.119-.06*Math.sqrt(1-r*r),Math.sin(a)*.46*r);
    if(ring&&side){const i=ring*(sides+1)+side;indices.push(i,i-sides-1,i-1,i-1,i-sides-1,i-sides-2);}
  }
  return surface(positions,indices);
}

/** Neck, cheeks and blunt beaked snout are one tapered volume. */
export function turtleHeadGeometry(){
  const profile=[[.32,.185,.092,.083],[.45,.202,.129,.112],[.59,.205,.134,.116],[.70,.197,.117,.095],[.79,.179,.077,.065],[.841,.171,.052,.039],[.854,.17,0,0]],sides=20,positions:number[]=[],indices:number[]=[];
  for(let ring=0;ring<profile.length;ring++)for(let side=0;side<=sides;side++){
    const [x,y,width,height]=profile[ring],a=side/sides*Math.PI*2;positions.push(x,y+Math.cos(a)*height,Math.sin(a)*width);
    if(ring&&side){const i=ring*(sides+1)+side;indices.push(i,i-1,i-sides-1,i-1,i-sides-2,i-sides-1);}
  }
  return surface(positions,indices);
}
/** The broad leading edge narrows into a thin swimming paddle, with its root at the shoulder. */
export function turtleFlipperGeometry(){
  const positions:number[]=[],indices:number[]=[],rings=16,sides=10;
  for(let ring=0;ring<=rings;ring++)for(let side=0;side<=sides;side++){
    const t=ring/rings,a=side/sides*Math.PI*2,width=.11*Math.sin(Math.PI*(t+.22)/1.22),cx=.14*Math.sin(Math.PI*t)-t*.10;
    positions.push(cx+Math.cos(a)*width,Math.sin(a)*(.022*(1-t)+.003),t*.50);
    if(ring&&side){const i=ring*(sides+1)+side;indices.push(i,i-1,i-sides-1,i-1,i-sides-2,i-sides-1);}
  }
  return surface(positions,indices);
}
export function turtleScuteGeometry(){
  const centers:[number,number,number][]=[];
  for(let i=0;i<5;i++)centers.push([-.48+i*.205,0,.119]);
  for(const side of [-1,1])for(let i=0;i<4;i++)centers.push([-.38+i*.205,side*.235,.143]);
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2;centers.push([-.08+Math.cos(a)*.604,Math.sin(a)*.421,.069]);}
  const positions:number[]=[],indices:number[]=[];
  const point=(x:number,z:number)=>{
    const q=((x+.08)/.66)**2+(z/.47)**2;if(q>.98){const t=Math.sqrt(.98/q);x=-.08+(x+.08)*t;z*=t;}
    return [x,turtleShellHeight(x,z)+.0035,z];
  };
  for(const [x,z,r]of centers){
    const center=positions.length/3;positions.push(...point(x,z));
    for(let side=0;side<=6;side++){const a=Math.PI/6+side*Math.PI/3;positions.push(...point(x+Math.cos(a)*r*.91,z+Math.sin(a)*r*.91));if(side)indices.push(center,center+side+1,center+side);}
  }
  const geometry=surface(positions,indices);geometry.userData.plateCount=centers.length;return geometry;
}

/** Low disturbed soil and flattened flipper scrapes, without a raised nest ring. */
export function turtleNestSandGeometry(){
  const positions:number[]=[],indices:number[]=[],sides=36,rings=8;
  for(let ring=0;ring<=rings;ring++)for(let side=0;side<=sides;side++){
    const a=side/sides*Math.PI*2,r=ring/rings,edge=1+.10*Math.sin(a*3+.7)+.045*Math.sin(a*7);
    const x=Math.cos(a)*r*.67*edge,z=Math.sin(a)*r*.49*edge;
    const scrape=.004*Math.sin(x*55+z*18)+.003*Math.sin(z*63);
    positions.push(x,.009+scrape+.006*Math.sin(a*2)*r,z);
    if(ring&&side){const i=ring*(sides+1)+side;indices.push(i,i-1,i-sides-1,i-1,i-sides-2,i-sides-1);}
  }
  return surface(positions,indices);
}


export const TURTLE_VARIATIONS = [
  {shell:'#354e36',plates:'#789059',skin:'#789169',belly:'#d7cc9e',width:.96,flipper:1.03},
  {shell:'#62543b',plates:'#9d8956',skin:'#9a9973',belly:'#e0d4ac',width:1.075,flipper:.90},
  {shell:'#365d57',plates:'#72977c',skin:'#71968e',belly:'#c9d6b6',width:1.015,flipper:1.12},
] as const;
