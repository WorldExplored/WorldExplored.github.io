'use client';

import { useEffect, useState } from 'react';
import { world } from '../../content/world';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, CapsuleGeometry, CatmullRomCurve3, CylinderGeometry, ExtrudeGeometry, Group, InstancedMesh, Mesh, MeshPhysicalMaterial, Object3D, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityBuildings, cityLocalToWorld, cityRoofMounts, cityStationActivity, type CityTransitRoute } from './city';
import { cityDocks, cityFerryDistance, cityTurbines, createCityFerryRoute, writeCityFerryPose } from './cityInfrastructure';
import { terrainHeight } from './terrain';
import { GardenFountain } from './GardenFountain';
import type { EnvironmentProps } from './Water';
import { createTownInteractionState, type TownInteractionState } from './townInteractionState';
import { TownInteractions } from './TownInteractions';
import { createTownMechanisms } from './TownMechanisms';

export function createCityLife(stationRoute: CityTransitRoute) {
  const root = new Group(); root.name = 'operating-city-infrastructure';
  const mechanisms = createTownMechanisms(stationRoute); root.add(mechanisms.root);
  const geometryResources = new Set<BufferGeometry>();
  const materials = {
    white: new MeshPhysicalMaterial({ color: '#f3fff6', roughness: .4, metalness: .03, clearcoat: .3, clearcoatRoughness: .2 }),
    aqua: new MeshPhysicalMaterial({ color: '#3fdee6', roughness: .45, metalness: .25, clearcoat: .12 }),
    solar: new MeshPhysicalMaterial({ color: '#236986', roughness: .24, metalness: .07, clearcoat: .9 }),
    wake: new MeshPhysicalMaterial({ color: '#c1fffa', roughness: .3, metalness: 0, clearcoat: .8, transparent: true, opacity: .22, depthWrite: false }),
    station: new MeshPhysicalMaterial({ color: '#d0fff8', emissive: '#68eeed', emissiveIntensity: 0, roughness: .25, metalness: .02, clearcoat: .9 }),
  };
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
    shape.bezierCurveTo(.38, .32, .38, 1.16, .1, 2.27);
    shape.bezierCurveTo(.01, 2.42, -.08, 2.31, -.04, 2.1);
    shape.bezierCurveTo(.04, 1.18, -.23, .45, 0, .05);
    return new ExtrudeGeometry(shape, { depth: .065, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, curveSegments: 18 }).translate(0, 0, -.035);
  };
  const fixed: BufferGeometry[] = []; const water: BufferGeometry[] = [];
  const rotors: Group[] = [];
  for (const [index, turbine] of cityTurbines.entries()) {
    const floor = terrainHeight(turbine.x, turbine.z);
    fixed.push(new CylinderGeometry(.13, .27, turbine.height, 20).translate(turbine.x, floor + turbine.height / 2, turbine.z));
    fixed.push(new CylinderGeometry(.52, .61, .2, 24).translate(turbine.x, floor + .1, turbine.z));
    const rotor = new Group(); rotor.name = `city-wind-turbine-${index}`; rotor.position.set(turbine.x, floor + turbine.height, turbine.z + .23); root.add(rotor); rotors.push(rotor);
    add(`city-sculpted-turbine-blades-${index}`, merged([new SphereGeometry(.24, 20, 12).scale(1, 1, 1.5), ...Array.from({ length: 3 }, (_, bladeIndex) => blade().rotateZ(bladeIndex * Math.PI * 2 / 3))]), materials.white, rotor);
  }
  for (const dock of cityDocks) {
    fixed.push(new BoxGeometry(dock.width, .16, dock.length).translate(dock.x, dock.y - .08, dock.z));
    for (const side of [-1, 1]) for (const step of [-1, 0, 1]) {
      const z = dock.z + step * (dock.length / 2 - .3);
      const floor = Math.min(terrainHeight(dock.x, z), .2);
      fixed.push(new CylinderGeometry(.055, .065, dock.y + .43 - floor, 10).translate(dock.x + side * .59, (dock.y + .43 + floor) / 2, z));
    }
    fixed.push(new BoxGeometry(.055, .055, dock.length - .4).translate(dock.x + .59, dock.y + .42, dock.z));
    fixed.push(new BoxGeometry(.055, .055, dock.length - .4).translate(dock.x - .59, dock.y + .42, dock.z));
    water.push(new BoxGeometry(.035, .025, dock.length - .6).translate(dock.x + .45, dock.y + .01, dock.z));
  }
  // Boarding fingers reach the taxi's two safe offshore stops.
  fixed.push(new BoxGeometry(.3, .16, 1.05).translate(-12.7, .98, -60));
  fixed.push(new BoxGeometry(2.2, .16, .5).translate(-8, .98, -24.45));
  // Public station rail and canopy lights align with the existing transit hall.
  fixed.push(new BoxGeometry(2.2, .09, .75).translate(-5, 3.08, -67.15));
  for (const index of [-1, 0, 1]) fixed.push(new BoxGeometry(.025, .12, .025).translate(-5 + index * .64, 5.26, -66.87));
  add('city-public-infrastructure', merged(fixed), materials.white);
  add('city-dock-guide-stripes', merged(water), materials.aqua);

  const solarHeading = Math.atan2(-world.lighting.sunPosition[0], -world.lighting.sunPosition[2]);
  const panels: Array<{ x: number; y: number; z: number; yaw: number; width: number; depth: number; phase: number }> = [];
  const solarSupports:BufferGeometry[]=[];
  for (const mount of cityRoofMounts) {
    panels.push({x:mount.world[0],y:mount.world[1]+.20,z:mount.world[2],yaw:mount.yaw,width:mount.width,depth:mount.depth,phase:mount.world[0]*.06});
    solarSupports.push(new BoxGeometry(.1,.22,.1).translate(mount.world[0],mount.world[1]+.09,mount.world[2]));
  }
  const supports=add('solar-roof-supports',merged(solarSupports),materials.white);supports.geometry.userData.mounts=cityRoofMounts.map(mount=>mount.building);
  const frames = instance('city-articulated-solar-frames', panels.length, new BoxGeometry(1, .055, 1), materials.aqua);
  const cells = instance('city-articulated-solar-cells', panels.length, merged([new BoxGeometry(.88, .014, .39).translate(0, .036, -.235), new BoxGeometry(.88, .014, .39).translate(0, .036, .235)]), materials.solar);
  const pods = instance('city-maintenance-pods', 2, merged([new CapsuleGeometry(.18, .45, 4, 12).rotateZ(Math.PI / 2), new TorusGeometry(.29, .035, 6, 16).rotateY(Math.PI / 2).translate(-.22, 0, 0), new TorusGeometry(.29, .035, 6, 16).rotateY(Math.PI / 2).translate(.22, 0, 0), ...[-1,1].flatMap(side=>[new BoxGeometry(.16,.10,.12).translate(side*.34,0,.19),new TorusGeometry(.065,.023,6,12).rotateY(Math.PI/2).translate(side*.4,0,.22)])]), materials.white);
  // Captive service lifts have a visible ground dock and fixed rails behind two buildings.
  const lifts=cityBuildings.filter(building=>['residence-west','residence-east'].includes(building.id)).map(building=>{
    const [x,base,z]=cityLocalToWorld(building,[0,0,-building.depth/2-.75]);
    return {x,z,base,yaw:building.rotation,height:building.height-.4};
  });
  const guides:BufferGeometry[]=[];
  for(const lift of lifts){
    const frame=new Object3D();frame.position.set(lift.x,lift.base,lift.z);frame.rotation.y=lift.yaw;frame.updateMatrix();
    for(const side of [-1,1])guides.push(new BoxGeometry(.045,lift.height,.06).translate(side*.4,lift.height/2,.22).applyMatrix4(frame.matrix));
    guides.push(new BoxGeometry(1.1,.16,1).translate(0,.08,0).applyMatrix4(frame.matrix));
  }
  add('city-service-lift-guides-and-docks',merged(guides),materials.aqua);
  const station = add('city-station-arrival-lights', merged([-1, 0, 1].map(index => new BoxGeometry(.42, .04, .07).translate(-5 + index * .64, 5.18, -66.87))), materials.station);
  station.castShadow = false;

  const ferryRoute = createCityFerryRoute();
  const ferry = new Group(); ferry.name = 'city-water-taxi'; root.add(ferry);
  const hull = merged([-1, 1].map(side => new CapsuleGeometry(.2, 1.75, 4, 16).rotateX(Math.PI / 2).translate(side * .45, .06, 0)));
  const roof = new CapsuleGeometry(.43, .83, 4, 18).rotateX(Math.PI / 2).scale(1, .2, 1).translate(0, .82, 0);
  const glazing = new CapsuleGeometry(.39, .75, 4, 18).rotateX(Math.PI / 2).scale(1, .62, 1).translate(0, .5, 0);
  add('city-water-taxi-shell', merged([merged([hull, roof, new BoxGeometry(.95, .12, 1.7).translate(0, .2, 0)]), glazing], true), [materials.white, materials.aqua], ferry);
  const wake = add('city-water-taxi-wake', merged([-1, 1].map(side => new TubeGeometry(new CatmullRomCurve3([new Vector3(side * .38, .03, -.6), new Vector3(side * .75, .03, -1.5), new Vector3(side * 1.15, .03, -2.55)]), 24, .028, 5, false))), materials.wake, ferry);
  wake.castShadow = false;
  const dummy = new Object3D(); const ferryPosition = new Vector3(); const ferryTangent = new Vector3();
  let disposeTimer: ReturnType<typeof setTimeout> | undefined;
  let displayedTime = 0; let detail = 1;
  const idleControls = createTownInteractionState();
  const update = (elapsed: number, stationRoute: CityTransitRoute, controls: TownInteractionState = idleControls, paused = false) => {
    if (!paused) displayedTime = elapsed;
    const time = displayedTime;
    mechanisms.update(time, controls, paused, detail);
    for (let index = 0; index < rotors.length; index++) {
      rotors[index].rotation.z = time * cityTurbines[index].rate + cityTurbines[index].phase;
      rotors[index].rotation.y = index === 0 ? controls.states.wind.amount * .32 : 0;
    }
    for (let index = 0; index < panels.length; index++) {
      const panel = panels[index];
      const response = controls.states.solar.amount;
      const heading = Math.max(-.6, Math.min(.6, solarHeading - panel.yaw));
      dummy.position.set(panel.x, panel.y, panel.z); dummy.rotation.set((-.13 + Math.sin(time * .13 + panel.phase) * .055) * (1 - response) - .16 * response, panel.yaw + heading * response, 0, 'YXZ'); dummy.scale.set(panel.width, 1, panel.depth); dummy.updateMatrix();
      frames.setMatrixAt(index, dummy.matrix); cells.setMatrixAt(index, dummy.matrix);
    }
    frames.instanceMatrix.needsUpdate = true; cells.instanceMatrix.needsUpdate = true;
    for (let index = 0; index < 2; index++) {
      const phase = (time + index * 9) % 22; const travel = Math.min(1, Math.max(0, (phase - 3) / 16));
      const eased = (1 - Math.cos(travel * Math.PI * 2)) / 2;
      const lift=lifts[index];
      dummy.position.set(lift.x,lift.base+.485+eased*(lift.height-.8),lift.z); dummy.rotation.set(0,lift.yaw,0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); pods.setMatrixAt(index, dummy.matrix);
    }
    pods.instanceMatrix.needsUpdate = true;
    materials.station.emissiveIntensity = .03 + cityStationActivity(stationRoute, time) * .6 + controls.states.station.amount * .8;
    writeCityFerryPose(ferryRoute, time, ferryPosition, ferryTangent);
    ferry.position.copy(ferryPosition); ferry.rotation.y = Math.atan2(ferryTangent.x, ferryTangent.z);
    const speed = ((cityFerryDistance(ferryRoute, time + .02) - cityFerryDistance(ferryRoute, time) + ferryRoute.length) % ferryRoute.length) / .02;
    const wakeStrength = Math.min(1, speed / ferryRoute.speed);
    wake.visible = wakeStrength > .015; materials.wake.opacity = .22 * wakeStrength;
  };
  update(0, stationRoute);
  return { root, update, setQuality(quality: EnvironmentProps['quality']) { detail = quality === 'high' ? 1 : quality === 'medium' ? .65 : .35; ferry.visible = quality !== 'low'; pods.visible = quality === 'high'; }, retain() { clearTimeout(disposeTimer); return () => { disposeTimer = setTimeout(() => { mechanisms.dispose(); geometryResources.forEach(geometry => geometry.dispose()); root.traverse(object => { if (object instanceof InstancedMesh) object.dispose(); }); Object.values(materials).forEach(material => material.dispose()); }, 0); }; } };
}

export function CityLife({ runtime, paused, quality, route }: EnvironmentProps & { route: CityTransitRoute }) {
  const [city] = useState(() => createCityLife(route));
  const [controls] = useState(createTownInteractionState);
  useEffect(() => city.retain(), [city]);
  useEffect(() => city.setQuality(quality), [city, quality]);
  useFrame((_, delta) => { controls.advance(delta, paused); city.update(runtime.current.elapsed, route, controls, paused); });
  return <><primitive object={city.root} dispose={null} /><GardenFountain runtime={runtime} paused={paused} quality={quality} controls={controls} /><TownInteractions controls={controls} /></>;
}
