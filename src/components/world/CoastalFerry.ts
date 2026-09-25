import { BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, Object3D, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityFerryDistance, createCityFerryRoute, writeCityFerryPose } from './cityInfrastructure';

/** Fine bow, immersed keel and displaced-water sections replace the capsule hull. */
export function ferryPontoonGeometry() {
  const sections = [[-1.18,.025,.03],[-1.04,.18,.14],[-.65,.235,.19],[.35,.23,.18],[.92,.14,.12],[1.27,.009,.018]];
  const curve = new CatmullRomCurve3(sections.map(([z,w,h])=>new Vector3(z,w,h)),false,'catmullrom',.3);
  const positions:number[]=[],indices:number[]=[];
  const rows=36,sides=20;
  for(let row=0;row<=rows;row++){
    const section=curve.getPoint(row/rows);
    for(let side=0;side<=sides;side++){
      const angle=side/sides*Math.PI*2;
      positions.push(Math.sin(angle)*Math.max(.008,section.y),Math.cos(angle)*Math.max(.008,section.z)*1.5,section.x);
      if(row&&side){const a=row*(sides+1)+side;indices.push(a,a-sides-1,a-1,a-1,a-sides-1,a-sides-2);}
    }
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

/** Fittings share one rigid hull transform; only the wake has a water-plane offset. */
export function createCoastalFerry() {
  const root=new Group();root.name='city-water-taxi';const route=createCityFerryRoute();
  const materials={
    shell:new MeshPhysicalMaterial({color:'#edf6ef',roughness:.28,metalness:.18,clearcoat:.65}),
    trim:new MeshPhysicalMaterial({color:'#1262c4',roughness:.27,metalness:.35,clearcoat:.55}),
    solar:new MeshPhysicalMaterial({color:'#16375f',roughness:.3,metalness:.38,clearcoat:.45}),
    deck:new MeshPhysicalMaterial({color:'#986345',roughness:.8}),
    glass:new MeshPhysicalMaterial({color:'#124b62',roughness:.09,metalness:.12,transparent:true,opacity:.42,depthWrite:false,clearcoat:1}),
    rubber:new MeshPhysicalMaterial({color:'#233940',roughness:.91}),
    seats:new MeshPhysicalMaterial({color:'#06abc1',roughness:.65}),
    red:new MeshPhysicalMaterial({color:'#fa5341',emissive:'#ec3020',emissiveIntensity:.6,roughness:.3}),
    green:new MeshPhysicalMaterial({color:'#75dc4d',emissive:'#56b93b',emissiveIntensity:.6,roughness:.3}),
    wake:new MeshPhysicalMaterial({color:'#d3fff2',transparent:true,opacity:0,depthWrite:false,roughness:.6,side:DoubleSide}),
  };
  const resources:BufferGeometry[]=[];
  function add(name:string,parts:BufferGeometry[],material:MeshPhysicalMaterial,parent=root){
    for(const part of parts)if(!part.getAttribute('uv')){const p=part.getAttribute('position'),uv:number[]=[];for(let i=0;i<p.count;i++)uv.push(p.getX(i),p.getZ(i));part.setAttribute('uv',new Float32BufferAttribute(uv,2));}
    const converted=parts.map(part=>part.index?part.toNonIndexed():part);
    const geometry=mergeGeometries(converted)!;new Set([...parts,...converted]).forEach(part=>part.dispose());resources.push(geometry);
    const mesh=new Mesh(geometry,material);mesh.name=name;mesh.castShadow=!material.transparent;mesh.receiveShadow=!material.transparent;parent.add(mesh);return mesh;
  }
  const strut=(a:Vector3,b:Vector3,radius=.018)=>{
    const direction=b.clone().sub(a),object=new Object3D();object.position.copy(a).add(b).multiplyScalar(.5);object.quaternion.setFromUnitVectors(new Vector3(0,1,0),direction.clone().normalize());object.updateMatrix();
    return new CylinderGeometry(radius,radius,direction.length(),10).applyMatrix4(object.matrix);
  };
  add('ferry-twin-displacement-hulls',[-1,1].map(side=>ferryPontoonGeometry().translate(side*.43,0,0)),materials.shell);
  add('ferry-deck-and-boarding-threshold',[new BoxGeometry(1.12,.10,1.94).translate(0,.22,-.03),new BoxGeometry(1.19,.055,.36).translate(0,.26,-.84)],materials.deck);
  const canopyPositions:number[]=[],canopyIndices:number[]=[];
  for(let row=0;row<=16;row++)for(let col=0;col<=12;col++){
    const z=-.74+row/16*1.54,x=(col/12-.5)*1.04;
    canopyPositions.push(x,.98+.065*(1-(x/.52)**2)-.04*(z/.8)**2,z);
    if(row&&col){const a=row*13+col;canopyIndices.push(a,a-13,a-1,a-1,a-13,a-14);}
  }
  const canopy=new BufferGeometry();canopy.setAttribute('position',new Float32BufferAttribute(canopyPositions,3));canopy.setIndex(canopyIndices);canopy.computeVertexNormals();
  const underside=canopy.clone().translate(0,-.045,0);const undersideIndex=underside.index!;for(let i=0;i<undersideIndex.count;i+=3){const a=undersideIndex.getX(i);undersideIndex.setX(i,undersideIndex.getX(i+2));undersideIndex.setX(i+2,a);}underside.computeVertexNormals();
  const frames:BufferGeometry[]=[];const glazing:BufferGeometry[]=[];
  for(const side of [-1,1]){
    for(const z of [-.69,.67])frames.push(strut(new Vector3(side*.48,.28,z),new Vector3(side*.5,.98,z-.035),.026));
    frames.push(strut(new Vector3(side*.5,.975,-.76),new Vector3(side*.5,.975,.79),.023));
    // The aft quarter remains open for boarding, with an actual threshold and handrail.
    glazing.push(new BoxGeometry(.014,.54,.58).translate(side*.49,.65,.39),new BoxGeometry(.014,.54,.43).translate(side*.49,.65,-.16));
    frames.push(strut(new Vector3(side*.49,.35,.07),new Vector3(side*.50,.98,.07),.014));
  }
  glazing.push(new BoxGeometry(.94,.56,.016).rotateX(-.06).translate(0,.65,.68));
  frames.push(new BoxGeometry(.98,.045,.04).translate(0,.96,.70),new BoxGeometry(.98,.04,.035).translate(0,.37,.70));
  add('ferry-supported-curved-canopy',[canopy,underside,...frames],materials.shell);add('ferry-cabin-glazing',glazing,materials.glass);
  const cabin:BufferGeometry[]=[];const steel:BufferGeometry[]=[];
  for(const side of [-1,1])for(const z of [-.35,.15]){
    cabin.push(new BoxGeometry(.27,.07,.28).translate(side*.28,.45,z),new BoxGeometry(.27,.26,.055).rotateX(-.12).translate(side*.28,.59,z-.12));
    steel.push(new CylinderGeometry(.023,.025,.19,10).translate(side*.28,.335,z));
  }
  cabin.push(new BoxGeometry(.31,.22,.19).translate(-.25,.52,.49));steel.push(new BoxGeometry(.23,.03,.12).rotateX(.3).translate(-.25,.68,.47));
  add('ferry-seats-and-helm',cabin,materials.seats);add('ferry-seat-pedestals-and-controls',steel,materials.trim);
  const rails:BufferGeometry[]=[];
  for(const side of [-1,1]){
    const rail=new CatmullRomCurve3([new Vector3(side*.56,.47,-.9),new Vector3(side*.56,.47,-.5),new Vector3(side*.56,.47,.70),new Vector3(side*.38,.47,.91)]);
    rails.push(new TubeGeometry(rail,24,.014,8,false));
    for(const z of [-.9,-.5,.65])rails.push(strut(new Vector3(side*.56,.27,z),new Vector3(side*.56,.47,z),.014));
  }
  add('ferry-deck-rails',rails,materials.shell);
  add('ferry-mounted-fenders',[-1,1].flatMap(side=>[-.60,.54].map(z=>new CylinderGeometry(.045,.045,.19,12).rotateZ(Math.PI/2).translate(side*.57,.27,z))),materials.rubber);
  add('ferry-port-navigation-light',[new BoxGeometry(.035,.045,.075).translate(-.535,.93,.60)],materials.red);
  add('ferry-starboard-navigation-light',[new BoxGeometry(.035,.045,.075).translate(.535,.93,.60)],materials.green);
  // Two supported photovoltaic modules sit over the aft canopy, clear of boarding.
  const panelFrames:BufferGeometry[]=[],cells:BufferGeometry[]=[],conductors:BufferGeometry[]=[];
  for(const side of [-1,1]) {
    const cx=side*.25;
    panelFrames.push(new BoxGeometry(.465,.025,.58).translate(cx,1.084,-.435));
    for(let row=0;row<4;row++)for(let col=0;col<3;col++) {
      const x=cx+(col-1)*.139,z=-.645+row*.14;
      cells.push(new BoxGeometry(.131,.009,.132).translate(x,1.103,z));
      conductors.push(new BoxGeometry(.002,.001,.127).translate(x,1.1085,z));
    }
    for(const z of [-.65,-.23])panelFrames.push(new BoxGeometry(.41,.055,.022).translate(cx,1.052,z));
  }
  add('ferry-aft-solar-supports',panelFrames,materials.shell);
  add('ferry-aft-photovoltaic-cells',cells,materials.solar);
  add('ferry-solar-cell-busbars',conductors,materials.trim);
  add('ferry-solar-power-conduit',[strut(new Vector3(.48,1.06,-.54),new Vector3(.48,.31,-.54),.012),new BoxGeometry(.26,.13,.18).translate(.27,.36,-.56)],materials.rubber);
  add('ferry-electric-drive-and-dock-cleats',[-1,1].flatMap(side=>[
    new BoxGeometry(.12,.13,.25).translate(side*.43,-.15,-1.05),new CylinderGeometry(.047,.047,.08,12).rotateX(Math.PI/2).translate(side*.43,-.17,-1.19),
    new BoxGeometry(.12,.024,.04).translate(side*.42,.305,-.77),new BoxGeometry(.03,.05,.03).translate(side*.42,.28,-.77),
  ]),materials.trim);
  const wakeRoot=new Group();wakeRoot.name='ferry-water-contact';root.add(wakeRoot);
  const wakePositions:number[]=[],wakeIndices:number[]=[];
  for(const side of [-1,1])for(let row=0;row<=28;row++){
    const t=row/28,start=wakePositions.length/3;
    for(const edge of [-1,1])wakePositions.push(side*(.43+t*.80)+edge*(.018+t*.045)*Math.sin(Math.PI*t),0,-1.13-t*2.9);
    if(row<28)wakeIndices.push(start,start+1,start+2,start+1,start+3,start+2);
  }
  const wakeGeometry=new BufferGeometry();wakeGeometry.setAttribute('position',new Float32BufferAttribute(wakePositions,3));wakeGeometry.setIndex(wakeIndices);wakeGeometry.computeVertexNormals();
  const wake=add('ferry-speed-driven-wake',[wakeGeometry],materials.wake,wakeRoot);wake.castShadow=false;
  const position=new Vector3(),tangent=new Vector3();let lastTime=0;
  function update(time:number,paused=false){
    const next=paused?lastTime:time;lastTime=next;
    writeCityFerryPose(route,next,position,tangent);root.position.copy(position);root.rotation.y=Math.atan2(tangent.x,tangent.z);
    const current=cityFerryDistance(route,next),ahead=cityFerryDistance(route,next+.01);
    const speed=paused?0:((ahead-current+route.length)%route.length)/.01;
    const strength=Math.min(1,speed/route.speed);
    wakeRoot.position.y=.025-position.y;wake.visible=strength>.025;if(!paused)wakeRoot.scale.set(1,1,.5+strength*.5);materials.wake.opacity=.36*strength;
    root.userData.speed=speed;root.userData.docked=speed<.025;
    return {position,speed};
  }
  update(0);
  return {root,route,update,dispose(){resources.forEach(resource=>resource.dispose());Object.values(materials).forEach(material=>material.dispose());}};
}
