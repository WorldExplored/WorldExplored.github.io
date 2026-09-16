import test from 'node:test';
import assert from 'node:assert/strict';
import { createCirculationGraph, circulationPaths, STATION_ACCESS } from '../src/components/world/circulation';
import { createLandscapePlan, distanceToSegment, pathGeometry, terrainMeshHeight } from '../src/components/world/terrain';
import { cityBuildings, cityEntranceWorld, citySecondaryEntrances } from '../src/components/world/city';
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
  for (const id of ['research','about','about-conservatory','contact','purdue','garden-bridge-north','garden-bridge-south','purdue-bridge-west','purdue-bridge-east','main-dock-boarding']) assert.ok(walk.has(id), `Primary walking network misses ${id}`);
  assert.ok(!walk.has('city-dock-boarding'), 'Ferry crossing must not be mislabeled as a walk');
  for (const building of cityBuildings) {
    assert.ok(all.has(building.id), `City entrance ${building.id} is disconnected`);
    const expected = cityEntranceWorld(building), actual = nodes.get(building.id)!;
    assert.ok(Math.hypot(actual.x-expected.x,actual.z-expected.z)<1e-6 && Math.abs(actual.y!-expected.y)<1e-6, `${building.id}: graph does not terminate at actual architectural doorway`);
  }
  for (const id of ['city-dock-boarding','city-park','city-waterfront','station-bottom','station-lobby']) assert.ok(all.has(id), `Network misses ${id}`);
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

test('path top vertices and triangle interiors stay above final terrain, with grounded closed edges', () => {
  const failures: string[] = [];
  for (const path of circulationPaths().filter(p=>!p.bridge)) {
    const mesh = pathGeometry([path]);
    assert.ok(Number.isInteger(mesh.userData.surfaceVertexCount) && Number.isInteger(mesh.userData.rowStride) && mesh.userData.rowStride >= 3, 'Path geometry must identify its top surface layout');
    try {
      const positions=mesh.attributes.position, topCount=mesh.userData.surfaceVertexCount as number, indices=mesh.index!;
      for(let i=0;i<topCount;i++) {
        const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),height=terrainMeshHeight(x,z);
        if(y<height+.039)failures.push(`${path.id} top vertex ${i} buried: ${y-height}`);
      }
      for(let i=0;i<indices.count;i+=3) {
        const ids=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)]; if(ids.some(id=>id>=topCount))continue;
        // Centroid and edge midpoint sampling catches a hill poking through a face
        // even when its perimeter vertices individually clear the ground.
        for(const weights of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]) {
          const x=ids.reduce((n,id,k)=>n+positions.getX(id)*weights[k],0),y=ids.reduce((n,id,k)=>n+positions.getY(id)*weights[k],0),z=ids.reduce((n,id,k)=>n+positions.getZ(id)*weights[k],0);
          if(y-terrainMeshHeight(x,z)<.008)failures.push(`${path.id} triangle ${i/3} intersects terrain at ${x},${z}`);
        }
      }
      for(let i=topCount;i<positions.count;i++) assert.ok(Math.abs(positions.getY(i)-(terrainMeshHeight(positions.getX(i),positions.getZ(i))-.025))<1e-5, `${path.id}: ramp side does not reach ground`);
    } finally { mesh.dispose(); }
  }
  assert.equal(failures.length,0,failures.slice(0,16).join('\n'));
});

test('all raised route endpoints meet their thresholds across the full path width', () => {
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
  // Rounded thresholds include their .02 bevel; tolerance admits that small bevel.
  const expected: Record<string,number>={work:1.105,research:1.07,purdue:1.03,about:1.06,'about-conservatory':1.06,contact:1.06,building:2.93};
  for(const [id,y] of Object.entries(expected)) {
    const node=createCirculationGraph().nodes.find(n=>n.id===id)!;
    assert.ok(Math.abs(node.y!-y)<.025, `${id}: path endpoint y=${node.y} differs from modeled threshold top ${y}`);
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
