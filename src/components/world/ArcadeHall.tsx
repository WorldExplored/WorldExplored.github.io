'use client';

/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, Color, CylinderGeometry, InstancedMesh, MeshStandardMaterial, Object3D, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import { combine, roundedBox, stroke, usePalette, useResources, type ModelProps } from './BuildingKit';
import { floorRectangle, floorSlab, FurnishedInterior, InteriorBuilder } from './InteriorKit';
import { architecturalBox as box, doorway, windowBay, type ShellParts } from './LandmarkShellKit';

export const ARCADE_BOUNDS = { halfWidth: 3.48, front: 3.0, back: -3.03, top: 4.85, entrance: [0, 1.08, 2.42] as const };
export const ARCADE_PLAN = [[-3.47, -1.94], [-2.08, -3.02], [3.47, -3.02], [3.47, 2.52], [-3.47, 2.52]] as const;
const FLOOR = 1.075;
const CABINETS = [
  { x: -2.4, z: -1.85, width: .72, height: 1.84 }, { x: -1.53, z: -2.23, width: .76, height: 1.69 },
  { x: -.5, z: -2.25, width: .84, height: 1.94 }, { x: .57, z: -2.22, width: .75, height: 1.77 },
  { x: 1.61, z: -2.24, width: .78, height: 1.88 }, { x: 2.58, z: -2.20, width: .69, height: 1.72 },
];
const LETTERS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
};
function marqueeLetters() {
  const parts: BufferGeometry[] = [];
  for (const [letter, character] of [...'ARCADE'].entries()) LETTERS[character].forEach((row, y) => [...row].forEach((value, x) => {
    if (value === '1') parts.push(box(.082, .065, .034, -1.565 + (letter * 6 + x) * .09, 4.20 - y * .077, 2.56));
  }));
  return combine(parts);
}

export function createArcadeHall() {
  const shell: ShellParts = { walls: [], glass: [], frames: [] }, ceiling = 3.65;
  doorway(shell, 0, 2.2, 1.25, FLOOR, ceiling);
  for (const x of [-1.9125, 1.9125]) windowBay(shell, x, 2.2, 2.575, FLOOR, ceiling, 0, .28);
  windowBay(shell, -3.12, .175, 4.05, FLOOR, ceiling, Math.PI / 2, .34);
  for (const z of [-1.55, .95]) windowBay(shell, 3.12, z, 2.5, FLOOR, ceiling, Math.PI / 2, .34);
  shell.walls.push(box(5.2, ceiling - FLOOR, .16, .6, (ceiling + FLOOR) / 2, -2.8));
  shell.walls.push(box(Math.hypot(1.12, .95), ceiling - FLOOR, .16, 0, 0, 0).rotateY(Math.atan2(.95, 1.12)).translate(-2.56, (ceiling + FLOOR) / 2, -2.325));
  const ribs: BufferGeometry[] = [];
  for (const x of [-3.05, -1.52, 0, 1.52, 3.05]) {
    const start = x < -2.08 ? -1.94 - (x + 3.47) / 1.39 * 1.08 + .08 : -2.95;
    ribs.push(stroke(t => new Vector3(x, 3.88, start + t * (2.4 - start)), .04, 12));
  }
  const roof = floorSlab('arcade-roof', [ARCADE_PLAN], 3.875, .23); delete roof.userData.floor;
  return {
    base: floorSlab('arcade-foundation', [[[-3.275, -1.92], [-2.08, -2.88], [3.275, -2.88], [3.275, 2.28], [-3.275, 2.28]]], 1.05, .28, 'foundation'),
    threshold: floorSlab('arcade-threshold', [floorRectangle(0, 2.42, 1.4, .6)], 1.08, .28, 'threshold'),
    walls: combine(shell.walls), glass: combine(shell.glass), frames: combine(shell.frames),
    roof, ribs: combine(ribs),
    fascia: roundedBox(4.58, .84, .22, .15).translate(0, 3.95, 2.4),
    sign: marqueeLetters(),
    marqueeRim: combine([stroke(t => new Vector3(-2.24 + t * 4.48, 4.40, 2.5), .045, 12), stroke(t => new Vector3(-2.24 + t * 4.48, 3.51, 2.5), .045, 12), ...[-1, 1].map(side => box(.055, .85, .07, side * 2.25, 3.95, 2.51))]),
    fins: combine([-1, 1].flatMap(side => [roundedBox(.22, 1.8, .4, .09).rotateZ(-side * .12).translate(side * 3.05, 3.90, 1.73), box(.11, 1.27, .04, side * 3.07, 3.86, 1.951)])),
    canopy: roundedBox(2.1, .13, .83, .16).translate(0, 3.32, 2.565),
    skirt: combine([box(.08, .18, 4.05, -3.19, 1.30, .175), box(.08, .18, 4.96, 3.19, 1.30, -.3)]),
  };
}

