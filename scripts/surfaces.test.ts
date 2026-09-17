import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { MeshStandardMaterial } from 'three';
import { applySurface } from '../src/components/world/surfaceMaterials';
import { lighthouseAccessCurve, createLighthouseAccess } from '../src/components/world/LighthouseAccess';
import { terrainMeshHeight } from '../src/components/world/terrain';

test('optimized licensed material set stays below one megabyte and is browser-independent on the server', () => {
  const manifest=JSON.parse(readFileSync('public/materials/sources.json','utf8'));
  assert.equal(manifest.files.length,12);
  let bytes=0;
  for(const file of manifest.files){assert.equal(file.license,'CC0-1.0');assert.match(file.source,/^https:\/\/dl\.polyhaven\.org\//);bytes+=statSync(file.file).size;}
  assert.ok(bytes<1_000_000);
  const material=applySurface(new MeshStandardMaterial(),'mineral');
  assert.equal(material.map,null);material.dispose();
});
test('lighthouse coastal route has continuous bearings, bounded treads and a connected upper landing',()=>{
  const curve=lighthouseAccessCurve();
  const end=curve.getPointAt(1);assert.ok(Math.hypot(end.x+74.1,end.z+34)<.001);
  assert.ok(Math.abs(end.y-terrainMeshHeight(end.x,end.z))<.35);
  let previous=curve.getPointAt(0);
  for(let i=1;i<=40;i++){const p=curve.getPointAt(i/40);assert.ok(p.distanceTo(previous)<.5);assert.ok(Math.abs(p.y-previous.y)<.25); const tangent=curve.getTangentAt(i/40); for(const side of [-.6,0,.6]){const length=Math.hypot(tangent.x,tangent.z); const ground=terrainMeshHeight(p.x+tangent.z/length*side,p.z-tangent.x/length*side);assert.ok(p.y>ground+.07,'Full stair width stays above terrain');} previous=p;}
  const route=createLighthouseAccess();
  assert.ok(route.root.getObjectByName('lighthouse-graded-treads'));assert.ok(route.root.getObjectByName('lighthouse-bearing-piles-and-posts'));assert.ok(route.root.getObjectByName('lighthouse-tread-lights'));route.dispose();
});
test('active page omits the unapproved music control while preserving its implementation',()=>{
  const page=readFileSync('src/components/Habitat.tsx','utf8');
  assert.doesNotMatch(page,/<AudioControl\b/);assert.match(readFileSync('src/components/AudioControl.tsx','utf8'),/export function AudioControl/);
});
