'use client';

import { useEffect,useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, BoxGeometry, BufferGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { combine, strut } from './BuildingKit';
import { createVesselState, stepVessel, vesselOccupants, SURVEY_BERTH, SURVEY_DWELL, VISITOR_BERTH, VISITOR_DWELL, writeVesselPose } from './marineTraffic';
import { harborWaterHeight } from './waterSurface';
import { seededRandom, terrainMeshHeight } from './terrain';
import { createDockGrowthGeometry } from './DockEcology';
import { CITY_PIER_JUNCTION, VISITOR_PIER_HEAD } from './cityInfrastructure';
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
  const materials={shell:new MeshPhysicalMaterial({color:'#e2f5ec',metalness:.14,roughness:.34,clearcoat:.5}),trim:new MeshPhysicalMaterial({color:index===1?'#369c8d':'#168ab4',metalness:.28,roughness:.32}),glass:new MeshPhysicalMaterial({color:'#397d8f',transparent:true,opacity:.55,depthWrite:false,roughness:.13}),solar:new MeshPhysicalMaterial({color:'#183b60',metalness:.28,roughness:.36}),metal:new MeshPhysicalMaterial({color:'#789ba0',metalness:.55,roughness:.43}),warm:new MeshPhysicalMaterial({color:'#ffdb87',emissive:'#ffcf7b',emissiveIntensity:.3}),red:new MeshPhysicalMaterial({color:'#f45346',emissive:'#e12e20',emissiveIntensity:.7}),green:new MeshPhysicalMaterial({color:'#91db72',emissive:'#75bd55',emissiveIntensity:.7}),rubber:new MeshPhysicalMaterial({color:'#294b57',roughness:.93}),rescue:new MeshPhysicalMaterial({color:'#f6a346',roughness:.6})};
  const allMaterials = Object.values(materials);
  // Keep shader defines stable for the entire visitor fade. Small boats remain opaque.
  if (large) for (const material of allMaterials) material.transparent = true;
  const geometries:BufferGeometry[]=[];
  const boardingGate = new Group(); boardingGate.name=large?'visitor-retracting-boarding-gate':'survey-retracting-boarding-gate'; root.add(boardingGate);
  const partBounds:Record<string,Box3>={},batches=new Map<Group,Map<keyof typeof materials,BufferGeometry[]>>();
  const add=(name:string,parts:BufferGeometry[],paint:keyof typeof materials,parent=root)=>{
    const geometry=combine(parts);geometry.computeBoundingBox();partBounds[name]=geometry.boundingBox!.clone();
    const marker=new Object3D();marker.name=name;marker.userData.bounds=partBounds[name];parent.add(marker);
    if(!batches.has(parent))batches.set(parent,new Map());const paints=batches.get(parent)!;
    if(!paints.has(paint))paints.set(paint,[]);paints.get(paint)!.push(geometry);
  };
  const length=large?15.6:index===1?4.6:3.5,width=large?4.4:index===1?2.15:1.35;
  if(index===0)add('swept-hydrofoil-hull',[launchHull(length,width,.9)],'shell');
  else add('twin-fine-entry-hulls',[-1,1].map(side=>launchHull(length,width*(large?.28:.32),large?1.4:1).translate(side*width*.36,0,0)),'shell');
  add('connected-passenger-deck',[new BoxGeometry(width,.12,length*.78).translate(0,large?.42:.28,-.12)],'shell');
  add('aqua-waterline-trim',[-1,1].map(side=>new BoxGeometry(.035,.065,length*.69).translate(side*width*.5,.27,-.17)),'trim');
  const cabinLength=large?8.7:index===1?2.25:1.45,cabinHeight=large?1.94:index===1?1.74:.65;
  const frames:BufferGeometry[]=[],panes:BufferGeometry[]=[],seats:BufferGeometry[]=[];
  for(const side of [-1,1]){
    for(const z of [-cabinLength/2,0,cabinLength/2].filter(z=>!(index===1&&side===1&&z===0)))frames.push(new BoxGeometry(.045,cabinHeight,.045).translate(side*width*.40,.37+cabinHeight/2,z));
    if(index>0&&side===1){
      for(const [start,end] of [[-cabinLength/2,large?-1.57:-.47],[large?-.28:.47,cabinLength/2]])panes.push(new BoxGeometry(.022,cabinHeight-.12,end-start-.04).translate(side*width*.4,.46+cabinHeight/2,(start+end)/2));
    }else panes.push(new BoxGeometry(.022,cabinHeight-.12,cabinLength-.04).translate(side*width*.4,.46+cabinHeight/2,0));
    for(let row=0;row<(large?8:2);row++){
      const z=-cabinLength*.36+row*(large?.72:.48);
      if(index===1&&side===1&&row===1)continue;
      seats.push(new BoxGeometry(large?.38:.24,.08,.29).translate(side*width*.23,large?.71:.55,z),new BoxGeometry(large?.38:.24,large?.53:.27,.055).translate(side*width*.23,large?.98:.69,z-.14));
      frames.push(new CylinderGeometry(.022,.03,.2,6).translate(side*width*.23,large?.57:.41,z));
    }
  }
  panes.push(new BoxGeometry(width*.78,cabinHeight-.12,.018).rotateX(-.12).translate(0,.38+cabinHeight/2,cabinLength*.5));
  add('cabin-pillars-and-seat-pedestals',frames,'metal');add('individual-aqua-seating',seats,'trim');add('panoramic-windscreen',panes,'glass');
  const roof=.42+cabinHeight;
  add('curved-canopy',[new SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2).scale(width*.48,.16,cabinLength*.59).translate(0,roof,0)],'shell');
  add('roof-mounted-photovoltaics',Array.from({length:large?12:6},(_,n)=>new BoxGeometry(width*.18,.022,cabinLength*.2).rotateX(-.055).translate(((n%3)-1)*width*.22,roof+.15,-cabinLength*.29+Math.floor(n/3)*cabinLength*.2)),'solar');
  add('stern-battery-and-helm',[new BoxGeometry(width*.49,.22,.35).translate(0,.48,-cabinLength*.56),new BoxGeometry(.27,.22,.19).translate(-width*.17,.54,cabinLength*.38)],'trim');
  const rails:BufferGeometry[]=[];
  const railBase=large?.48:.34,railTop=large?1.48:.83,gateStart=large?-1.57:-.47,gateEnd=large?-.28:.47;
  for(const side of [-1,1]){
    const x=side*width*.48;
    const spans=index>0&&side===1?[[-length*.35,gateStart],[gateEnd,length*.28]]:[[-length*.35,length*.28]];
    for(const [start,end] of spans){
      for(const y of [railBase+(railTop-railBase)*.5,railTop])rails.push(strut(new Vector3(x,y,start),new Vector3(x,y,end),large?.026:.019));
      const count=Math.ceil((end-start)/(large?.85:.48));
      for(let post=0;post<=count;post++){const z=start+(end-start)*post/count;rails.push(strut(new Vector3(x,railBase,z),new Vector3(x,railTop,z),large?.027:.018));}
    }
    add(side<0?'port-light':'starboard-light',[new SphereGeometry(large?.068:.045,8,6).translate(side*width*.48,railTop+.04,length*.22)],side<0?'red':'green');
    // Impellers are completely inside the hull. Only the shrouded discharge
    // and protective inlet grate are exposed below the stern waterline.
    const jetRadius=large?.20:.075,jetX=side*width*.36,jetZ=-length*.45;
    add('enclosed-waterjet-nozzles',[
      new CylinderGeometry(jetRadius,jetRadius*1.13,large?.42:.18,12,1,true).rotateX(Math.PI/2).translate(jetX,-.13,jetZ),
      ...[-1,0,1].map(offset=>new BoxGeometry(jetRadius*1.7,.014,.03).translate(jetX,-.13+offset*jetRadius*.49,jetZ+(large?.22:.10))),
      new BoxGeometry(jetRadius*2,.04,large?.48:.2).translate(jetX,-.32,jetZ+.45),
    ],'metal');
    add('recessed-waterjet-outlets',[new CylinderGeometry(jetRadius*.82,jetRadius*.82,.025,12).rotateX(Math.PI/2).translate(jetX,-.13,jetZ-.05)],'rubber');
  }
  rails.push(strut(new Vector3(-width*.48,railTop,-length*.35),new Vector3(width*.48,railTop,-length*.35),.025));
  add('perimeter-guardrails',rails,'metal');
  add('cabin-warm-light-strip',[new BoxGeometry(width*.50,.018,.05).translate(0,roof-.06,0)],'warm');
  if(index===1){
    add('survey-boarding-threshold',[
      new BoxGeometry(.39,.08,.88).translate(1.10,.44,0),
      new BoxGeometry(.23,.10,.88).translate(.85,.39,0),
    ],'shell');
    add('survey-door-frame',[
      ...[-.47,.47].map(z=>new BoxGeometry(.06,1.72,.06).translate(width*.4,1.20,z)),
      new BoxGeometry(.065,.065,1.01).translate(width*.4,2.075,0),
    ],'shell');
    add('survey-sliding-cabin-door',[new BoxGeometry(.024,1.59,.88).translate(width*.4+.025,1.245,0)],'glass',boardingGate);
    add('survey-boarding-rail-gate',[
      ...[.59,.83].map(y=>new BoxGeometry(.035,.045,.92).translate(width*.48+.03,y,0)),
      ...[-.44,0,.44].map(z=>new BoxGeometry(.035,.49,.035).translate(width*.48+.03,.59,z)),
    ],'metal',boardingGate);
    add('survey-chart-table-and-instruments',[
      new BoxGeometry(.46,.40,.31).translate(-.28,.54,.70),
      new BoxGeometry(.42,.05,.27).rotateX(-.20).translate(-.28,.77,.64),
      new BoxGeometry(.50,.11,.37).translate(-.32,.42,-.65),
    ],'trim');
    add('survey-navigation-display',[new BoxGeometry(.24,.15,.016).rotateX(-.22).translate(-.28,.91,.67)],'solar');
    add('survey-lifering',[new TorusGeometry(.16,.045,6,18).rotateY(Math.PI/2).translate(-1.01,.86,-.45)],'rescue');
    add('survey-mast',[new CylinderGeometry(.024,.04,.72,8).translate(0,roof+.46,-.47),new SphereGeometry(.10,10,8).scale(1,.7,1).translate(0,roof+.84,-.47)],'shell');}
  if(index===0)add('hydrofoil-underwater-wings',[new BoxGeometry(width*1.18,.025,.21).translate(0,-.37,.55),new BoxGeometry(width*.76,.022,.16).translate(0,-.37,-.8)],'trim');
  if(large){
    add('enclosed-lower-saloon-bulkheads', [
      new BoxGeometry(.08,.66,cabinLength).translate(-width*.40,.82,0),
      ...[[-cabinLength/2,-1.57],[-.28,cabinLength/2]].map(([start,end])=>new BoxGeometry(.08,.66,end-start).translate(width*.40,.82,(start+end)/2)),
      new BoxGeometry(width*.8,cabinHeight,.10).translate(0,.37+cabinHeight/2,-cabinLength/2),
      new BoxGeometry(width*.8,.63,.12).translate(0,.67,cabinLength/2),
    ],'shell');
    add('saloon-window-mullions',[-1,1].flatMap(side=>Array.from({length:8},(_,i)=>-3.8+i*1.08).filter(z=>side===-1||z < -1.57||z > -.28).map(z=>new BoxGeometry(.07,1.25,.06).translate(side*width*.403,1.72,z))),'shell');
    add('enclosed-wheelhouse-and-radar',[
      new BoxGeometry(2.55,.65,3.15).translate(0,roof+.56,.7),
      new BoxGeometry(2.5,1.3,.08).translate(0,roof+.92,-.85),
      new CylinderGeometry(.05,.07,.9,8).translate(0,roof+2.2,.5),
      new BoxGeometry(1.05,.13,.2).translate(0,roof+2.66,.5),
    ],'shell');
    add('raised-bow-breakwater',[-1,1].map(side=>new BoxGeometry(.07,1,2.5).rotateY(-side*.25).translate(side*1.19,.98,5.52)),'shell');
    add('attached-deck-and-wheelhouse-lights',[
      ...[-1,1].flatMap(side=>[-3,0,3].map(z=>new BoxGeometry(.07,.05,.42).translate(side*1.7,roof-.1,z))),
      new BoxGeometry(1.8,.035,.09).translate(0,roof+1.5,1.8),
      new SphereGeometry(.09,8,6).translate(0,roof+2.73,.5),
    ],'warm');
    add('starboard-boarding-step',[new BoxGeometry(.54,.08,1.22).translate(width*.5,.44,-.925)],'shell');
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
    add('boarding-portal-frame',[
      ...[-1.57,-.28].map(z=>new BoxGeometry(.075,1.94,.075).translate(width*.4,1.45,z)),
      new BoxGeometry(.085,.10,1.37).translate(width*.4,2.45,-.925),
      ...[-1.57,-.28].map(z=>strut(new Vector3(width*.4,1.35,z),new Vector3(width*.52,1.35,z),.027)),
    ],'shell');
    add('sliding-cabin-door',[new BoxGeometry(.035,1.83,1.18).translate(width*.405,1.43,-.925)],'glass',boardingGate);
    add('sliding-boarding-gate',[
      ...[.98,1.48].map(y=>new BoxGeometry(.035,.04,1.28).translate(width*.48+.04,y,-.925)),
      ...[-1.55,-.93,-.30].map(z=>new BoxGeometry(.035,1,.035).translate(width*.48+.04,.98,z)),
    ],'metal',boardingGate);
    add('passenger-safety-fittings',[
      ...[-1,1].flatMap(side=>[-3.7,2.5].map(z=>new TorusGeometry(.21,.052,6,18).rotateY(Math.PI/2).translate(side*1.84,1.5,z))),
    ],'rescue');
    add('rubber-fenders-and-nonslip-threshold',[
      ...[-1,1].flatMap(side=>[-4.8,-2.4,1.6,4.4].map(z=>new CylinderGeometry(.105,.105,.54,10).translate(side*2.19,.54,z))),
      ...Array.from({length:7},(_,i)=>new BoxGeometry(.55,.006,.025).translate(2.15,.483,-1.46+i*.18)),
    ],'rubber');
    add('life-raft-canisters-and-luggage-racks',[
      ...[-1,1].map(side=>new CylinderGeometry(.22,.22,1.2,12).rotateX(Math.PI/2).translate(side*1.38,roof+.37,-2.75)),
      new BoxGeometry(1.05,.10,.60).translate(-.82,.96,-3.54),
      new BoxGeometry(1.05,.10,.60).translate(-.82,1.60,-3.54),
      new BoxGeometry(.06,1.25,.60).translate(-1.37,1.10,-3.54),
    ],'shell');
    add('navigation-console-and-passenger-fittings',[
      new BoxGeometry(.9,.46,.36).translate(0,roof+.61,1.86),
      new BoxGeometry(.62,.08,.30).rotateX(.28).translate(0,roof+.89,1.90),
      new BoxGeometry(.40,.14,.38).translate(0,roof+.55,1.17),
      new BoxGeometry(.40,.48,.08).translate(0,roof+.82,1.0),
      new BoxGeometry(.48,.65,.34).translate(.99,.81,-3.51),
    ],'trim');
    add('stern-stair-handrails',[-1,1].map(side=>strut(new Vector3(-1.12+side*.35,1.38,-4.9),new Vector3(-1.12+side*.35,2.90,-3.14),.025)),'metal');

  }
  const helmX=large?0:-width*.17,helmY=large?roof+.93:.89,helmZ=large?1.62:cabinLength*.36;
  add('helm-wheel-throttle-and-controls',[
    new TorusGeometry(large?.16:.115,.014,6,16).rotateX(-.3).translate(helmX,helmY,helmZ),
    ...[0,Math.PI*2/3,Math.PI*4/3].map(angle=>strut(new Vector3(helmX,helmY,helmZ),new Vector3(helmX+Math.sin(angle)*(large?.15:.105),helmY+Math.cos(angle)*(large?.15:.105),helmZ),.009)),
    strut(new Vector3(helmX+.25,helmY-.13,helmZ+.1),new Vector3(helmX+.25,helmY+.03,helmZ+.04),.014),
    new SphereGeometry(.032,8,6).translate(helmX+.25,helmY+.03,helmZ+.04),
  ],'metal');
  add('helm-dial-and-map-screen',[
    new BoxGeometry(large?.35:.23,.16,.025).rotateX(-.2).translate(helmX,helmY+.14,helmZ+.15),
  ],'solar');
  for(const [parent,paints]of batches)for(const [paint,parts]of paints){
    for(const part of parts)part.deleteAttribute('uv');
    const geometry=combine(parts);geometries.push(geometry);const mesh=new Mesh(geometry,materials[paint]);
    mesh.name=`${parent===root?'boat':'boarding-gate'}-${paint}`;mesh.raycast=()=>{};mesh.castShadow=paint!=='glass';mesh.receiveShadow=true;parent.add(mesh);
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
  let disposed = false;
  return {
    root, materials, wakeRoot, partBounds,
    update(time: number, opacity: number, night: number, speed: number, quality: string = 'high', boarding = 0) {
      boardingGate.position.z = boarding * (large?1.31:1.0);
      for (const material of allMaterials) material.opacity = opacity * (material === materials.glass ? .55 : 1);
      materials.warm.emissiveIntensity = night * 3.4;
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
export const VISITOR_PIER_SHORE = { x: -12, z: -58 };
export { VISITOR_PIER_HEAD } from './cityInfrastructure';

/** One connected city pier branches west from the taxi's existing shore access. */
export function createVisitorPier() {
  const root = new Group(), pieces: BufferGeometry[] = [], steel: BufferGeometry[] = [], rubber:BufferGeometry[]=[];
  const wetPosts: { x: number; z: number; bottom: number; top: number; bottomRadius: number; topRadius: number }[] = [];
  const head = VISITOR_PIER_HEAD, joint=CITY_PIER_JUNCTION;
  const rampStart=-51.16,rampEnd=head.z-.575;
  const grade=(z:number)=>z<=rampStart?joint.y:z>=rampEnd?.56:joint.y+(.56-joint.y)*(z-rampStart)/(rampEnd-rampStart);
  const rail=(a:Vector3,b:Vector3)=>steel.push(strut(a,b,.031));
  // Exact top/bottom corner prisms meet at shared edges. Rotated plank boxes
  // used to overlap the flat decks and the city stem by several centimetres.
  const deckPrism=(name:string,x0:number,x1:number,z0:number,z1:number,y0:number,y1:number,thickness:number)=>{
    const geometry=new BufferGeometry(),positions:number[]=[];
    for(const drop of [thickness,0])positions.push(x0,y0-drop,z0,x1,y0-drop,z0,x1,y1-drop,z1,x0,y1-drop,z1);
    geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
    geometry.setIndex([4,7,6,4,6,5,0,1,2,0,2,3,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0]);
    const flat=geometry.toNonIndexed();geometry.dispose();flat.computeVertexNormals();flat.userData.deckPanel={name,x0,x1,z0,z1,y0,y1,thickness};pieces.push(flat);
  };
  deckPrism('city-branch',head.x+.84,joint.x-.65,joint.z-.84,joint.z+.84,joint.y,joint.y,.12);
  deckPrism('elbow',head.x-.84,head.x+.84,joint.z-.84,rampStart,joint.y,joint.y,.12);
  deckPrism('graded-ramp',head.x-.84,head.x+.84,rampStart,rampEnd,joint.y,.56,.12);
  deckPrism('quay-head',head.x-3.3,head.x+3.3,rampEnd,head.z+.575,.56,.56,.14);
  const deckPanels=pieces.map(piece=>piece.userData.deckPanel);
  // One outline owns every exposed edge, including both T shoulders and the elbow.
  // Only the shared city stem and the two interlocked boarding gates interrupt it.
  const perimeter=[[-12.60,-52.78],[-27.78,-52.78],[-27.78,rampStart],[-27.78,-46.365],[-30.24,-46.365],[-30.24,-45.335],[-28.57,-45.335],[-27.28,-45.335],[-23.76,-45.335],[-23.76,-46.365],[-26.22,-46.365],[-26.22,-51.22],[-12.60,-51.22]];
  const railingSegments:{a:Vector3;b:Vector3}[]=[];
  const supportKeys=new Set<string>();
  const pole=(x:number,z:number,top:number)=>{
    const key=`${x.toFixed(4)},${z.toFixed(4)}`;if(supportKeys.has(key))return;supportKeys.add(key);
    const bottom=terrainMeshHeight(x,z)-.3;
    steel.push(new CylinderGeometry(.10,.13,top-bottom,10).translate(x,(top+bottom)/2,z));
    rail(new Vector3(x,top,z),new Vector3(x,top+1,z));
    wetPosts.push({x,z,bottom,top,bottomRadius:.13,topRadius:.10});
  };
  for(let i=0;i<perimeter.length-1;i++){
    const [ax,az]=perimeter[i],[bx,bz]=perimeter[i+1];
    if(i===6||i===4)continue;
    const a=new Vector3(ax,grade(az),az),b=new Vector3(bx,grade(bz),bz);railingSegments.push({a,b});
    for(const height of [.50,1])rail(a.clone().add(new Vector3(0,height,0)),b.clone().add(new Vector3(0,height,0)));
    const count=Math.ceil(a.distanceTo(b)/1.45);
    for(let post=0;post<=count;post++){const point=a.clone().lerp(b,post/count);pole(point.x,point.z,point.y);}
  }
  // The west-side service gate and front passenger gate are closed whenever empty.
  const gates=[
    {name:'visitor-quay-gate',a:new Vector3(-28.57,.56,-45.335),b:new Vector3(-27.28,.56,-45.335)},
    {name:'survey-quay-gate',a:new Vector3(-30.24,.56,-46.365),b:new Vector3(-30.24,.56,-45.335)},
  ].map(({name,a,b})=>{
    const direction=b.clone().sub(a),length=direction.length(),group=new Group();group.name=name;group.position.copy(a);
    const closedYaw=Math.atan2(-direction.z,direction.x);group.rotation.y=closedYaw;
    const parts=[... [.50,1].map(height=>new BoxGeometry(length,.05,.045).translate(length/2,height,0)),... [0,length/2,length].map(x=>new BoxGeometry(.04,1,.045).translate(x,.5,0))];
    pole(a.x,a.z,a.y);pole(b.x,b.z,b.y);
    return {group,geometry:combine(parts),closedYaw,a,b};
  });
  for(const side of [-1,1]){
    const x=head.x+side*2.85;
    steel.push(new CylinderGeometry(.08,.09,.22,10).translate(x,.67,head.z),new BoxGeometry(.30,.06,.10).translate(x,.78,head.z));
    rubber.push(new CylinderGeometry(.13,.13,.48,10).translate(head.x+side*2.6,.24,head.z+.61));
  }
  const material=new MeshPhysicalMaterial({color:'#e5f3e8',roughness:.34,clearcoat:.35,clearcoatRoughness:.24}),metal=new MeshPhysicalMaterial({color:'#3a8093',metalness:.35,roughness:.43}),rubberMaterial=new MeshStandardMaterial({color:'#274e58',roughness:.95});
  const deck=new Mesh(combine(pieces),material),piles=new Mesh(combine(steel),metal),fenders=new Mesh(combine(rubber),rubberMaterial);
  deck.name='visitor-pier-boardwalk';piles.name='visitor-pier-seabed-piles';fenders.name='quay-soft-fenders';
  for(const mesh of [deck,piles,fenders]){mesh.raycast=()=>{};mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
  root.name='unified-city-pier-west-berth';
  for(const gate of gates){const mesh=new Mesh(gate.geometry,metal);mesh.raycast=()=>{};gate.group.add(mesh);root.add(gate.group);}
  // Two shore-mounted gangways align with real side thresholds; neither is a second dock.
  const bridges=[
    {name:'visitor-telescoping-gangway',position:new Vector3(head.x-.925,.56,head.z+.515),width:1.18,length:.67,yaw:0},
    {name:'survey-telescoping-gangway',position:new Vector3(head.x-3.24,.56,head.z),width:.86,length:.44,yaw:-Math.PI/2},
  ].map(({name,position,width,length,yaw})=>{
    const group=new Group();group.name=name;group.position.copy(position);group.rotation.y=yaw;
    const parts=[new BoxGeometry(width,.07,length).translate(0,-.035,length/2)];
    for(const side of [-1,1]){
      for(const y of [.50,1])parts.push(strut(new Vector3(side*(width/2-.03),y,0),new Vector3(side*(width/2-.03),y,length),.028));
      for(const z of [0,length])parts.push(strut(new Vector3(side*(width/2-.03),0,z),new Vector3(side*(width/2-.03),1,z),.028));
    }
    const mesh=new Mesh(combine(parts),metal);mesh.raycast=()=>{};group.add(mesh);root.add(group);group.visible=false;return {group,mesh};
  });
  const random=seededRandom(26891);
  const algaeSites:{x:number;y:number;z:number;height:number;width:number;rotation:number;variant:number;seed:number;post:typeof wetPosts[number]}[]=[];
  for(const post of wetPosts){
    const lower=Math.max(-2.6,post.bottom+.65),upper=-.26;
    if(lower>=upper)continue;
    const rows=Math.max(3,Math.ceil((upper-lower)/(.29+random()*.09))),phase=random()*Math.PI*2,twist=.45+random()*.65;
    for(let row=0;row<rows;row++)for(let side=0;side<2;side++){
      if(random()<.08)continue;
      const y=lower+(upper-lower)*((row+random()*.32)/rows),rotation=phase+side*Math.PI+row*twist+random()*.45;
      const radius=post.bottomRadius+(post.topRadius-post.bottomRadius)*(y-post.bottom)/(post.top-post.bottom);
      if(y<=terrainMeshHeight(post.x+Math.sin(rotation)*radius,post.z+Math.cos(rotation)*radius)+.05)continue;
      algaeSites.push({x:post.x+Math.sin(rotation)*radius,y,z:post.z+Math.cos(rotation)*radius,height:Math.min(.27+random()*.19,(-.25-y)/1.04),width:radius/.12,rotation,variant:Math.floor(random()*3),seed:Math.floor(random()*2147483647),post});
    }
  }
  const algaeMaterial=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.96});
  const algaeGeometry=createDockGrowthGeometry(algaeSites.map(site=>({...site,radius:site.width*.12})));
  const algaeMesh=new Mesh(algaeGeometry,algaeMaterial);algaeMesh.name='visitor-pier-attached-algae';algaeMesh.userData.dockGrowth=true;algaeMesh.raycast=()=>{};root.add(algaeMesh);
  const algae=[algaeMesh];
  let disposed=false;
  return {root,deckPanels,algaeSites,railingSegments,gateSegments:gates.map(({a,b})=>({a,b})),update(boarding:number,surveyBoarding=0){
    for(const [index,amount]of [boarding,surveyBoarding].entries()){bridges[index].group.visible=amount>.02;bridges[index].group.scale.z=Math.max(.02,amount);gates[index].group.rotation.y=gates[index].closedYaw+amount*Math.PI/2;}
  },dispose(){
    if(disposed)return;disposed=true;
    for(const mesh of [deck,piles,fenders,...bridges.map(bridge=>bridge.mesh)])mesh.geometry.dispose();for(const gate of gates)gate.geometry.dispose();material.dispose();metal.dispose();rubberMaterial.dispose();
    for(const mesh of algae){mesh.geometry.dispose();}algaeMaterial.dispose();
  }};
}

export function createCoastalTraffic(location: Pick<Location, 'hostname' | 'search'> | undefined = typeof window === 'undefined' ? undefined : window.location) {
  const fleet = [1, 2].map(index => ({ state: createVesselState(index), boat: createAeroBoat(index) }));
  const pier = createVisitorPier();
  if (location && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    const pose=new URLSearchParams(location.search).get('qaVessel');
    if(pose==='berth'||pose==='survey-berth'){
      const vessel=fleet.find(vessel=>vessel.state.index===(pose==='berth'?2:1))!.state;
      vessel.distance=vessel.route.berth;vessel.dwell=vessel.index===2?VISITOR_DWELL:SURVEY_DWELL;vessel.speed=0;
      writeVesselPose(vessel);
    }
  }
  let cleanup: ReturnType<typeof setTimeout> | undefined;
  return {
    fleet, pier,
    update(delta: number, time: number, night: number, paused: boolean, quality: string) {
      let visitorBoarding=0,surveyBoarding=0;
      for (const { state, boat } of fleet) {
        if (!paused) stepVessel(state, delta, time);
        boat.root.position.copy(state.position);
        const docked = state.position.distanceTo(state.index===2?VISITOR_BERTH:SURVEY_BERTH) < .08;
        boat.root.position.y = docked ? .08 : harborWaterHeight(state.position.x, state.position.z, time) * .35 + .08;
        boat.root.rotation.set(docked ? 0 : Math.sin(time * .7 + state.index) * .008, state.heading, docked ? 0 : Math.cos(time * .56) * .012);
        boat.root.visible = state.opacity > .01;
        const dwell=state.index===2?VISITOR_DWELL:SURVEY_DWELL;
        const boarding=state.dwell>0?Math.min(1,(dwell-state.dwell)/1.2,state.dwell/1.2):0;
        boat.update(time, state.opacity, night, state.speed, quality,boarding);
        if(state.index===2)visitorBoarding=boarding;else surveyBoarding=boarding;
      }
      pier.update(visitorBoarding,surveyBoarding);
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
