import { BRIDGES, bridgeHeightAt } from '../src/components/world/bridgePlan';
import { createBridges } from '../src/components/world/Bridges';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { create } from '@react-three/test-renderer';
import { ComputeBuilding } from '../src/components/world/ComputeBuilding';
import { ResearchInstitute } from '../src/components/world/ResearchInstitute';
import { CampusHall } from '../src/components/world/CampusHall';
import { GardenGallery } from '../src/components/world/GardenGallery';
import { ReceptionTerminal } from '../src/components/world/ReceptionTerminal';
import { ExperienceStudio, HistoryMuseum } from '../src/components/world/CivicLandmarks';
import { createSceneRuntime, world } from '../src/content/world';
import { buildCityArchitecture } from '../src/components/world/CityArchitecture';
import { createCirculationGraph, circulationPaths, STATION_ACCESS } from '../src/components/world/circulation';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { archipelagoGeometry, groundRouteAt, terrainHeight, createLandscapePlan, distanceToSegment, pathGeometry, terrainMeshHeight } from '../src/components/world/terrain';
import { cityBuildings, cityEntranceWorld, citySecondaryEntrances, cityLocalToWorld } from '../src/components/world/city';
import { stationAccessPlan } from '../src/components/world/StationAccess';

function reachable(start: string, boat: boolean) {
  const graph = createCirculationGraph(), reached = new Set([start]), queue = [start];
  while (queue.length) {
    const id = queue.shift()!;
    for (const edge of graph.edges) {
      if (!boat && edge.mode === 'boat') continue;
      const next = edge.from === id ? edge.to : edge.to === id ? edge.from : undefined;
      if (next && !reached.has(next)) { reached.add(next); queue.push(next); }
    }
  }
  return reached;
}

test('all primary and city entrances connect through actual bridge, dock and ferry graph edges', () => {
  const graph = createCirculationGraph();
  assert.equal(new Set(graph.nodes.map(n => n.id)).size, graph.nodes.length, 'Node IDs must be unique');
  assert.equal(new Set(graph.edges.map(e => e.id)).size, graph.edges.length, 'Edge IDs must be unique');
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  for (const edge of graph.edges) {
    const a = nodes.get(edge.from), b = nodes.get(edge.to);
    assert.ok(a && b, `${edge.id}: missing graph endpoint`);
    assert.ok(Math.hypot(edge.points[0].x-a.x,edge.points[0].z-a.z)<1e-5, `${edge.id}: rendered start does not match connected node`);
    assert.ok(Math.hypot(edge.points.at(-1)!.x-b.x,edge.points.at(-1)!.z-b.z)<1e-5, `${edge.id}: rendered end does not match connected node`);
  }
  const walk = reachable('work', false), all = reachable('work', true);
  for (const id of ['experience','research','about','about-conservatory','contact','purdue','garden-bridge-north','garden-bridge-south','purdue-bridge-west','purdue-bridge-east','main-dock-boarding']) assert.ok(walk.has(id), `Primary walking network misses ${id}`);
  assert.ok(!walk.has('city-dock-boarding'), 'Ferry crossing must not be mislabeled as a walk');
  for (const building of cityBuildings) {
    assert.ok(all.has(building.id), `City entrance ${building.id} is disconnected`);
    const expected = cityEntranceWorld(building), actual = nodes.get(building.id)!;
    assert.ok(Math.hypot(actual.x-expected.x,actual.z-expected.z)<1e-6 && Math.abs(actual.y!-expected.y)<1e-6, `${building.id}: graph does not terminate at actual architectural doorway`);
  }
  for (const id of ['history','history-court','city-dock-boarding','city-park','city-waterfront','station-bottom','station-lobby']) assert.ok(all.has(id), `Network misses ${id}`);
  const secondary = citySecondaryEntrances[0].world, lobby = nodes.get('station-lobby')!;
  assert.ok(Math.hypot(lobby.x-secondary[0],lobby.z-secondary[2])<1e-6 && Math.abs(lobby.y!-secondary[1])<1e-6);
  assert.deepEqual([...reachable('building', false)].sort(), ['beacon-court','beacon-overlook','building']);
});

