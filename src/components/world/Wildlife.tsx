'use client';

import { measureConstruction } from './renderDiagnostics';

/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, CatmullRomCurve3, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, MeshStandardMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentProps } from './Water';
import { createCrabStates, createGullStates, stepCrab, stepGull, WILDLIFE_COUNTS, type GullState } from './wildlifeState';

function ellipsoid(x: number, y: number, z: number, sx: number, sy: number, sz: number, turn = 0) {
  return new SphereGeometry(1, 16, 10).scale(sx, sy, sz).rotateY(turn).translate(x, y, z);
}
function merge(parts: BufferGeometry[]) { parts.forEach(part=>part.deleteAttribute('uv')); const geometry = mergeGeometries(parts)!; parts.forEach(part => part.dispose()); return geometry; }
function bone(a: Vector3, b: Vector3, radius: number) {
  const axis = b.clone().sub(a); const geometry = new CylinderGeometry(radius, radius * .7, axis.length(), 7);
  const transform = new Object3D(); transform.position.copy(a).add(b).multiplyScalar(.5); transform.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize()); transform.updateMatrix();
  return geometry.applyMatrix4(transform.matrix);
}

function mirrored(geometry: BufferGeometry) {
  const copy = geometry.clone().scale(-1, 1, 1);
  const index = copy.index!;
  for (let i = 0; i < index.count; i += 3) { const a = index.getX(i); index.setX(i, index.getX(i + 2)); index.setX(i + 2, a); }
  return copy;
}

