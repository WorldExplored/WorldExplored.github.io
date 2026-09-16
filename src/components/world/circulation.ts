import cityStreetRoutes from './cityStreetRoutes.json';
import { BRIDGES } from './bridgePlan';
import { cityBuildings, cityEntranceWorld, citySecondaryEntrances } from './city';
import { landDistance, type LandscapePath, type PathPoint } from './terrain';

export interface CirculationNode extends PathPoint { id: string; y?: number; kind: 'entrance' | 'junction' | 'landing' | 'park' | 'dock' }
export interface CirculationEdge extends LandscapePath { id: string; from: string; to: string; mode: 'walk' | 'bridge' | 'stair' | 'dock' | 'boat' }
import { STATION_ACCESS, stationAccessPlan } from './stationPlan';
export { STATION_ACCESS } from './stationPlan';

function cityGroundClear(x: number, z: number, margin: number) {
  if (landDistance(x,z) < 1.9) return false;
  if (Math.hypot(x - 21, z + 72) < 6.25 + margin) return false;
  for (const b of cityBuildings) {
    const dx=x-b.x,dz=z-b.z,c=Math.cos(b.rotation),s=Math.sin(b.rotation);
    const lx=dx*c-dz*s,lz=dx*s+dz*c;
    if (Math.abs(lx)<b.width/2+.24+margin && Math.abs(lz)<b.depth/2+.24+margin) return false;
  }
  if (Math.hypot(x+16.2,z+70)<1.18+margin) return false;
  if (Math.abs(x-STATION_ACCESS.x)<STATION_ACCESS.width/2+margin && z>STATION_ACCESS.bottomZ+.15 && z<STATION_ACCESS.platformZ) return false;
  return true;
}
function clearLine(a: PathPoint,b: PathPoint,margin:number) {
  const steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.14);
  for(let i=0;i<=steps;i++)if(!cityGroundClear(a.x+(b.x-a.x)*i/Math.max(1,steps),a.z+(b.z-a.z)*i/Math.max(1,steps),margin))return false;
  return true;
}

/** Route streets around final rotated foundations, then remove unnecessary grid bends. */
export function routeCityWalk(start: PathPoint,end: PathPoint,width=.95): PathPoint[] {
  const step=.4, margin=width/2+.05;
  // Authored street waypoints avoid repeating A* during startup; validate against current buildings.
  const prepared=(cityStreetRoutes as Record<string,PathPoint[]>)[JSON.stringify([start.x,start.z,end.x,end.z,width])];
  if(prepared&&prepared.slice(1).every((point,i)=>clearLine(prepared[i],point,margin)))return prepared.map(p=>({...p}));
  const key=(x:number,z:number)=>`${x},${z}`;
  const nearest=(p:PathPoint)=>{
    let best:PathPoint|undefined,distance=Infinity;
    for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){
      const x=Math.round(p.x/step)+dx,z=Math.round(p.z/step)+dz,q={x:x*step,z:z*step};
      const d=Math.hypot(q.x-p.x,q.z-p.z);
      if(d<distance&&cityGroundClear(q.x,q.z,margin)&&clearLine(p,q,margin)){best={x,z};distance=d;}
    }
    if(!best)throw new Error(`No clear city street node near ${p.x}, ${p.z}`);return best;
  };
  const a=nearest(start),b=nearest(end),goal=key(b.x,b.z),first=key(a.x,a.z);
  const open=new Set([first]),scores=new Map([[first,0]]),previous=new Map<string,string>(),coords=new Map([[first,a]]);
  let reached=false;
  for(let iteration=0;open.size&&iteration<25000;iteration++){
    let current='',best=Infinity;
    for(const k of open){const p=coords.get(k)!,f=scores.get(k)!+Math.hypot(p.x-b.x,p.z-b.z);if(f<best){best=f;current=k;}}
    if(current===goal){reached=true;break;}open.delete(current);const p=coords.get(current)!;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const q={x:p.x+dx,z:p.z+dz};if(q.x<-87||q.x>48||q.z<-238||q.z>-150)continue;
      const k=key(q.x,q.z);if(!clearLine({x:p.x*step,z:p.z*step},{x:q.x*step,z:q.z*step},margin))continue;
      const cost=scores.get(current)!+Math.hypot(dx,dz);
      if(cost>=(scores.get(k)??Infinity))continue;
      scores.set(k,cost);previous.set(k,current);coords.set(k,q);open.add(k);
    }
  }
  if(!reached)throw new Error(`City path is disconnected: ${start.x},${start.z} to ${end.x},${end.z}`);
  const path:PathPoint[]=[end];let k=goal;
  while(k!==first){const p=coords.get(k)!;path.push({x:p.x*step,z:p.z*step});k=previous.get(k)!;}
  path.push(start);path.reverse();const simplified=[path[0]];let i=0;
  while(i<path.length-1){let next=path.length-1;while(next>i+1&&!clearLine(path[i],path[next],margin))next--;simplified.push(path[next]);i=next;}
  return simplified;
}

