import test from 'node:test';
import assert from 'node:assert/strict';
import { create } from '@react-three/test-renderer';
import { Box3, BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Object3D, Raycaster, Vector3 } from 'three';
import { ComputeBuilding } from '../src/components/world/ComputeBuilding';
import { ResearchInstitute } from '../src/components/world/ResearchInstitute';
import { CampusHall } from '../src/components/world/CampusHall';
import { GardenGallery } from '../src/components/world/GardenGallery';
import { ReceptionTerminal } from '../src/components/world/ReceptionTerminal';
import { ExperienceStudio, HistoryMuseum } from '../src/components/world/CivicLandmarks';
import { createSceneRuntime, world } from '../src/content/world';
import { cityBuildings } from '../src/components/world/city';
import { buildCityArchitecture } from '../src/components/world/CityArchitecture';
import { archipelagoGeometry } from '../src/components/world/terrain';
import { floorSlab, floorRectangle, floorEllipse } from '../src/components/world/InteriorKit';

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const eps=.00001;
const rect=(x:number,z:number,x0:number,x1:number,z0:number,z1:number)=>x>=x0-eps&&x<=x1+eps&&z>=z0-eps&&z<=z1+eps;
const disk=(x:number,z:number,cx:number,cz:number,rx:number,rz=rx)=>((x-cx)/rx)**2+((z-cz)/rz)**2<=1+eps;
// These limits come from enclosing wall faces, independently of floor constructors.
const rooms:Record<string,(x:number,z:number)=>boolean>={
  work:(x,z)=>(Math.abs(x)>=1.63-eps&&Math.abs(x)<=4.08+eps&&z>=-2.13-eps&&z<=2.24+eps)||rect(x,z,-1.64,1.64,-1.9,2.18)||rect(x,z,-1.37,1.37,2.18,2.31),
  experience:(x,z)=>rect(x,z,-3.825,3.825,-2.64,2.64),
  research:(x,z)=>rect(x,z,-2.75,.32,-1.61,1.58)||disk(x,z,1.58,-.73,.91)||rect(x,z,.665,2.695,.41,1.79)||rect(x,z,.24,.81,-1.12,-.34)||rect(x,z,.24,.81,.68,1.42),
  purdue:(x,z)=>rect(x,z,-2.055,2.055,-1.435,1.435)||rect(x,z,-.725,.725,1.435,1.515),
  history:(x,z)=>rect(x,z,-5.275,5.275,-3.55,3.55),
  about:(x,z)=>rect(x,z,-2.44,2.44,-2,-1.36)||rect(x,z,-2.45,-1.45,-1.36,1.38),
  contact:(x,z)=>disk(x,z,0,0,1.55)||rect(x,z,1.14,2.24,-1.265,.765),
};
const foundations:Record<string,(x:number,z:number)=>boolean>={
  work:(x,z)=>rect(x,z,-4.325,4.325,-2.375,2.375)||rect(x,z,-1.555,1.555,-2.375,2.455),
  experience:(x,z)=>rect(x,z,-4.225,4.225,-3.06,3.06),
  research:(x,z)=>rect(x,z,-2.925,.495,-1.785,1.755)||disk(x,z,1.58,-.73,1.085)||rect(x,z,.53,2.83,.275,1.925)||rect(x,z,.36,.67,-1.18,-.28)||rect(x,z,.36,.67,.61,1.49),
  purdue:(x,z)=>rect(x,z,-2.225,2.225,-1.6,1.6),
  history:(x,z)=>rect(x,z,-5.6,5.6,-3.85,3.85),
  about:(x,z)=>rect(x,z,-2.615,2.615,-2.185,-1.195)||rect(x,z,-2.605,-1.295,-1.315,1.555),
  contact:(x,z)=>disk(x,z,0,0,1.72)||rect(x,z,1.12,2.38,-1.405,.905),
};
function points(geometry:BufferGeometry,start=0,count=geometry.index?.count??geometry.attributes.position.count) {
  const p=geometry.attributes.position,index=geometry.index;const result:number[][]=[];
  for(let i=start;i<start+count;i++) {const n=index?index.getX(i):i;result.push([p.getX(n),p.getY(n),p.getZ(n)]);}
  return result;
}
function assertContained(geometry:BufferGeometry,accept:(x:number,z:number)=>boolean,name:string,start=0,count?:number) {
  const p=points(geometry,start,count);
  for(const [x,,z] of p)assert.ok(accept(x,z),`${name}: vertex outside architectural footprint at ${x},${z}`);
  for(let i=0;i<p.length;i+=3){const tri=p.slice(i,i+3);if(tri.length<3)continue;const x=tri.reduce((n,v)=>n+v[0],0)/3,z=tri.reduce((n,v)=>n+v[2],0)/3;assert.ok(accept(x,z),`${name}: face bridges an open courtyard at ${x},${z}`);}
}

