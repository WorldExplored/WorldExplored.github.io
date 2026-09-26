'use client';

import { useEffect,useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import { combine, strut } from './BuildingKit';
import { createVesselState, stepVessel, vesselOccupants, VISITOR_BERTH, VISITOR_DWELL, writeVesselPose } from './marineTraffic';
import { harborWaterHeight } from './waterSurface';
import { seededRandom, terrainMeshHeight } from './terrain';
import { createDockWeedGeometry } from './DockEcology';
import type { EnvironmentProps } from './Water';

/** Swept chines, a fine bow and broad transom give launches distinct built hulls. */
export function launchHull(length:number,width:number,height:number){
  const positions:number[]=[],indices:number[]=[],sections=[[.50,.035],[.38,.61],[.04,1],[-.34,.95],[-.48,.76]];
  for(const [z,w]of sections)for(const [x,y]of [[-1,.22],[-.91,-.23],[-.52,-.55],[.52,-.55],[.91,-.23],[1,.22]])positions.push(x*w*width*.5,y*height,z*length);
  for(let row=0;row<sections.length-1;row++)for(let side=0;side<6;side++){const a=row*6+side,b=row*6+(side+1)%6,c=b+6,d=a+6;indices.push(a,b,d,b,c,d);}
  for(const start of [0,(sections.length-1)*6])for(let i=1;i<5;i++)indices.push(start,start+i,start+i+1);
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function createAeroBoat(index:number){
  const large=index===2,root=new Group();root.name=large?'solar-coastal-visitor':index===1?'beacon-survey-launch':'aero-hydrofoil';
  const materials={shell:new MeshPhysicalMaterial({color:'#e2f5ec',metalness:.14,roughness:.34,clearcoat:.5}),trim:new MeshPhysicalMaterial({color:index===1?'#369c8d':'#168ab4',metalness:.28,roughness:.32}),glass:new MeshPhysicalMaterial({color:'#397d8f',transparent:true,opacity:.55,depthWrite:false,roughness:.13}),solar:new MeshPhysicalMaterial({color:'#183b60',metalness:.28,roughness:.36}),metal:new MeshPhysicalMaterial({color:'#789ba0',metalness:.55,roughness:.43}),warm:new MeshPhysicalMaterial({color:'#ffdb87',emissive:'#ffcf7b',emissiveIntensity:.3}),red:new MeshPhysicalMaterial({color:'#f45346',emissive:'#e12e20',emissiveIntensity:.7}),green:new MeshPhysicalMaterial({color:'#91db72',emissive:'#75bd55',emissiveIntensity:.7})};
  const allMaterials = Object.values(materials);
  // Keep shader defines stable for the entire visitor fade. Small boats remain opaque.
  if (large) for (const material of allMaterials) material.transparent = true;
  const geometries:BufferGeometry[]=[],moving:Group[]=[];
  const add=(name:string,parts:BufferGeometry[],paint:keyof typeof materials,parent=root)=>{const geometry=combine(parts);geometries.push(geometry);const mesh=new Mesh(geometry,materials[paint]);mesh.name=name;mesh.raycast=()=>{};mesh.castShadow=paint!=='glass';mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const length=large?11.8:index===1?3.3:3.5,width=large?3.8:index===1?1.65:1.35;
  if(index===0)add('swept-hydrofoil-hull',[launchHull(length,width,.9)],'shell');
  else add('twin-fine-entry-hulls',[-1,1].map(side=>launchHull(length,width*(large?.28:.32),large?1.4:1).translate(side*width*.36,0,0)),'shell');
  add('connected-passenger-deck',[new BoxGeometry(width,.12,length*.75).translate(0,.28,-.12)],'shell');
  add('aqua-waterline-trim',[-1,1].map(side=>new BoxGeometry(.035,.065,length*.69).translate(side*width*.5,.27,-.17)),'trim');
  const cabinLength=large?6.5:index===1?1.35:1.45,cabinHeight=large?1.66:.65;
  const frames:BufferGeometry[]=[],panes:BufferGeometry[]=[],seats:BufferGeometry[]=[];
  for(const side of [-1,1]){
    for(const z of [-cabinLength/2,0,cabinLength/2])frames.push(new BoxGeometry(.045,cabinHeight,.045).translate(side*width*.40,.37+cabinHeight/2,z));
    panes.push(new BoxGeometry(.016,cabinHeight-.12,cabinLength-.04).translate(side*width*.4,.38+cabinHeight/2,0));
    for(let row=0;row<(large?8:2);row++){
      const z=-cabinLength*.36+row*(large?.72:.48);
      seats.push(new BoxGeometry(large?.38:.24,.08,.29).translate(side*width*.23,.55,z),new BoxGeometry(large?.38:.24,.27,.045).translate(side*width*.23,.69,z-.14));
      frames.push(new CylinderGeometry(.022,.03,.2,6).translate(side*width*.23,.41,z));
    }
  }
  panes.push(new BoxGeometry(width*.78,cabinHeight-.12,.018).rotateX(-.12).translate(0,.38+cabinHeight/2,cabinLength*.5));
  add('cabin-pillars-and-seat-pedestals',frames,'metal');add('individual-aqua-seating',seats,'trim');add('panoramic-windscreen',panes,'glass');
  const roof=.42+cabinHeight;
  add('curved-canopy',[new SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2).scale(width*.48,.16,cabinLength*.59).translate(0,roof,0)],'shell');
  add('roof-mounted-photovoltaics',Array.from({length:large?12:6},(_,n)=>new BoxGeometry(width*.18,.022,cabinLength*.2).rotateX(-.055).translate(((n%3)-1)*width*.22,roof+.15,-cabinLength*.29+Math.floor(n/3)*cabinLength*.2)),'solar');
  add('stern-battery-and-helm',[new BoxGeometry(width*.49,.22,.35).translate(0,.48,-cabinLength*.56),new BoxGeometry(.27,.22,.19).translate(-width*.17,.54,cabinLength*.38)],'trim');
  const rails:BufferGeometry[]=[];
  for(const side of [-1,1]){
    if (large && side === 1) {
      rails.push(strut(new Vector3(side*width*.48,.7,-length*.34),new Vector3(side*width*.48,.7,-1.3),.015));
      rails.push(strut(new Vector3(side*width*.48,.7,-.55),new Vector3(side*width*.48,.7,length*.28),.015));
    } else rails.push(strut(new Vector3(side*width*.48,.7,-length*.34),new Vector3(side*width*.48,.7,length*.28),.015));
    for(const z of [-length*.34,length*.28])rails.push(strut(new Vector3(side*width*.48,.33,z),new Vector3(side*width*.48,.7,z),.015));
    add(side<0?'port-light':'starboard-light',[new SphereGeometry(.045,8,6).translate(side*width*.48,.73,length*.22)],side<0?'red':'green');
    const drive=new Group();drive.position.set(side*width*.36,-.19,-length*.45);root.add(drive);moving.push(drive);
    add('electric-thruster-blades',[new BoxGeometry(.17,.025,.024),new BoxGeometry(.024,.17,.024)],'metal',drive);
  }
  add('perimeter-guardrails',rails,'metal');
  add('cabin-warm-light-strip',[new BoxGeometry(width*.50,.018,.05).translate(0,roof-.06,0)],'warm');
  if(index===1){add('survey-mast',[new CylinderGeometry(.024,.04,.72,8).translate(0,roof+.46,-.47),new SphereGeometry(.10,10,8).scale(1,.7,1).translate(0,roof+.84,-.47)],'shell');}
  if(index===0)add('hydrofoil-underwater-wings',[new BoxGeometry(width*1.18,.025,.21).translate(0,-.37,.55),new BoxGeometry(width*.76,.022,.16).translate(0,-.37,-.8)],'trim');
  if(large){
    add('starboard-boarding-step',[new BoxGeometry(.35,.09,.72).translate(width*.5,.435,-.925)],'shell');
    add('upper-saloon-pearl-shell',[
      new BoxGeometry(2.7,.12,3.3).translate(0,roof+.24,.7),
      ...[-1,1].flatMap(side=>[-.85,2.25].map(z=>new BoxGeometry(.08,1.3,.08).translate(side*1.25,roof+.92,z))),
      new SphereGeometry(1,20,8,0,Math.PI*2,0,Math.PI/2).scale(1.45,.27,1.8).translate(0,roof+1.59,.7),
    ],'shell');
    add('upper-saloon-glazing',[-1,1].map(side=>new BoxGeometry(.024,1.15,3).translate(side*1.25,roof+.94,.7)).concat([new BoxGeometry(2.4,1.15,.024).rotateX(-.08).translate(0,roof+.94,2.25)]),'glass');
    add('upper-deck-solar-array',Array.from({length:10},(_,i)=>new BoxGeometry(.47,.03,.5).translate((i%5-2)*.51,roof+1.83,.16+Math.floor(i/5)*.56)),'solar');
    add('upper-lounge-seats',[-1,1].flatMap(side=>[-.35,.4,1.15].flatMap(z=>[new BoxGeometry(.42,.1,.38).translate(side*.72,roof+.56,z),new BoxGeometry(.42,.37,.07).translate(side*.72,roof+.78,z-.18)])),'trim');
    add('stern-boarding-stair',Array.from({length:9},(_,i)=>new BoxGeometry(.6,.12,.32).translate(-1.12,.55+i*.19,-4.9+i*.22)),'shell');
    add('hull-portholes',[-1,1].flatMap(side=>Array.from({length:9},(_,i)=>new CylinderGeometry(.12,.12,.025,12).rotateZ(Math.PI/2).translate(side*1.48,.12,-3.7+i*.84))),'glass');
    add('passenger-deck-bollards',[-1,1].flatMap(side=>[-4.7,4.7].map(z=>new CylinderGeometry(.075,.11,.22,8).translate(side*1.4,.48,z))),'metal');
    add('rear-luggage-lockers',[-1,1].map(side=>new BoxGeometry(.45,.45,.64).translate(side*.66,.56,-2.0)),'trim');
    add('boarding-handrails',[strut(new Vector3(-.95,.8,-1.95),new Vector3(-.95,.8,-2.47),.022),strut(new Vector3(.95,.8,-1.95),new Vector3(.95,.8,-2.47),.022)],'metal');
  }
  const wakeRoot = new Group();
  wakeRoot.name = `${root.name}-water-contact`;
  const wakeMaterial = new MeshPhysicalMaterial({ color: '#d0f3e8', transparent: true, opacity: 0, depthWrite: false, roughness: .8, side: DoubleSide, forceSinglePass: true, vertexColors: true });
  const vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  for (const side of [-1, 1]) for (let row = 0; row <= 28; row++) {
    const t = row / 28, start = vertices.length / 3;
    for (const edge of [-1, 1]) {
      vertices.push(side * (width * .36 + t * (large ? 1.45 : .85)) + edge * (.022 + t * .085) * Math.sin(Math.PI * t), 0, -length * .46 - t * (large ? 5.6 : 3.3));
      const shade = .42 + .58 * Math.sin(Math.PI * t);
      colors.push(shade, shade, shade);
    }
    if (row < 28) indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
  }
  const wakeGeometry = new BufferGeometry();
  wakeGeometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  wakeGeometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  wakeGeometry.setIndex(indices); wakeGeometry.computeVertexNormals();
  const wake = new Mesh(wakeGeometry, wakeMaterial);
  wake.name = 'separate-speed-driven-wake'; wake.raycast = () => {}; wakeRoot.add(wake);
  geometries.push(wakeGeometry);
  let lastTime = 0, propellerPhase = index * 1.7, disposed = false;
  return {
    root, materials, wakeRoot,
    update(time: number, opacity: number, night: number, speed: number, quality: string = 'high') {
      const dt = Math.min(.1, Math.max(0, time - lastTime)); lastTime = time;
      propellerPhase = (propellerPhase + dt * speed * 14) % (Math.PI * 2);
      for (const propeller of moving) propeller.rotation.z = propellerPhase;
      for (const material of allMaterials) material.opacity = opacity * (material === materials.glass ? .55 : 1);
      materials.warm.emissiveIntensity = night * 1.5;
      materials.red.emissiveIntensity = materials.green.emissiveIntensity = .2 + night * .7;
      const strength = Math.min(1, speed / (large ? 1.35 : index === 1 ? .75 : 1.05));
      wakeRoot.position.set(root.position.x, harborWaterHeight(root.position.x, root.position.z, time) + .06, root.position.z);
      wakeRoot.rotation.y = root.rotation.y;
      wakeRoot.visible = opacity > .01 && strength > .025;
      wakeRoot.scale.z = (.35 + strength * .65) * (quality === 'low' ? .8 : 1);
      wakeMaterial.opacity = opacity * strength * .38;
    },
    dispose() {
      if (disposed) return; disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const material of allMaterials) material.dispose();
      wakeMaterial.dispose();
    },
  };

}
export const VISITOR_PIER_SHORE = { x: -24, z: -69 };
export const VISITOR_PIER_HEAD = { x: -27, z: -51.55, y: .49 };

export function createVisitorPier() {
  const root = new Group(), pieces: BufferGeometry[] = [], steel: BufferGeometry[] = [];
  const wetPosts: { x: number; z: number; bottom: number; top: number; bottomRadius: number; topRadius: number }[] = [];
  const shore = VISITOR_PIER_SHORE, head = VISITOR_PIER_HEAD;
  const startY = terrainMeshHeight(shore.x, shore.z) + .12;
  const count = 68, step = (head.z - shore.z) / count;
  const grade = (z: number) => head.y + (startY - head.y) * Math.max(0, Math.min(1, (head.z - z) / (head.z - shore.z)));
  for (let n = 0; n <= count; n++) {
    const z = shore.z + n * step;
    pieces.push(new BoxGeometry(1.4, .10, step * .92).translate(shore.x, grade(z), z));
  }
  pieces.push(new BoxGeometry(6.6, .14, 1.15).translate(head.x, head.y, head.z));
  // The opening faces the visitor's port-side boarding gate, with fenders
  // between the platform and hull. The first planks overlap dry ground.
  for (let z = shore.z; z < head.z - .3; z += 2.1) for (const side of [-1, 1]) {
    const x = shore.x + side * .58, top = grade(z) + .07, bottom = terrainMeshHeight(x, z) - .4;
    steel.push(new CylinderGeometry(.075, .11, top - bottom, 8).translate(x, (bottom + top) / 2, z));
    wetPosts.push({ x, z, bottom, top, bottomRadius: .11, topRadius: .075 });
    if (z < head.z - 1.2) {
      steel.push(strut(new Vector3(x, top, z), new Vector3(x, top + .65, z), .025));
      const end = Math.min(head.z - 1.2, z + 2.1);
      steel.push(strut(new Vector3(x, top + .65, z), new Vector3(x, grade(end) + .72, end), .025));
    }
  }
  for (const side of [-1, 1]) {
    const x = head.x + side * 2.8, bottom = terrainMeshHeight(x, head.z) - .4;
    steel.push(new CylinderGeometry(.09, .13, head.y - bottom, 8).translate(x, (head.y + bottom) / 2, head.z));
    wetPosts.push({ x, z: head.z, bottom, top: head.y, bottomRadius: .13, topRadius: .09 });
    steel.push(new CylinderGeometry(.075, .075, .3, 8).translate(x, head.y + .2, head.z));
    pieces.push(new BoxGeometry(.18, .4, .14).translate(head.x + side * 1.8, .25, head.z + .59));
  }
  const material = new MeshPhysicalMaterial({ color: '#bad9cf', roughness: .7 });
  const metal = new MeshPhysicalMaterial({ color: '#3a8093', metalness: .35, roughness: .43 });
  const deck = new Mesh(combine(pieces), material), piles = new Mesh(combine(steel), metal);
  deck.name = 'visitor-pier-boardwalk'; piles.name = 'visitor-pier-seabed-piles';
  deck.raycast = piles.raycast = () => {};
  deck.castShadow = piles.castShadow = true;
  deck.receiveShadow = piles.receiveShadow = true;
  root.add(deck, piles); root.name = 'visitor-boat-berth';
  const random = seededRandom(26891), placement = new Object3D();
  const algaeSites: { x: number; y: number; z: number; height: number; width: number; rotation: number; variant: number; post: typeof wetPosts[number] }[] = [];
  for (const post of wetPosts) {
    const lower = Math.max(-2.6, post.bottom + .58), upper = -.52;
    if (lower >= upper) continue;
    for (let row = 0; row < 2; row++) for (let side = 0; side < 2; side++) {
      const y = lower + (upper - lower) * (.18 + row * .55 + random() * .09);
      const rotation = side * Math.PI + row * 1.53 + random() * .45;
      // Holdfasts follow the taper of each actual post, above its buried foot.
      const radius = post.bottomRadius + (post.topRadius - post.bottomRadius) * (y - post.bottom) / (post.top - post.bottom);
      algaeSites.push({ x: post.x + Math.sin(rotation) * radius, y, z: post.z + Math.cos(rotation) * radius,
        height: Math.min(.35 + random() * .4, (-.30 - y) / 1.04), width: .55 + random() * .4,
        rotation, variant: (row + side + Math.floor(random() * 3)) % 3, post });
    }
  }
  const algaeMaterial = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .94 });
  const algae = [0, 1, 2].map(variant => {
    const geometry = createDockWeedGeometry(variant), sites = algaeSites.filter(site => site.variant === variant);
    const mesh = new InstancedMesh(geometry, algaeMaterial, sites.length);
    mesh.name = `visitor-pier-attached-algae-${variant}`; mesh.raycast = () => {};
    for (let index = 0; index < sites.length; index++) {
      const site = sites[index];
      placement.position.set(site.x, site.y, site.z); placement.rotation.set(0, site.rotation, 0);
      placement.scale.set(site.width, site.height, site.width); placement.updateMatrix(); mesh.setMatrixAt(index, placement.matrix);
    }
    mesh.computeBoundingSphere(); root.add(mesh); return mesh;
  });
  let disposed = false;
  return { root, algaeSites, dispose() {
    if (disposed) return; disposed = true;
    deck.geometry.dispose(); piles.geometry.dispose(); material.dispose(); metal.dispose();
    for (const mesh of algae) { mesh.geometry.dispose(); mesh.dispose(); }
    algaeMaterial.dispose();
  } };
}

