import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, DoubleSide, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { addGuidewayHardware } from '../src/components/world/CityGuideway';
import { createCityTransitRoute, CITY_TRACK_Y } from '../src/components/world/city';
import { FLIGHT_DURATION, FLIGHT_INTERVAL, makeSolarGlider, solarFlightPose } from '../src/components/world/SolarFlyover';
import { giantGrottoGeometry, makeMythicGrotto, mythicCrabPose } from '../src/components/world/MythicGrotto';
import { MYTHIC_GROTTO, mythicalCaveClearance, mythicalCaveFloor } from '../src/components/world/coastalCaveLayout';
import { archipelagoGeometry, landDistance, terrainMeshHeight } from '../src/components/world/terrain';
import { reefSeafloorGeometry } from '../src/components/world/ReefHabitatScene';
import { marineFloorHeight } from '../src/components/world/reefHabitat';

test('guideway service hardware leaves the tyre corridor and station platform unobstructed',()=>{
  let count=0,vertices=0;
  addGuidewayHardware(createCityTransitRoute(),geometry=>{
    geometry.computeBoundingBox();const box=geometry.boundingBox!;
    assert.ok(box.max.y<CITY_TRACK_Y-.1,'hardware remains below the train guide rollers');
    const closest=new Vector3();box.clampPoint(new Vector3(-5,CITY_TRACK_Y,-68),closest);
    assert.ok(Math.hypot(closest.x+5,closest.z+68)>2.8,'station boarding corridor remains open');
    assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
    count++;vertices+=geometry.attributes.position.count;geometry.dispose();
  });
  assert.ok(count>300&&vertices<25000,'track details merge into existing finish batches');
});

test('the occasional solar glider crosses the sky continuously and disappears beyond the world',()=>{
  assert.equal(solarFlightPose(149,12).visible,false);
  assert.equal(solarFlightPose(160,2).visible,false);
  for(let event=0;event<3;event++){
    const start=150+event*FLIGHT_INTERVAL;
    let previous=solarFlightPose(start,12);
    assert.ok(Math.abs(previous.x)>350);
    for(let t=.1;t<FLIGHT_DURATION;t+=.1){
      const pose=solarFlightPose(start+t,12);
      assert.ok(pose.visible&&pose.y>57);
      assert.ok(Math.hypot(pose.x-previous.x,pose.y-previous.y,pose.z-previous.z)<.66,'smooth 6.4 m/s crossing, no teleport in view');
      previous=pose;
    }
    assert.ok(Math.abs(previous.x)>350);
    assert.equal(solarFlightPose(start+FLIGHT_DURATION,12).visible,false);
  }
  const glider=makeSolarGlider(),bounds=new Box3().setFromObject(glider);
  assert.ok(bounds.max.x-bounds.min.x>17&&bounds.max.z-bounds.min.z>8);
  assert.equal(glider.children.length,4);
  glider.children.forEach(child=>{const mesh=child as Mesh;mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();});
});

test('the giant crab has a submerged roof, open entrance and a deep physical stone recess',()=>{
  const {root,body}=makeMythicGrotto();root.updateMatrixWorld(true);
  const bank=root.getObjectByName('sand-buried-angular-grotto') as Mesh;
  const bounds=new Box3().setFromObject(root),crabBounds=new Box3().setFromObject(body);
  assert.ok(bounds.max.y<-.5,'sand bank remains submerged');
  assert.ok(crabBounds.max.x-crabBounds.min.x>4&&crabBounds.max.x-crabBounds.min.x<5,'crab stays mythical without filling the entire cave mouth');
  assert.ok(mythicalCaveClearance(-55,-20)<-4&&mythicalCaveClearance(-35,-20)>0);
  const ray=new Raycaster(new Vector3(-55,MYTHIC_GROTTO.floor+1.5,-14),new Vector3(0,0,-1));
  const hit=ray.intersectObject(bank)[0];
  assert.ok(hit&&hit.distance>8,'no facade plane plugs the entrance before the recessed interior');
  const above=new Raycaster(new Vector3(-55,2,-22),new Vector3(0,-1,0));
  const roof=above.intersectObject(bank)[0],animal=above.intersectObject(body,true)[0];
  assert.ok(roof&&animal&&roof.distance<animal.distance,'roof conceals the resident from overhead views');
  let triangles=0;
  root.traverse(object=>{if(object instanceof Mesh){triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite));object.geometry.dispose();(object.material as MeshStandardMaterial).dispose();}});
  assert.ok(triangles<15000,'single rare habitat has a bounded mesh budget');
});


