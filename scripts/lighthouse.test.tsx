import test from 'node:test';
import assert from 'node:assert/strict';
import { create, act } from '@react-three/test-renderer';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdditiveBlending, DoubleSide, FrontSide, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Raycaster, Vector3 } from 'three';
import { createLighthouseGeometry, CoastalLighthouse, LIGHTHOUSE_OPENINGS, lighthouseRadius, LighthouseFocusButton } from '../src/components/world/CoastalLighthouse';
import { createLighthouseActivation, illuminateLighthouse, lighthouseSignal, stepLighthouseSignal } from '../src/components/world/lighthouseSignal';
import { createLandmarkMechanism, LandmarkMechanisms } from '../src/components/world/LandmarkMechanisms';
import { createLighthouseAccess, lighthouseAccessCurve, LIGHTHOUSE_LANDING } from '../src/components/world/LighthouseAccess';
import { terrainMeshHeight } from '../src/components/world/terrain';
import { createSceneRuntime } from '../src/content/world';

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});

test('lighthouse foundation is circular and openings penetrate a real masonry shell',()=>{
  const geometry=createLighthouseGeometry();const material=new MeshBasicMaterial({side:DoubleSide});const ray=new Raycaster();
  try {
    const foundation=geometry.foundation.getAttribute('position');let maximumRadius=0;
    for(let i=0;i<foundation.count;i++)maximumRadius=Math.max(maximumRadius,Math.hypot(foundation.getX(i),foundation.getZ(i)));
    assert.ok(maximumRadius<=1.16001);assert.ok(maximumRadius>1.15);
    const shaft=new Mesh(geometry.shaft,material);shaft.updateMatrixWorld(true);
    for(const opening of LIGHTHOUSE_OPENINGS){const y=(opening.bottom+opening.top)/2;ray.set(new Vector3(.01,y,3),new Vector3(0,0,-1));const hits=ray.intersectObject(shaft,false);assert.ok(hits.length);assert.ok(hits[0].point.z<0,`${opening.name} must cut the front masonry`);}
    ray.set(new Vector3(.01,2.6,3),new Vector3(0,0,-1));assert.ok(ray.intersectObject(shaft,false)[0].point.z>.65,'wall remains between openings');
    const door=new Mesh(geometry.door,material);door.updateMatrixWorld(true);ray.set(new Vector3(0,1.52,3),new Vector3(0,0,-1));const hit=ray.intersectObject(door,false)[0];assert.ok(hit.point.z<lighthouseRadius(1.52)-.06,'door face is recessed');
    for(const [name,item]of Object.entries(geometry)){assert.ok(Array.from(item.getAttribute('position').array).every(Number.isFinite),name);}
  }finally{Object.values(geometry).forEach(g=>g.dispose());material.dispose();}
});

test('balcony supports touch its underside and the original resident gull keeps its rail perch',()=>{
  const geometry=createLighthouseGeometry();
  try {
    const brackets=geometry.balconyBrackets.getAttribute('position');let top=-Infinity;for(let i=0;i<brackets.count;i++)top=Math.max(top,brackets.getY(i));assert.ok(top>=5.17&&top<5.22);
    const rails=geometry.rails.getAttribute('position');const perch=new Vector3(1.09,5.83,0);let nearest=Infinity;const point=new Vector3();for(let i=0;i<rails.count;i++)nearest=Math.min(nearest,point.fromBufferAttribute(rails,i).distanceTo(perch));assert.ok(nearest<.05);
    const floor=geometry.balcony.getAttribute('position');for(let i=0;i<floor.count;i++)assert.ok(Math.hypot(floor.getX(i),floor.getZ(i))<=1.13001);
    const joints=geometry.masonrySeams.getAttribute('position');assert.ok(joints.count>1000,'courses and staggered mortar joints are physical merged geometry');
  }finally{Object.values(geometry).forEach(g=>g.dispose());}
});

test('Fresnel lamp stays inside the lantern throughout rotation and supports bounded feedback',()=>{
  const assembly=createLandmarkMechanism('building');const point=new Vector3();
  try {
    const rotating=assembly.root.getObjectByName('lighthouse-rotating-fresnel-lens')!;
    assert.ok(rotating.getObjectByName('lighthouse-lamp-reflector'));assert.ok(assembly.root.getObjectByName('lighthouse-lamp-bearing'));assert.ok(assembly.root.getObjectByName('lighthouse-lens-support-cage'));
    for(let frame=0;frame<120;frame++){
      assembly.update(frame*.71,frame%2,1/60);assembly.root.updateMatrixWorld(true);
      rotating.traverse(object=>{if(!(object instanceof Mesh))return;const positions=object.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);assert.ok(Math.hypot(point.x,point.z)<.38);assert.ok(point.y>5.6&&point.y<6.4);}});
    }
    const lamp=assembly.root.getObjectByName('lighthouse-lens-prism') as Mesh;const material=lamp.material as MeshPhysicalMaterial;assembly.setSignal(0);const idle=material.emissiveIntensity;assembly.setSignal(1);assert.ok(material.emissiveIntensity>idle+1);assembly.setSignal(0);assert.equal(material.emissiveIntensity,idle);
  }finally{assembly.dispose();}
});