export function createCoastalTraffic(location: Pick<Location, 'hostname' | 'search'> | undefined = typeof window === 'undefined' ? undefined : window.location) {
  const fleet = [0, 1, 2].map(index => ({ state: createVesselState(index), boat: createAeroBoat(index) }));
  const pier = createVisitorPier();
  if (location && ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('qaVessel') === 'berth') {
    const visitor = fleet[2].state;
    visitor.distance = visitor.route.berth; visitor.dwell = VISITOR_DWELL; visitor.speed = 0;
    writeVesselPose(visitor);
  }
  let cleanup: ReturnType<typeof setTimeout> | undefined;
  return {
    fleet, pier,
    update(delta: number, time: number, night: number, paused: boolean, quality: string) {
      for (const { state, boat } of fleet) {
        if (!paused) stepVessel(state, delta, time);
        boat.root.position.copy(state.position);
        const docked = state.index === 2 && state.position.distanceTo(VISITOR_BERTH) < .08;
        boat.root.position.y = docked ? .08 : harborWaterHeight(state.position.x, state.position.z, time) * .35 + .08;
        boat.root.rotation.set(docked ? 0 : Math.sin(time * .7 + state.index) * .008, state.heading, docked ? 0 : Math.cos(time * .56) * .012);
        boat.root.visible = state.opacity > .01;
        boat.update(time, state.opacity, night, state.speed, quality);
      }
    },
    attach() {
      clearTimeout(cleanup);
      for (const { state } of fleet) if (!vesselOccupants.includes(state)) vesselOccupants.push(state);
    },
    detach() {
      for (const { state } of fleet) {
        const index = vesselOccupants.indexOf(state);
        if (index >= 0) vesselOccupants.splice(index, 1);
      }
      clearTimeout(cleanup);
      // React's effect replay reattaches these same resources before this fires.
      cleanup = setTimeout(() => {
        for (const { boat } of fleet) boat.dispose();
        pier.dispose();
      }, 0);
    },
  };
}

export function CoastalTraffic({ runtime, paused, quality }: EnvironmentProps) {
  const traffic = useMemo(() => createCoastalTraffic(), []);
  useEffect(() => { traffic.attach(); return () => traffic.detach(); }, [traffic]);
  useFrame((_, delta) => traffic.update(delta, runtime.current.elapsed, runtime.current.weather.night, paused, quality));
  return <group name="coastal-boat-traffic">
    <primitive object={traffic.pier.root} />
    {traffic.fleet.map(({ boat }, index) => <group key={index}>
      <primitive object={boat.root} /><primitive object={boat.wakeRoot} />
    </group>)}
  </group>;
}