test('all seven inhabited landmarks have inset finished floors and foundations matching their actual wall footprint',async()=>{
  const components={work:ComputeBuilding,experience:ExperienceStudio,research:ResearchInstitute,purdue:CampusHall,history:HistoryMuseum,about:GardenGallery,contact:ReceptionTerminal};
  for(const [id,Component] of Object.entries(components)){
    const renderer=await create(<Component active={false} paused quality="high" runtime={{current:createSceneRuntime()}}/>);
    try{
      let floors=0,bases=0;
      for(const node of renderer.scene.findAll(n=>n.instance.type==='Mesh')){
        const geometry=(node.instance as Mesh).geometry,tag=geometry.userData.floor;
        if(tag?.kind==='foundation'){assertContained(geometry,foundations[id],tag.name);bases++;}
        else if(tag?.kind==='floor'){assertContained(geometry,rooms[id],tag.name);floors++;}
        for(const part of geometry.userData.floors??[]){assertContained(geometry,rooms[id],part.name,part.start,part.count);floors++;}
      }
      assert.ok(floors>=1&&bases===1,`${id}: floors and foundation must remain tagged for auditing`);
    }finally{await renderer.unmount();}
  }
});

test('every city room floor is bounded by the inner faces of its actual generated walls',()=>{
  for(const building of cityBuildings){
    const geometries:BufferGeometry[]=[],matrix=new Object3D();
    buildCityArchitecture(building,(geometry,_finish,x=0,y=0,z=0,sx=1,sy=1,sz=1,yaw=0)=>{
      matrix.position.set(x,y,z);matrix.scale.set(sx,sy,sz);matrix.rotation.set(0,yaw,0);matrix.updateMatrix();geometry.applyMatrix4(matrix.matrix);geometry.computeBoundingBox();geometries.push(geometry);
    });
    try{
      const floors=geometries.filter(g=>g.userData.floor?.kind==='floor');assert.ok(floors.length>0,building.id);
      for(const floor of floors){
        const name=floor.userData.floor.name,walls=geometries.filter(g=>g.userData.roomWall?.room===name);
        const curved=walls.find(g=>g.userData.roomWall.role==='ellipse');
        if(curved){const b=curved.boundingBox!;assertContained(floor,(x,z)=>disk(x,z,0,0,Math.max(Math.abs(b.min.x),Math.abs(b.max.x)),Math.max(Math.abs(b.min.z),Math.abs(b.max.z))),name);continue;}
        const bound=(role:string)=>walls.find(g=>g.userData.roomWall.role===role||(role==='back'&&g.userData.roomWall.role==='back-left'))!.boundingBox!;
        const left=bound('left').max.x,right=bound('right').min.x,back=bound('back').max.z,front=bound('front').min.z;
        assertContained(floor,(x,z)=>rect(x,z,left,right,back,front),name);
      }
      // Ground walls define separate wings and courtyards; never their convex hull.
      const ground=geometries.filter(g=>g.userData.roomWall?.ground), envelopes:Array<(x:number,z:number)=>boolean>=[];
      for(const id of new Set(ground.map(g=>g.userData.roomWall.room))){
        const walls=ground.filter(g=>g.userData.roomWall.room===id),ellipse=walls.find(g=>g.userData.roomWall.role==='ellipse');
        if(ellipse){const b=ellipse.boundingBox!;envelopes.push((x,z)=>disk(x,z,0,0,b.max.x+.08,b.max.z+.08));continue;}
        const bounds=new Box3();for(const wall of walls)bounds.union(wall.boundingBox!);
        envelopes.push((x,z)=>rect(x,z,bounds.min.x-.025,bounds.max.x+.025,bounds.min.z-.025,bounds.max.z+.025));
      }
      if(building.family==='public-station')for(const x of [-building.width*.44,building.width*.44])for(const z of [-building.depth*.43,building.depth*.43])envelopes.push((px,pz)=>rect(px,pz,x-.081,x+.081,z-.081,z+.081));
      const foundation=geometries.find(g=>g.userData.floor?.kind==='foundation')!;
      assertContained(foundation,(x,z)=>envelopes.some(contains=>contains(x,z)),`${building.id} foundation`);
    }finally{geometries.forEach(g=>g.dispose());}
  }
});

