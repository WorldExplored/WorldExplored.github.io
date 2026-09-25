'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, CatmullRomCurve3, CircleGeometry, CylinderGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentProps } from './Water';
import { createMarineVisitor, sampleTurtleCycle, stepMarineVisitor, turtleHatchlingPose, type MarineVisitorState } from './marineVisitorState';
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
  const turtleShell=paint('#314d38'),turtlePlates=paint('#6b8656'),turtleSkin=paint('#668a64'),turtleBelly=paint('#d2c99a'),egg=paint('#f3ead8'),nestSand=paint('#b5a17e'),nestWrack=paint('#72745a'),nestWood=paint('#988b6d');
  const shadowMaterial=new MeshStandardMaterial({color:'#263e30',transparent:true,opacity:.24,depthWrite:false,roughness:1,side:DoubleSide});materials.add(shadowMaterial);
  const bodyStone=shape(oval(0,.105,0,.43,.11,.30)),stoneFin=shape(new SphereGeometry(1,7,5).scale(.12,.17,.028));
  const stoneSpot=shape(new SphereGeometry(1,6,4).scale(.032,.009,.026)),eye=shape(new SphereGeometry(1,7,5).scale(.018,.018,.014));
  const mantle=shape(oval(.12,.24,0,.44,.145,.16)),head=shape(oval(-.24,.185,0,.17,.11,.125)),siphon=shape(new CylinderGeometry(.026,.038,.11,9).rotateX(Math.PI/2));
  const armPath=new CatmullRomCurve3([new Vector3(0,0,0),new Vector3(.12,-.06,.025),new Vector3(.27,-.075,.055),new Vector3(.42,-.07,.10),new Vector3(.47,-.025,.17),new Vector3(.42,.03,.21)]);
  const octArm=shape(new TubeGeometry(armPath,18,.044,6,false));
  const armPositions=octArm.getAttribute('position'),armUV=octArm.getAttribute('uv');
  for(let i=0;i<armPositions.count;i++){
    const t=armUV.getX(i),center=armPath.getPointAt(t),taper=.98-.83*t;
    armPositions.setXYZ(i,center.x+(armPositions.getX(i)-center.x)*taper,center.y+(armPositions.getY(i)-center.y)*taper,center.z+(armPositions.getZ(i)-center.z)*taper);
  }
  armPositions.needsUpdate=true;octArm.computeVertexNormals();
  const suckers=shape(new SphereGeometry(1,5,4).scale(.023,.012,.024));
  const shell=shape(oval(-.08,.31,0,.67,.27,.48)),belly=shape(oval(-.08,.15,0,.58,.09,.42)),turtleHead=shape(oval(.59,.18,0,.24,.16,.18));
  const flipper=shape(oval(.10,.06,0,.34,.045,.15));
  const eggShape=shape(new SphereGeometry(.057,12,8));
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
  const plates:[number,number,number][]=[];
  for(let i=0;i<5;i++)plates.push([-.32+i*.16,0,.101]);
  for(const side of [-1,1])for(let i=0;i<4;i++)plates.push([-.27+i*.18,side*.21,.108]);
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2;plates.push([Math.cos(a)*.405,Math.sin(a)*.365,.072]);}
  for(const [cu,cv,radius] of plates){
    const center=shellPoint(cu,cv);
    for(let edge=0;edge<6;edge++){
      const a=Math.PI/6+edge*Math.PI/3,b=a+Math.PI/3;
      scutePositions.push(...center,...shellPoint(cu+Math.cos(b)*radius*.89,cv+Math.sin(b)*radius*.89),...shellPoint(cu+Math.cos(a)*radius*.89,cv+Math.sin(a)*radius*.89));
    }
  }
  const shellScutes=shape(new BufferGeometry());shellScutes.setAttribute('position',new Float32BufferAttribute(scutePositions,3));shellScutes.computeVertexNormals();shellScutes.userData.plateCount=plates.length;
  const suckerCluster=combine(Array.from({length:3},(_,n)=>{const p=armPath.getPointAt(.39+n*.21);return suckers.clone().translate(p.x,p.y-.038,p.z);}));
  const turtleTail=shape(new CylinderGeometry(.002,.067,.21,8).rotateZ(Math.PI/2).translate(-.68,.15,0));
  const turtleMarkings=combine([-1,1].flatMap(side=>Array.from({length:13},(_,i)=>{
    const a=i*2.4;
    return oval(.58+Math.cos(a)*.12,.23+Math.sin(a)*.043,side*(.12+Math.sin(a)*.025),.025,.009,.008);
  })));
  const nestDebris=combine(Array.from({length:11},(_,i)=>{
    const a=i*2.399,r=.37+(i%3)*.073;
    return new CylinderGeometry(.007,.016,.16+(i%4)*.08,5).rotateZ(Math.PI/2).rotateY(a+.6).translate(Math.cos(a)*r,.018+(i%3)*.012,Math.sin(a)*r);
  }));
  const nestLeaves=combine(Array.from({length:14},(_,i)=>{
    const a=i*2.19,r=.28+(i%5)*.06;
    return oval(Math.cos(a)*r,.025+(i%3)*.004,Math.sin(a)*r,.09+(i%3)*.018,.008,.022).rotateY(a);
  }));
  const nestShells=combine(Array.from({length:9},(_,i)=>{
    const a=i*2.399,r=.32+(i%4)*.05;
    return new SphereGeometry(.026,7,4,0,Math.PI*2,0,Math.PI*.5).scale(1,.4,.8).translate(Math.cos(a)*r,.012,Math.sin(a)*r);
  }));
  // Uneven deposited sand and scrape marks, without a manufactured torus rim.
  const disturbedSand=combine(Array.from({length:21},(_,i)=>{
    const a=i*2.399,r=.22+(i%6)*.040;
    return oval(Math.cos(a)*r,-.018,Math.sin(a)*r,.10+(i%3)*.014,.037+(i%4)*.004,.075).rotateY(a);
  }));
  const contactShadow=combine([
    new CircleGeometry(1,24).rotateX(-Math.PI/2).scale(.60,1,.36),
    new CircleGeometry(1,14).rotateX(-Math.PI/2).scale(.23,1,.13).translate(.08,0,-.35),
    new CircleGeometry(1,14).rotateX(-Math.PI/2).scale(.23,1,.13).translate(.08,0,.35),
  ]);
  const add=(parent:Group,name:string,geometry:BufferGeometry,material:MeshStandardMaterial,x=0,y=0,z=0)=>{const mesh=new Mesh(geometry,material);mesh.name=name;mesh.position.set(x,y,z);mesh.raycast=()=>{};parent.add(mesh);return mesh;};
  const states:MarineVisitorState[]=[];
  type Actor={state:MarineVisitorState;animal:Group;arms?:Group[];flippers?:Mesh[];shadow?:Mesh;mantle?:Mesh;eggs?:Group};
  const actors:Actor[]=[];
  for(const [kind,count] of [['stonefish',2],['octopus',2],['turtle',3]] as const) for(let index=0;index<count;index++){
    const state=createMarineVisitor(kind,index);states.push(state);
    const animal=new Group();animal.name=`${kind}-${index}`;animal.scale.setScalar(state.size);root.add(animal);
    const actor:Actor={state,animal};actors.push(actor);
    if(kind==='stonefish'){
      add(animal,'low-camouflaged-stonefish',bodyStone,stone);
      for(let fin=0;fin<9;fin++){const angle=fin/9*Math.PI*2;const mesh=add(animal,'venomous-dorsal-and-pectoral-spines',stoneFin,fin%3?stone:stoneMottles[fin%2],Math.cos(angle)*.32,.18,Math.sin(angle)*.23);mesh.rotation.z=.5*Math.cos(angle);mesh.rotation.x=.55*Math.sin(angle);}
      stoneMarkings.forEach((geometry,tint)=>add(animal,'reef-stone-mottling',geometry,stoneMottles[tint]));
      for(const side of [-1,1])add(animal,'stonefish-eyes',eye,stoneEye,.27,.17,side*.14);
    }else if(kind==='octopus'){
      const skin=octopusSkin[index%2];actor.mantle=add(animal,'octopus-mantle',mantle,skin);add(animal,'octopus-head',head,skin);
      add(animal,'octopus-siphon',siphon,skin,-.17,.155,.115);
      for(const side of [-1,1])add(animal,'inset-octopus-eye',eye,octopusEye,-.255,.222,side*.116).scale.set(.75,.62,.4);
      actor.arms=[];
      for(let arm=0;arm<8;arm++){
        const pivot=new Group();pivot.name=`octopus-arm-${arm+1}`;pivot.position.set(-.29,.15,0);pivot.rotation.y=Math.PI+(arm-3.5)*.24;pivot.scale.setScalar(.86+(arm%3)*.055);animal.add(pivot);actor.arms.push(pivot);
        add(pivot,'tapered-tendril',octArm,skin);
        add(pivot,'sucker-row',suckerCluster,octopusUnderside);
      }
    }else{
      add(animal,'arched-sea-turtle-shell',shell,turtleShell);add(animal,'pale-plastron',belly,turtleBelly);add(animal,'sea-turtle-head',turtleHead,turtleSkin);
      add(animal,'shell-scutes',shellScutes,turtlePlates);add(animal,'sea-turtle-tail',turtleTail,turtleSkin);add(animal,'head-scale-markings',turtleMarkings,turtleShell);
      for(const side of [-1,1])add(animal,'turtle-eye',eye,octopusEye,.72,.23,side*.142).scale.set(.7,.7,.55);
      actor.flippers=[];
      for(const side of [-1,1])for(const forward of [-1,1]){
        const limb=add(animal,'four-swimming-flippers',flipper,turtleSkin,forward*.36,.075,side*.38);limb.rotation.y=side*(forward>0?.62:-.25);limb.scale.set(forward>0?1.13:.67,1,forward>0?.75:.95);actor.flippers.push(limb);
      }
      animal.traverse(object=>{if(object instanceof Mesh)object.castShadow=true;});
      const shadow=add(root,'turtle-contact-shadow',contactShadow,shadowMaterial);shadow.renderOrder=2;actor.shadow=shadow;
      const nest=new Group();nest.name=`guarded-turtle-nest-${index}`;nest.position.copy(state.nest);root.add(nest);
      for(const [name,geometry,material] of [['disturbed-nesting-sand',disturbedSand,nestSand],['weathered-driftwood-fragments',nestDebris,nestWood],['dry-kelp-and-seagrass-wrack',nestLeaves,nestWrack],['scattered-broken-shells',nestShells,egg]] as const){
        const grounded=shape(geometry.clone()),positions=grounded.getAttribute('position');
        for(let v=0;v<positions.count;v++)positions.setY(v,positions.getY(v)+terrainMeshHeight(state.nest.x+positions.getX(v),state.nest.z+positions.getZ(v))-state.nest.y);
        grounded.computeVertexNormals();add(nest,name,grounded,material);
      }
      const clutch=new Group();clutch.name='buried-round-turtle-eggs';nest.add(clutch);actor.eggs=clutch;
      for(let n=0;n<6;n++)add(clutch,'round-turtle-egg',eggShape,egg,Math.cos(n*2.399)*.13,.036,Math.sin(n*2.399)*.13);

    }
  }
  const babyAnatomy=[{geometry:shell,color:'#314d38'},{geometry:turtleHead,color:'#668a64'},...[-1,1].map(side=>({geometry:eye.clone().translate(.72,.23,side*.14),color:'#162a31'}))];
  const babyParts=babyAnatomy.map(({geometry,color})=>{
    const part=geometry.clone(),tint=new Color(color),count=part.getAttribute('position').count;
    part.setAttribute('color',new Float32BufferAttribute(Array.from({length:count},()=>[tint.r,tint.g,tint.b]).flat(),3));return part;
  });
  babyAnatomy.slice(2).forEach(part=>part.geometry.dispose());
  const babyBodyGeometry=combine(babyParts),babyMaterial=paint('#ffffff');babyMaterial.vertexColors=true;
  const babyBody=new InstancedMesh(babyBodyGeometry,babyMaterial,18),babyPlates=new InstancedMesh(shellScutes,turtlePlates,18),babyFlippers=new InstancedMesh(flipper,turtleSkin,72);
  babyBody.name='turtle-hatchling-bodies';babyPlates.name='turtle-hatchling-shell-scutes';babyFlippers.name='turtle-hatchling-paddling-flippers';
  for(const mesh of [babyBody,babyPlates,babyFlippers]){mesh.frustumCulled=false;mesh.raycast=()=>{};root.add(mesh);}
  const babyTransform=new Object3D(),limbTransform=new Object3D();
  let quality:EnvironmentProps['quality']='high';
  const hatchlingPoint=new Vector3();
  function writeActors(){for(const {state,animal,arms,flippers,shadow,mantle,eggs} of actors){
    animal.position.copy(state.position);animal.rotation.y=state.heading;
    if(state.kind==='octopus'){
      animal.position.y+=state.moving?.09+state.jet*.055:0;
      if(mantle){mantle.scale.y=1-state.jet*.17;mantle.scale.z=1-state.jet*.16;}
      arms?.forEach((arm,index)=>{
        arm.rotation.y=Math.PI+(index-3.5)*.24*(1-state.jet*.54)+Math.sin(state.time*1.1+index*.8)*.035;
        arm.rotation.x=Math.sin(state.time*1.45+index*.72)*.055;
        arm.rotation.z=Math.sin(state.time*1.55+index*.65)*.045-state.jet*.08;
      });
    }
    if(state.kind==='turtle'){
      const x=state.position.x,z=state.position.z,h=state.heading,nursery=state.nursery!;
      const swimming=state.position.y<-.08;
      if(!swimming)animal.position.y-=.038;
      const gx=swimming?0:(terrainMeshHeight(x+.25,z)-terrainMeshHeight(x-.25,z))/.5;
      const gz=swimming?0:(terrainMeshHeight(x,z+.25)-terrainMeshHeight(x,z-.25))/.5;
      animal.rotation.set(-Math.atan(gx*Math.sin(h)+gz*Math.cos(h)),h,Math.atan(gx*Math.cos(h)-gz*Math.sin(h)),'YXZ');
      flippers?.forEach((flipper,index)=>{flipper.rotation.z=Math.sin(state.time*(swimming?2:3)+index*Math.PI)*(swimming?.22:state.moving||nursery.stage==='digging'?.13:.014);});
      const shown=quality==='high'||state.index===0||(quality==='medium'&&state.index<2);
      animal.visible=shown&&!['incubating','hatching','resting-at-sea'].includes(nursery.stage);
      if(shadow){shadow.visible=animal.visible&&!swimming;shadow.position.set(x,terrainMeshHeight(x,z)+.016,z);shadow.rotation.y=h;}
      if(eggs){eggs.visible=nursery.eggsExposed>.02;eggs.position.y=-.095+nursery.eggsExposed*.098;}
      for(let index=0;index<6;index++){
        const pose=turtleHatchlingPose(state,index,hatchlingPoint),slot=state.index*6+index;
        babyTransform.position.copy(hatchlingPoint);babyTransform.rotation.set(0,pose.heading,0);babyTransform.scale.setScalar(shown&&pose.visible?.15+(index%3)*.012:.00001);babyTransform.updateMatrix();
        babyBody.setMatrixAt(slot,babyTransform.matrix);babyPlates.setMatrixAt(slot,babyTransform.matrix);
        for(let i=0;i<4;i++){
          const side=i<2?-1:1,forward=i%2?-1:1;
          limbTransform.position.set(forward*.36,.075,side*.38);limbTransform.rotation.set(0,side*.6,Math.sin(state.time*6+index+i*Math.PI)*.20);limbTransform.scale.set(forward>0?1.1:.65,1,.75);limbTransform.updateMatrix();limbTransform.matrix.premultiply(babyTransform.matrix);babyFlippers.setMatrixAt(slot*4+i,limbTransform.matrix);
        }
      }
      for(const mesh of [babyBody,babyPlates,babyFlippers])mesh.instanceMatrix.needsUpdate=true;
    }
  }}
  function update(delta:number,paused=false,turtleTime?:number){
    if(paused)return;
    actors.forEach(({state})=>{
      if(state.kind==='turtle'&&turtleTime!==undefined){state.time=Math.max(0,turtleTime);sampleTurtleCycle(state,state.time);}
      else stepMarineVisitor(state,delta);
    });
    writeActors();
  }
  function seekTurtles(seconds:number){actors.forEach(({state})=>{if(state.kind==='turtle'){state.time=Math.max(0,seconds);sampleTurtleCycle(state,state.time);}});writeActors();}
  function setQuality(tier:EnvironmentProps['quality']){quality=tier;actors.forEach(({animal,state})=>{animal.visible=tier==='high'||state.index===0||(tier==='medium'&&state.index<2);});root.children.filter(child=>child.name.startsWith('guarded-turtle-nest-')).forEach((nest,index)=>{nest.visible=tier==='high'||index===0||(tier==='medium'&&index<2);});writeActors();}
  update(0);
  let timer:ReturnType<typeof setTimeout>;
  function dispose(){for(const mesh of [babyBody,babyPlates,babyFlippers])mesh.dispose();geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());}
  return {root,states,update,setQuality,seekTurtles,dispose,retain(){clearTimeout(timer);return()=>{timer=setTimeout(dispose,0);};}};
}

export function MarineVisitors({runtime,paused,quality}:EnvironmentProps){
  const life=useMemo(()=>createMarineVisitors(),[]);
  const nurseryStart=useRef(runtime.current.activeElapsed),qaOffset=useRef(0);
  useEffect(()=>life.retain(),[life]);
  useEffect(()=>{
    if(!['localhost','127.0.0.1'].includes(window.location.hostname))return;
    const time=new URLSearchParams(window.location.search).get('qaWildlifeTime');
    if(time!==null&&Number.isFinite(Number(time))){qaOffset.current=Number(time);life.seekTurtles(qaOffset.current);}
  },[life]);
  useEffect(()=>{life.setQuality(quality);},[life,quality]);
  useFrame((_,delta)=>life.update(delta,paused,runtime.current.activeElapsed-nurseryStart.current+qaOffset.current));
  return <primitive object={life.root}/>;
}
