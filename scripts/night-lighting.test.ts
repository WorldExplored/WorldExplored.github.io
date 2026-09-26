import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3,PointLight,SpotLight,Mesh,MeshBasicMaterial,MeshStandardMaterial,Raycaster,DoubleSide,ShaderLib,type BufferGeometry,type WebGLProgramParametersWithUniforms } from 'three';
import {createElement} from 'react';
import {create} from '@react-three/test-renderer';
import {EcoCity} from '../src/components/world/EcoCity';
import {makeComputeBuilding,makeComputeInterior} from '../src/components/world/ComputeBuilding';
import {makeResearchBuilding,makeResearchInterior} from '../src/components/world/ResearchInstitute';
import {makeExperienceStudio,makeHistoryMuseum} from '../src/components/world/CivicLandmarks';
import {makeCampusHall,createCampusInterior} from '../src/components/world/CampusHall';
import {makeGardenGallery,makeGalleryInterior} from '../src/components/world/GardenGallery';
import {makeReceptionTerminal,makeReceptionInterior} from '../src/components/world/ReceptionTerminal';
import {createArcadeHall,createArcadeInterior} from '../src/components/world/ArcadeHall';
import { createRoomLighting,mainRoomLamps,mainRooms,applyBakedRoomLighting,roomNightUniform } from '../src/components/world/RoomLighting';
import { world,createSceneRuntime } from '../src/content/world';

test('all front buildings have contained fixtures and night light pools, with one local light',()=>{
  const lights=createRoomLighting(mainRoomLamps);
  try {
    assert.equal(lights.positions.length,mainRoomLamps.length);
    for(const site of world.landmarks.filter(site=>site.id!=='building'))assert.ok(mainRoomLamps.some(lamp=>Math.hypot(lamp.x-site.position[0],lamp.z-site.position[2])<6),site.id);
    const local=lights.root.getObjectByName('nearest-room-light') as SpotLight;
    lights.update(0,new Vector3(0,2,0),0);assert.equal(local.intensity,0);
    const pool=lights.root.getObjectByName('interior-floor-light-pools') as Mesh;assert.equal(pool.visible,false);
    lights.update(1,new Vector3(0,2,0),1);assert.ok(local.intensity>0);assert.equal(pool.visible,true);
    for(const room of mainRoomLamps)assert.ok(room.ceiling-room.floor>1.6&&room.ceiling-room.floor<6);
    assert.equal(lights.root.children.filter(item=>item instanceof PointLight).length,0);
    assert.equal(lights.root.children.filter(item=>item instanceof SpotLight).length,1);
    assert.equal(local.castShadow,false);
    assert.ok(local.color.g>=local.color.r*.95&&local.color.b>=local.color.r*.80,'the actual fixture produces pearl light');
    const selected=mainRoomLamps.find(room=>Math.abs(room.x-local.position.x)<.001&&Math.abs(room.z-local.position.z)<.001)!;
    assert.ok(Math.tan(local.angle)*(selected.ceiling-selected.floor)<=Math.min(selected.width,selected.depth)*.41,'the cone stays inside its room');
  }finally{lights.dispose();}
});