test('footprint union removes overlapping top faces while retaining curved boundaries and open courtyards',()=>{
  const geometry=floorSlab('test',[floorEllipse(0,0,1),floorRectangle(1,0,1,1)],1,.2);
  try{
    const p=points(geometry);let area=0;
    for(let i=0;i<p.length;i+=3){const t=p.slice(i,i+3);if(t.every(v=>Math.abs(v[1]-1)<1e-5))area+=Math.abs((t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]))/2;}
    // Circle + one rectangle - their overlap: about 3.68, never the summed 4.14.
    assert.ok(area>3.65&&area<3.72,`Coplanar overlap was not removed: area ${area}`);
  }finally{geometry.dispose();}
  const court=floorSlab('court',[floorRectangle(-1,0,.3,2.3),floorRectangle(1,0,.3,2.3),floorRectangle(0,-1,1.7,.3),floorRectangle(0,1,1.7,.3)],1,.2);
  try{assertContained(court,(x,z)=>Math.abs(x)>=.85-eps||Math.abs(z)>=.85-eps,'Open courtyard');}finally{court.dispose();}
});


test('grounded doorway thresholds preserve their original surface heights and entrance coordinates',async()=>{
  const entries=[
    {Component:ComputeBuilding,point:[0,2.51],top:1.105},
    {Component:ResearchInstitute,point:[-1.33,1.85],top:1.07},
    {Component:CampusHall,point:[0,1.72],top:1.03},
    {Component:GardenGallery,point:[1.195,-1.14],top:1.06},
    {Component:GardenGallery,point:[-1.95,1.64],top:1.06},
    {Component:ReceptionTerminal,point:[0,1.95],top:1.06},
  ];
  for(const {Component,point,top} of entries){
    const renderer=await create(<Component active={false} paused quality="high" runtime={{current:createSceneRuntime()}}/>);
    try{
      renderer.scene.instance.updateMatrixWorld(true);
      const meshes=renderer.scene.findAll(n=>n.instance.type==='Mesh').map(n=>n.instance as Mesh);
      const hit=new Raycaster(new Vector3(point[0],1.6,point[1]),new Vector3(0,-1,0),0,1).intersectObjects(meshes,false)[0];
      assert.ok(hit&&Math.abs(hit.point.y-top)<1e-5,`Doorway ${point}: expected ${top}, got ${hit?.point.y}`);
    }finally{await renderer.unmount();}
  }
});


test('campus plank joints and doorway connection cover the actual graded terrain',async()=>{
  const renderer=await create(<CampusHall active={false} paused quality="high" runtime={{current:createSceneRuntime()}}/>);
  const material=new MeshBasicMaterial({side:DoubleSide}),ground=new Mesh(archipelagoGeometry(),material),floors:Mesh[]=[];
  try{
    const landmark=world.landmarks.find(l=>l.id==='purdue')!,c=Math.cos(landmark.rotationY??0),s=Math.sin(landmark.rotationY??0);
    for(const node of renderer.scene.findAll(n=>n.instance.type==='Mesh')){
      const geometry=(node.instance as Mesh).geometry,positions=geometry.attributes.position;
      for(const part of geometry.userData.floors??[]){
        const vertices:number[]=[];
        for(let i=part.start;i<part.start+part.count;i++)vertices.push(positions.getX(i),positions.getY(i),positions.getZ(i));
        const floor=new Mesh(new BufferGeometry().setAttribute('position',new Float32BufferAttribute(vertices,3)),material);
        floor.name=part.name;floor.rotation.y=landmark.rotationY??0;floor.position.fromArray(landmark.position);floor.updateMatrixWorld(true);floors.push(floor);
      }
    }
    ground.updateMatrixWorld(true);const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0),0,.5);
    const check=(x:number,z:number)=>{
      const wx=landmark.position[0]+x*c+z*s,wz=landmark.position[2]-x*s+z*c;
      ray.ray.origin.set(wx,1.04,wz);const hit=ray.intersectObjects([...floors,ground],false)[0];
      assert.ok(hit&&hit.object!==ground,`Ground visible through floor joint at local ${x},${z}; first surface ${hit?.point.y}`);
      assert.ok(hit.point.y>=1.0289&&hit.point.y<=1.0301,`Floor joint at ${x},${z} lacks a continuous structural surface`);
    };
    check(0,1.4);
    for(let joint=0;joint<13;joint++)for(let row=0;row<=14;row++)check(-1.74+joint*.29,-1.4+row*.2);
    for(const x of [-.65,0,.65])for(const z of [1.43,1.47,1.51])check(x,z);
  }finally{floors.forEach(mesh=>mesh.geometry.dispose());ground.geometry.dispose();material.dispose();await renderer.unmount();}
});
