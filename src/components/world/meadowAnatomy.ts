import { BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, Float32BufferAttribute, Quaternion, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function paint(g:BufferGeometry,hex:string){
  const color=new Color(hex),p=g.getAttribute('position'),values=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const shade=.94+.06*Math.sin(p.getX(i)*43+p.getY(i)*67+p.getZ(i)*29)**2;values.set([color.r*shade,color.g*shade,color.b*shade],i*3);}
  g.setAttribute('color',new Float32BufferAttribute(values,3));g.deleteAttribute('uv');return g;
}
function merge(parts:BufferGeometry[]){const flat=parts.map(g=>g.index?g.toNonIndexed():g),result=mergeGeometries(flat)!;parts.forEach((g,i)=>{g.dispose();if(flat[i]!==g)flat[i].dispose();});result.computeBoundingBox();result.computeBoundingSphere();return result;}
function sphere(x:number,y:number,z:number,sx:number,sy:number,sz:number,hex:string,segments=12){return paint(new SphereGeometry(1,segments,8).scale(sx,sy,sz).translate(x,y,z),hex);}
function rod(a:Vector3,b:Vector3,r:number,hex:string){const direction=b.clone().sub(a),g=new CylinderGeometry(r*.8,r,direction.length(),5);g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.normalize())).translate(...a.clone().add(b).multiplyScalar(.5).toArray());return paint(g,hex);}
/** Barrel torso, thick neck and smooth peduncle; the broad muzzle is a separate grazing joint. */
export function manateeBodyGeometry(){
  const curve=new CatmullRomCurve3([[-1.13,.09,.14],[-.95,.22,.25],[-.57,.37,.40],[-.03,.45,.48],[.45,.40,.43],[.73,.31,.32],[.89,.235,.27]].map(p=>new Vector3(...p)),false,'catmullrom',.3);
  const positions:number[]=[],indices:number[]=[],colors:number[]=[],c=new Color();
  for(let ring=0;ring<=24;ring++){
    const p=curve.getPoint(ring/24);
    for(let side=0;side<=20;side++){
      const a=side/20*Math.PI*2,y=Math.cos(a)*p.y,z=Math.sin(a)*p.z;positions.push(p.x,y,z);
      c.set(y>.12?'#7f958e':y<-.15?'#b2bbaa':'#91a69c');const grain=.93+.07*Math.sin(p.x*87+a*5)**2,crease=1-.035*Math.cos(p.x*73)*Math.max(0,p.x-.3);colors.push(c.r*grain*crease,c.g*grain*crease,c.b*grain*crease);
      if(ring&&side){const i=ring*21+side;indices.push(i,i-1,i-22,i,i-22,i-21);}
    }
  }
  for(let side=1;side<19;side++){indices.push(0,side+1,side);const end=24*21;indices.push(end,end+side,end+side+1);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.name='manatee-barrel-torso';return g;
}
export function manateeHeadGeometry(){
  const parts=[sphere(.25,0,0,.40,.28,.29,'#91a69c',16),sphere(.52,-.115,-.115,.20,.16,.18,'#b2b9a7'),sphere(.52,-.115,.115,.20,.16,.18,'#b2b9a7'),sphere(.44,-.225,0,.22,.07,.19,'#879990')];
  for(const side of [-1,1]){
    parts.push(sphere(.18,.073,side*.257,.036,.032,.016,'#667b74',10),sphere(.181,.076,side*.270,.020,.020,.009,'#1c3838',8),sphere(.186,.083,side*.277,.005,.005,.003,'#d6e3cf',6));
    parts.push(sphere(.44,.167,side*.079,.031,.012,.018,'#37534d',8));
    for(let n=0;n<5;n++)parts.push(rod(new Vector3(.59,-.10-n*.017,side*(.07+n*.015)),new Vector3(.72+n*.003,-.12-n*.018,side*(.09+n*.019)),.003,'#536b60'));
  }
  const g=merge(parts);g.name='manatee-bristled-muzzle-eyes-nostrils';return g;
}
export function manateeTailGeometry(){
  const parts=[sphere(-.14,0,0,.21,.10,.22,'#8ca096'),sphere(-.45,-.01,0,.45,.066,.58,'#8ca096',20)];
  const g=merge(parts);g.name='manatee-rounded-paddle-tail';return g;
}
export function manateeFlipperGeometry(side:number){
  const g=merge([sphere(-.06,-.018,side*.08,.17,.079,.13,'#91a69c'),sphere(-.23,-.09,side*.26,.24,.055,.23,'#99afa1')]);
  g.name=`manatee-attached-pectoral-${side}`;return g;
}
export function hermitBodyGeometry(){
  const parts=[sphere(-.02,.065,0,.13,.12,.11,'#d6b992'),sphere(.095,-.01,0,.095,.046,.055,'#9a7254')];
  const spiral=Array.from({length:34},(_,i)=>{const t=i/33,a=t*Math.PI*4.8,r=.103*(1-t*.85);return new Vector3(-.025+Math.cos(a)*r,.084+Math.sin(a)*r,.066+t*.024);});
  parts.push(paint(new TubeGeometry(new CatmullRomCurve3(spiral),32,.008,4,false),'#9d7f60'));
  for(const side of[-1,1]){
    parts.push(rod(new Vector3(.14,.015,side*.027),new Vector3(.174,.068,side*.042),.009,'#9d7553'),sphere(.176,.070,side*.043,.013,.014,.012,'#243e35',6));
    parts.push(sphere(.21,-.007,side*.07,.045,side===1?.025:.018,.026,'#b48d63',8));
  }
  return merge(parts);
}
export function hermitLegsGeometry(side:number){
  const parts:BufferGeometry[]=[];
  for(let i=0;i<3;i++){
    const x=.01+i*.045,base=new Vector3(x,-.012,side*.04),knee=new Vector3(x-.05,-.01,side*(.13+i*.018)),foot=new Vector3(x-.10,-.062,side*(.18+i*.014));parts.push(rod(base,knee,.008,'#aa8861'),rod(knee,foot,.006,'#ae9873'));
  }
  return merge(parts);
}
export function clamGeometry(form:number){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[],color=new Color(['#b9bea4','#c8bbaa','#93b8b1'][form]);
  for(let ring=0;ring<=6;ring++)for(let side=0;side<=24;side++){
    const r=ring/6,a=side/24*Math.PI*2,ridge=1+.045*Math.cos(a*15),y=.40*Math.sqrt(1-r*r)+.035*Math.cos(a*15)*r;
    positions.push(Math.cos(a)*r*ridge,y,Math.sin(a)*r*.78*ridge);const shade=.85+.15*Math.cos(a*15)**2;colors.push(color.r*shade,color.g*shade,color.b*shade);
    if(ring&&side){const i=ring*25+side;indices.push(i,i-1,i-26,i,i-26,i-25);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function meadowGrassGeometry(form:number){
  const p:number[]=[],colors:number[]=[],indices:number[]=[],color=new Color(['#3d7751','#528348','#547c61'][form]);
  for(let blade=0;blade<4;blade++){
    const a=blade*2.399+form*.9,length=.56+((blade*7+form*3)%9)/20,bend=.27+((blade+form)%3)*.1,width=form===2?.048:.031,start=p.length/3;
    for(let level=0;level<=3;level++)for(const side of[-1,1]){
      const t=level/3,w=width*(1-t*.92),spread=bend*t*t;
      p.push(Math.cos(a)*spread+Math.sin(a)*w*side,t*length,Math.sin(a)*spread-Math.cos(a)*w*side);const shade=.76+t*.24+(side===1?.04:0);colors.push(color.r*shade,color.g*shade,color.b*shade);
    }
    for(let level=0;level<3;level++){const i=start+level*2;indices.push(i,i+2,i+3,i,i+3,i+1);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function floatingLeafGeometry(rooted:boolean){
  const p:number[]=[0,0,0],indices:number[]=[],colors:number[]=[],c=new Color(rooted?'#4e8551':'#668547');colors.push(c.r*.8,c.g*.8,c.b*.8);
  for(let i=0;i<=28;i++){
    // A real radial notch distinguishes shoreline pads from irregular floating algae lobes.
    const a=(rooted?.16:0)+i/28*(Math.PI*2-(rooted?.32:0)),r=rooted?1: .74+.12*Math.cos(a*7)+.14*Math.sin(a*5);
    p.push(Math.cos(a)*r,.024*(1-Math.cos(a*3)),Math.sin(a)*r);const shade=.9+.1*Math.cos(a*8)**2;colors.push(c.r*shade,c.g*shade,c.b*shade);if(i)indices.push(0,i,i+1);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