test('grotto roof and front have welded seams, with every open mesh edge buried in the real floor',()=>{
  const geometry=giantGrottoGeometry(),positions=geometry.getAttribute('position'),indices=geometry.index!,edges=new Map<string,number>();
  try {
    for(let triangle=0;triangle<indices.count;triangle+=3)for(let edge=0;edge<3;edge++){
      const a=indices.getX(triangle+edge),b=indices.getX(triangle+(edge+1)%3),key=[Math.min(a,b),Math.max(a,b)].join(':');
      edges.set(key,(edges.get(key)??0)+1);
    }
    let buriedEdges=0;
    for(const [key,count]of edges){
      assert.ok(count<=2,'No overlapping surface fans share an edge.');
      if(count!==1)continue;
      buriedEdges++;const [a,b]=key.split(':').map(Number);
      for(let sample=0;sample<=12;sample++){
        const t=sample/12,x=positions.getX(a)*(1-t)+positions.getX(b)*t+MYTHIC_GROTTO.x,z=positions.getZ(a)*(1-t)+positions.getZ(b)*t+MYTHIC_GROTTO.z;
        const y=positions.getY(a)*(1-t)+positions.getY(b)*t+MYTHIC_GROTTO.floor;
        const ground=landDistance(x,z)>=-6.5?Math.max(terrainMeshHeight(x,z),marineFloorHeight(x,z)):marineFloorHeight(x,z);
        assert.ok(y<ground-.005,`Exposed cave seam at ${x.toFixed(2)},${z.toFixed(2)}.`);
      }
    }
    assert.ok(buriedEdges>60&&buriedEdges<160,'Only the outside ground-connected perimeter is open.');
    const a=new Vector3(),b=new Vector3(),c=new Vector3();let apronSamples=0;
    for(let triangle=0;triangle<indices.count;triangle+=3){
      a.fromBufferAttribute(positions,indices.getX(triangle));b.fromBufferAttribute(positions,indices.getX(triangle+1));c.fromBufferAttribute(positions,indices.getX(triangle+2));
      for(let u=0;u<=4;u++)for(let v=0;v<=4-u;v++){
        const x=(a.x*u+b.x*v+c.x*(4-u-v))/4,y=(a.y*u+b.y*v+c.y*(4-u-v))/4,z=(a.z*u+b.z*v+c.z*(4-u-v))/4;
        if(z<=1.31*MYTHIC_GROTTO.scale||Math.abs(x)<=4.31*MYTHIC_GROTTO.scale)continue;
        const ground=marineFloorHeight(x+MYTHIC_GROTTO.x,z+MYTHIC_GROTTO.z);
        assert.ok(y+MYTHIC_GROTTO.floor-ground<.08,'front apron triangles follow the excavated sand instead of rising into sharp lips');apronSamples++;
      }
    }
    assert.ok(apronSamples>180,'both front shoulders are sampled between their vertices');
  }finally{geometry.dispose();}
});