export function createArcadeInterior() {
  const b = new InteriorBuilder();
  b.add('paper', floorSlab('arcade-room-floor', [[[-3.025, -1.8], [-1.96, -2.68], [3.025, -2.68], [3.025, 2.08], [-3.025, 2.08]]], FLOOR, .025));
  // Inlaid blue tiles leave one clear route from the doorway to six cabinets.
  for (let x = 0; x < 12; x++) for (let z = 0; z < 9; z++) if ((x + z) % 2 === 0 && !(x < 2 && z < 2)) b.box('coolant', .477, .008, .477, -2.64 + x * .48, FLOOR + .008, -2.26 + z * .48);
  for (const [index, c] of CABINETS.entries()) {
    const h = c.height;
    b.box('metal', c.width, h * .58, .53, c.x, FLOOR + h * .29, c.z);
    b.box('fabric', c.width + .025, .11, .7, c.x, FLOOR + h * .53, c.z + .07);
    b.box('screen', c.width - .12, h * .31, .055, c.x, FLOOR + h * .77, c.z - .08);
    for (const side of [-1, 1]) b.box(index % 3 ? 'coolant' : 'fabric', .075, h * .47, .55, c.x + side * (c.width / 2 - .038), FLOOR + h * .77, c.z - .09);
    b.box('light', c.width - .08, .14, .04, c.x, FLOOR + h - .06, c.z + .18);
    b.box('metal', .085, .15, .055, c.x + c.width * .21, FLOOR + .44, c.z + .284);
    b.box('paper', .045, .018, .06, c.x + c.width * .21, FLOOR + .47, c.z + .316);
    b.add('metal', new CylinderGeometry(.018, .018, .11, 8).translate(c.x - c.width * .22, FLOOR + h * .53 + .1, c.z + .19));
    b.add('fabric', new SphereGeometry(.046, 10, 8).translate(c.x - c.width * .22, FLOOR + h * .53 + .165, c.z + .19));
    for (let key = 0; key < 3; key++) b.add('light', new CylinderGeometry(.026, .026, .018, 10).translate(c.x + .015 + key * .065, FLOOR + h * .53 + .07, c.z + .21));
    const pattern = index === 0 ? ['1000', '1100', '0111'] : index === 1 ? ['1010', '0101', '1010'] : index === 2 ? ['1111', '1101', '0000'] : index === 3 ? ['1001', '0000', '1001'] : index === 4 ? ['1001', '1001', '1001'] : ['0100', '1110', '0111'];
    pattern.forEach((row, y) => [...row].forEach((pixel, x) => { if (pixel === '1') b.box(index % 2 ? 'fabric' : 'light', .052, .049, .016, c.x + (x - 1.5) * .083, FLOOR + h * .85 - y * .078, c.z - .042); }));
    // Speaker grilles and lower kick plates make each upright read as a real cabinet.
    for (let vent = 0; vent < 5; vent++) b.box('paper', .018, .07, .018, c.x - .09 + vent * .04, FLOOR + h - .05, c.z + .208);
    b.box('pipe', c.width - .07, .10, .016, c.x, FLOOR + .12, c.z + .274);
  }
  b.box('fabric', .92, .025, 1.64, -2.13, FLOOR + .025, .48);
  b.box('metal', .69, .49, .65, -2.13, FLOOR + .245, .38);
  b.box('screen', .79, .07, .76, -2.13, FLOOR + .52, .38);
  b.chair(-2.13, FLOOR, 1.35, Math.PI); b.chair(-2.13, FLOOR, -.59);
  b.box('fabric', .66, .18, 1.65, 2.51, FLOOR + .38, .66);
  b.box('coolant', .12, .4, 1.65, 2.79, FLOOR + .60, .66);
  for (const z of [-.06, 1.34]) b.box('metal', .45, .3, .065, 2.51, FLOOR + .15, z);
  b.table(1.48, FLOOR, .72, .58, .76, .49);
  b.box('paper', .14, .17, .14, 1.48, FLOOR + .62, .71);
  b.box('coolant', .78, 1.66, .58, 2.49, FLOOR + .83, -.74);
  b.box('screen', .56, 1.11, .035, 2.49, FLOOR + 1.06, -.43);
  for (let row = 0; row < 4; row++) for (let bottle = 0; bottle < 3; bottle++) b.add(row % 2 ? 'paper' : 'light', new CylinderGeometry(.035, .035, .16, 7).translate(2.31 + bottle * .18, FLOOR + .63 + row * .24, -.39));
  b.plant(2.72, FLOOR, 1.77, .8); b.plant(-2.76, FLOOR, 1.79, .65);
  for (const x of [-1.45, 1.45]) for (const z of [-1.4, 1]) b.lamp(x, 3.60, z, 1.15);
  return b.finish();
}