test('demand-mode feedback invalidates only activation and bounded reset, with stale timeout cancellation',()=>{
  const runtime=createSceneRuntime();const signal=lighthouseSignal(runtime);let invalidations=0,next=0,cancellations=0;
  const pending=new Map<number,()=>void>();
  const controller=createLighthouseActivation(runtime,()=>{invalidations++;},{schedule:(callback,delay)=>{assert.equal(delay,4000);const handle=++next;pending.set(handle,callback);return handle as unknown as ReturnType<typeof setTimeout>;},cancel:handle=>{pending.delete(handle as unknown as number);cancellations++;}});
  controller.activate();assert.equal(invalidations,1);assert.equal(signal.intensity,1);
  stepLighthouseSignal(signal,120,true);assert.equal(signal.intensity,1,'a long idle demand-frame delta cannot erase fresh feedback');assert.equal(invalidations,1,'no animation frames are scheduled during reduced motion');
  const stale=pending.get(1)!;controller.activate();assert.equal(invalidations,2);assert.equal(cancellations,1);stale();assert.equal(signal.intensity,1);assert.equal(invalidations,2);
  pending.get(2)!();assert.equal(signal.intensity,0);assert.equal(signal.remaining,0);assert.equal(invalidations,3);
  controller.activate();assert.equal(invalidations,4);controller.dispose();assert.equal(cancellations,2);assert.equal(signal.intensity,0);assert.equal(invalidations,4,'unmount does not schedule a render');
});