test('solar cells lie within the real swept wing surface and the nose follows the flight path',()=>{
  const glider=makeSolarGlider(),material=new MeshBasicMaterial({side:DoubleSide});
  const airframe=new Mesh((glider.children[0]as Mesh).geometry,material),cells=(glider.children[2]as Mesh).geometry.getAttribute('position');airframe.updateMatrixWorld();
  const ray=new Raycaster(),direction=new Vector3(0,-1,0);let tested=0;
  try {
    for(let i=0;i<cells.count;i++){
      const x=cells.getX(i),y=cells.getY(i),z=cells.getZ(i);if(y<.02||Math.abs(x)<1)continue;
      ray.set(new Vector3(x,.2,z),direction);const hit=ray.intersectObject(airframe,false)[0];
      assert.ok(hit&&hit.point.y>.024&&hit.point.y<.037,'Every solar-panel corner is supported by the wing beneath it.');
      assert.ok(y-hit.point.y<.025,'Photovoltaic cells sit flush instead of floating over the wing.');tested++;
    }
    assert.ok(tested>200);
    for(let event=0;event<2;event++)for(let age=1;age<FLIGHT_DURATION-1;age+=2){
      const t=150+event*FLIGHT_INTERVAL+age,pose=solarFlightPose(t,12),next=solarFlightPose(t+.01,12);
      const travel=new Vector3(next.x-pose.x,0,next.z-pose.z).normalize(),nose=new Vector3(Math.sin(pose.yaw),0,-Math.cos(pose.yaw));
      assert.ok(travel.dot(nose)>.999999,'The glider does not skid sideways along its curved crossing.');
    }
  } finally {material.dispose();glider.children.forEach(child=>{const mesh=child as Mesh;mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();});}
});


test('the crab burrow cuts a deeper real seafloor and blends into the unchanged surrounding sand',()=>{
  assert.ok(MYTHIC_GROTTO.floor<-7);
  assert.ok(marineFloorHeight(-55,-20)<-7.35);
  assert.ok(terrainMeshHeight(-55,-20)<-7.25,'the island apron cannot cap the excavated chamber');
  for(const [x,z]of [[-68,-20],[-42,-20],[-55,-31],[-55,-10]])assert.equal(mythicalCaveFloor(x,z,-5),-5);
  let previous=marineFloorHeight(-55,-20);
  for(let z=-19.9;z<-12;z+=.1){const height=marineFloorHeight(-55,z);assert.ok(Math.abs(height-previous)<.14,'entrance blends along a slope rather than a vertical sand wall');previous=height;}
});

test('the smaller crab steps, rests and articulates its pincers inside the chamber',()=>{
  const life=makeMythicGrotto(),snapshots:number[][]=[];
  try {
    for(const time of [0,4,9,18,32,47,59,74]){
      life.update(time);life.root.updateMatrixWorld(true);
      const bounds=new Box3().setFromObject(life.body);
      assert.ok(bounds.min.y>MYTHIC_GROTTO.floor-.13&&bounds.max.y<MYTHIC_GROTTO.floor+1.2);
      assert.ok(bounds.min.x>MYTHIC_GROTTO.x-2.7&&bounds.max.x<MYTHIC_GROTTO.x+2.7);
      snapshots.push([...life.legs[0].lower.matrix.elements]);
    }
    assert.notDeepEqual(snapshots[0],snapshots[1],'leg joints visibly move during a crawl');
    assert.equal(mythicCrabPose(25).walking,false);assert.equal(mythicCrabPose(50).walking,true);
    const position=life.body.position.clone(),jaw=life.jaws[0].rotation.toArray();life.update(10,true);
    assert.deepEqual(life.body.position,position);assert.deepEqual(life.jaws[0].rotation.toArray(),jaw);
  }finally{life.root.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();(object.material as MeshStandardMaterial).dispose();}});}
});

test('the actual reef and island triangle meshes leave the excavated mouth unobstructed',()=>{
  const material=new MeshBasicMaterial({side:DoubleSide}),terrain=new Mesh(archipelagoGeometry(),material),reef=new Mesh(reefSeafloorGeometry(),material);
  const ray=new Raycaster(),origin=new Vector3(),direction=new Vector3(0,0,-1);ray.far=4.4;
  try {
    for(let x=-57.1;x<-52.8;x+=.4)for(let y=-6.95;y<-5.95;y+=.25){
      ray.set(origin.set(x,y,-17.9),direction);
      assert.equal(ray.intersectObjects([terrain,reef]).length,0,'rendered sand must not plug any part of the usable cave mouth');
    }
  }finally{terrain.geometry.dispose();reef.geometry.dispose();material.dispose();}
});