let cached: { nodes: CirculationNode[]; edges: CirculationEdge[] } | undefined;
export function createCirculationGraph() {
  if(cached)return cached;
  const nodes:CirculationNode[]=[],edges:CirculationEdge[]=[];
  const node=(id:string,x:number,z:number,kind:CirculationNode['kind']='junction',y?:number)=>{const n={id,x,z,kind,y};nodes.push(n);return n;};
  const edge=(id:string,from:CirculationNode,to:CirculationNode,via:PathPoint[]=[],width=1.2,mode:CirculationEdge['mode']='walk')=>{
    const e:CirculationEdge={id,from:from.id,to:to.id,mode,width,points:[from,...via,to],startY:from.y,endY:to.y};edges.push(e);return e;
  };
  const work=node('work',-8,2.51,'entrance',1.105), research=node('research',2.67,-5.15,'entrance',1.07);
  const experience=node('experience',-26.62,1.18,'entrance',1.03);
  const west=node('main-west',-14.8,3.2),center=node('main-center',-5.5,5.4),lab=node('research-plaza',2.67,-3.75);
  const gardenNorth=node('garden-bridge-north',-6,7,'landing',.95), gardenSouth=node('garden-bridge-south',-6,18,'landing',1.4);
  const purdueWest=node('purdue-bridge-west',12,-7,'landing',.95),purdueEast=node('purdue-bridge-east',21.7,-7,'landing',.95);
  const purdue=node('purdue',24.28,-7,'entrance',1.03);
  const gallery=node('about',-8.805,21.86,'entrance',1.06),glasshouse=node('about-conservatory',-11.95,24.64,'entrance',1.06);
  const garden=node('garden-court',-5.5,24.1,'park'),contact=node('contact',12,24.95,'entrance',1.06);
  const mainDock=node('main-dock-land',-8,-18.5,'dock',1.06),mainBoat=node('main-dock-boarding',-8,-24.45,'dock',1.06);
  edge('work-entrance',work,center,[{x:-8,z:3.6}]);edge('main-west-walk',work,west,[{x:-9.6,z:4.3}]);
  edge('experience-entrance',experience,west,[{x:-22.5,z:2.9},{x:-18,z:3.2}],1.2);
  edge('main-lab-walk',center,lab,[{x:-1,z:3.2},{x:1,z:-2.6}]);edge('research-entrance',lab,research);
  edge('main-garden-approach',center,gardenNorth);edge('research-purdue-approach',lab,purdueWest,[{x:8.4,z:-3.8},{x:10.5,z:-5}]);
  edge('purdue-entrance',purdueEast,purdue,[],1.25);
  edge('garden-bridge-walk',gardenSouth,garden,[{x:-4,z:21.5}]);
  edge('gallery-entrance',gallery,garden,[{x:-8.625,z:22.3},{x:-8.625,z:23.65},{x:-9.05,z:24.15},{x:-9.2,z:25.65},{x:-6.75,z:25.65}],.65);
  edge('conservatory-entrance',glasshouse,garden,[{x:-11.95,z:26},{x:-7.8,z:26}]);
  edge('garden-spine',garden,contact,[{x:5,z:26},{x:12,z:25.6}],1.3);
  edge('main-harbor-walk',west,mainDock,[{x:-15.2,z:-6},{x:-13.5,z:-13.5},{x:-8,z:-16.6}],1.25);
  edge('main-dock',mainDock,mainBoat,[],1.1,'dock');
  for(const bridge of BRIDGES){const ends=bridge.id==='garden'?[gardenNorth,gardenSouth]:[purdueWest,purdueEast];const e=edge(`bridge-${bridge.id}`,ends[0],ends[1],[],bridge.width,'bridge');e.bridge=true;e.bridgeId=bridge.id;e.points=bridge.samples.map(p=>({x:p.point.x,z:p.point.z}));}
  const cityWest=node('city-west-street',-19.5,-74.7),cityCenter=node('city-center-street',-5,-74.2),cityEast=node('city-east-street',13,-72);
  const history=node('history',19.96,-68.4,'entrance',1.03),historyCourt=node('history-court',17.5,-69.2,'park');
  const waterfront=node('city-waterfront',-15.5,-65.4,'park'),cityDock=node('city-dock-land',-12,-65,'dock',1.06),cityBoat=node('city-dock-boarding',-12.7,-60,'dock',1.06);
  const hubs=[cityWest,cityCenter,cityEast,waterfront];
  for(const [a,b] of [[cityWest,cityCenter],[cityCenter,cityEast],[cityWest,waterfront],[waterfront,cityDock]]){const e=edge(`${a.id}-${b.id}`,a,b,[],1.05);e.points=routeCityWalk(a,b,1.05);}
  edge('history-threshold',history,historyCourt,[],1.35);
  edge('history-promenade',historyCourt,cityEast,[{x:16.2,z:-70},{x:14.5,z:-71.2}],1.35);
  const park=node('city-park',-16.2,-68.51,'park');const parkEdge=edge('city-park-walk',park,cityWest,[],.5);parkEdge.points=routeCityWalk(park,cityWest,.5);
  edge('fountain-plaza',park,park,Array.from({length:47},(_,i)=>({x:-16.2+Math.sin((i+1)/48*Math.PI*2)*1.49,z:-70+Math.cos((i+1)/48*Math.PI*2)*1.49})),.5);
  for(const building of cityBuildings){
    const entrance=cityEntranceWorld(building),n=node(building.id,entrance.x,entrance.z,'entrance',entrance.y);
    if(building.archetype==='transit-hall'){
      const bottom=node('station-bottom',STATION_ACCESS.x,STATION_ACCESS.bottomZ,'landing',stationBottomHeight());
      edge('station-approach',cityCenter,bottom,[],1.3);
      edge('station-stairs',bottom,n,[{x:STATION_ACCESS.x,z:STATION_ACCESS.topLandingZ}],1.3,'stair');continue;
    }
    const portal=node(`${building.id}-plaza`,n.x+Math.sin(building.rotation)*1.1,n.z+Math.cos(building.rotation)*1.1,'landing');
    edge(`${building.id}-threshold`,n,portal,[],1.05);
    const nearest=hubs.toSorted((a,b)=>Math.hypot(a.x-portal.x,a.z-portal.z)-Math.hypot(b.x-portal.x,b.z-portal.z))[0];
    const e=edge(`${building.id}-street`,portal,nearest,[],.95);e.points=routeCityWalk(portal,nearest);
  }
  for(const entry of citySecondaryEntrances){const [x,y,z]=entry.world;const n=node('station-lobby',x,z,'entrance',y),p=node('station-lobby-plaza',x+.65,z+2,'landing');edge('station-lobby-threshold',n,p,[{x:x+.65,z}],.8);const e=edge('station-lobby-walk',p,cityEast,[],.95);e.points=routeCityWalk(p,cityEast);}
  edge('city-dock',cityDock,cityBoat,[{x:-12,z:-60}],1.1,'dock');edge('water-taxi',mainBoat,cityBoat,[],1,'boat');
  const beacon=node('building',-76,-34.805,'entrance',2.86),beaconCourt=node('beacon-court',-74.1,-34,'park');
  const overlook=node('beacon-overlook',-73.5,-33.3,'park');
  edge('beacon-entrance',beacon,beaconCourt,[{x:-76,z:-33.9}],.85);edge('beacon-court-walk',beaconCourt,overlook,[],.85);
  cached={nodes,edges};return cached;
}

