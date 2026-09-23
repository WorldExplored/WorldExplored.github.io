import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide, Mesh, MeshBasicMaterial, Object3D, Raycaster, Vector3 } from 'three';
import { buildCityArchitecture, type CityFinish } from '../src/components/world/CityArchitecture';
import { CITY_BASE_Y, cityBuildings, cityEntranceLocal, cityEntranceWorld, cityRoofMounts, type CityBuilding } from '../src/components/world/city';

function fixture(building: Readonly<CityBuilding>) {
  const meshes: Mesh[] = []; const finishes: CityFinish[] = [];
  const matrix = new Object3D();
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const rooms = buildCityArchitecture(building, (geometry, finish, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rotation = 0) => {
    matrix.position.set(x, y, z); matrix.scale.set(sx, sy, sz); matrix.rotation.set(0, rotation, 0); matrix.updateMatrix();
    geometry.applyMatrix4(matrix.matrix); const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld(); meshes.push(mesh); finishes.push(finish);
  });
  return { meshes, finishes, rooms, dispose() { meshes.forEach(mesh => mesh.geometry.dispose()); material.dispose(); } };
}

test('thirteen distinct city families remain inside the original footprints and include room-scale detail', () => {
  assert.equal(cityBuildings.length, 13);
  assert.equal(new Set(cityBuildings.map(building => building.family)).size, 13);
  for (const building of cityBuildings) {
    const item = fixture(building);
    try {
      assert.ok(item.rooms.length >= 1, `${building.id} has a reachable room vignette`);
      assert.ok(item.finishes.includes('wood') && item.finishes.includes('fabric') && item.finishes.includes('metal'));
      for (const mesh of item.meshes) {
        const position = mesh.geometry.attributes.position;
        for (let n = 0; n < position.count; n++) {
          const [x, y, z] = [position.getX(n), position.getY(n), position.getZ(n)];
          assert.ok([x, y, z].every(Number.isFinite));
          assert.ok(Math.hypot(x, z) <= building.radius + .001, `${building.id} footprint`);
          assert.ok(y >= -.001 && y <= building.height + .001, `${building.id} height ${y}`);
        }
      }
    } finally { item.dispose(); }
  }
});

test('selected city windows reveal real occupied depth with no opaque facade backing', () => {
  const ray = new Raycaster();
  for (const building of cityBuildings) {
    const item = fixture(building);
    try {
      const opaque = item.meshes.filter((_, index) => item.finishes[index] !== 'window' && item.finishes[index] !== 'glass');
      const glazing = item.meshes.filter((_, index) => item.finishes[index] === 'window');
      for (const room of item.rooms) {
        assert.ok(room.depth >= 1 && room.width >= 1, `${building.id} furniture-scale room`);
        const origin = new Vector3(...room.window).add(new Vector3(0, 0, .5));
        ray.set(origin, new Vector3(origin.x, room.floor + .015, room.target[2]).sub(origin).normalize());
        const glass = ray.intersectObjects(glazing, false)[0];
        const interior = ray.intersectObjects(opaque, false)[0];
        assert.ok(glass && glass.distance < .8, `${building.id} visible transparent opening`);
        const wall=ray.intersectObjects(opaque.filter(mesh=>mesh.geometry.userData.roomWall),false)[0];
        assert.ok(!wall || wall.distance>glass.distance+.25,`${building.id} glazing cannot have an opaque wall pasted immediately behind it`);
        assert.ok(interior && interior.distance>glass.distance+.025,`${building.id} furniture remains behind glazing`);
        assert.ok(interior.distance < .5 + room.depth + .6, `${building.id} room has real rear geometry`);
        const inside = new Vector3(...room.target); inside.y = room.floor + 1.1;
        ray.set(inside, new Vector3(0, -1, 0));
        assert.ok(ray.intersectObjects(opaque, false).length > 0, `${building.id} occupied floor beneath room`);
      }
    } finally { item.dispose(); }
  }
});