test('every articulated crab vertex clears the real chamber floor and roof throughout its cycle',()=>{
  const life=makeMythicGrotto();life.root.updateMatrixWorld(true);
  const bank=life.root.getObjectByName('sand-buried-angular-grotto') as Mesh,p=bank.geometry.attributes.position,index=bank.geometry.index!;
  const cells=new Map<string,[Vector3,Vector3,Vector3][]>(),a=new Vector3(),b=new Vector3(),c=new Vector3();
  for(let i=0;i<index.count;i+=3){
    a.fromBufferAttribute(p,index.getX(i)).applyMatrix4(bank.matrixWorld);b.fromBufferAttribute(p,index.getX(i+1)).applyMatrix4(bank.matrixWorld);c.fromBufferAttribute(p,index.getX(i+2)).applyMatrix4(bank.matrixWorld);
    const triangle:[Vector3,Vector3,Vector3]=[a.clone(),b.clone(),c.clone()];
    for(let x=Math.floor(Math.min(a.x,b.x,c.x)*2);x<=Math.floor(Math.max(a.x,b.x,c.x)*2);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)*2);z<=Math.floor(Math.max(a.z,b.z,c.z)*2);z++){
      const key=`${x},${z}`,cell=cells.get(key)??[];cell.push(triangle);cells.set(key,cell);
    }
  }
  const column=(x:number,z:number)=>{
    const heights:number[]=[];
    for(const [a,b,c]of cells.get(`${Math.floor(x*2)},${Math.floor(z*2)}`)??[]){
      const denominator=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(denominator)<1e-10)continue;
      const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/denominator,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/denominator;
      if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)heights.push(u*a.y+v*b.y+(1-u-v)*c.y);
    }
    return heights;
  };
  const vertex=new Vector3(),matrix=new Matrix4();let sampled=0,minFloor=Infinity,minRoof=Infinity;
  try {
    for(let time=0;time<84;time+=.5){
      life.update(time);life.root.updateMatrixWorld(true);
      life.body.traverse(object=>{
        if(!(object instanceof Mesh))return;
        const positions=object.geometry.attributes.position,count=object instanceof InstancedMesh?object.count:1;
        for(let instance=0;instance<count;instance++){
          if(object instanceof InstancedMesh){object.getMatrixAt(instance,matrix);matrix.premultiply(object.matrixWorld);}else matrix.copy(object.matrixWorld);
          for(let i=0;i<positions.count;i++){
            vertex.fromBufferAttribute(positions,i).applyMatrix4(matrix);
            const heights=column(vertex.x,vertex.z),floor=Math.max(...heights.filter(y=>y<MYTHIC_GROTTO.floor+.15)),roof=Math.min(...heights.filter(y=>y>=MYTHIC_GROTTO.floor+.15));
            minFloor=Math.min(minFloor,vertex.y-floor);minRoof=Math.min(minRoof,roof-vertex.y);sampled++;
          }
        }
      });
    }
    assert.ok(sampled>2_500_000,'the audit includes instance transforms and every mesh vertex at each pose');
    assert.ok(minFloor>.01,'toes clear the actual tunnel floor while planted');
    assert.ok(minRoof>.6,'carapace, pincers and legs remain inside the physical rock recess');
    for(const boundary of [0,16,42,62,84]){
      life.update(boundary-1e-4);const before=life.legs.map(leg=>leg.lower.matrix.elements.slice());
      life.update(boundary+1e-4);life.legs.forEach((leg,i)=>leg.lower.matrix.elements.forEach((value,j)=>assert.ok(Math.abs(value-before[i][j])<.001,'walking blends into rest without a joint snap')));
    }
  }finally{const materials=new Set<MeshStandardMaterial>();life.root.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();materials.add(object.material as MeshStandardMaterial);}});materials.forEach(material=>material.dispose());}
});