test('main ceiling heights match actual roof and upper-floor triangles',()=>{
  const models:Record<string,Record<string,BufferGeometry>>={work:makeComputeBuilding(),research:makeResearchBuilding(),experience:makeExperienceStudio(),history:makeHistoryMuseum(),purdue:makeCampusHall(),about:makeGardenGallery(),contact:makeReceptionTerminal(),arcade:createArcadeHall()};
  const roofs:Record<string,string[]>={work:['upper','roof'],research:['upper','roof'],experience:['roof'],history:['gallery','roof'],purdue:['roof'],about:['galleryRoof','conservatoryRoof'],contact:['roof','serviceRoof'],arcade:['roof']};
  const interiors={work:makeComputeInterior(),research:makeResearchInterior(),purdue:createCampusInterior(),about:makeGalleryInterior(),contact:makeReceptionInterior(),arcade:createArcadeInterior()};
  const material=new MeshBasicMaterial({side:DoubleSide});
  try{
    for(const[id,x,z,floor,ceiling]of mainRooms){
      const meshes=roofs[id].filter(key=>models[id][key]).map(key=>new Mesh(models[id][key],material));
      const hit=new Raycaster(new Vector3(x,floor+.005,z),new Vector3(0,1,0)).intersectObjects(meshes,false)[0];
      assert.ok(hit&&Math.abs(hit.point.y-ceiling)<.00001,`${id} fixture meets the actual ceiling`);
      const interior=interiors[id as keyof typeof interiors];
      if(interior){
        const floorHit=new Raycaster(new Vector3(x,floor+.003,z),new Vector3(0,-1,0)).intersectObjects([...Object.values(interior).filter(geometry=>geometry.attributes.position?.count),...['floor','upper','ground','floors'].map(key=>models[id][key]).filter(Boolean)].map(geometry=>new Mesh(geometry,material)),false)[0];
        assert.ok(floorHit&&Math.abs(floorHit.point.y-floor)<.002,`${id} light pool rests on the furnished floor`);
      }
    }
  }finally{material.dispose();for(const parts of [...Object.values(models),...Object.values(interiors)])Object.values(parts).forEach(geometry=>geometry.dispose());}
});

test('night fill adds diffuse light to opaque surfaces and survives cloned city materials',()=>{
  const plain=new MeshStandardMaterial(),materials=[applyBakedRoomLighting(plain,true),applyBakedRoomLighting(plain.clone(),true),applyBakedRoomLighting(new MeshStandardMaterial())];
  try{
    materials.forEach((material,index)=>{
      const shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader} as WebGLProgramParametersWithUniforms;
      material.onBeforeCompile(shader,{} as never);
      assert.equal(shader.uniforms.roomNight,roomNightUniform);
      assert.ok(shader.fragmentShader.includes('reflectedLight.indirectDiffuse += diffuseColor.rgb'));
      assert.equal(shader.vertexShader.includes('attribute float aRoomFill'),index<2);
      assert.equal(material.emissive.getHex(),0,'room materials retain their physical emissive setting');
    });
  }finally{materials.forEach(material=>material.dispose());}
});

test('city lights sit on actual floor and ceiling faces while outside walls and glass stay unlit',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const runtime={current:createSceneRuntime()},renderer=await create(createElement(EcoCity,{runtime,quality:'medium',paused:true}));
  try{
    const root=renderer.scene.instance,fixture=root.getObjectByName('interior-light-fixtures')!;
    const rooms=fixture.userData.rooms as typeof mainRoomLamps,opaque:Mesh[]=[];
    let lit=0,dark=0,bytes=0;
    root.traverse(object=>{
      if(!(object instanceof Mesh)||!object.name.startsWith('eco-city-'))return;
      const material=object.material as MeshStandardMaterial,fill=object.geometry.attributes.aRoomFill;
      if(!material.transparent)opaque.push(object);
      if(!fill)return;bytes+=fill.array.byteLength;
      for(let i=0;i<fill.count;i++){if(fill.getX(i)>.01)lit++;else dark++;if(material.transparent)assert.equal(fill.getX(i),0);}
    });
    assert.ok(rooms.length>30&&lit>3000&&dark>lit,'room interiors are selected separately from the outdoor shell');
    assert.ok(bytes<1500000,'one normalized byte per structural vertex bounds the added GPU attribute');
    for(const room of rooms){
      const up=new Raycaster(new Vector3(room.x,room.floor+.004,room.z),new Vector3(0,1,0)).intersectObjects(opaque,false)[0];
      const down=new Raycaster(new Vector3(room.x,room.floor+.004,room.z),new Vector3(0,-1,0)).intersectObjects(opaque,false)[0];
      assert.ok(up&&Math.abs(up.point.y-room.ceiling)<.004,'city fixture is below its actual ceiling slab');
      assert.ok(down&&Math.abs(down.point.y-room.floor)<.004,'city pool rests on the actual floor');
    }
  }finally{await renderer.unmount();}
});