test('adjacent buildings have different structural height profiles and facade depths', () => {
  const profiles = new Map<string, number[]>();
  for (const building of cityBuildings) {
    const item = fixture(building);
    try {
      const profile: number[] = [];
      // Scan actual roof/slab/wall geometry at world-scale height bands. Furniture cannot provide variety.
      for (let level = 0; level < 16; level++) {
        const low = .4 + level * .75; let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
        item.meshes.forEach((mesh, index) => {
          if (!['porcelain', 'stone', 'aqua', 'window'].includes(item.finishes[index])) return;
          const p = mesh.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) if (p.getY(i) >= low && p.getY(i) < low + .75) {
            minX = Math.min(minX, p.getX(i)); maxX = Math.max(maxX, p.getX(i)); minZ = Math.min(minZ, p.getZ(i)); maxZ = Math.max(maxZ, p.getZ(i));
          }
        });
        profile.push(Number.isFinite(minX) ? maxX - minX : 0, Number.isFinite(minZ) ? maxZ - minZ : 0);
      }
      profiles.set(building.id, profile);
    } finally { item.dispose(); }
  }
  let adjacent = 0;
  for (let i = 0; i < cityBuildings.length; i++) for (let j = i + 1; j < cityBuildings.length; j++) {
    const a = cityBuildings[i]; const b = cityBuildings[j];
    if (Math.hypot(a.x - b.x, a.z - b.z) > 12) continue;
    adjacent++;
    const difference = profiles.get(a.id)!.reduce((sum, width, index) => sum + Math.abs(width - profiles.get(b.id)![index]), 0);
    assert.ok(difference > 3.5, `${a.id} and ${b.id} repeat the same structural silhouette (${difference})`);
  }
  assert.ok(adjacent > 20);
});

test('entrances and equipment mounts are attached to actual thresholds and roofs', () => {
  const ray = new Raycaster();
  for (const building of cityBuildings) {
    const item = fixture(building);
    try {
      const local = cityEntranceLocal(building); const world = cityEntranceWorld(building);
      assert.ok(Math.abs(world.y - CITY_BASE_Y - local[1]) < 1e-9);
      // Sample a few centimeters inside the threshold edge to avoid the mathematical boundary.
      const inside = new Vector3(...local);
      if (building.family === 'public-station') inside.x -= .04; else inside.z -= .05;
      inside.y += .2; ray.set(inside, new Vector3(0, -1, 0));
      const floor = ray.intersectObjects(item.meshes, false)[0];
      assert.ok(floor && Math.abs(floor.point.y - local[1]) < .025, `${building.id} threshold touches a physical slab`);
      const mount = cityRoofMounts.find(value => value.building === building.id);
      if (mount) {
        ray.set(new Vector3(...mount.local).add(new Vector3(0, .1, 0)), new Vector3(0, -1, 0));
        const roof = ray.intersectObjects(item.meshes, false)[0];
        assert.ok(roof && Math.abs(roof.point.y - mount.local[1]) < .04, `${building.id} equipment mount reaches roof`);
      }
    } finally { item.dispose(); }
  }
});


test('station canopy provides full standing headroom across the boarding platform', () => {
  const building = cityBuildings.find(item => item.id === 'transit-garden')!;
  const item = fixture(building);
  try {
    const canopy = item.meshes.filter(mesh => { mesh.geometry.computeBoundingBox(); return mesh.geometry.boundingBox!.min.y > 4; });
    assert.equal(canopy.length, 1);
    const ray = new Raycaster(new Vector3(), new Vector3(0, 1, 0));
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 8; j++) {
      ray.ray.origin.set(-1.58 + i * 3.16 / 12, 2.32, -1.35 + j * 2.7 / 8);
      const roof = ray.intersectObjects(canopy, false)[0];
      assert.ok(roof && roof.distance >= 1.85, `Platform headroom ${roof?.distance}`);
    }
    // North stair portal and rail center both retain clear overhead space.
    for (const x of [0, 1.59]) {
      ray.ray.origin.set(x, 2.32, 0);
      assert.ok(ray.intersectObjects(canopy, false)[0].distance >= 1.85);
    }
  } finally { item.dispose(); }
});