/** A continuous feather surface has a quill ridge and tapered vanes, rather than an oval bead. */
function feather(length:number,width:number,curve=.035) {
  const positions:number[]=[],indices:number[]=[];
  for(let row=0;row<=12;row++)for(let col=0;col<=4;col++){
    const t=row/12,v=col/2-1;
    const breadth=width*Math.pow(Math.sin(Math.PI*t),.62)*(1-.25*t);
    positions.push(t*length,curve*Math.sin(Math.PI*t)+(1-Math.abs(v))*.009*Math.sin(Math.PI*t),v*breadth);
    if(row&&col){const i=row*5+col;indices.push(i,i-5,i-1,i-1,i-5,i-6);}
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  // Feather thickness keeps surfaces readable from both sides without duplicated material draws.
  return geometry;
}

export function gullBodyGeometry() {
  const profile=new CatmullRomCurve3([new Vector3(-.35,.07,.09),new Vector3(-.21,.16,.19),new Vector3(.02,.18,.175),new Vector3(.24,.135,.12),new Vector3(.39,.06,.045)],false,'catmullrom',.35);
  const positions:number[]=[],indices:number[]=[];
  for(let row=0;row<=24;row++){
    const p=profile.getPoint(row/24);
    for(let side=0;side<=24;side++){
      const a=side/24*Math.PI*2;
      positions.push(Math.sin(a)*p.y,Math.cos(a)*p.z+Math.max(0,-p.x)*.09,p.x);
      if(row&&side){const i=row*25+side;indices.push(i,i-25,i-1,i-1,i-25,i-26);}
    }
  }
  const body=new BufferGeometry();body.setAttribute('position',new Float32BufferAttribute(positions,3));body.setIndex(indices);body.computeVertexNormals();
  return body;
}

export function crabCarapaceGeometry() {
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const rings=12,sides=40;
  for(let ring=0;ring<=rings;ring++)for(let side=0;side<=sides;side++){
    const r=ring/rings,a=side/sides*Math.PI*2;
    const rim=1+.026*Math.cos(a*10)*Math.pow(r,6);
    const x=Math.cos(a)*.178*r*rim,z=Math.sin(a)*.125*r*rim;
    const groove=Math.exp(-(((Math.abs(x)-.042)/.009)**2))*.008*r;
    const y=.01+.097*Math.pow(Math.max(0,1-r*r),.58)-groove+.009*Math.cos(a*2)*r;
    positions.push(x,y,z);const shade=.71+.23*(1-r)+.07*Math.sin(a*8+r*31);colors.push(shade,shade,shade);
    if(ring&&side){const i=ring*(sides+1)+side;indices.push(i,i-1,i-sides-1,i-1,i-sides-2,i-sides-1);}
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function createWildlife() {
  const group = new Group(); group.name = 'coastal-wildlife';
  const materials = [new MeshStandardMaterial({ side: 2, color: '#f8fbfa', roughness: .65 }), new MeshStandardMaterial({ side: 2, color: '#b8c6cc', roughness: .7 }), new MeshStandardMaterial({ side: 2, color: '#263640', roughness: .75 }), new MeshStandardMaterial({ side: 2, color: '#eaba42', roughness: .58 }), new MeshStandardMaterial({ side: 2, color: '#b84f2e', roughness: .67, vertexColors: true }), new MeshStandardMaterial({ side: 2, color: '#ed8a50', roughness: .65 }), new MeshStandardMaterial({ color: '#7b6747', roughness: .94 }), new MeshStandardMaterial({ color: '#acd9d2', roughness: .36, metalness: .15 }), new MeshStandardMaterial({ color: '#e5dec5', roughness: .9 })];
  const meshes: InstancedMesh[] = [];
  const instances = (name: string, geometry: BufferGeometry, material: number, count: number) => {
    const mesh = new InstancedMesh(geometry, materials[material], count); mesh.name = name; mesh.frustumCulled = false; mesh.castShadow = false; mesh.raycast = () => {};
    group.add(mesh); meshes.push(mesh); return mesh;
  };
  const gullBody = instances('gull-bodies', merge([
    gullBodyGeometry(),
    ...[-2,-1,0,1,2].map(index=>feather(.32,.043,.016).rotateY(-Math.PI/2+index*.045).translate(index*.047,.015,.28)),
  ]), 0, 18);
  const gullHead = instances('gull-heads-and-necks', merge([ellipsoid(0, .15, -.34, .135, .14, .16), ellipsoid(0, .09, -.21, .125, .14, .20)]).translate(0,-.09,.25), 0, 18);
  const gullEyes = instances('gull-eyes', merge([-1, 1].map(side => ellipsoid(side * .119, .185, -.395, .019, .023, .024))).translate(0,-.09,.25), 2, 18);
  const bill = merge([
    // A tapered solid maxilla and lower mandible meet along a narrow seam.
    new CylinderGeometry(.006,.043,.235,9).rotateX(-Math.PI/2).scale(1,.65,1).translate(0,.043,-.304),
    new CylinderGeometry(.003,.032,.208,9).rotateX(-Math.PI/2).scale(1,.38,1).translate(0,.019,-.294),
    ellipsoid(0,.039,-.408,.012,.022,.026),
  ]);
  const gullBill = instances('gull-bills', bill, 3, 18);
  const wing = instances('gull-inner-wings', merge([
    // Continuous coverts overlap the shoulder and wrist throughout the folded pose.
    ellipsoid(.10,0,.025,.18,.062,.16),
    ellipsoid(.40,.008,.067,.35,.045,.145),
    ellipsoid(.68,.005,.062,.115,.039,.095),
    ...Array.from({length:8},(_,index)=>feather(.42-index*.019,.075,.045).rotateY(-1.0+index*.08).translate(.08+index*.081,.01,.015)),
  ]), 1, 18);
  const primaries = instances('gull-articulated-primaries', merge([
    ellipsoid(.04,0,.025,.10,.029,.074),
    ...Array.from({length:6},(_,index)=>feather(.49-index*.043,.044,.028).rotateY(-.11-index*.16).translate(.015+index*.035,0,.012+index*.038)),
  ]), 2, 18);
  const leftWing = instances('gull-left-inner-wings', mirrored(wing.geometry), 1, 18);
  const leftPrimaries = instances('gull-left-primaries', mirrored(primaries.geometry), 2, 18);
  const gullLegs = instances('gull-perching-feet', merge([-1, 1].flatMap(side => [
    bone(new Vector3(side * .075, -.07, .07), new Vector3(side * .075, -.24, .10), .018),
    ...[-1, 0, 1].map(toe => bone(new Vector3(side * .075, -.24, .10), new Vector3(side * .075 + toe * .038, -.25, -.015), .012)),
  ])), 3, 18);
  const gulls=createGullStates();
  const nests=gulls.filter(bird=>bird.perch.nest).filter((bird,index,all)=>all.findIndex(other=>other.perch.id===bird.perch.id)===index);
  const nestGeometry=merge(Array.from({length:62},(_,index)=>{
    const angle=index*2.3999632,r=.22+(index%7)*.018;
    const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
    return bone(new Vector3(x-.12*Math.sin(angle),-.035+(index%4)*.015,z+.12*Math.cos(angle)),new Vector3(x+.13*Math.sin(angle),-.017+(index%4)*.015,z-.13*Math.cos(angle)),.009+(index%3)*.002);
  }));
  const nestTwigs=instances('gull-woven-twig-nests',nestGeometry,6,nests.length);
  const nestEggs=instances('gull-speckled-nest-eggs',merge([ellipsoid(-.072,.018,.008,.038,.052,.033),ellipsoid(.038,.018,.058,.036,.05,.032),ellipsoid(.058,.018,-.058,.037,.052,.032)]),8,nests.length);
  const nestLining=instances('gull-grass-and-feather-lining',merge([
    ...Array.from({length:38},(_,i)=>{
      const a=i*2.399,r=.07+(i%9)*.020;
      return bone(new Vector3(Math.cos(a)*r,-.025,Math.sin(a)*r),new Vector3(Math.cos(a+.55)*(r+.07),-.01,Math.sin(a+.55)*(r+.07)),.0035);
    }),
    ...Array.from({length:7},(_,i)=>feather(.12,.016,.008).rotateY(i*1.83).translate(Math.cos(i*2)*.15,-.008,Math.sin(i*2)*.15)),
  ]),8,nests.length);
  const eggSpeckles=instances('gull-egg-brown-speckles',merge([[-.072,.018,.008],[.038,.018,.058],[.058,.018,-.058]].flatMap(([x,y,z])=>Array.from({length:11},(_,i)=>{
    const a=i*2.399,b=.15+(i%4)*.24;
    return ellipsoid(x+Math.cos(a)*.036*Math.sin(b),y+.052*Math.cos(b),z+Math.sin(a)*.032*Math.sin(b),.003,.002,.004);
  }))),6,nests.length);
  const nestTransform=new Object3D();
  nests.forEach((bird,index)=>{
    nestTransform.position.copy(bird.perch.position);nestTransform.position.y-=.255;nestTransform.rotation.y=index*1.37;nestTransform.updateMatrix();
    for(const mesh of [nestTwigs,nestEggs,nestLining,eggSpeckles])mesh.setMatrixAt(index,nestTransform.matrix);
  });
  const gullPrey=instances('gull-hunt-silver-fish',merge([ellipsoid(0,0,0,.045,.058,.17),feather(.13,.052,.002).rotateY(-Math.PI/2).translate(0,0,.12)]),7,18);
  const preyEyes=instances('gull-hunt-fish-eyes',merge([-1,1].map(side=>ellipsoid(side*.034,.017,-.11,.009,.011,.012))),2,18);
  const crabBody = instances('crab-shells', crabCarapaceGeometry(), 4, 10);
  const crabEyes = instances('crab-eyes', merge([-1, 1].flatMap(side => [bone(new Vector3(side * .07, .045, -.07), new Vector3(side * .085, .14, -.11), .012), ellipsoid(side * .085, .14, -.11, .026, .027, .023)])), 2, 10);
  const crabLegs = instances('crab-jointed-legs', merge([bone(new Vector3(), new Vector3(.13, .055, .02), .017), bone(new Vector3(.13, .055, .02), new Vector3(.24, -.08, .06), .012)]), 5, 40);
  const crabClaws = instances('crab-claws', merge([
    bone(new Vector3(), new Vector3(.065, .055, -.10), .021), ellipsoid(.065, .06, -.14, .06, .04, .075),
    ellipsoid(.035, .065, -.218, .015, .02, .055, -.25), ellipsoid(.102, .065, -.208, .017, .025, .06, .25),
  ]), 4, 10);
  const leftCrabLegs = instances('crab-left-legs', mirrored(crabLegs.geometry), 5, 40);
  const leftCrabClaws = instances('crab-left-claws', mirrored(crabClaws.geometry), 4, 10);
  return { leftWing, leftPrimaries, leftCrabLegs, leftCrabClaws, group, meshes, materials, gullBody, gullHead, gullEyes, gullBill, wing, primaries, gullLegs, crabBody, crabEyes, crabLegs, crabClaws, gulls, gullPrey, preyEyes, crabs: createCrabStates(), root: new Object3D(), hinge: new Object3D(), tip: new Object3D(), local: new Object3D(), timer: undefined as ReturnType<typeof setTimeout> | undefined };
}

export function writeGullPose(life: ReturnType<typeof createWildlife>, bird: GullState, index: number) {
  const { root, hinge, tip, local } = life;
  const perched = bird.mode === 'perched' || bird.mode === 'preening';
  const pulse = Math.sin(bird.time * (6.8 + index % 3 * .4) + bird.phase);
  const glideAngle = .09 + Math.sin(bird.time * 1.1 + bird.phase) * .055;
  const wingAngle = (glideAngle * (1 - bird.flap) + pulse * .52 * bird.flap) * (1 - bird.fold) - .10 * bird.fold;
  const bank = bird.bank;
  root.position.copy(bird.position); root.rotation.set(bird.pitch+(perched?Math.sin(bird.time*.7+bird.phase)*.012:0), bird.heading, bank);
  root.scale.setScalar(.91 + index % 4 * .075); root.updateMatrix();
  life.gullBody.setMatrixAt(index, root.matrix);
  local.position.set(0,.09,-.25); local.rotation.set(bird.mode==='preening'?.28+Math.sin(bird.time*2.1)*.09:perched?Math.sin(bird.time*.58+bird.phase)*.06:0, bird.mode==='preening'?.82*Math.sin(bird.time*.6+bird.phase):perched?Math.sin(bird.time*.37+bird.phase)*.22:0, 0); local.scale.set(1,1,1); local.updateMatrix(); local.matrix.premultiply(root.matrix);
  for (const mesh of [life.gullHead, life.gullEyes, life.gullBill]) mesh.setMatrixAt(index, local.matrix);
  local.position.set(0, -.01*(1-bird.legs), .03*(1-bird.legs)); local.rotation.set(-(1-bird.legs)*1.30, 0, 0); local.scale.set(1, 1, 1); local.updateMatrix(); local.matrix.premultiply(root.matrix); life.gullLegs.setMatrixAt(index, local.matrix);
  local.position.copy(bird.preyPosition);local.rotation.set(0,bird.time*.32,0);local.scale.setScalar(bird.preyVisible?1:.0001);
  if(bird.caught&&bird.preyVisible){
    local.position.set(0,.13,-.51);local.rotation.set(.3,Math.PI/2,0);local.updateMatrix();local.matrix.premultiply(root.matrix);
  }else local.updateMatrix();
  life.gullPrey.setMatrixAt(index,local.matrix);life.preyEyes.setMatrixAt(index,local.matrix);
  for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
    const side = sideIndex === 0 ? -1 : 1;
    hinge.position.set(side * .105, .035, .01); hinge.rotation.set(0, -side * 1.35 * bird.fold, side * wingAngle); hinge.scale.set(1-.6*bird.fold, 1, 1-.15*bird.fold); hinge.updateMatrix(); hinge.matrix.premultiply(root.matrix);
    (side < 0 ? life.leftWing : life.wing).setMatrixAt(index, hinge.matrix);
    tip.position.set(side * .73, 0, .06); tip.rotation.set(0, side * (-.12 + 1.5 * bird.fold), side * (.05 * (1 - bird.flap) - .14 * pulse * bird.flap)); tip.scale.set(1-.7*bird.fold, 1, 1); tip.updateMatrix(); tip.matrix.premultiply(hinge.matrix);
    (side < 0 ? life.leftPrimaries : life.primaries).setMatrixAt(index, tip.matrix);
  }
}

export function Wildlife({ runtime, paused, quality }: EnvironmentProps) {
  const life = useMemo(() => measureConstruction('wildlife', () => createWildlife()), []);
  useEffect(() => { clearTimeout(life.timer); return () => { life.timer = setTimeout(() => { life.meshes.forEach(mesh => { mesh.geometry.dispose(); mesh.dispose(); }); life.materials.forEach(material => material.dispose()); }, 0); }; }, [life]);
  useFrame(({ camera }, delta) => {
    const counts = WILDLIFE_COUNTS[quality]; const pointer = runtime.current.pointerActive ? runtime.current.pointerWorld : null;
    const { root, local } = life;
    for (const mesh of [life.gullBody, life.gullHead, life.gullEyes, life.gullBill, life.gullLegs, life.gullPrey, life.preyEyes]) mesh.count = counts.gulls;
    life.wing.count = life.primaries.count = life.leftWing.count = life.leftPrimaries.count = counts.gulls;
    life.crabBody.count = life.crabEyes.count = counts.crabs; life.crabLegs.count = life.leftCrabLegs.count = counts.crabs * 4; life.crabClaws.count = life.leftCrabClaws.count = counts.crabs;
    life.gulls.forEach((bird, index) => {
      stepGull(bird, delta, camera.position, pointer, paused);
      writeGullPose(life, bird, index);
    });
    life.crabs.forEach((crab, index) => {
      stepCrab(crab, delta, camera.position, pointer, paused);
      root.position.copy(crab.position); root.rotation.set(0, crab.heading, 0); root.scale.setScalar(1.15 + index % 3 * .12); root.updateMatrix();
      life.crabBody.setMatrixAt(index, root.matrix); life.crabEyes.setMatrixAt(index, root.matrix);
      for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
        const side = sideIndex === 0 ? -1 : 1;
        for (let leg = 0; leg < 4; leg++) {
          const phase = crab.gait + leg * Math.PI + sideIndex * Math.PI;
          local.position.set(side * .12, 0, (leg - 1.5) * .053); local.rotation.set(0, side * ((leg - 1.5) * -.36 + Math.sin(phase) * .15), side * Math.max(0, Math.cos(phase)) * .16); local.scale.set(1, 1, 1); local.updateMatrix(); local.matrix.premultiply(root.matrix);
          (side < 0 ? life.leftCrabLegs : life.crabLegs).setMatrixAt(index * 4 + leg, local.matrix);
        }
        local.position.set(side * .10, 0, -.065); local.rotation.set(0, side * -.25, side * crab.scuttle * -.20); local.scale.set(1, 1, 1); local.updateMatrix(); local.matrix.premultiply(root.matrix); (side < 0 ? life.leftCrabClaws : life.crabClaws).setMatrixAt(index, local.matrix);
      }
    });
    life.meshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
  });
  return <primitive object={life.group} dispose={null} />;
}
