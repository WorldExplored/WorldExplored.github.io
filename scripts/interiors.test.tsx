import test from 'node:test';
import assert from 'node:assert/strict';
import { StrictMode } from 'react';
import { create } from '@react-three/test-renderer';
import { Box3, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { ComputeBuilding, makeComputeInterior } from '../src/components/world/ComputeBuilding';
import { ResearchInstitute, makeResearchInterior } from '../src/components/world/ResearchInstitute';
import { GardenGallery, makeGalleryInterior } from '../src/components/world/GardenGallery';
import { ReceptionTerminal, makeReceptionInterior } from '../src/components/world/ReceptionTerminal';
import { createSceneRuntime } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const fixtures = [
  { id: 'work', Component: ComputeBuilding, build: makeComputeInterior, bounds: [-4.18, 1.1, -2.12, 4.18, 4.94, 2.05], origin: [2.28, 2.07, 5], target: [2.28, 2.07, 1.56], aisle: [0, 1.65, 2.1, 0, 1.65, -.6] },
  { id: 'research', Component: ResearchInstitute, build: makeResearchInterior, bounds: [-2.7, 1.03, -1.6, 2.5, 3.35, 1.76], origin: [.02, 2.02, 4], target: [-.18, 1.955, .99], aisle: [-1.33, 1.4, 1.58, -1.33, 1.4, -.3] },
  { id: 'about', Component: GardenGallery, build: makeGalleryInterior, bounds: [-2.44, 1.05, -2.05, 2.44, 3.31, 1.38], origin: [-.45, 2.57, -5], target: [-.45, 2.57, -1.91], aisle: [-1.88, 1.3, 1.35, -1.88, 1.3, -1.21] },
  { id: 'contact', Component: ReceptionTerminal, build: makeReceptionInterior, bounds: [-1.53, 1.03, -1.53, 2.25, 3.16, 1.53], origin: [-4, 2, .25], target: [-1.13, 1.59, .25], aisle: [0, 1.4, 1.5, 0, 1.4, .1] },
];

test('furniture geometry remains inside occupied envelopes and leaves entrance circulation clear', () => {
  const material = new MeshBasicMaterial({ side: DoubleSide });
  try {
    for (const f of fixtures) {
      const geometry = f.build();
      const meshes = Object.values(geometry).filter(g => g.getAttribute('position')).map(g => new Mesh(g, material));
      try {
        const bounds = new Box3();
        for (const mesh of meshes) bounds.expandByObject(mesh);
        const [x, y, z, xx, yy, zz] = f.bounds;
        assert.ok(bounds.min.x >= x - 1e-5 && bounds.min.y >= y - 1e-5 && bounds.min.z >= z - 1e-5 && bounds.max.x <= xx + 1e-5 && bounds.max.y <= yy + 1e-5 && bounds.max.z <= zz + 1e-5, `${f.id} bounds ${bounds.min.toArray()} / ${bounds.max.toArray()}`);
        // Three torso-height rays give the approach a measurable pedestrian width.
        const start = new Vector3(...f.aisle.slice(0, 3));
        const end = new Vector3(...f.aisle.slice(3));
        for (const offset of [-.13, 0, .13]) {
          const origin = start.clone().add(new Vector3(offset, 0, 0));
          const ray = new Raycaster(origin, end.clone().sub(start).normalize(), .01, start.distanceTo(end));
          assert.equal(ray.intersectObjects(meshes, false).length, 0, `${f.id} blocks its approach at ${offset}`);
        }
      } finally { Object.values(geometry).forEach(g => g.dispose()); }
    }
  } finally { material.dispose(); }
});

test('outside window rays reach actual furniture before any opaque shell surface', async () => {
  for (const f of fixtures) {
    const renderer = await create(<f.Component active={false} paused quality="high" runtime={{ current: createSceneRuntime() }} />);
    try {
      renderer.scene.instance.updateMatrixWorld(true);
      const meshes = renderer.scene.findAll(node => node.instance.type === 'Mesh').map(node => node.instance as Mesh);
      // Furniture is intentionally noninteractive in production; restore ordinary mesh
      // raycasting solely for this geometric visibility measurement.
      for (const mesh of meshes) if (mesh.name.startsWith(`${f.id}-interior-`)) mesh.raycast = Mesh.prototype.raycast;
      const origin = new Vector3(...f.origin), target = new Vector3(...f.target);
      const hits = new Raycaster(origin, target.clone().sub(origin).normalize(), .01, origin.distanceTo(target) + .4).intersectObjects(meshes, false);
      const opaque = hits.find(hit => {
        const material = (hit.object as Mesh).material;
        return !Array.isArray(material) && !material.transparent;
      });
      assert.ok(opaque?.object.name.startsWith(`${f.id}-interior-`), `${f.id}: first opaque hit ${opaque?.object.name}; all hits ${hits.map(hit => hit.object.name)}`);
      assert.ok(hits.some(hit => { const m = (hit.object as Mesh).material; return !Array.isArray(m) && m.transparent; }), `${f.id}: ray must cross an actual window`);
    } finally { await renderer.unmount(); }
  }
});

test('interior materials and batches survive StrictMode and quality changes without pointer interception', async () => {
  const runtime = { current: createSceneRuntime() };
  const render = (quality: 'high' | 'low') => <StrictMode><ComputeBuilding active={false} paused runtime={runtime} quality={quality} /></StrictMode>;
  const renderer = await create(render('high'));
  const resources = renderer.scene.findAll(node => node.instance.type === 'Mesh' && node.instance.name.startsWith('work-interior-')).map(node => node.instance as Mesh);
  const originals = resources.map(mesh => [mesh.geometry, mesh.material]);
  let disposed = 0;
  for (const mesh of resources) mesh.geometry.addEventListener('dispose', () => disposed++);
  await renderer.update(render('low'));
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(disposed, 0);
  resources.forEach((mesh, i) => { assert.equal(mesh.geometry, originals[i][0]); assert.equal(mesh.material, originals[i][1]); assert.notEqual(mesh.raycast, Mesh.prototype.raycast); });
  assert.equal(resources.length, 10);
  await renderer.unmount();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(disposed, 10);
});

test('internal connections are genuine openings and gallery furniture preserves the sculpture court', async () => {
  const passages = [
    { Component: ComputeBuilding, from: [0, 1.7, 1.65], to: [1.72, 1.7, 1.65] },
    { Component: ComputeBuilding, from: [0, 1.7, 1.65], to: [-1.72, 1.7, 1.65] },
    { Component: ResearchInstitute, from: [.15, 1.7, -.73], to: [.73, 1.7, -.73] },
    { Component: ResearchInstitute, from: [.15, 1.7, 1.05], to: [.85, 1.7, 1.05] },
    { Component: ReceptionTerminal, from: [1.15, 1.7, 0], to: [1.9, 1.7, 0] },
    { Component: GardenGallery, from: [-1.88, 1.7, -1.03], to: [-1.88, 1.7, -1.57] },
  ];
  for (const p of passages) {
    const renderer = await create(<p.Component active={false} paused quality="high" runtime={{ current: createSceneRuntime() }} />);
    try {
      renderer.scene.instance.updateMatrixWorld(true);
      const meshes = renderer.scene.findAll(node => node.instance.type === 'Mesh').map(node => node.instance as Mesh);
      const origin = new Vector3(...p.from), end = new Vector3(...p.to);
      const hits = new Raycaster(origin, end.clone().sub(origin).normalize(), .01, origin.distanceTo(end)).intersectObjects(meshes, false);
      assert.equal(hits.length, 0, `Internal connection obstructed by ${hits.map(hit => hit.object.name)}`);
    } finally { await renderer.unmount(); }
  }
  const gallery = makeGalleryInterior();
  try {
    for (const geometry of Object.values(gallery)) {
      const positions = geometry.getAttribute('position');
      if (!positions) continue;
      for (let i = 0; i < positions.count; i++) assert.ok(Math.hypot(positions.getX(i), positions.getZ(i)) > 1.25, 'Gallery furniture entered the sculpture rotation court');
    }
  } finally { Object.values(gallery).forEach(geometry => geometry.dispose()); }
});
