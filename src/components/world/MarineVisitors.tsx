'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, CatmullRomCurve3, CircleGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentProps } from './Water';
import { createMarineVisitor, stepMarineVisitor, type MarineVisitorState } from './marineVisitorState';
import { terrainMeshHeight } from './terrain';

function oval(x:number,y:number,z:number,sx:number,sy:number,sz:number){return new SphereGeometry(1,12,8).scale(sx,sy,sz).translate(x,y,z);}

/** Small populations share anatomy, colors and the nest details across instances. */
export function createMarineVisitors(){
  const root=new Group();root.name='reef-visitors-and-beach-nursery';
  const geometries=new Set<BufferGeometry>(),materials=new Set<MeshStandardMaterial>();
  const shape=(geometry:BufferGeometry)=>{geometries.add(geometry);return geometry;};
  const paint=(color:string,roughness=.78)=>{const material=new MeshStandardMaterial({color,roughness,side:DoubleSide});materials.add(material);return material;};
  const stone=paint('#66715b'),stoneMottles=[paint('#a2a98a'),paint('#525e50')],stoneEye=paint('#191e20');
  const octopusSkin=[paint('#c56e64',.58),paint('#8265a5',.57)],octopusUnderside=paint('#e8ad9e'),octopusEye=paint('#162a31');
  const turtleShell=paint('#3b5945'),turtlePlates=paint('#779765'),turtleSkin=paint('#668a64'),turtleBelly=paint('#d2c99a'),egg=paint('#ece7d3'),nestSand=paint('#b5a17e');
  const shadowMaterial=new MeshStandardMaterial({color:'#263e30',transparent:true,opacity:.24,depthWrite:false,roughness:1,side:DoubleSide});materials.add(shadowMaterial);
  const bodyStone=shape(oval(0,.105,0,.43,.11,.30)),stoneFin=shape(new SphereGeometry(1,7,5).scale(.12,.17,.028));
  const stoneSpot=shape(new SphereGeometry(1,6,4).scale(.032,.009,.026)),eye=shape(new SphereGeometry(1,7,5).scale(.018,.018,.014));
  const mantle=shape(oval(-.10,.42,0,.31,.28,.25)),head=shape(oval(.21,.30,0,.23,.19,.21)),siphon=shape(new TorusGeometry(.052,.015,5,12));
  const armPath=new CatmullRomCurve3([new Vector3(.12,.07,0),new Vector3(.27,.02,.09),new Vector3(.42,.04,.19),new Vector3(.53,.015,.25),new Vector3(.55,.08,.29),new Vector3(.48,.12,.31)]);
  const octArm=shape(new TubeGeometry(armPath,18,.055,6,false));
  const armPositions=octArm.getAttribute('position'),armUV=octArm.getAttribute('uv');
  for(let i=0;i<armPositions.count;i++){
    const t=armUV.getX(i),center=armPath.getPointAt(t),taper=.98-.83*t;
    armPositions.setXYZ(i,center.x+(armPositions.getX(i)-center.x)*taper,center.y+(armPositions.getY(i)-center.y)*taper,center.z+(armPositions.getZ(i)-center.z)*taper);
  }
  armPositions.needsUpdate=true;octArm.computeVertexNormals();
  const suckers=shape(new SphereGeometry(1,5,4).scale(.023,.012,.024));
  const shell=shape(oval(-.08,.31,0,.67,.27,.48)),belly=shape(oval(-.08,.15,0,.58,.09,.42)),turtleHead=shape(oval(.59,.18,0,.24,.16,.18));
  const flipper=shape(oval(.10,.06,0,.34,.045,.15));
  const nestRim=shape(new TorusGeometry(.40,.045,5,20).rotateX(Math.PI/2)),eggShape=shape(new SphereGeometry(1,7,5).scale(.085,.10,.075));
  const combine=(parts:BufferGeometry[])=>{const geometry=mergeGeometries(parts)!;parts.forEach(part=>part.dispose());return shape(geometry);};
  const stoneMarkings=[0,1].map(tint=>combine(Array.from({length:17},(_,spot)=>{
    const a=spot*2.399,r=.07+Math.sqrt((spot*13%17)/17)*.28;
    return spot%2===tint?stoneSpot.clone().translate(Math.cos(a)*r,.192-Math.abs(Math.sin(a))*r*.13,Math.sin(a)*r*.62):null;
  }).filter((part):part is BufferGeometry=>part!==null)));
  const scutePositions:number[]=[];
  const shellPoint=(u:number,v:number)=>{
    let x=-.08+u*1.4,z=v,q=((x+.08)/.67)**2+(z/.48)**2;
    if(q>.88){const scale=Math.sqrt(.88/q);x=-.08+(x+.08)*scale;z*=scale;q=.88;}
    return [x,.31+.27*Math.sqrt(1-q)+.015,z];
  };
  const plateRadius=.145;
  for(let plateIndex=0;plateIndex<7;plateIndex++){
    const angle=(plateIndex-1)*Math.PI/3,offset=plateIndex?Math.sqrt(3)*plateRadius:0;
    const cu=Math.cos(angle)*offset,cv=Math.sin(angle)*offset;
    const center=shellPoint(cu,cv);
    for(let edge=0;edge<6;edge++){
      const a=Math.PI/6+edge*Math.PI/3,b=a+Math.PI/3;
      scutePositions.push(...center,...shellPoint(cu+Math.cos(b)*plateRadius*.93,cv+Math.sin(b)*plateRadius*.93),...shellPoint(cu+Math.cos(a)*plateRadius*.93,cv+Math.sin(a)*plateRadius*.93));
    }
  }
  const shellScutes=shape(new BufferGeometry());shellScutes.setAttribute('position',new Float32BufferAttribute(scutePositions,3));shellScutes.computeVertexNormals();shellScutes.userData.plateCount=7;
  const suckerCluster=combine(Array.from({length:3},(_,n)=>{const p=armPath.getPointAt(.39+n*.21);return suckers.clone().translate(p.x,p.y-.038,p.z);}));
  const contactShadow=combine([
    new CircleGeometry(1,24).rotateX(-Math.PI/2).scale(.60,1,.36),
    new CircleGeometry(1,14).rotateX(-Math.PI/2).scale(.23,1,.13).translate(.08,0,-.35),
    new CircleGeometry(1,14).rotateX(-Math.PI/2).scale(.23,1,.13).translate(.08,0,.35),
  ]);
  const add=(parent:Group,name:string,geometry:BufferGeometry,material:MeshStandardMaterial,x=0,y=0,z=0)=>{const mesh=new Mesh(geometry,material);mesh.name=name;mesh.position.set(x,y,z);mesh.raycast=()=>{};parent.add(mesh);return mesh;};
  const states:MarineVisitorState[]=[];
  const actors:{state:MarineVisitorState;animal:Group;arms?:Group[];flippers?:Mesh[];shadow?:Mesh}[]=[];
  for(const [kind,count] of [['stonefish',2],['octopus',2],['turtle',3]] as const) for(let index=0;index<count;index++){
    const state=createMarineVisitor(kind,index);states.push(state);
    const animal=new Group();animal.name=`${kind}-${index}`;animal.scale.setScalar(state.size);root.add(animal);
    const actor:{state:MarineVisitorState;animal:Group;arms?:Group[];flippers?:Mesh[];shadow?:Mesh}={state,animal};actors.push(actor);
    if(kind==='stonefish'){
      add(animal,'low-camouflaged-stonefish',bodyStone,stone);
      for(let fin=0;fin<9;fin++){const angle=fin/9*Math.PI*2;const mesh=add(animal,'venomous-dorsal-and-pectoral-spines',stoneFin,fin%3?stone:stoneMottles[fin%2],Math.cos(angle)*.32,.18,Math.sin(angle)*.23);mesh.rotation.z=.5*Math.cos(angle);mesh.rotation.x=.55*Math.sin(angle);}
      stoneMarkings.forEach((geometry,tint)=>add(animal,'reef-stone-mottling',geometry,stoneMottles[tint]));
      for(const side of [-1,1])add(animal,'stonefish-eyes',eye,stoneEye,.27,.17,side*.14);
    }else if(kind==='octopus'){
      const skin=octopusSkin[index%2];add(animal,'octopus-mantle',mantle,skin);add(animal,'octopus-head',head,skin);
      const nozzle=add(animal,'octopus-siphon',siphon,octopusUnderside,-.03,.17,.21);nozzle.rotation.x=Math.PI/2;
      for(const side of [-1,1]){add(animal,'octopus-eye-rim',eye,octopusUnderside,.31,.39,side*.19).scale.setScalar(2);add(animal,'octopus-pupil',eye,octopusEye,.325,.40,side*.217);}
      actor.arms=[];
      for(let arm=0;arm<8;arm++){
        const pivot=new Group();pivot.name=`octopus-arm-${arm+1}`;pivot.rotation.y=arm*Math.PI/4;pivot.scale.setScalar(.89+(arm%3)*.055);animal.add(pivot);actor.arms.push(pivot);
        add(pivot,'tapered-tendril',octArm,skin);
        add(pivot,'sucker-row',suckerCluster,octopusUnderside);
      }
    }else{
      add(animal,'arched-sea-turtle-shell',shell,turtleShell);add(animal,'pale-plastron',belly,turtleBelly);add(animal,'sea-turtle-head',turtleHead,turtleSkin);
      add(animal,'shell-scutes',shellScutes,turtlePlates);
      for(const side of [-1,1])add(animal,'turtle-eye',eye,octopusEye,.72,.23,side*.14);
      actor.flippers=[];
      for(const side of [-1,1])for(const forward of [-1,1]){
        const limb=add(animal,'four-swimming-flippers',flipper,turtleSkin,forward*.36,.10,side*.43);limb.rotation.y=side*(forward>0?.45:-.25);actor.flippers.push(limb);
      }
      animal.traverse(object=>{if(object instanceof Mesh)object.castShadow=true;});
      const shadow=add(root,'turtle-contact-shadow',contactShadow,shadowMaterial);shadow.renderOrder=2;actor.shadow=shadow;
      // The small clutch sits on a separately validated beach patch beside its guardian.
      const nest=new Group();nest.name=`guarded-turtle-nest-${index}`;nest.position.set(state.nest.x,state.nest.y-.025,state.nest.z);root.add(nest);
      add(nest,'partly-buried-sand-rim',nestRim,nestSand);
      for(let n=0;n<5;n++)add(nest,'small-turtle-egg',eggShape,egg,Math.cos(n*2.399)*.18,.10,Math.sin(n*2.399)*.18);
    }
  }
  function update(delta:number,paused=false){if(paused)return;for(const {state,animal,arms,flippers,shadow} of actors){
    stepMarineVisitor(state,delta);
    animal.position.copy(state.position);animal.rotation.y=state.heading;
    if(state.kind==='octopus'){
      animal.position.y+=state.moving?.07+state.jet*.16:0;
      arms?.forEach((arm,index)=>{arm.rotation.x=Math.sin(state.time*1.8+index*1.3)*(.09+state.jet*.12);arm.rotation.z=Math.sin(state.time*1.45+index*.9)*.08;});
    }
    if(state.kind==='turtle'){
      const x=state.position.x,z=state.position.z,h=state.heading;
      const gx=(terrainMeshHeight(x+.25,z)-terrainMeshHeight(x-.25,z))/.5;
      const gz=(terrainMeshHeight(x,z+.25)-terrainMeshHeight(x,z-.25))/.5;
      animal.rotation.set(-Math.atan(gx*Math.sin(h)+gz*Math.cos(h)),h,Math.atan(gx*Math.cos(h)-gz*Math.sin(h)),'YXZ');
      flippers?.forEach((flipper,index)=>{flipper.rotation.z=Math.sin(state.time*3+index*Math.PI)* (state.moving?.23:.035);});
      if(shadow){shadow.position.set(state.position.x,state.position.y+.008,state.position.z);shadow.rotation.y=state.heading;}
    }
  }}
  function setQuality(tier:EnvironmentProps['quality']){actors.forEach(({animal,state,shadow})=>{animal.visible=tier==='high'||state.index===0||(tier==='medium'&&state.index<2);if(shadow)shadow.visible=animal.visible;});root.children.filter(child=>child.name.startsWith('guarded-turtle-nest-')).forEach((nest,index)=>{nest.visible=tier==='high'||index===0||(tier==='medium'&&index<2);});}
  update(0);
  let timer:ReturnType<typeof setTimeout>;
  function dispose(){geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());}
  return {root,states,update,setQuality,dispose,retain(){clearTimeout(timer);return()=>{timer=setTimeout(dispose,0);};}};
}

export function MarineVisitors({paused,quality}:EnvironmentProps){
  const life=useMemo(()=>createMarineVisitors(),[]);
  useEffect(()=>life.retain(),[life]);
  useEffect(()=>{life.setQuality(quality);},[life,quality]);
  useFrame((_,delta)=>life.update(delta,paused));
  return <primitive object={life.root}/>;
}