function createArcadeLights() {
  const material = new MeshStandardMaterial({ color: '#ffffff', emissive: '#3facc2', emissiveIntensity: .42, roughness: .3, toneMapped: false }), geometry = new BoxGeometry(.052, .052, .042);
  const lamps = new InstancedMesh(geometry, material, 54), transform = new Object3D(), tint = new Color();
  lamps.name = 'arcade-marquee-lamps'; lamps.position.y = FLOOR; lamps.frustumCulled = false; lamps.raycast = () => undefined;
  const positions = Array.from({ length: 48 }, (_, i) => {
    if (i < 18) return [-2.06 + i * .243, 4.33, 2.541];
    if (i < 36) return [-2.06 + (i - 18) * .243, 3.58, 2.541];
    return [i < 42 ? -2.17 : 2.17, 3.69 + (i % 6) * .105, 2.541];
  });
  for (let index = 0; index < 54; index++) {
    const cabinet = CABINETS[index - 48];
    const position = positions[index] ?? [cabinet.x + Math.sin(index - 48) * .16, FLOOR + cabinet.height * .75 + Math.cos(index - 48) * .09, cabinet.z - .022];
    transform.position.set(position[0], position[1] - FLOOR, position[2]); transform.updateMatrix();
    lamps.setMatrixAt(index, transform.matrix); lamps.setColorAt(index, tint.set(index % 3 ? '#9ef3e7' : '#dcf77e'));
  }
  const lettering = new MeshStandardMaterial({ color: '#b3eb79', emissive: '#86c65e', emissiveIntensity: .65, roughness: .38 });
  return { lamps, material, lettering, geometry, transform, tint, positions };
}

export function ArcadeHall(props: ModelProps) {
  const geometry = useResources(createArcadeHall), material = usePalette(props, 'arcade');
  const lights = useMemo(() => createArcadeLights(), []);
  useEffect(() => () => { lights.lamps.dispose(); lights.geometry.dispose(); lights.material.dispose(); lights.lettering.dispose(); }, [lights]);
  useFrame(() => {
    const time = props.paused ? 0 : props.runtime.current.elapsed;
    for (let i = 0; i < 48; i++) {
      const glow = .42 + .58 * Math.max(0, Math.sin(i * .43 - time * 2.1));
      lights.lamps.setColorAt(i, lights.tint.set(i % 3 ? '#9ef3e7' : '#dcf77e').multiplyScalar(glow));
    }
    for (let i = 0; i < CABINETS.length; i++) {
      const cabinet = CABINETS[i];
      lights.transform.position.set(cabinet.x + Math.sin(time * (.7 + i * .13) + i) * .16, cabinet.height * .75 + Math.cos(time * .9 + i) * .09, cabinet.z - .022);
      lights.transform.updateMatrix(); lights.lamps.setMatrixAt(48 + i, lights.transform.matrix);
      lights.lamps.setColorAt(48 + i, lights.tint.set(i % 2 ? '#effca3' : '#76f4ff'));
    }
    lights.lamps.instanceMatrix.needsUpdate = true;
    if (lights.lamps.instanceColor) lights.lamps.instanceColor.needsUpdate = true;
  });
  return <group dispose={null} name="aero-arcade-hall">
    <mesh geometry={geometry.base} material={material.paving} receiveShadow/>
    <mesh geometry={geometry.threshold} material={material.paving} receiveShadow/>
    <mesh geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow/>
    <mesh geometry={geometry.glass} material={material.facade}/>
    <mesh geometry={geometry.frames} material={material.navy} castShadow/>
    <mesh geometry={geometry.roof} material={material.cyan} castShadow receiveShadow/>
    <mesh geometry={geometry.ribs} material={material.edge} castShadow/>
    <mesh geometry={geometry.fascia} material={material.navy} castShadow/>
    <mesh geometry={geometry.sign} material={lights.lettering}/>
    <mesh geometry={geometry.marqueeRim} material={material.edge}/>
    <mesh geometry={geometry.fins} material={material.porcelain} castShadow/>
    <mesh geometry={geometry.canopy} material={material.porcelain} castShadow/>
    <mesh geometry={geometry.skirt} material={material.navy}/>
    <primitive object={lights.lamps}/>
    <FurnishedInterior name="arcade-games-room" build={createArcadeInterior}/>
  </group>;
}