test('station graph meets measured ground landing and actual upper platform', () => {
  const graph = createCirculationGraph(), stairs = graph.edges.find(e => e.id === 'station-stairs')!, plan = stationAccessPlan();
  assert.equal(stairs.mode, 'stair');
  const lower = graph.nodes.find(n => n.id === stairs.from)!, upper = graph.nodes.find(n => n.id === stairs.to)!;
  assert.ok(Math.hypot(lower.x-plan.bottom.x,lower.z-plan.bottom.z)<1e-6 && Math.abs(lower.y!-plan.bottom.y)<1e-6);
  assert.ok(Math.hypot(upper.x-plan.top.x,upper.z-plan.top.z)<1e-6 && Math.abs(upper.y!-plan.top.y)<1e-6);
  assert.equal(STATION_ACCESS.platformY,plan.top.y);
  assert.equal(STATION_ACCESS.platformZ,plan.top.z);
  const approach = circulationPaths().find(p => p.id === 'station-approach')!;
  const mesh = pathGeometry([approach]);
  try {
    const positions = mesh.attributes.position, stride = mesh.userData.rowStride as number, rows = mesh.userData.surfaceVertexCount / stride;
    for(let across=0;across<stride;across++) assert.ok(Math.abs(positions.getY((rows-1)*stride+across)-plan.bottom.y)<.005, 'Station ground path and landing must touch across their full width');
  } finally { mesh.dispose(); }
});

test('paved routes are samples of one rendered ground mesh, without floating ribbons or side caps', () => {
  const material=new MeshBasicMaterial({side:DoubleSide}),ground=new Mesh(archipelagoGeometry(),material);
  ground.updateMatrixWorld();const bridges=createBridges();bridges.root.updateMatrixWorld(true);const decks=bridges.root.children.filter(mesh=>mesh.name.endsWith('-deck'));decks.forEach(deck=>{deck.raycast=Mesh.prototype.raycast;});const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
  try {
    for(const path of circulationPaths().filter(p=>!p.bridge)) {
      const sample=pathGeometry([path]);
      try {
        assert.equal(sample.userData.auditOnly,true,'Route geometry is an audit proxy, not a raised surface');
        assert.equal(sample.userData.surfaceVertexCount,sample.attributes.position.count,'No detached side walls remain');
        assert.ok(Number.isInteger(sample.userData.rowStride)&&sample.userData.rowStride>=3);
        const p=sample.attributes.position;
        for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-terrainMeshHeight(p.getX(i),p.getZ(i)))<.00002,`${path.id}: route sample floats above or below its ground`);
        // Read actual final terrain triangles, including each doorway edge and
        // interior route samples. Proxy triangles are deliberately not rendered.
        const stride=sample.userData.rowStride as number;
        const samples=new Set<number>([...Array.from({length:stride},(_,i)=>i),...Array.from({length:stride},(_,i)=>p.count-stride+i)]);
        for(let i=0;i<p.count;i+=Math.max(stride,Math.floor(p.count/5/stride)*stride))samples.add(i+Math.floor(stride/2));
        for(const i of samples){
          ray.ray.origin.set(p.getX(i),30,p.getZ(i));const hit=ray.intersectObjects([ground,...decks],false)[0];
          const bridge=hit&&BRIDGES.find(bridge=>hit.object.name===`bridge-${bridge.id}-deck`);
          const expected=bridge?bridgeHeightAt(bridge,p.getX(i),p.getZ(i)):p.getY(i);
          assert.ok(hit&&Math.abs(hit.point.y-expected)<(bridge?.001:.00003),`${path.id}: rendered ground differs from route at vertex ${i}`);
        }
      }finally{sample.dispose();}
    }
  }finally{bridges.dispose();ground.geometry.dispose();material.dispose();}
});

test('route unions grade continuously across segment and junction boundaries',()=>{
  for(const path of circulationPaths().filter(p=>!p.bridge))for(let i=0;i<path.points.length;i+=3){
    const p=path.points[i];
    for(const [dx,dz] of [[.0001,0],[0,.0001],[.0001,.0001]]){
      const difference=Math.abs(terrainHeight(p.x+dx,p.z+dz)-terrainHeight(p.x-dx,p.z-dz));
      assert.ok(difference<.005,`${path.id}: grade discontinuity ${difference} at ${p.x},${p.z}`);
    }
  }
});

