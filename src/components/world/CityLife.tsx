'use client';

import { coastalSoundScene } from './coastalAudio';

import { useEffect, useState } from 'react';
import { world } from '../../content/world';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshPhysicalMaterial, Object3D, Shape, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityRoofMounts, cityStationActivity, type CityTransitRoute } from './city';
import { cityDocks, cityTurbines, dockLandingLayout, createCityFerryRoute, FERRY_DWELL, writeCityFerryPose } from './cityInfrastructure';
import { terrainHeight } from './terrain';
import { GardenFountain } from './GardenFountain';
import type { EnvironmentProps } from './Water';
import { createTownInteractionState, type TownInteractionState } from './townInteractionState';
import { TownInteractions } from './TownInteractions';
import { createTownMechanisms } from './TownMechanisms';
import { createCoastalFerry } from './CoastalFerry';

// Route waterline + aft threshold center + half its slab thickness.
export const DOCK_BOARDING_HEIGHT = .17 + .26 + .055 / 2;
export const DOCK_STAIR_COUNT = 4;

export function dockBoardingPlan() {
  const route=createCityFerryRoute();
  return cityDocks.map((dock,index)=>{
    const position=new Vector3(),tangent=new Vector3();writeCityFerryPose(route,index===0?0:route.firstDuration,position,tangent);
    const right=new Vector3(tangent.z,0,-tangent.x);
    // The gangway stops 2cm behind the actual aft deck edge, leaving room for a fender.
    const end=position.clone().addScaledVector(tangent,-1.04);end.y=DOCK_BOARDING_HEIGHT;
    const start=dock.id==='city'?new Vector3(dock.x-dock.width/2,DOCK_BOARDING_HEIGHT,end.z):new Vector3(-8.40,DOCK_BOARDING_HEIGHT,dock.z-dock.length/2);
    const across=dock.id==='city'?new Vector3(0,0,1):new Vector3(1,0,0);
    return {dock,index,start,end,right,across,...dockLandingLayout(dock),width:.50};
  });
}

export function dockBoardingExtension(elapsed:number,station:number,duration:number,firstDuration:number) {
  const phase=((elapsed%duration)+duration)%duration;
  const age=phase-(station===0?0:firstDuration);
  if(age<=1e-9||age>=FERRY_DWELL-.15-1e-9)return 0;
  const smooth=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
  return smooth(age/.65)*smooth((FERRY_DWELL-.3-age)/.65);
}