test('every occupied upper floor connects to a served lift through a covered corridor and clear rear aperture', () => {
  let checked=0;
  for(const building of cityBuildings) {
    const plans: import('../src/components/world/CityArchitecture').CityLiftPlan[]=[],meshes:Mesh[]=[];
    const material=new MeshBasicMaterial({side:DoubleSide}),matrix=new Object3D();
    buildCityArchitecture(building,(geometry,_finish,x=0,y=0,z=0,sx=1,sy=1,sz=1,rotation=0)=>{
      matrix.position.set(x,y,z);matrix.scale.set(sx,sy,sz);matrix.rotation.set(0,rotation,0);matrix.updateMatrix();geometry.applyMatrix4(matrix.matrix);
      const mesh=new Mesh(geometry,material);mesh.updateMatrixWorld();meshes.push(mesh);
    },plan=>plans.push(plan));
    try {
      const floors=meshes.filter(mesh=>mesh.geometry.userData.roomAccess);
      for(const mesh of floors) {
        const room=mesh.geometry.userData.roomAccess;
        if(room.floor<.5)continue;
        checked++;
        const lift=plans.find(plan=>plan.floors.some(floor=>Math.abs(floor-room.floor)<1e-5));
        assert.ok(lift,`${room.room} has no served lift stop`);
        const cover=meshes.find(mesh=>mesh.geometry.userData.circulation?.rooms.includes(room.room));
        assert.ok(cover,`${room.room} lacks a covered connection to its lift`);
        const landing=meshes.find(mesh=>Math.abs((mesh.geometry.userData.liftLanding?.floor??Infinity)-room.floor)<1e-5)!;
        const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
        const galleryZ=lift.z+.70;
        for(let t=0;t<=1.0001;t+=.05) {
          // Shared wings join laterally first, then approach their inset rear door.
          ray.ray.origin.set(room.rear[0]*t,room.floor+.15,galleryZ);
          assert.ok(ray.intersectObject(landing).length,`${room.room}: transverse gallery gap`);
          ray.ray.origin.set(room.rear[0],room.floor+.15,galleryZ+(room.rear[1]-.055-galleryZ)*t);
          assert.ok(ray.intersectObject(landing).length,`${room.room}: rear corridor gap`);
        }
        // The rear route has a genuinely open aperture at standing height.
        ray.set(new Vector3(room.rear[0],room.floor+.65,room.rear[1]-.08),new Vector3(0,0,1));ray.far=.20;
        assert.equal(ray.intersectObjects(meshes).length,0,`${room.room}: blocked rear doorway`);
      }
    } finally {meshes.forEach(mesh=>mesh.geometry.dispose());material.dispose();}
  }
  assert.ok(checked>30,'All modeled upper rooms are audited, including both wings and conservatory');
});

test('balcony planting is integrated into reachable terraces and all room floors contain furnishings', () => {
  let balconies=0,occupied=0;
  for(const building of cityBuildings) {
    const geometries: import('three').BufferGeometry[]=[];
    buildCityArchitecture(building,geometry=>geometries.push(geometry));
    try {
      const rooms=geometries.filter(g=>g.userData.roomAccess);
      for(const room of rooms) {
        const access=room.userData.roomAccess;
        assert.ok(geometries.some(g=>Math.abs((g.userData.furniture?.floor??Infinity)-(access.floor+.015))<.025),`${access.room}: empty occupied floor`);
        occupied++;
      }
      for(const planter of geometries.filter(g=>g.userData.reachableGarden)) {
        const tag=planter.userData.reachableGarden;
        assert.ok(geometries.some(g=>g.userData.floor?.name===`${tag.room}-balcony`));
        assert.ok(rooms.some(g=>g.userData.roomAccess.room===tag.room));balconies++;
      }
    } finally {geometries.forEach(g=>g.dispose());}
  }
  assert.ok(balconies>=20 && occupied>=40);
});