test('all graded route endpoints meet their thresholds across the full path width', () => {
  const paths=circulationPaths().filter(p=>!p.bridge);
  for(const path of paths) {
    const mesh=pathGeometry([path]);
    try {
      const positions=mesh.attributes.position,stride=mesh.userData.rowStride as number,rows=mesh.userData.surfaceVertexCount/stride;
      for(const [row,height] of [[0,path.startY],[rows-1,path.endY]]) if(height!==undefined) {
        for(let across=0;across<stride;across++) assert.ok(Math.abs(positions.getY(row!*stride+across)-height)<.005, `${path.id}: threshold edge is not level at ${across}`);
      }
    } finally { mesh.dispose(); }
  }
  // Architectural threshold surfaces, not the centre of the corresponding boxes.
  // Surface height includes rounded trim; graded approach must meet within 5mm.
  const expected: Record<string,number>={work:1.105,experience:1.07,research:1.07,purdue:1.03,history:1.07,about:1.06,'about-conservatory':1.06,contact:1.06,building:2.86};
  for(const [id,y] of Object.entries(expected)) {
    const node=createCirculationGraph().nodes.find(n=>n.id===id)!;
    assert.ok(Math.abs(node.y!-y)<.005, `${id}: path endpoint y=${node.y} differs from modeled threshold top ${y}`);
  }
});

test('walking corridors clear landscape rocks, trees, and other rotated city foundations', () => {
  const plan=createLandscapePlan(), failures:string[]=[];
  for(const path of circulationPaths().filter(p=>!p.bridge)) {
    for(const obstacle of [...plan.rocks,...plan.trees]) {
      let distance=Infinity;
      for(let i=1;i<path.points.length;i++)distance=Math.min(distance,distanceToSegment(obstacle.x,obstacle.z,path.points[i-1],path.points[i]));
      if(distance<obstacle.radius+path.width/2+.05) failures.push(`${path.id} intersects ${obstacle.id}`);
    }
    const geometry=pathGeometry([path]);
    try {
      const p=geometry.attributes.position,topCount=geometry.userData.surfaceVertexCount as number;
      for(const building of cityBuildings) {
        // Only that building's own measured doorway crossing is exempt.
        if(path.id===`${building.id}-threshold` || (building.id==='transit-garden'&&path.id==='station-lobby-threshold'))continue;
        const c=Math.cos(building.rotation),s=Math.sin(building.rotation);
        for(let i=0;i<topCount;i++) {
          const dx=p.getX(i)-building.x,dz=p.getZ(i)-building.z,lx=dx*c-dz*s,lz=dx*s+dz*c;
          if(Math.abs(lx)<building.width/2+.24 && Math.abs(lz)<building.depth/2+.24) {failures.push(`${path.id} top vertex ${i} enters rotated ${building.id} foundation`);break;}
        }
      }
    } finally { geometry.dispose(); }
  }
  assert.equal(failures.length,0,failures.join('\n'));
});

test('narrow gallery path clears the complete sculpture sweep, bench, and planted court furniture', () => {
  const path=circulationPaths().find(p=>p.id==='gallery-entrance')!;
  assert.ok(path.width<=.65);
  const geometry=pathGeometry([path]);
  try {
    const p=geometry.attributes.position,topCount=geometry.userData.surfaceVertexCount as number;
    for(let i=0;i<topCount;i++) {
      const x=p.getX(i)+10,z=p.getZ(i)-23;
      assert.ok(Math.hypot(x,z)>.915+.05, `Gallery route intrudes on sculpture sweep at ${x},${z}`);
      assert.ok(!(x>1.81&&x<2.34&&z>-.24&&z<.94), `Gallery route intersects court bench at ${x},${z}`);
      assert.ok(!(x>1.49&&x<2.23&&z>1.09&&z<1.88), `Gallery route intersects court planter at ${x},${z}`);
    }
  } finally { geometry.dispose(); }
});


