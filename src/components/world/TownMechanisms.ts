import { BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, Group, InstancedMesh, LatheGeometry, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityBuildings, cityLocalToWorld, type CityTransitRoute } from './city';
import { GREENHOUSE_VENT_LOCAL, TOWN_BUOY_SITE } from './TownInteractions';
import type { TownInteractionState } from './townInteractionState';

import { harborWaterHeight } from './waterSurface';
export { harborWaterHeight } from './waterSurface';

export function createTownMechanisms(route: CityTransitRoute) {
  const root = new Group(); root.name = 'town-working-mechanisms';
  const geometries = new Set<BufferGeometry>();
  const materials = {
    shell: new MeshStandardMaterial({ color: '#d6e0ca', roughness: .67, metalness: .18 }),
    metal: new MeshStandardMaterial({ color: '#637972', roughness: .42, metalness: .65 }),
    dark: new MeshStandardMaterial({ color: '#203b37', roughness: .92 }),
    brass: new MeshStandardMaterial({ color: '#d4a76a', roughness: .38, metalness: .72 }),
    buoy: new MeshStandardMaterial({ color: '#e8ba68', roughness: .64, metalness: .12 }),
    signal: new MeshStandardMaterial({ color: '#a8e9c1', emissive: '#6bddb1', emissiveIntensity: .08, roughness: .32 }),
    buoySignal: new MeshStandardMaterial({ color: '#e7cf84', emissive: '#edc35b', emissiveIntensity: .08, roughness: .32 }),
    route: new MeshStandardMaterial({ color: '#b1ffe1', emissive: '#73efc7', emissiveIntensity: 1.2, transparent: true, opacity: 0, depthWrite: false, roughness: .5 }),
  };
  function mesh(name: string, geometry: BufferGeometry, material: MeshStandardMaterial, parent = root) {
    geometries.add(geometry); const object = new Mesh(geometry, material); object.name = name; object.castShadow = !material.transparent; object.raycast = () => {}; parent.add(object); return object;
  }
  function combine(parts: BufferGeometry[]) { const result = mergeGeometries(parts)!; parts.forEach(part => part.dispose()); return result; }
  const greenhouse = cityBuildings.find(building => building.id === 'winter-garden')!;
  const vent = new Group(); vent.name = 'greenhouse-exhaust-housing'; vent.position.fromArray(cityLocalToWorld(greenhouse, GREENHOUSE_VENT_LOCAL)); vent.rotation.y = greenhouse.rotation; root.add(vent);
  mesh('greenhouse-connected-duct', combine([
    new BoxGeometry(1.22, .075, .3).translate(0, -.375, 0), new BoxGeometry(1.22, .075, .3).translate(0, .375, 0),
    new BoxGeometry(.075, .75, .3).translate(-.575, 0, 0), new BoxGeometry(.075, .75, .3).translate(.575, 0, 0),
  ]), materials.shell, vent);
  mesh('greenhouse-duct-depth', new BoxGeometry(1.1, .68, .035).translate(0, 0, -.125), materials.dark, vent);
  const louvers: Group[] = []; const louverGeometry = new BoxGeometry(1.08, .113, .025).translate(0, -.0565, 0);
  geometries.add(louverGeometry);
  const louverBlades = new InstancedMesh(louverGeometry, materials.metal, 6);
  louverBlades.name = 'greenhouse-louver-blades'; louverBlades.castShadow = true; louverBlades.frustumCulled = false; louverBlades.raycast = () => {}; vent.add(louverBlades);
  for (let index = 0; index < 6; index++) {
    const hinge = new Group(); hinge.name = `greenhouse-louver-${index}`; hinge.position.set(0, .338 - index * .113, .15); vent.add(hinge); louvers.push(hinge);
    hinge.updateMatrix(); louverBlades.setMatrixAt(index, hinge.matrix);
  }
  mesh('greenhouse-vent-indicator', new SphereGeometry(.045, 8, 6).translate(.57, -.30, .17), materials.signal, vent);
  const buoy = new Group(); buoy.name = 'harbor-buoy'; buoy.position.set(TOWN_BUOY_SITE.x, 0, TOWN_BUOY_SITE.z); root.add(buoy);
  mesh('harbor-buoy-float', combine([new TorusGeometry(.28, .115, 8, 24).rotateX(Math.PI / 2), new CylinderGeometry(.21, .27, .25, 16).translate(0, -.03, 0)]), materials.buoy, buoy);
  mesh('harbor-buoy-cage', combine([
    ...[-1, 1].map(side => new CylinderGeometry(.023, .028, .64, 8).translate(side * .2, .37, 0)),
    new TorusGeometry(.2, .027, 6, 20).rotateX(Math.PI / 2).translate(0, .67, 0),
    new CylinderGeometry(.04, .055, .2, 8).translate(0, -.23, 0),
  ]), materials.metal, buoy);
  const bell = new Group(); bell.name = 'harbor-buoy-bell'; bell.position.y = .63; buoy.add(bell);
  mesh('harbor-brass-bell', combine([new LatheGeometry([[.018,0],[.044,-.018],[.059,-.05],[.069,-.12],[.103,-.18],[.154,-.20],[.155,-.222],[.129,-.224],[.08,-.18],[.044,-.08],[.018,-.045]].map(([r,y])=>new Vector2(r,y)),32), new SphereGeometry(.029, 12, 8).translate(0, -.22, 0), new CylinderGeometry(.008,.008,.16,8).translate(0,-.12,0), new TorusGeometry(.025,.008,6,16).translate(0,.014,0)]), materials.brass, bell);
  const lens = mesh('harbor-buoy-lens', new SphereGeometry(.075, 10, 8).translate(0, .75, 0), materials.buoySignal, buoy); lens.castShadow = false;
  const center = new Vector3(); const ahead = new Vector3(); const points: Vector3[] = [];
  for (let index = 0; index <= 256; index++) {
    const t = index / 256; route.curve.getPointAt(t, center); route.curve.getPointAt((t + .0001) % 1, ahead); ahead.sub(center).normalize();
    points.push(new Vector3(center.x + ahead.z * .47, center.y + .045, center.z - ahead.x * .47));
  }
  const routeLight = mesh('station-illuminated-transit-route', new TubeGeometry(new CatmullRomCurve3(points), 256, .023, 4, false), materials.route);
  routeLight.castShadow = false; routeLight.visible = false;
  let time = 0; let waterDetail = 1; let disposed = false;
  return { root, materials, louvers, buoy, bell, routeLight,
    update(elapsed: number, controls: TownInteractionState, reducedMotion: boolean, detail = 1) {
      if (!reducedMotion) { time = elapsed; waterDetail = detail; }
      const ventAmount = controls.states.greenhouse.amount; const response = controls.states.buoy.amount;
      for (let index = 0; index < louvers.length; index++) { const hinge = louvers[index]; hinge.rotation.x = -ventAmount * 1.02; hinge.updateMatrix(); louverBlades.setMatrixAt(index, hinge.matrix); }
      louverBlades.instanceMatrix.needsUpdate = true;
      routeLight.visible = controls.states.station.amount > .001; materials.route.opacity = controls.states.station.amount * .88;
      materials.signal.emissiveIntensity = .08 + ventAmount * .55;
      materials.buoySignal.emissiveIntensity = .08 + response * .55;
      buoy.position.y = harborWaterHeight(TOWN_BUOY_SITE.x, TOWN_BUOY_SITE.z, time, waterDetail);
      buoy.rotation.x = Math.sin(time * .7) * .055;
      buoy.rotation.z = Math.sin(time * .91) * .065;
      bell.rotation.z = response * (reducedMotion ? .28 : Math.sin(time * 6) * .42);
    },
    dispose() { if (disposed) return; disposed = true; louverBlades.dispose(); root.clear(); geometries.forEach(geometry => geometry.dispose()); Object.values(materials).forEach(material => material.dispose()); },
  };
}