function roundedRoute(points: PathPoint[], city: boolean, tight: boolean) {
  if(points.length<3||tight)return points;
  const result:PathPoint[]=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],b=points[i],c=points[i+1];
    const ab=Math.hypot(b.x-a.x,b.z-a.z),bc=Math.hypot(c.x-b.x,c.z-b.z);
    let cut=Math.min(city?.42:.85,ab*.24,bc*.24);
    let arc:PathPoint[]=[];
    for(let attempt=0;attempt<4;attempt++){
      const p={x:b.x+(a.x-b.x)*cut/Math.max(.001,ab),z:b.z+(a.z-b.z)*cut/Math.max(.001,ab)};
      const q={x:b.x+(c.x-b.x)*cut/Math.max(.001,bc),z:b.z+(c.z-b.z)*cut/Math.max(.001,bc)};
      arc=Array.from({length:9},(_,j)=>{const t=j/8,u=1-t;return{x:u*u*p.x+2*u*t*b.x+t*t*q.x,z:u*u*p.z+2*u*t*b.z+t*t*q.z};});
      if(!city||arc.every(point=>cityGroundClear(point.x,point.z,.57)))break;
      cut*=.35;if(attempt===3)arc=[b];
    }
    result.push(...arc);
  }
  result.push(points.at(-1)!);return result;
}
let renderedPaths:LandscapePath[]|undefined;
export function circulationPaths(): LandscapePath[] {
  if(renderedPaths)return renderedPaths;
  renderedPaths=createCirculationGraph().edges.filter(edge=>edge.mode==='walk'||edge.mode==='bridge').map(edge=>{
    const points=roundedRoute(edge.points,edge.points[0].z< -50,edge.bridge||edge.id==='gallery-entrance'||edge.id==='fountain-plaza');
    return {...edge,points:points.flatMap((p,i)=>{if(i===points.length-1)return [{x:p.x,z:p.z}];const q=points[i+1],count=Math.max(1,Math.ceil(Math.hypot(q.x-p.x,q.z-p.z)/.35));return Array.from({length:count},(_,j)=>({x:p.x+(q.x-p.x)*j/count,z:p.z+(q.z-p.z)*j/count}));})};
  });return renderedPaths;
}
export function entranceRiseAt(path: LandscapePath,x:number,z:number,base:number) {
  let height=base;
  for(const end of [false,true]) {
    const points=path.points,p=points[end?points.length-1:0],q=points[end?Math.max(0,points.length-2):1],y=end?path.endY:path.startY;
    if(y===undefined||!q||Math.hypot(x-p.x,z-p.z)>2)continue;
    const dx=q.x-p.x,dz=q.z-p.z,length=Math.hypot(dx,dz);
    const distance=Math.max(0,((x-p.x)*dx+(z-p.z)*dz)/Math.max(.0001,length));
    const t=Math.max(0,1-Math.max(0,distance-.4)/1.15);
    height=Math.max(height,base+(y-base)*t*t*(3-2*t));
  }
  return height;
}
export function stationBottomHeight() { return stationAccessPlan().bottom.y; }