test('graded ground supports actual foundations and stays below finished floors',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const samples=(positions:{getX:(i:number)=>number;getY:(i:number)=>number;getZ:(i:number)=>number},ids:number[],top:number,worldPoint:(x:number,y:number,z:number)=>readonly number[],name:string,bearing=false)=>{
    for(let offset=0;offset<ids.length;offset+=3){
      const triangle=ids.slice(offset,offset+3);if(triangle.length<3||triangle.some(i=>Math.abs(positions.getY(i)-top)>.0001))continue;
      for(let row=0;row<=4;row++)for(let column=0;column<=4-row;column++){
        const weights=[row/4,column/4,1-(row+column)/4];
        const x=triangle.reduce((sum,i,k)=>sum+positions.getX(i)*weights[k],0),z=triangle.reduce((sum,i,k)=>sum+positions.getZ(i)*weights[k],0),p=worldPoint(x,top,z);
        const ground=terrainMeshHeight(p[0],p[2]);
        if(bearing)assert.ok(ground>=p[1]-.001,`${name}: foundation unsupported by ${p[1]-ground} at ${p[0]},${p[2]}`);
        else assert.ok(ground<p[1]-.0001,`${name}: graded terrain rises through finished floor at ${p[0]},${p[2]}`);
      }
    }
  };
  for(const [id,Component]of Object.entries({work:ComputeBuilding,experience:ExperienceStudio,research:ResearchInstitute,purdue:CampusHall,history:HistoryMuseum,about:GardenGallery,contact:ReceptionTerminal})){
    const renderer=await create(createElement(Component,{active:false,paused:true,quality:'high',runtime:{current:createSceneRuntime()}}));
    try{
      const landmark=world.landmarks.find(l=>l.id===id)!,c=Math.cos(landmark.rotationY??0),s=Math.sin(landmark.rotationY??0);
      for(const node of renderer.scene.findAll(n=>n.instance.type==='Mesh')){
        const geometry=(node.instance as Mesh).geometry,positions=geometry.attributes.position;
        if(geometry.userData.floor?.kind==='foundation'){
          const ids=Array.from({length:geometry.index?.count??positions.count},(_,i)=>geometry.index?geometry.index.getX(i):i),bottom=Math.min(...ids.map(i=>positions.getY(i)));
          samples(positions,ids,bottom,(x,y,z)=>[landmark.position[0]+x*c+z*s,landmark.position[1]+y,landmark.position[2]-x*s+z*c],geometry.userData.floor.name,true);
        }
        for(const part of geometry.userData.floors??[]){
          const ids=Array.from({length:part.count},(_,i)=>part.start+i),top=Math.max(...ids.map(i=>positions.getY(i)));if(top>1.6)continue;
          samples(positions,ids,top,(x,y,z)=>[landmark.position[0]+x*c+z*s,landmark.position[1]+y,landmark.position[2]-x*s+z*c],part.name);
        }
      }
    }finally{await renderer.unmount();}
  }
  for(const building of cityBuildings)buildCityArchitecture(building,(geometry,_finish,x=0,y=0,z=0,sx=1,sy=1,sz=1,yaw=0)=>{
    try{
      const kind=geometry.userData.floor?.kind;if(kind!=='floor'&&kind!=='foundation')return;
      geometry.scale(sx,sy,sz).rotateY(yaw).translate(x,y,z);geometry.computeBoundingBox();const top=kind==='foundation'?geometry.boundingBox!.min.y:geometry.boundingBox!.max.y;if(top>.35)return;
      const ids=Array.from({length:geometry.index?.count??geometry.attributes.position.count},(_,i)=>geometry.index?geometry.index.getX(i):i);
      samples(geometry.attributes.position,ids,top,(px,py,pz)=>cityLocalToWorld(building,[px,py,pz]),geometry.userData.floor.name,kind==='foundation');
    }finally{geometry.dispose();}
  });
});


test('history approaches stay outside its complete rotated foundation and meet its front threshold',()=>{
  const museum=world.landmarks.find(item=>item.id==='history')!,angle=museum.rotationY??0,c=Math.cos(angle),s=Math.sin(angle);
  const paths=circulationPaths().filter(path=>path.id?.startsWith('history-'));
  for(const path of paths){
    const geometry=pathGeometry([path]);
    try{
      const p=geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        const dx=p.getX(i)-museum.position[0],dz=p.getZ(i)-museum.position[2],x=dx*c-dz*s,z=dx*s+dz*c;
        assert.ok(Math.abs(x)>=5.6||Math.abs(z)>=3.85,`${path.id} cuts beneath museum at ${x},${z}`);
      }
    }finally{geometry.dispose();}
  }
  const entry=createCirculationGraph().nodes.find(n=>n.id==='history')!;
  const dx=entry.x-museum.position[0],dz=entry.z-museum.position[2];
  assert.ok(Math.abs(dx*c-dz*s)<1e-6&&Math.abs(dx*s+dz*c-4.17)<1e-6,'Approach meets actual front edge of threshold');
});

