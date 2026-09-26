import { BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, Float32BufferAttribute, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { combine } from './BuildingKit';

export interface FacadeGardenOptions { width: number; height: number; seed: number; detail?:'near'|'far'; spread?:boolean }
export const VINE_HABITS = ['twining maple vine', 'fan-leaved climber', 'trailing willow vine', 'heart-leaved morning glory', 'star jasmine'] as const;
export function vineHabit(seed: number) { return Math.abs(seed) % VINE_HABITS.length; }

/** A rooted climbing vine with an asymmetric, tapering canopy rather than a wall panel. */
export function createFacadeGarden({ width, height, seed, detail='near', spread=false }: FacadeGardenOptions) {
  const wood: BufferGeometry[] = [], foliage: BufferGeometry[] = [], light: BufferGeometry[] = [], fruit: BufferGeometry[] = [];
  const habit = vineHabit(seed),far=detail==='far';
  const noise = (i: number) => { const value = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return value - Math.floor(value); };
  const tube = (curve:CatmullRomCurve3, radius:number, segments=9) => {
    segments=far?Math.max(3,Math.ceil(segments*.55)):segments;
    const sides=far?3:4,geometry=new TubeGeometry(curve,segments,radius,sides,false),points=geometry.attributes.position;
    for(let row=0;row<=segments;row++){
      const center=curve.getPointAt(row/segments),taper=1-row/segments*.7;
      for(let side=0;side<=sides;side++){
        const i=row*(sides+1)+side;
        points.setXYZ(i,center.x+(points.getX(i)-center.x)*taper,center.y+(points.getY(i)-center.y)*taper,center.z+(points.getZ(i)-center.z)*taper);
      }
    }
    geometry.computeVertexNormals();return geometry;
  };
  const rootRadius=Math.min(.16,width*.22);
  const planter=new CylinderGeometry(rootRadius*.78,rootRadius,.045,7).translate(0,.0225,0);
  planter.userData.facadeGarden={role:'root-mound',seed,floor:0,width,height,spread,habit:VINE_HABITS[habit]};
  // An empty attributed part preserves the callers' shared batching API without a trellis.
  const trellis=new BufferGeometry();
  for(const [name,size] of [['position',3],['normal',3],['uv',2]] as const)trellis.setAttribute(name,new Float32BufferAttribute([],size));
  const trunk=(t:number)=>new Vector3(
    habit===0?(Math.sin(t*6.7+seed)-Math.sin(seed))*width*.085*t:
    habit===1?width*(.16*t+.045*Math.sin(t*9+seed)*t):
    habit===2?width*(-.17*t+.07*Math.sin(t*11+seed)*t):
    habit===3?width*(.11*Math.sin(t*15+seed)*t):width*(.09*t+.06*Math.sin(t*19+seed)*t),
    t*(height-.10),.015+Math.sin(t*(habit===2?11:8)+seed)*.025*t);
  const leader=(t:number,lane:number)=>{
    const point=trunk(t);
    if(spread){point.x+=lane*width*(Math.sin(t*Math.PI*.5)*.29+Math.sin(t*7+seed)*.025*t);point.y*=1-Math.abs(lane)*(.07+noise(lane+701)*.06);}
    return point;
  };
  wood.push(tube(new CatmullRomCurve3(Array.from({length:13},(_,i)=>leader(i/12,0))),.024,18));
  if(spread)for(const lane of [-1,1])wood.push(tube(new CatmullRomCurve3(Array.from({length:13},(_,i)=>leader(i/12,lane))),.018,14));
  for(let root=0;root<4;root++){
    const a=root*2.399+seed;
    wood.push(tube(new CatmullRomCurve3([new Vector3(Math.cos(a)*rootRadius,0,Math.sin(a)*rootRadius),new Vector3(Math.cos(a)*rootRadius*.3,.06,Math.sin(a)*rootRadius*.3),trunk(.08)]),.013,5));
  }
  const count=spread?Math.max(18,Math.ceil(height/.22)):Math.max(7,Math.ceil(height/(habit===0?.22:habit===1?.25:habit===4?.21:.27)));
  for(let branch=0;branch<count;branch++){
    const t=.08+branch/Math.max(1,count-1)*.84,side=habit===1?(branch%2?1:-1):noise(branch+7)>.45?1:-1,start=leader(t,spread?branch%3-1:0);
    const branchSpread=(habit===1?.34:habit===2?.31:.2)+noise(branch+91)*(habit===2?.26:.30);
    const extension=branchSpread*(1-t*(habit===1?.22:.42));
    const endX=spread?Math.max(-width*.43,Math.min(width*.43,start.x+side*width*extension*.38)):side*width*extension;
    const end=new Vector3(endX,Math.min(height-.06,Math.max(.06,start.y+(habit===2?-.04:.13)+noise(branch+12)*height*(habit===2?.07:.16))),.10+noise(branch+40)*.10);
    const middle=start.clone().lerp(end,.52).add(new Vector3(side*width*(habit===1?.07:.035),habit===2?-.04:.025+noise(branch+4)*.06,.035));
    const curve=new CatmullRomCurve3([start,middle,end]);wood.push(tube(curve,.011,6));
    const leafCount=(spread?10:habit===2?5:habit===4?7:6)+Math.floor(noise(branch+101)*(habit===1?6:5));
    for(let leaf=0;leaf<leafCount;leaf++){
      const index=branch*13+leaf,position=curve.getPoint(.13+leaf/leafCount*.87);
      const size=(habit===1?.11:habit===2?.085:.095)+noise(index+51)*(habit===1?.095:.085);
      const leafSize=size*Math.min(1,width/.6)*(spread?1.38:1);
      const lobed=noise(index+35)>.35;
      let outline=habit===3?[[0,0],[-.42,.2],[-.62,.50],[-.48,.80],[-.18,.83],[0,1],[.18,.83],[.48,.80],[.62,.50],[.42,.2]]:
        habit===4?[[0,0],[-.26,.17],[-.38,.48],[-.24,.79],[0,1],[.24,.79],[.38,.48],[.26,.17]]:
        habit===0&&lobed?[[0,0],[-.4,.14],[-.65,.42],[-.36,.44],[-.5,.76],[-.2,.68],[0,1],[.2,.68],[.5,.76],[.36,.44],[.65,.42],[.4,.14]]:
        habit===1?[[0,0],[-.55,.18],[-.72,.48],[-.38,.87],[0,.75],[.38,.87],[.72,.48],[.55,.18]]:
        habit===2?[[0,0],[-.21,.16],[-.30,.48],[-.13,.82],[0,1],[.13,.82],[.30,.48],[.21,.16]]:
        [[0,0],[-.4,.18],[-.55,.5],[-.3,.8],[0,1],[.3,.8],[.55,.5],[.4,.18]];
      if(far)outline=outline.filter((_,i)=>i%2===0);
      const cup=.11+noise(index+12)*.17;
      const vertices=[0,leafSize*.47,leafSize*cup,...outline.flatMap(([x,y])=>[x*leafSize,y*leafSize,leafSize*.025*Math.sin(y*8+index)])];
      const indices:number[]=[];
      for(let edge=0;edge<outline.length;edge++)indices.push(0,edge+1,(edge+1)%outline.length+1);
      const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new Float32BufferAttribute([.5,.47,...outline.flatMap(([x,y])=>[x+.5,y])],2));geometry.setIndex(indices);geometry.computeVertexNormals();
      const turn=(noise(index+81)-.5)*3.7;
      geometry.rotateZ(turn).rotateY((noise(index+103)-.5)*1.2).rotateX((noise(index+112)-.5)*.7).translate(position.x,position.y,position.z+.028);
      (index%4===0?light:foliage).push(geometry);
      // Raised midribs give the small leaves legible folded surfaces in oblique light.
      if(!far&&index%5===0){
        const vein=tube(new CatmullRomCurve3([new Vector3(),new Vector3(0,leafSize*.45,leafSize*cup),new Vector3(0,leafSize*.84,leafSize*.03)]),.0022,4);
        vein.rotateZ(turn).rotateY((noise(index+103)-.5)*1.2).rotateX((noise(index+112)-.5)*.7).translate(position.x,position.y,position.z+.030);light.push(vein);
      }
    }
    if(branch%3===1){
      const points=Array.from({length:18},(_,i)=>{const t=i/17,a=t*Math.PI*3.6;return end.clone().add(new Vector3(side*(t*.10+Math.sin(a)*.028),t*.10+Math.cos(a)*.026-.026,.02+t*.03));});
      wood.push(tube(new CatmullRomCurve3(points),.004,12));
    }
    if(habit===4&&branch%2===0){
      for(let blossom=0;blossom<3;blossom++){
        const center=end.clone().add(new Vector3((blossom-1)*.042,.03*Math.sin(blossom*2.1),.025));
        for(let petal=0;petal<5;petal++){
          const a=petal*Math.PI*2/5,shape=new BufferGeometry();
          shape.setAttribute('position',new Float32BufferAttribute([0,0,0,Math.cos(a-.3)*.045,Math.sin(a-.3)*.045,.012,Math.cos(a)*.063,Math.sin(a)*.063,0,Math.cos(a+.3)*.045,Math.sin(a+.3)*.045,.012],3));
          shape.setAttribute('uv',new Float32BufferAttribute([.5,0,0,.7,.5,1,1,.7],2));shape.setIndex([0,1,2,0,2,3]);shape.computeVertexNormals();shape.translate(center.x,center.y,center.z);fruit.push(shape);
        }
      }
    }
    if(habit!==4&&branch%5===seed%5)for(let grape=0;grape<7;grape++){
      const row=Math.floor(grape/3),a=grape*2.399,r=.027*(1-row*.22);
      fruit.push(new SphereGeometry(.030,far?4:5,3).translate(end.x*.85+Math.cos(a)*r,end.y-.04-row*.035,end.z+.03+Math.sin(a)*r));
    }
  }
  const tint=(parts:BufferGeometry[],hex:string)=>{
    const geometry=combine(parts),color=new Color(hex),values=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<values.length;i+=3){const variation=.87+noise(Math.floor(i/36))* .24;values[i]=color.r*variation;values[i+1]=color.g*variation;values[i+2]=color.b*variation;}
    geometry.setAttribute('color',new Float32BufferAttribute(values,3));return geometry;
  };
  return {planter,wood:combine(wood),trellis,foliage:tint(foliage,'#487941'),light:tint(light,'#84a44d'),fruit:tint(fruit,habit===4?['#fff2c6','#d7e7ff','#efb0d4'][Math.abs(seed)%3]:habit===1?'#83914a':'#664568')};
}