test('continuous climbing gardens are rooted at ground with varied foliage and clear entrances', () => {
  let triangles = 0;
  for (const building of cityBuildings.filter(value => value.family !== 'public-station')) {
    const item = fixture(building);
    try {
      const gardens = item.meshes.filter(mesh => mesh.geometry.userData.facadeGarden);
      assert.equal(new Set(gardens.map(mesh => mesh.geometry.userData.facadeGarden.seed)).size, 2, `${building.id} has two continuous vines`);
      assert.ok(gardens.every(mesh => mesh.geometry.userData.facadeGarden.floor === 0));
      assert.equal(gardens.filter(mesh => mesh.geometry.userData.facadeGarden.role === 'trellis').length, 0, 'No repeated rectangular trellis panels');
      const foliage = gardens.filter(mesh => ['foliage', 'light'].includes(mesh.geometry.userData.facadeGarden.role));
      const min = Math.min(...foliage.map(mesh => { mesh.geometry.computeBoundingBox(); return mesh.geometry.boundingBox!.min.y; }));
      const max = Math.max(...foliage.map(mesh => mesh.geometry.boundingBox!.max.y));
      assert.ok(max - min > (building.height > 4 ? building.height * .48 : 1.15), `${building.id} climbers reach multiple facade levels`);
      assert.ok(gardens.some(mesh => mesh.geometry.userData.facadeGarden.role === 'fruit' && mesh.geometry.hasAttribute('color')));
      assert.ok(foliage.every(mesh => mesh.geometry.hasAttribute('color')), 'leaf colors share the original garden batch');
      const containers = gardens.filter(mesh => mesh.geometry.userData.facadeGarden.role === 'planter');
      assert.equal(containers.length, 2, 'One ground root per vine, no per-floor planters');
      for (const mesh of containers) {
        mesh.geometry.computeBoundingBox();
        assert.ok(Math.abs(mesh.geometry.boundingBox!.min.y - mesh.geometry.userData.facadeGarden.floor) < 1e-5, 'root mound starts at ground level');
      }
      for (const front of item.meshes.filter(mesh => mesh.geometry.userData.roomAccess)) {
        const room = front.geometry.userData.roomAccess;
        const ray = new Raycaster(new Vector3(room.front[0], room.floor + .7, room.front[1] + .6), new Vector3(0, 0, -1), 0, 1.0);
        assert.equal(ray.intersectObjects(gardens, false).length, 0, `${room.room} entrance remains clear of climbers`);
      }
      triangles += gardens.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
    } finally { item.dispose(); }
  }
  assert.ok(triangles < 180000, `climbing gardens use ${triangles} triangles`);
});


test('rounded occupied floors are enclosed at all angles except their usable door apertures', () => {
  const building=cityBuildings.find(value=>value.family==='rounded-housing')!,item=fixture(building);
  try {
    const rooms=item.meshes.filter(mesh=>mesh.geometry.userData.roomAccess);
    for(const [level,mesh] of rooms.entries()) {
      const room=mesh.geometry.userData.roomAccess;
      const shell=item.meshes.filter(part=>part.geometry.userData.roomWall?.room===room.room);
      const top=Math.max(...shell.map(part=>{part.geometry.computeBoundingBox();return part.geometry.boundingBox!.max.y;}));
      const rx=building.width/2-level*.08-.1,rz=building.depth/2-.33;
      for(const fraction of [.025,.3,.68,.975])for(let sample=0;sample<256;sample++) {
        const angle=sample*Math.PI*2/256,x=Math.sin(angle)*rx,z=Math.cos(angle)*rz,y=room.floor+(top-room.floor)*fraction;
        const frontDoor=level===0&&z>0&&Math.abs(x)<.42,backDoor=z<0&&Math.abs(x)<.36;
        if((frontDoor||backDoor)&&y<room.floor+room.height+.01)continue;
        const direction=new Vector3(x,0,z).normalize(),origin=new Vector3(x,y,z).addScaledVector(direction,.12);
        const ray=new Raycaster(origin,direction.negate(),0,.15);
        assert.ok(ray.intersectObjects(shell).length,`${room.room}: open wall at angle ${angle.toFixed(3)}, y ${y.toFixed(3)}`);
      }
    }
  } finally {item.dispose();}
});

