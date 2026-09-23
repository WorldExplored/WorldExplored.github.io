import { architectureFootprints, type LandscapePath } from './terrain';
import { cityBuildings } from './city';
import { world } from '../../content/world';
import { BRIDGES } from './bridgePlan';
import { entranceRiseAt } from './circulation';

interface Segment { ax:number; az:number; bx:number; bz:number; ay:number; by:number; half:number; length2:number; main:boolean }
interface Landing { x:number; z:number; y:number; dx:number; dz:number; half:number; main:boolean }
interface RouteCell { segments:Segment[]; landings:Landing[] }
const smoothWeight=(distance:number,extent:number)=>{const t=Math.max(0,Math.min(1,1-Math.max(0,distance)/extent));return t*t*(3-2*t);};
/** One continuous grade field: intersecting routes share ground, and doorway planes
 * extend over the neighboring terrain vertices needed for a level mesh crossing. */
export function createGroundRoutes(paths: readonly LandscapePath[], baseHeight:(x:number,z:number)=>number) {
  const cells=new Map<string,RouteCell>();
  const isMain=(path:LandscapePath)=>!path.bridge&&!path.elevated&&path.points[0].x>-45&&path.points[0].x<18&&path.points[0].z>-25&&path.points[0].z<12;
  const mainPortals=paths.filter(isMain).flatMap(path=>[false,true].flatMap(end=>{
    const point=path.points[end?path.points.length-1:0],next=path.points[end?path.points.length-2:1],height=end?path.endY:path.startY;
    const length=Math.hypot(next.x-point.x,next.z-point.z);
    return height===undefined?[]:[{x:point.x,z:point.z,height:height-.002,dx:(next.x-point.x)/length,dz:(next.z-point.z)/length,half:path.width/2}];
  }));
  // Bounded-slope grade cones share each measured landing plane. Their maximum
  // remains continuous at every junction, with no inheritance of decorative hills.
  const mainGrade=(x:number,z:number)=>mainPortals.reduce((height,p)=>{
    const dx=x-p.x,dz=z-p.z,along=Math.abs(dx*p.dx+dz*p.dz-.05)-.68,across=Math.abs(-dx*p.dz+dz*p.dx)-p.half-.58;
    const distance=Math.hypot(Math.max(0,along),Math.max(0,across));
    const eased=distance-.20*(1-Math.exp(-distance/.20));
    return Math.max(height,p.height-.075*eased);
  },.84);
  const bearings=[...architectureFootprints(),...cityBuildings];
  const museum=world.landmarks.find(item=>item.id==='history')!;
  const pavingExclusions=[...cityBuildings.map(b=>({x:b.x,z:b.z,rotation:b.rotation,halfX:b.width/2+.24,halfZ:b.depth/2+.24})),
    {x:museum.position[0],z:museum.position[2],rotation:museum.rotationY??0,halfX:5.6,halfZ:3.85}];
  const bridgeApproaches=BRIDGES.flatMap(bridge=>[false,true].map(end=>{
    const p=bridge.samples[end?bridge.samples.length-1:0].point,q=bridge.samples[end?bridge.samples.length-2:1].point;
    const length=Math.hypot(q.x-p.x,q.z-p.z);return{x:p.x,z:p.z,dx:(q.x-p.x)/length,dz:(q.z-p.z)/length,half:bridge.width/2};
  }));
  const insert=(x0:number,z0:number,x1:number,z1:number,add:(cell:RouteCell)=>void)=>{
    for(let iz=Math.floor(z0/4);iz<=Math.floor(z1/4);iz++)for(let ix=Math.floor(x0/4);ix<=Math.floor(x1/4);ix++){
      const key=`${ix},${iz}`;let cell=cells.get(key);if(!cell){cell={segments:[],landings:[]};cells.set(key,cell);}add(cell);
    }
  };
  for(const path of paths.filter(p=>!p.bridge&&!p.elevated)) {
    for(let i=1;i<path.points.length;i++) {
      const a=path.points[i-1],b=path.points[i];
      const height=(x:number,z:number)=>entranceRiseAt(path,x,z,baseHeight(x,z));
      const segment={ax:a.x,az:a.z,bx:b.x,bz:b.z,ay:height(a.x,a.z),by:height(b.x,b.z),half:path.width/2,main:isMain(path),length2:(b.x-a.x)**2+(b.z-a.z)**2};
      const r=segment.half+(segment.main?10:1.25);
      insert(Math.min(a.x,b.x)-r,Math.min(a.z,b.z)-r,Math.max(a.x,b.x)+r,Math.max(a.z,b.z)+r,cell=>cell.segments.push(segment));
    }
    for(const end of [false,true]) {
      const p=path.points[end?path.points.length-1:0],q=path.points[end?path.points.length-2:1],y=end?path.endY:path.startY;
      if(y===undefined||!q)continue;
      const length=Math.hypot(q.x-p.x,q.z-p.z);if(length<.00001)continue;
      const landing={x:p.x,z:p.z,y,dx:(q.x-p.x)/length,dz:(q.z-p.z)/length,half:path.width/2,main:isMain(path)};
      const radius=landing.half+1.8;
      insert(p.x-radius,p.z-radius,p.x+radius,p.z+radius,cell=>cell.landings.push(landing));
    }
  }
  return (x:number,z:number)=>{
    let distance=100,weight=0,heightTotal=0,heightWeight=0,mainWeight=0;
    const base=baseHeight(x,z),cell=cells.get(`${Math.floor(x/4)},${Math.floor(z/4)}`),mainTarget=mainGrade(x,z),mainShoulder=Math.max(3.5,Math.min(9,Math.abs(base-mainTarget)/.20+2));
    if(cell)for(const s of cell.segments){
      const t=Math.max(0,Math.min(1,((x-s.ax)*(s.bx-s.ax)+(z-s.az)*(s.bz-s.az))/Math.max(.000001,s.length2)));
      const d=Math.hypot(x-s.ax-(s.bx-s.ax)*t,z-s.az-(s.bz-s.az)*t)-s.half;
      distance=Math.min(distance,d);
      const target=s.main?mainTarget:s.ay+(s.by-s.ay)*t;
      // A full-width level verge protects the walking mesh; broad shoulders ease
      // the surrounding hill into the path instead of carving a narrow trench.
      const influence=s.main?smoothWeight(d-.65,mainShoulder):smoothWeight(d,1.15);
      if(s.main)mainWeight=Math.max(mainWeight,influence);
      weight=Math.max(weight,influence);
      // Smooth weighting avoids a height seam where two nearest routes exchange.
      const contribution=influence**4;
      heightTotal+=target*contribution;heightWeight+=contribution;
    }
    let height=heightWeight?heightTotal/heightWeight:base;
    if(cell){
      let landingWeight=0,landingTotal=0,total=0;
      for(const p of cell.landings){
        if(p.main)continue;
        const dx=x-p.x,dz=z-p.z,along=dx*p.dx+dz*p.dz,across=-dx*p.dz+dz*p.dx;
        // A .4m grid cell may reach .566m beyond its sampled crossing point.
        const d=Math.max(Math.abs(across)-p.half-.58,Math.abs(along-.05)-.68);
        const influence=smoothWeight(d,.55);if(!influence)continue;
        landingWeight=Math.max(landingWeight,influence);const contribution=influence**8;
        // A 2mm reveal keeps terrain out of coplanar doorway flooring.
        landingTotal+=(p.y-.002)*contribution;total+=contribution;
      }
      if(total){const target=landingTotal/total;const graded=base+(height-base)*weight;height=graded+(target-graded)*landingWeight;weight=1;}
    }
    // Keep the approach grading on land: its rounded influence must not lift
    // seabed into the solid underside of the first/last bridge deck spans.
    let graded=base+(height-base)*weight;
    if(graded>base)for(const p of bridgeApproaches){
      const dx=x-p.x,dz=z-p.z,along=dx*p.dx+dz*p.dz,across=Math.abs(-dx*p.dz+dz*p.dx);
      if(along<=.85||along>3||across>p.half+1.1)continue;
      const acrossWeight=smoothWeight(across-p.half-.58,.52),retained=smoothWeight(along-.85,.4);
      graded=base+(graded-base)*(1-acrossWeight*(1-retained));
    }
    // Route cuts cannot excavate the existing architectural bearing planes.
    // Only downward grading is limited; level approaches may still rise.
    if(graded<base&&mainWeight<.999)for(const p of bearings){
      const support=smoothWeight(Math.hypot(x-p.x,z-p.z)-p.radius-.1,.6);
      graded+=(base-graded)*support;
    }
    // Stop paving at foundations, including rounded doorway endpoint caps.
    for(const p of pavingExclusions){
      const dx=x-p.x,dz=z-p.z,c=Math.cos(p.rotation),s=Math.sin(p.rotation);
      const ax=Math.abs(dx*c-dz*s)-p.halfX,az=Math.abs(dx*s+dz*c)-p.halfZ;
      const signed=Math.hypot(Math.max(0,ax),Math.max(0,az))+Math.min(0,Math.max(ax,az));
      distance=Math.max(distance,.025-signed);
    }
    return {distance,height:graded,weight:1};
  };
}
