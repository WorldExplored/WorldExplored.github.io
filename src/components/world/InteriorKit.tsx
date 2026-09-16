'use client';

import { useEffect, useState } from 'react';
import { BoxGeometry, BufferGeometry, CylinderGeometry, MeshStandardMaterial, MeshPhysicalMaterial, SphereGeometry, Vector3 } from 'three';
import { combine, strut, useResources } from './BuildingKit';

export type InteriorFinish = 'wood' | 'fabric' | 'metal' | 'paper' | 'screen' | 'light' | 'leaf' | 'soil' | 'coolant' | 'pipe';
export type InteriorGeometry = Record<InteriorFinish, BufferGeometry>;
const finishes: InteriorFinish[] = ['wood', 'fabric', 'metal', 'paper', 'screen', 'light', 'leaf', 'soil', 'coolant', 'pipe'];
const timers = new WeakMap<object, ReturnType<typeof setTimeout>>();

/** Furniture is built in small assemblies, then merged into one draw per finish. */
export class InteriorBuilder {
  parts = Object.fromEntries(finishes.map(key => [key, [] as BufferGeometry[]])) as Record<InteriorFinish, BufferGeometry[]>;
  add(finish: InteriorFinish, geometry: BufferGeometry) { this.parts[finish].push(geometry); }
  box(finish: InteriorFinish, w: number, h: number, d: number, x: number, y: number, z: number, yaw = 0) {
    this.add(finish, new BoxGeometry(w, h, d).rotateY(yaw).translate(x, y, z));
  }
  rod(finish: InteriorFinish, a: number[], b: number[], radius = .025) { this.add(finish, strut(new Vector3(...a), new Vector3(...b), radius)); }
  table(x: number, floor: number, z: number, width = .85, depth = .43, height = .64) {
    this.box('wood', width, .055, depth, x, floor + height, z);
    for (const dx of [-width * .4, width * .4]) for (const dz of [-depth * .35, depth * .35]) this.box('metal', .035, height - .025, .035, x + dx, floor + (height - .025) / 2, z + dz);
  }
  chair(x: number, floor: number, z: number, yaw = 0, scale = 1) {
    const put = (finish: InteriorFinish, w: number, h: number, d: number, dx: number, y: number, dz: number) => this.box(finish, w * scale, h * scale, d * scale, x + (dx * Math.cos(yaw) + dz * Math.sin(yaw)) * scale, floor + y * scale, z + (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) * scale, yaw);
    put('fabric', .34, .075, .35, 0, .36, 0); put('fabric', .34, .33, .065, 0, .56, -.145);
    for (const dx of [-.12, .12]) for (const dz of [-.12, .12]) put('metal', .025, .32, .025, dx, .16, dz);
  }
  monitor(x: number, desktop: number, z: number, yaw = 0) {
    this.box('metal', .18, .025, .14, x, desktop + .016, z, yaw);
    this.box('metal', .025, .12, .025, x, desktop + .08, z);
    this.box('metal', .36, .24, .045, x, desktop + .245, z, yaw);
    this.box('screen', .315, .193, .012, x + Math.sin(yaw) * .029, desktop + .245, z + Math.cos(yaw) * .029, yaw);
    this.box('paper', .21, .018, .085, x + Math.sin(yaw) * .13, desktop + .032, z + Math.cos(yaw) * .13, yaw);
  }
  shelf(x: number, floor: number, z: number, width = .8, height = 1, depth = .22) {
    for (const dx of [-width / 2, width / 2]) this.box('wood', .04, height, depth, x + dx, floor + height / 2, z);
    this.box('wood', width, .035, depth, x, floor + height, z);
    for (let row = 0; row < 3; row++) {
      const y = floor + .07 + row * (height - .32) / 2;
      this.box('wood', width, .035, depth, x, y, z);
      for (let n = 0; n < 5; n++) { const bookHeight = .17 + n % 3 * .025; this.box(n % 3 === 0 ? 'fabric' : 'paper', .055 + n % 2 * .02, bookHeight, depth * .7, x - width * .35 + n * width * .145, y + .0175 + bookHeight / 2, z); }
    }
  }
  plant(x: number, floor: number, z: number, scale = 1) {
    this.add('paper', new CylinderGeometry(.13 * scale, .09 * scale, .22 * scale, 12).translate(x, floor + .11 * scale, z));
    this.add('soil', new CylinderGeometry(.118 * scale, .118 * scale, .018 * scale, 12).translate(x, floor + .225 * scale, z));
    this.rod('leaf', [x, floor + .22 * scale, z], [x, floor + .62 * scale, z], .018 * scale);
    for (let n = 0; n < 5; n++) { const a = n * 2.4; this.add('leaf', new SphereGeometry(.1, 7, 5).scale(1.6 * scale, .42 * scale, .65 * scale).rotateZ(.45).rotateY(a).translate(x + Math.cos(a) * .08 * scale, floor + (.35 + n * .055) * scale, z + Math.sin(a) * .08 * scale)); }
  }
  lamp(x: number, ceiling: number, z: number, width = .55) {
    this.box('metal', width + .055, .045, .13, x, ceiling - .035, z);
    this.box('light', width, .018, .1, x, ceiling - .064, z);
  }
  finish(): InteriorGeometry {
    return Object.fromEntries(finishes.map(key => [key, this.parts[key].length ? combine(this.parts[key]) : new BufferGeometry()])) as InteriorGeometry;
  }
}

export function FurnishedInterior({ build, name }: { build: () => InteriorGeometry; name: string }) {
  const geometry = useResources(build);
  const [materials] = useState(() => ({
    wood: new MeshStandardMaterial({ color: '#b58651', roughness: .8 }),
    fabric: new MeshStandardMaterial({ color: '#52757b', roughness: .98 }),
    metal: new MeshStandardMaterial({ color: '#7b8990', roughness: .46, metalness: .65 }),
    paper: new MeshStandardMaterial({ color: '#f5eed8', roughness: .92 }),
    screen: new MeshStandardMaterial({ color: '#143a49', roughness: .38, emissive: '#3c8791', emissiveIntensity: .22 }),
    light: new MeshStandardMaterial({ color: '#fff0cc', roughness: .5, emissive: '#ffda91', emissiveIntensity: .65 }),
    leaf: new MeshStandardMaterial({ color: '#498346', roughness: .85 }),
    soil: new MeshStandardMaterial({ color: '#433b2d', roughness: 1 }),
    coolant: new MeshStandardMaterial({ color: '#29aeb5', roughness: .23, metalness: .05 }),
    pipe: new MeshPhysicalMaterial({ color: '#d4f9f4', roughness: .08, transparent: true, opacity: .2, depthWrite: false }),
  }));
  useEffect(() => { clearTimeout(timers.get(materials)); return () => { timers.set(materials, setTimeout(() => Object.values(materials).forEach(material => material.dispose()), 0)); }; }, [materials]);
  return <group name={name} dispose={null}>{finishes.filter(key => geometry[key].getAttribute('position')?.count > 0).map(key => <mesh key={key} name={`${name}-${key}`} geometry={geometry[key]} material={materials[key]} receiveShadow raycast={() => {}} />)}</group>;
}