test('rectangular curtain walls use thin recessed panes with joined floor edges', () => {
  for(const building of cityBuildings.filter(value=>value.family!=='rounded-housing')) {
    const item=fixture(building);
    try {
      for(const floor of item.meshes.filter(mesh=>mesh.geometry.userData.roomAccess)) {
        const room=floor.geometry.userData.roomAccess,walls=item.meshes.filter(mesh=>mesh.geometry.userData.roomWall?.room===room.room);
        const bounds=(role:string)=>{const mesh=walls.find(mesh=>mesh.geometry.userData.roomWall.role===role)!;mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox!;};
        const front=bounds('front'),left=bounds('left'),right=bounds('right'),rear=bounds('back-left');
        floor.geometry.computeBoundingBox();const slab=floor.geometry.boundingBox!;
        for(const difference of [slab.min.x-left.max.x,right.min.x-slab.max.x,slab.min.z-rear.max.z,front.min.z-slab.max.z])assert.ok(Math.abs(difference)<.001,`${room.room}: floor/wall join ${difference}`);
        for(const mesh of walls.filter(mesh=>item.finishes[item.meshes.indexOf(mesh)]==='window')) {
          const b=mesh.geometry.boundingBox??(mesh.geometry.computeBoundingBox(),mesh.geometry.boundingBox!);
          assert.ok(Math.min(b.max.x-b.min.x,b.max.z-b.min.z)<.019,`${room.room}: pane must have a single thin optical depth`);
        }
        assert.ok(front.max.z<room.front[1]-.005,`${room.room}: glass recessed behind front frame`);
        const top=Math.max(...walls.map(mesh=>{mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox!.max.y;}));
        for(const fraction of [.03,.5,.97])for(const t of [-.8,-.4,.4,.8]) {
          const y=room.floor+(top-room.floor)*fraction;
          for(const [x,z,dx,dz]of [[left.min.x-.08,(rear.min.z+front.max.z)/2+t*(front.max.z-rear.min.z)/2,1,0],[right.max.x+.08,(rear.min.z+front.max.z)/2+t*(front.max.z-rear.min.z)/2,-1,0]]) {
            const ray=new Raycaster(new Vector3(x,y,z),new Vector3(dx,0,dz),0,.13);
            assert.ok(ray.intersectObjects(walls).length,`${room.room}: side shell gap`);
          }
        }
      }
    } finally {item.dispose();}
  }
});

test('maisonette offset bears on grounded columns and its exposed lower roof is weather-covered',()=>{
  const building=cityBuildings.find(value=>value.family==='stacked-maisonettes')!,item=fixture(building);
  try {
    item.meshes.forEach(mesh=>mesh.geometry.computeBoundingBox());
    const columns=item.meshes.filter(mesh=>mesh.geometry.userData.structuralSupport?.role==='column'),beams=item.meshes.filter(mesh=>mesh.geometry.userData.structuralSupport?.role==='transfer-beam');
    const rooms=item.meshes.filter(mesh=>mesh.geometry.userData.roomAccess),lower=rooms[0].geometry.boundingBox!,upper=rooms[1].geometry.boundingBox!;
    assert.equal(columns.length,2);assert.equal(beams.length,2);
    for(const column of columns) {
      const b=column.geometry.boundingBox!,x=(b.min.x+b.max.x)/2,z=(b.min.z+b.max.z)/2;
      assert.ok(Math.abs(b.min.y)<1e-5,'Column reaches ground');
      const ray=new Raycaster(new Vector3(x,b.max.y-.001,z),new Vector3(0,1,0),0,.002);
      assert.ok(ray.intersectObjects(beams).length,'Column bears directly on transfer beam');
      const down=new Raycaster(new Vector3(x,.21,z),new Vector3(0,-1,0),0,.22);
      assert.ok(down.intersectObjects(item.meshes.filter(mesh=>mesh.geometry.userData.floor?.kind==='foundation')).length,'Column lands on foundation');
    }
    const weather=item.meshes.filter((mesh,index)=>!['garden','fabric'].includes(item.finishes[index])&&!mesh.geometry.userData.furniture&&!mesh.geometry.userData.facadeGarden);
    for(let x=lower.min.x+.047;x<lower.max.x;x+=.11)for(let z=lower.min.z+.047;z<lower.max.z;z+=.11) {
      const ray=new Raycaster(new Vector3(x,upper.max.y+.02,z),new Vector3(0,-1,0),0,.16);
      // Corner posts and wall strips fill the perimeter beside the inset finished floor.
      assert.ok(ray.intersectObjects(weather).length,`No open lower roof below offset upper room at ${x}, ${z}`);
    }
  } finally {item.dispose();}
});