export function createCityLife(stationRoute: CityTransitRoute) {
  const root = new Group(); root.name = 'operating-city-infrastructure';
  const mechanisms = createTownMechanisms(stationRoute); root.add(mechanisms.root);
  const geometryResources = new Set<BufferGeometry>();
  const materials = {
    white: new MeshPhysicalMaterial({ color: '#f3fff6', roughness: .4, metalness: .03, clearcoat: .3, clearcoatRoughness: .2 }),
    aqua: new MeshPhysicalMaterial({ color: '#3fdee6', roughness: .45, metalness: .25, clearcoat: .12 }),
    glass: new MeshPhysicalMaterial({ color: '#a4f3f4', roughness: .08, metalness: 0, clearcoat: .7, transparent: true, opacity: .28, depthWrite: false, thickness: .06, ior: 1.45 }),
    solar: new MeshPhysicalMaterial({ color: '#17485e', roughness: .5, metalness: .15, clearcoat: .18, envMapIntensity: .15 }),
    station: new MeshPhysicalMaterial({ color: '#d0fff8', emissive: '#68eeed', emissiveIntensity: 0, roughness: .25, metalness: .02, clearcoat: .9 }),
    turbineSteel: new MeshPhysicalMaterial({ color: '#718d91', roughness: .32, metalness: .72, clearcoat: .28 }),
    turbineDark: new MeshPhysicalMaterial({ color: '#263b43', roughness: .42, metalness: .58 }),
  };
  materials.solar.onBeforeCompile=shader=>{
    shader.vertexShader=`varying vec2 solarCell;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\nsolarCell=position.xz*vec2(9.,10.);');
    shader.fragmentShader=`varying vec2 solarCell;\n${shader.fragmentShader}`.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 cell=fract(solarCell),edge=min(cell,1.-cell),width=max(fwidth(solarCell),vec2(.006));
      float seam=1.-min(smoothstep(0.,width.x+.012,edge.x),smoothstep(0.,width.y+.012,edge.y));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.30,.34),seam*.42);
    `);
  };
  materials.solar.customProgramCacheKey=()=> 'photovoltaic-cell-grid';
  const merged = (geometries: BufferGeometry[], groups = false) => {
    const sources = geometries.map(geometry => geometry.index ? geometry.toNonIndexed() : geometry);
    const result = mergeGeometries(sources, groups)!;
    new Set([...geometries, ...sources]).forEach(geometry => geometry.dispose()); return result;
  };
  const add = (name: string, geometry: BufferGeometry, material: MeshPhysicalMaterial | MeshPhysicalMaterial[], parent: Group = root) => {
    geometryResources.add(geometry); const mesh = new Mesh(geometry, material); mesh.name = name;
    mesh.castShadow = !Array.isArray(material) && !material.transparent; mesh.receiveShadow = mesh.castShadow; parent.add(mesh); return mesh;
  };
  const instance = (name: string, count: number, geometry: BufferGeometry, material: MeshPhysicalMaterial) => {
    geometryResources.add(geometry); const mesh = new InstancedMesh(geometry, material, count); mesh.name = name; mesh.castShadow = true; mesh.frustumCulled = false; root.add(mesh); return mesh;
  };
  const blade = () => {
    const shape = new Shape(); shape.moveTo(0, .05);
    shape.bezierCurveTo(.31, .32, .32, 1.12, .09, 2.15);
    shape.bezierCurveTo(.02, 2.34, -.055, 2.32, -.04, 2.12);
    shape.bezierCurveTo(.02, 1.14, -.19, .42, 0, .05);
    return new ExtrudeGeometry(shape, { depth: .07, bevelEnabled: true, bevelSize: .022, bevelThickness: .022, bevelSegments: 2, curveSegments: 18 }).translate(0, 0, -.035);
  };
  const fixed: BufferGeometry[] = []; const water: BufferGeometry[] = [];
  const rotors: Group[] = [];
  const turbineYaws: Group[] = [];
  const turbineHubs: Vector3[] = [];
  const turbineHardware: BufferGeometry[] = [];
  const steelParts: BufferGeometry[] = [
    new CylinderGeometry(.29, .29, .08, 24).translate(0, -.03, 0),
    new CylinderGeometry(.085, .085, .66, 16).rotateX(Math.PI / 2).translate(0, .34, .75),
  ];
  const darkParts: BufferGeometry[] = [
    new BoxGeometry(.025, .26, .34).translate(.371, .34, -.04),
    new CylinderGeometry(.17, .17, .11, 20).rotateX(Math.PI / 2).translate(0, .34, .58),
  ];
  const serviceFasteners: BufferGeometry[] = [];
  for (const z of [-.17, .09]) for (const y of [.25, .43]) serviceFasteners.push(new CylinderGeometry(.018, .018, .025, 8).rotateZ(Math.PI / 2).translate(.39, y, z));
  steelParts.push(merged(serviceFasteners));
  for (const side of [-1, 1]) steelParts.push(new BoxGeometry(.035, .18, .035).translate(.386, .34, -.04 + side * .13));
  const turbineGearbox = new BoxGeometry(.72, .48, 1.15).translate(0, .34, -.05);
  const turbineRearCover = new SphereGeometry(.33, 18, 12).scale(1, .78, .74).translate(0, .34, -.62);
  const rotorGeometry = merged([
    new SphereGeometry(.2, 20, 14).scale(1, 1, .82),
    new CylinderGeometry(.11, .14, .42, 18).rotateX(Math.PI / 2).translate(0, 0, -.23),
    new CylinderGeometry(.13, .1, .15, 18).rotateX(Math.PI / 2).translate(0, 0, .13),
    ...Array.from({ length: 3 }, (_, bladeIndex) => blade().rotateZ(bladeIndex * Math.PI * 2 / 3)),
  ]);
  for (const [index, turbine] of cityTurbines.entries()) {
    const floor = terrainHeight(turbine.x, turbine.z);
    fixed.push(new CylinderGeometry(.13, .27, turbine.height, 20).translate(turbine.x, floor + turbine.height / 2, turbine.z));
    fixed.push(new CylinderGeometry(.58, .61, .16, 28).translate(turbine.x, floor + .08, turbine.z));
    fixed.push(new CylinderGeometry(.35, .35, .12, 24).translate(turbine.x, floor + .22, turbine.z));
    const foundationBolts: BufferGeometry[] = [];
    for (let bolt = 0; bolt < 12; bolt++) {
      const angle = bolt * Math.PI / 6;
      foundationBolts.push(new CylinderGeometry(.035, .035, .08, 8).translate(turbine.x + Math.cos(angle) * .48, floor + .2, turbine.z + Math.sin(angle) * .48));
    }
    turbineHardware.push(merged(foundationBolts));

    // The yaw bearing sits on the tower cap; the housing and rotor pivot around its vertical axis.
    turbineHardware.push(new CylinderGeometry(.36, .36, .13, 24).translate(turbine.x, floor + turbine.height + .065, turbine.z));
    turbineHardware.push(new CylinderGeometry(.27, .27, .045, 24).translate(turbine.x, floor + turbine.height + .15, turbine.z));
    const yaw = new Group(); yaw.name = `city-wind-turbine-nacelle-yaw-${index}`;
    yaw.position.set(turbine.x, floor + turbine.height + .17, turbine.z); root.add(yaw); turbineYaws.push(yaw);
    const rotor = new Group(); rotor.name = `city-wind-turbine-${index}`; root.add(rotor); rotors.push(rotor);
    turbineHubs.push(new Vector3(0, .34, 1.06));
  }
  const steelHardware = merged(steelParts);
  steelHardware.userData.parts = ['yaw-carrier', 'rotor-shaft', 'service-fasteners', 'service-hinge-left', 'service-hinge-right'];
  const darkHardware = merged(darkParts);
  darkHardware.userData.parts = ['service-door', 'bearing-cap'];
  const steelBatch = instance('city-wind-turbine-steel-hardware', cityTurbines.length, steelHardware, materials.turbineSteel);
  const darkBatch = instance('city-wind-turbine-dark-hardware', cityTurbines.length, darkHardware, materials.turbineDark);
  const gearboxBatch = instance('city-wind-turbine-gearboxes', cityTurbines.length, turbineGearbox, materials.white);
  const rearBatch = instance('city-wind-turbine-rear-covers', cityTurbines.length, turbineRearCover, materials.aqua);
  const rotorBatch = instance('city-sculpted-turbine-blades', cityTurbines.length, rotorGeometry, materials.white);
  rotorGeometry.userData.parts = ['three-blade rotor', 'hub', 'rotor shaft coupling'];
  add('city-wind-turbine-static-hardware', merged(turbineHardware), materials.turbineSteel);
  const boardings=dockBoardingPlan();
  const gangways:Array<{mesh:Mesh;index:number}>=[];
  const dockBeam=(a:Vector3,b:Vector3,radius=.025)=>{
    const direction=b.clone().sub(a),transform=new Object3D();transform.position.copy(a).add(b).multiplyScalar(.5);transform.quaternion.setFromUnitVectors(new Vector3(0,1,0),direction.clone().normalize());transform.updateMatrix();
    return new CylinderGeometry(radius,radius,direction.length(),10).applyMatrix4(transform.matrix);
  };
  for(const boarding of boardings){
    const {dock,stairStart,stairEnd}=boarding;
    const {direction,dryEnd,landingEnd}=boarding,rise=(dock.y-DOCK_BOARDING_HEIGHT)/DOCK_STAIR_COUNT;
    const segment=(a:number,b:number,top:number)=>fixed.push(new BoxGeometry(dock.width,.16,Math.abs(b-a)).translate(dock.x,top-.08,(a+b)/2));
    segment(dryEnd,stairStart,dock.y);
    for(let step=0;step<DOCK_STAIR_COUNT;step++)segment(stairStart+(stairEnd-stairStart)*step/DOCK_STAIR_COUNT,stairStart+(stairEnd-stairStart)*(step+1)/DOCK_STAIR_COUNT,dock.y-rise*(step+1));
    segment(stairEnd,landingEnd,DOCK_BOARDING_HEIGHT);
    const heightAt=(z:number)=>{
      const t=(z-stairStart)/(stairEnd-stairStart);
      return t<=0?dock.y:t>=1?DOCK_BOARDING_HEIGHT:dock.y-(dock.y-DOCK_BOARDING_HEIGHT)*t;
    };
    for(const side of [-1,1]){
      const x=dock.x+side*.59;
      const breakpoints=[dryEnd,stairStart,stairEnd,landingEnd];
      if(dock.id==='city'&&side===-1)breakpoints.push(boarding.start.z-.36,boarding.start.z+.36);
      breakpoints.sort((a,b)=>(a-b)*direction);
      for(let i=1;i<breakpoints.length;i++){
        const a=breakpoints[i-1],b=breakpoints[i],middle=(a+b)/2;
        if(dock.id==='city'&&side===-1&&Math.abs(middle-boarding.start.z)<.36)continue;
        fixed.push(dockBeam(new Vector3(x,heightAt(a)+.42,a),new Vector3(x,heightAt(b)+.42,b)));
      }
      for(const z of breakpoints){
        const floor=Math.min(terrainHeight(x,z),.1),top=heightAt(z)+.42;
        fixed.push(new CylinderGeometry(.035,.055,top-floor,10).translate(x,(top+floor)/2,z));
      }
    }
    // Closed solid gangway, morphing into its pier-mounted cassette before the taxi moves.
    const half=boarding.width/2;
    const corners=[boarding.start.clone().addScaledVector(boarding.across,-half),boarding.start.clone().addScaledVector(boarding.across,half),boarding.end.clone().addScaledVector(boarding.right,half),boarding.end.clone().addScaledVector(boarding.right,-half)];
    // Keep both edges consistently ordered even when the docks face opposite directions.
    if(corners[0].distanceToSquared(corners[3])+corners[1].distanceToSquared(corners[2])>corners[0].distanceToSquared(corners[2])+corners[1].distanceToSquared(corners[3]))[corners[2],corners[3]]=[corners[3],corners[2]];
    const positions:number[]=[],retracted:number[]=[],uvs:number[]=[];
    for(const bottom of [0,.06])for(let i=0;i<4;i++){
      const vertex=corners[i].clone();vertex.y-=bottom;positions.push(...vertex.toArray());uvs.push(i%2,i>1?1:0);
      const target=i>1?boarding.start.clone().addScaledVector(boarding.across,i===2?half:-half):corners[i].clone();target.y-=bottom;retracted.push(...target.toArray());
    }
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);geometry.computeVertexNormals();if(geometry.getAttribute('normal').getY(0)<0){const index=geometry.index!;for(let i=0;i<index.count;i+=3){const a=index.getX(i);index.setX(i,index.getX(i+2));index.setX(i+2,a);}geometry.computeVertexNormals();}geometry.morphAttributes.position=[new Float32BufferAttribute(retracted,3)];
    const mesh=add(`city-${dock.id}-boarding-gangway`,geometry,materials.aqua);mesh.userData.boarding=boarding;gangways.push({mesh,index:boarding.index});
    fixed.push(new BoxGeometry(dock.id==='city'?.035:.62,.10,dock.id==='city'?.62:.035).translate(boarding.start.x,DOCK_BOARDING_HEIGHT-.10,boarding.start.z));
  }
  // Public station rail and canopy lights align with the existing transit hall.
  fixed.push(new BoxGeometry(2.2, .09, .75).translate(-5, 3.08, -67.15));
  for (const index of [-1, 0, 1]) fixed.push(new BoxGeometry(.025, .12, .025).translate(-5 + index * .64, 5.26, -66.87));
  add('city-public-infrastructure', merged(fixed), materials.white);

  const panels: Array<{ x: number; y: number; z: number; yaw: number; width: number; depth: number; phase: number }> = [];
  const solarSupports:BufferGeometry[]=[];
  for (const mount of cityRoofMounts) {
    panels.push({x:mount.world[0],y:mount.world[1]+.32,z:mount.world[2],yaw:mount.yaw,width:mount.width,depth:mount.depth,phase:mount.world[0]*.06});
    const rack = new Object3D(); rack.position.set(...mount.world); rack.rotation.y = mount.yaw; rack.updateMatrix();
    for (const side of [-1, 1]) {
      solarSupports.push(new BoxGeometry(mount.width * .74, .055, .08).translate(0, .15, side * mount.depth * .25).applyMatrix4(rack.matrix));
      for (const x of [-mount.width * .3, mount.width * .3]) {
        solarSupports.push(new BoxGeometry(.09, .15, .10).translate(x, .065, side * mount.depth * .25).applyMatrix4(rack.matrix));
        solarSupports.push(new BoxGeometry(.17, .025, .18).translate(x, .012, side * mount.depth * .25).applyMatrix4(rack.matrix));
      }
    }
    solarSupports.push(new BoxGeometry(.16,.06,mount.depth*.5+.1).translate(0,.15,0).applyMatrix4(rack.matrix));
    solarSupports.push(new CylinderGeometry(.15, .20, .13, 16).translate(0, .185, 0).applyMatrix4(rack.matrix));
    solarSupports.push(new SphereGeometry(.045,12,8).translate(0,.27,0).applyMatrix4(rack.matrix));
  }
  const supports=add('solar-roof-supports',merged(solarSupports),materials.white);supports.geometry.userData.mounts=cityRoofMounts.map(mount=>mount.building);
  const frames = instance('city-articulated-solar-frames', panels.length, merged([new BoxGeometry(1, .055, 1), ...[-1,1].map(side => new BoxGeometry(.08, .08, .92).translate(side*.31,-.045,0))]), materials.aqua);
  const cells = instance('city-articulated-solar-cells', panels.length, merged([new BoxGeometry(.88, .014, .39).translate(0, .036, -.235), new BoxGeometry(.88, .014, .39).translate(0, .036, .235)]), materials.solar);
  frames.castShadow = false; cells.castShadow = false;
  if(water.length)add('city-dock-edge-stripes', merged(water), materials.aqua);
  const station = add('city-station-arrival-lights', merged([-1, 0, 1].map(index => new BoxGeometry(.42, .04, .07).translate(-5 + index * .64, 5.18, -66.87))), materials.station);
  station.castShadow = false;

  const coastalFerry = createCoastalFerry();
  const ferry = coastalFerry.root; root.add(ferry);
  const dummy = new Object3D();
  let disposeTimer: ReturnType<typeof setTimeout> | undefined;
  let displayedTime = 0; let detail = 1;
  const idleControls = createTownInteractionState();
  const update = (elapsed: number, stationRoute: CityTransitRoute, controls: TownInteractionState = idleControls, paused = false, sunDirection:readonly number[]=world.lighting.sunPosition) => {
    if (!paused) displayedTime = elapsed;
    const time = displayedTime;
    if(!paused)for(const gangway of gangways){const extension=dockBoardingExtension(time,gangway.index,coastalFerry.route.duration,coastalFerry.route.firstDuration);gangway.mesh.morphTargetInfluences![0]=1-extension;gangway.mesh.visible=extension>.005;}
    mechanisms.update(time, controls, paused, detail);
    for (let index = 0; index < rotors.length; index++) {
      const yaw = index === 0 ? controls.states.wind.amount * .32 : 0;
      turbineYaws[index].rotation.y = yaw;
      turbineYaws[index].updateMatrixWorld(true);
      rotors[index].position.copy(turbineHubs[index]);
      turbineYaws[index].localToWorld(rotors[index].position);
      rotors[index].rotation.z = time * cityTurbines[index].rate + cityTurbines[index].phase;
      // Keep the public rotor yaw value while its pivot remains a sibling of the housing.
      rotors[index].rotation.y = yaw;
      rotors[index].updateMatrix();
      steelBatch.setMatrixAt(index, turbineYaws[index].matrix);
      darkBatch.setMatrixAt(index, turbineYaws[index].matrix);
      gearboxBatch.setMatrixAt(index, turbineYaws[index].matrix);
      rearBatch.setMatrixAt(index, turbineYaws[index].matrix);
      rotorBatch.setMatrixAt(index, rotors[index].matrix);
    }
    steelBatch.instanceMatrix.needsUpdate = true; darkBatch.instanceMatrix.needsUpdate = true;
    gearboxBatch.instanceMatrix.needsUpdate = true; rearBatch.instanceMatrix.needsUpdate = true; rotorBatch.instanceMatrix.needsUpdate = true;
    for (let index = 0; index < panels.length; index++) {
      const panel = panels[index];
      const response = controls.states.solar.amount;
      const solarHeading=Math.atan2(-sunDirection[0],-sunDirection[2]);
      const heading = Math.max(-.72, Math.min(.72, solarHeading - panel.yaw));
      const tilt=-.13-Math.max(0,Math.min(.04,(sunDirection[1]-.35)*.12));
      dummy.position.set(panel.x, panel.y, panel.z); dummy.rotation.set(tilt-response*.025, panel.yaw + heading, 0, 'YXZ'); dummy.scale.set(panel.width, 1, panel.depth); dummy.updateMatrix();
      frames.setMatrixAt(index, dummy.matrix); cells.setMatrixAt(index, dummy.matrix);
    }
    frames.instanceMatrix.needsUpdate = true; cells.instanceMatrix.needsUpdate = true;
    materials.station.emissiveIntensity = .03 + cityStationActivity(stationRoute, time) * .6 + controls.states.station.amount * .8;
    const {position:ferryPosition,speed} = coastalFerry.update(time,paused);
    coastalSoundScene.ferry=ferryPosition.toArray();coastalSoundScene.ferrySpeed=paused?0:speed;
    coastalSoundScene.fountainPressure=1+controls.states.fountain.amount*.18;
  };
  update(0, stationRoute);
  return { root, update, setQuality(quality: EnvironmentProps['quality']) { detail = quality === 'high' ? 1 : quality === 'medium' ? .65 : .35; ferry.visible = quality !== 'low'; }, retain() { clearTimeout(disposeTimer); return () => { disposeTimer = setTimeout(() => { mechanisms.dispose(); coastalFerry.dispose(); geometryResources.forEach(geometry => geometry.dispose()); root.traverse(object => { if (object instanceof InstancedMesh) object.dispose(); }); Object.values(materials).forEach(material => material.dispose()); }, 0); }; } };
}

export function CityLife({ runtime, paused, quality, route }: EnvironmentProps & { route: CityTransitRoute }) {
  const [city] = useState(() => createCityLife(route));
  const [controls] = useState(createTownInteractionState);
  useEffect(() => city.retain(), [city]);
  useEffect(() => city.setQuality(quality), [city, quality]);
  useFrame((_, delta) => { controls.advance(delta, paused); city.update(runtime.current.elapsed, route, controls, paused, runtime.current.sunDirection); });
  return <><primitive object={city.root} dispose={null} /><GardenFountain runtime={runtime} paused={paused} quality={quality} controls={controls} /><TownInteractions controls={controls} /></>;
}
