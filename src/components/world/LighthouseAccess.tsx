'use client';

import { useEffect, useMemo } from 'react';
import { BoxGeometry, BufferGeometry, CurvePath, CylinderGeometry, Float32BufferAttribute, Group, LineCurve3, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { distanceToSegment, terrainMeshHeight } from './terrain';
import { applySurface } from './surfaceMaterials';

export const LIGHTHOUSE_LANDING = { x: -68, z: -35.5, top: .52, width: 2.05, depth: 2.1 } as const;
const STAIR_WIDTH = 1.36;
export const LIGHTHOUSE_ACCESS_POINTS = [
  [-68, .52, -35.5], [-68.99, .52, -35.22], [-73.25, 2.98, -34], [-74.1, 2.98, -34],
] as const;
export const LIGHTHOUSE_COURT_POINTS = [[-74.1, 2.98, -34], [-74.82, 2.86, -34], [-76, 2.86, -34], [-76, 2.86, -34.805]] as const;
export const LIGHTHOUSE_WALK = LIGHTHOUSE_ACCESS_POINTS.map(([x, , z]) => [x, z] as const);

/** One straight flight and level landings cannot overshoot or fold their rail offsets. */
export function lighthouseAccessCurve() {
  const curve = new CurvePath<Vector3>();
  for (let i = 1; i < LIGHTHOUSE_ACCESS_POINTS.length; i++) curve.add(new LineCurve3(new Vector3(...LIGHTHOUSE_ACCESS_POINTS[i - 1]), new Vector3(...LIGHTHOUSE_ACCESS_POINTS[i])));
  return curve;
}

export function lighthouseAccessClearance(x: number, z: number) {
  let distance = Infinity;
  for (const route of [LIGHTHOUSE_ACCESS_POINTS, LIGHTHOUSE_COURT_POINTS]) for (let i = 1; i < route.length; i++) {
    distance = Math.min(distance, distanceToSegment(x, z, { x: route[i - 1][0], z: route[i - 1][2] }, { x: route[i][0], z: route[i][2] }) - (route === LIGHTHOUSE_ACCESS_POINTS ? STAIR_WIDTH / 2 : .46));
  }
  return distance;
}

/** Offset adjacent straight spans to the same miter point, preserving a clear upper exit. */
export function lighthouseRailLines() {
  const points = LIGHTHOUSE_ACCESS_POINTS.map(p => new Vector3(...p));
  return [-1, 1].map(sign => points.map((point, index) => {
    const before = points[Math.max(0, index - 1)], after = points[Math.min(points.length - 1, index + 1)];
    const incoming = point.clone().sub(before).setY(0).normalize(), outgoing = after.clone().sub(point).setY(0).normalize();
    if (!index) incoming.copy(outgoing); if (index === points.length - 1) outgoing.copy(incoming);
    const first = new Vector3(incoming.z, 0, -incoming.x), second = new Vector3(outgoing.z, 0, -outgoing.x);
    const miter = first.clone().add(second).normalize(), reach = STAIR_WIDTH / 2 / Math.max(.8, miter.dot(first));
    return point.clone().addScaledVector(miter, reach * sign).add(new Vector3(0, .95, 0));
  }));
}

export function createLighthouseAccess() {
  const root = new Group(); root.name = 'lighthouse-coastal-stairway';
  const deckMaterial = applySurface(new MeshStandardMaterial({ color: '#d5e8df', roughness: .82 }), 'mineral');
  const structure = new MeshStandardMaterial({ color: '#286c80', roughness: .42, metalness: .45 });
  const light = new MeshStandardMaterial({ color: '#a3f9e9', emissive: '#58dec7', emissiveIntensity: .25 });
  const rubber = new MeshStandardMaterial({ color: '#243d42', roughness: .93 });
  const treads: BufferGeometry[] = [], posts: BufferGeometry[] = [], lights: BufferGeometry[] = [], rails: BufferGeometry[] = [], midrails: BufferGeometry[] = [], stringers: BufferGeometry[] = [], braces: BufferGeometry[] = [], hardware: BufferGeometry[] = [], fenders: BufferGeometry[] = [], deck: BufferGeometry[] = [], piles: BufferGeometry[] = [], court: BufferGeometry[] = [];
  const up = new Vector3(0, 1, 0);
  const beam = (a: Vector3, b: Vector3, radius = .035) => {
    const delta = b.clone().sub(a);
    return new CylinderGeometry(radius, radius, delta.length(), 8).applyQuaternion(new Quaternion().setFromUnitVectors(up, delta.normalize())).translate(...a.clone().add(b).multiplyScalar(.5).toArray());
  };
  const board = (a: Vector3, b: Vector3, width: number, height: number, top: number) => {
    const yaw = Math.atan2(b.x - a.x, b.z - a.z), length = Math.hypot(b.x - a.x, b.z - a.z);
    return new BoxGeometry(width, height, length + .012).rotateY(yaw).translate((a.x + b.x) / 2, top - height / 2, (a.z + b.z) / 2);
  };
  const railLines = lighthouseRailLines();
  const treadPrism = (corners: Vector3[], top: number, bottom: number) => {
    const geometry = new BufferGeometry(), positions: number[] = [];
    for (const y of [bottom, top]) for (const p of corners) positions.push(p.x, y, p.z);
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setIndex([4, 5, 6, 4, 6, 7, 0, 2, 1, 0, 3, 2, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
    const flat = geometry.toNonIndexed(); geometry.dispose(); flat.computeVertexNormals(); return flat;
  };
  for (let segment = 1; segment < LIGHTHOUSE_ACCESS_POINTS.length; segment++) {
    const a = new Vector3(...LIGHTHOUSE_ACCESS_POINTS[segment - 1]), b = new Vector3(...LIGHTHOUSE_ACCESS_POINTS[segment]);
    const horizontal = Math.hypot(b.x - a.x, b.z - a.z), rise = b.y - a.y;
    const count = rise > 0 ? Math.ceil(rise / .155) : Math.ceil(horizontal / .24);
    for (let i = 0; i < count; i++) {
      const start = a.clone().lerp(b, i / count), end = a.clone().lerp(b, (i + 1) / count);
      // Closed risers extend to the previous tread; no sky is visible through the flight.
      const sides = railLines.map(line => [line[segment - 1].clone().lerp(line[segment], i / count), line[segment - 1].clone().lerp(line[segment], (i + 1) / count)]);
      treads.push(treadPrism([sides[0][0], sides[0][1], sides[1][1], sides[1][0]], end.y, end.y - (rise > 0 ? rise / count + .15 : .15)));
      if (i % 4 === 0) lights.push(board(start, start.clone().lerp(end, .16), .42, .012, end.y + .006));
    }
  }
  for (const rail of railLines) {
    for (const point of rail) {
      rails.push(new SphereGeometry(.037, 8, 6).translate(point.x, point.y, point.z));
      midrails.push(new SphereGeometry(.025, 8, 6).translate(point.x, point.y - .46, point.z));
    }
    for (let i = 1; i < rail.length; i++) {
      rails.push(beam(rail[i - 1], rail[i], .035));
      midrails.push(beam(rail[i - 1].clone().add(new Vector3(0, -.46, 0)), rail[i].clone().add(new Vector3(0, -.46, 0)), .023));
      stringers.push(beam(rail[i - 1].clone().add(new Vector3(0, -1.16, 0)), rail[i].clone().add(new Vector3(0, -1.16, 0)), .09));
      const count = Math.ceil(rail[i].distanceTo(rail[i - 1]) / .85);
      for (let post = i === 1 ? 0 : 1; post <= count; post++) {
        const top = rail[i - 1].clone().lerp(rail[i], post / count), bottom = terrainMeshHeight(top.x, top.z) - .22;
        posts.push(beam(new Vector3(top.x, bottom, top.z), top, .043));
        if (post > 0) {
          const previous = rail[i - 1].clone().lerp(rail[i], (post - 1) / count);
          braces.push(beam(top.clone().add(new Vector3(0, -1.1, 0)), new Vector3(previous.x, Math.max(bottom + .15, previous.y - 1.8), previous.z), .035));
        }
      }
    }
  }
  // The open upper rail ends meet a broad court, then the actual lighthouse threshold.
  for (let segment = 1; segment < LIGHTHOUSE_COURT_POINTS.length; segment++) {
    const a = new Vector3(...LIGHTHOUSE_COURT_POINTS[segment - 1]), b = new Vector3(...LIGHTHOUSE_COURT_POINTS[segment]);
    const count = segment === 1 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const start = a.clone().lerp(b, i / count), end = a.clone().lerp(b, (i + 1) / count);
      court.push(board(start, end, segment === 1 ? 1.36 : .92, .16, end.y));
    }
  }
  // Square corner pads join perpendicular court spans without a triangular hole.
  for (const point of LIGHTHOUSE_COURT_POINTS.slice(1, -1)) court.push(new BoxGeometry(.92, .16, .92).translate(point[0], point[1] - .08, point[2]));
  const landing = LIGHTHOUSE_LANDING;
  for (let board = 0; board < 10; board++) deck.push(new BoxGeometry(landing.width, .18, .202).translate(landing.x, landing.top - .09, landing.z - landing.depth / 2 + .105 + board * .21));
  for (const dx of [-.84, .84]) for (const dz of [-.87, .87]) {
    const x = landing.x + dx, z = landing.z + dz, bottom = terrainMeshHeight(x, z) - .25, top = landing.top - .12;
    piles.push(beam(new Vector3(x, bottom, z), new Vector3(x, top, z), .085));
    hardware.push(new CylinderGeometry(.11, .11, .12, 12).translate(x, .03, z));
  }
  for (const dz of [-.92, .92]) {
    const z = landing.z + dz;
    const stairEnd = railLines[dz < 0 ? 0 : 1][0], corner = new Vector3(landing.x + .25, landing.top + .95, z);
    hardware.push(beam(stairEnd, corner), beam(corner, new Vector3(landing.x + .60, landing.top + .95, z)));
    for (const dx of [.25, .60]) hardware.push(beam(new Vector3(landing.x + dx, landing.top, z), new Vector3(landing.x + dx, landing.top + .95, z)));
    hardware.push(new BoxGeometry(.26, .035, .13).translate(landing.x + .71, landing.top + .02, z), new CylinderGeometry(.026, .026, .11, 8).translate(landing.x + .71, landing.top + .085, z), new CylinderGeometry(.024, .024, .31, 8).rotateZ(Math.PI / 2).translate(landing.x + .71, landing.top + .14, z));
    fenders.push(new CylinderGeometry(.10, .10, .55, 12).translate(landing.x + 1.10, .16, landing.z + dz * .77));
    hardware.push(new TorusGeometry(.082, .013, 6, 16).rotateY(Math.PI / 2).translate(landing.x + 1.06, .51, landing.z + dz * .77));
  }
  for (const dz of [-.24, .24]) hardware.push(beam(new Vector3(landing.x + 1.03, -.75, landing.z + dz), new Vector3(landing.x + 1.03, 1.03, landing.z + dz), .027));
  for (let rung = 0; rung < 6; rung++) hardware.push(beam(new Vector3(landing.x + 1.03, -.63 + rung * .23, landing.z - .24), new Vector3(landing.x + 1.03, -.63 + rung * .23, landing.z + .24), .022));
  const add = (parts: BufferGeometry[], material: MeshStandardMaterial, name: string) => {
    const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose()); if (!geometry) return;
    const mesh = new Mesh(geometry, material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; mesh.raycast = () => undefined; root.add(mesh);
  };
  add(treads, deckMaterial, 'lighthouse-graded-treads'); add(posts, structure, 'lighthouse-bearing-piles-and-posts'); add(lights, light, 'lighthouse-tread-lights');
  add(rails, structure, 'lighthouse-continuous-handrail'); add(midrails, structure, 'lighthouse-midrail'); add(stringers, structure, 'lighthouse-stair-stringer');
  add(court, deckMaterial, 'lighthouse-upper-court-steps'); add(deck, deckMaterial, 'lighthouse-arrival-deck'); add(piles, structure, 'lighthouse-landing-seabed-piles');
  add(hardware, structure, 'lighthouse-mooring-hardware-and-ladder'); add(braces, structure, 'lighthouse-under-stair-cross-braces'); add(fenders, rubber, 'lighthouse-boat-fenders');
  let disposeTimer: ReturnType<typeof setTimeout> | undefined;
  const dispose = () => { root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); deckMaterial.dispose(); structure.dispose(); light.dispose(); rubber.dispose(); };
  return { root, dispose, retain() { clearTimeout(disposeTimer); return () => { disposeTimer = setTimeout(dispose, 0); }; } };
}
export function LighthouseAccess() {
  const access = useMemo(() => createLighthouseAccess(), []);
  useEffect(() => access.retain(), [access]);
  return <primitive object={access.root} dispose={null} />;
}