test('rendered paving stays continuous on narrow walks and never bleeds through foundations',()=>{
  const geometry=archipelagoGeometry(),position=geometry.attributes.position,paving=geometry.attributes.aPaving,index=geometry.index!;
  const cells=new Map<string,number[]>();
  for(let offset=0;offset<index.count;offset+=3){
    const ids=[index.getX(offset),index.getX(offset+1),index.getX(offset+2)],xs=ids.map(i=>position.getX(i)),zs=ids.map(i=>position.getZ(i));
    for(let z=Math.floor(Math.min(...zs));z<=Math.floor(Math.max(...zs));z++)for(let x=Math.floor(Math.min(...xs));x<=Math.floor(Math.max(...xs));x++){
      const key=`${x},${z}`,cell=cells.get(key)??[];if(!cells.has(key))cells.set(key,cell);cell.push(offset);
    }
  }
  // Interpolate the shader's actual indexed vertex attribute, not a ribbon proxy
  // or the analytic route field that originally hid missing paving pixels.
  const renderedDistance=(x:number,z:number)=>{
    for(const offset of cells.get(`${Math.floor(x)},${Math.floor(z)}`)??[]){
      const a=index.getX(offset),b=index.getX(offset+1),c=index.getX(offset+2);
      const ax=position.getX(a),az=position.getZ(a),bx=position.getX(b),bz=position.getZ(b),cx=position.getX(c),cz=position.getZ(c);
      const denominator=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(denominator)<1e-10)continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/denominator,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/denominator,w=1-u-v;
      if(Math.min(u,v,w)>=-.00001)return u*paving.getX(a)+v*paving.getX(b)+w*paving.getX(c);
    }
    throw new Error(`Missing rendered ground at ${x},${z}`);
  };
  try{
    for(const path of circulationPaths().filter(p=>!p.bridge))for(const point of path.points){
      if(groundRouteAt(point.x,point.z).distance>-.08)continue; // covered doorway floor
      assert.ok(renderedDistance(point.x,point.z)<-.035,`${path.id}: broken rendered paving at ${point.x},${point.z}`);
    }
    const museum=world.landmarks.find(item=>item.id==='history')!,angle=museum.rotationY??0;
    for(let z=-3.6;z<=3.6;z+=.3)for(let x=-5.4;x<=5.4;x+=.3){
      const wx=museum.position[0]+x*Math.cos(angle)+z*Math.sin(angle),wz=museum.position[2]-x*Math.sin(angle)+z*Math.cos(angle);
      assert.ok(renderedDistance(wx,wz)>.02,'Paving spills into the museum interior');
    }
    for(const building of cityBuildings){
      const [x,,z]=cityLocalToWorld(building,[0,0,building.depth/2-.1]);
      assert.ok(renderedDistance(x,z)>.02,`${building.id}: rounded route cap shows through its entrance floor`);
    }
  }finally{geometry.dispose();}
});


test('main island walking surfaces limit longitudinal grades and crossfall across their full rendered width',()=>{
  let maximumGrade=0,maximumCrossfall=0,samples=0;
  for(const path of circulationPaths().filter(path=>!path.bridge&&path.points[0].x>-45&&path.points[0].x<18&&path.points[0].z>-25&&path.points[0].z<12)) {
    for(let i=1;i<path.points.length;i++) {
      const a=path.points[i-1],b=path.points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<.0001)continue;
      for(const t of [0,.25,.5,.75]) {
        const x=a.x+dx*t,z=a.z+dz*t;
        for(const cross of [-.5,-.25,0,.25,.5]) {
          const px=x+dz/length*path.width*cross,pz=z-dx/length*path.width*cross,height=terrainMeshHeight(px,pz);
          const slope=Math.abs(terrainMeshHeight(px+dx/length*.05,pz+dz/length*.05)-terrainMeshHeight(px-dx/length*.05,pz-dz/length*.05))/.1;
          maximumGrade=Math.max(maximumGrade,slope);samples++;
          assert.ok(height>=.83&&height<=1.11,`${path.id}: hill or hole in the walking surface ${height}`);
          assert.ok(slope<.085,`${path.id}: rendered longitudinal grade ${slope}`);
        }
        const crossfall=Math.abs(terrainMeshHeight(x+dz/length*path.width/2,z-dx/length*path.width/2)-terrainMeshHeight(x-dz/length*path.width/2,z+dx/length*path.width/2))/path.width;
        maximumCrossfall=Math.max(maximumCrossfall,crossfall);assert.ok(crossfall<.075,`${path.id}: excessive crossfall ${crossfall}`);
      }
    }
  }
  assert.ok(samples>4000);console.log({maximumGrade,maximumCrossfall,mainPathSamples:samples});
});