test('one demand frame updates both lamp and beam; a wall-clock timeout resets paused feedback without animation',async context=>{
  context.mock.timers.enable({apis:['setTimeout']});
  const runtime={current:createSceneRuntime()};const signal=lighthouseSignal(runtime.current);
  // Normal motion still fades through the same four-second response envelope.
  illuminateLighthouse(runtime.current);for(let i=0;i<241;i++)stepLighthouseSignal(signal,1/60,false);assert.equal(signal.intensity,0);
  const render=(quality:'high'|'low'='high')=><><CoastalLighthouse active={false} paused quality={quality} runtime={runtime}/><LandmarkMechanisms id="building" active={false} paused runtime={runtime}/></>;
  const renderer=await create(render());
  try {
    const root=renderer.scene.instance;const hit=root.getObjectByName('lighthouse-lantern-hit') as Mesh;assert.equal(hit.userData.cameraInteraction,true);const geometry=hit.geometry;
    const beam=root.getObjectByName('signal-light-sweep') as Mesh;const material=beam.material as MeshPhysicalMaterial;
    assert.equal(material.depthWrite,false);assert.equal(material.blending,AdditiveBlending);assert.equal(material.side,FrontSide);assert.equal(material.userData.softVolume,true);
    const lamp=(root.getObjectByName('lighthouse-lens-prism') as Mesh).material as MeshPhysicalMaterial;
    const lens=root.getObjectByName('lighthouse-rotating-fresnel-lens')!;const angle=beam.rotation.y;const lensAngle=lens.rotation.y;
    context.mock.timers.tick(30000);
    let stopped=false;await renderer.fireEvent(renderer.scene.findByProps({name:'lighthouse-lantern-hit'}),'click',{delta:0,stopPropagation(){stopped=true;}});assert.ok(stopped);assert.equal(signal.intensity,1);
    // The first demand frame can be much later than the previous frame; it must still show the click.
    await act(async()=>{await renderer.advanceFrames(1,30);});assert.ok(material.opacity>.04);assert.ok(lamp.emissiveIntensity>1.5,'lamp observes activation in the same rendered frame');
    context.mock.timers.tick(3999);assert.equal(signal.intensity,1);
    context.mock.timers.tick(1);assert.equal(signal.intensity,0,'timeout resets even with no intervening frames');
    runtime.current.elapsed=50;await act(async()=>{await renderer.advanceFrames(1,4);});assert.equal(beam.rotation.y,angle);assert.equal(lens.rotation.y,lensAngle);assert.ok(material.opacity<.01);assert.ok(lamp.emissiveIntensity<.2);
    await renderer.update(render('low'));assert.equal((root.getObjectByName('lighthouse-lantern-hit') as Mesh).geometry,geometry);
    const button=renderToStaticMarkup(<LighthouseFocusButton activate={()=>{}}/>);assert.match(button,/aria-label="Illuminate lighthouse"/);assert.match(button,/lighthouse-focus-control/);assert.match(button,/width:44px/);assert.doesNotMatch(button,/outline:[^;]*#123e57/);assert.doesNotMatch(button,/>[^<]+</);
  }finally{await renderer.unmount();context.mock.timers.tick(0);}
});

test('water landing, actual stair faces and the stone court form a continuous supported boarding route',()=>{
  const access=createLighthouseAccess(),curve=lighthouseAccessCurve();
  const material=new MeshBasicMaterial({side:DoubleSide}),ray=new Raycaster();
  const walking=['lighthouse-arrival-deck','lighthouse-graded-treads','lighthouse-upper-court-steps'].map(name=>{
    const source=access.root.getObjectByName(name) as Mesh;
    const mesh=new Mesh(source.geometry,material);mesh.updateMatrixWorld(true);return mesh;
  });
  const height=(x:number,z:number)=>{ray.set(new Vector3(x,10,z),new Vector3(0,-1,0));return ray.intersectObjects(walking,false)[0]?.point.y;};
  try {
    assert.equal(curve.getPointAt(0).y,LIGHTHOUSE_LANDING.top);
    for(const dx of [-.8,0,.8])for(const dz of [-.75,.04,.75]){
      const x=LIGHTHOUSE_LANDING.x+dx,z=LIGHTHOUSE_LANDING.z+dz;
      assert.ok(terrainMeshHeight(x,z)<-.4,'the boat landing is genuinely offshore');
      assert.ok(Math.abs(height(x,z)!-.52)<.002,'the rendered deck is at boarding height');
    }
    let previous=height(curve.getPointAt(0).x,curve.getPointAt(0).z)!;
    for(let i=1;i<=180;i++){
      const p=curve.getPointAt(i/180),t=curve.getTangentAt(i/180),side=new Vector3(t.z,0,-t.x).normalize();
      const top=height(p.x,p.z);
      assert.ok(top!==undefined,'no opening between successive rendered treads');
      assert.ok(Math.abs(top-previous)<.17,'successive stair tops have a safe rise');
      for(const offset of [-.48,.48]){
        const x=p.x+side.x*offset,z=p.z+side.z*offset,edge=height(x,z);
        assert.ok(edge!==undefined,'the usable tread width has no missing faces');
        assert.ok(edge>terrainMeshHeight(x,z)+.06,'steps clear the whole bank');
      }
      previous=top;
    }
    for(let i=0;i<=24;i++){
      const x=-74.1-i*.69/24,z=-33.97+i*.04/24,top=height(x,z);
      assert.ok(top!==undefined,'the final treads join the existing court');
      assert.ok(Math.abs(top-previous)<.17);previous=top;
    }
    assert.ok(Math.abs(previous-terrainMeshHeight(-74.79,-33.93))<.06,'last step meets the graded court');
    const piles=(access.root.getObjectByName('lighthouse-landing-seabed-piles') as Mesh).geometry.getAttribute('position');
    for(const dx of [-.84,.84])for(const dz of [-.87,.87]){
      const x=LIGHTHOUSE_LANDING.x+dx,z=LIGHTHOUSE_LANDING.z+dz;let min=Infinity,max=-Infinity;
      for(let i=0;i<piles.count;i++)if(Math.hypot(piles.getX(i)-x,piles.getZ(i)-z)<.12){min=Math.min(min,piles.getY(i));max=Math.max(max,piles.getY(i));}
      assert.ok(min<terrainMeshHeight(x,z)-.2);assert.ok(max>=.399,'each pile bears the deck underside');
    }
    for(const name of ['lighthouse-boat-fenders','lighthouse-mooring-hardware-and-ladder','lighthouse-stair-stringer','lighthouse-under-stair-cross-braces'])assert.ok(access.root.getObjectByName(name));
  }finally{access.dispose();material.dispose();}
});

test('tower service details retain openings, beacon clearance and a bounded geometry cost',()=>{
  const geometry=createLighthouseGeometry();
  try {
    for(const name of ['serviceLadder','doorPanels','lanternVentRing'] as const)assert.ok(geometry[name].getAttribute('position').count>100);
    const ladder=geometry.serviceLadder.getAttribute('position');
    for(let i=0;i<ladder.count;i++)assert.ok(ladder.getZ(i)<-.43,'rear maintenance ladder does not obstruct front door/windows');
    const triangles=Object.values(geometry).reduce((sum,item)=>sum+(item.index?.count??item.getAttribute('position').count)/3,0);
    assert.ok(triangles<70000);
  }finally{Object.values(geometry).forEach(item=>item.dispose());}
});
