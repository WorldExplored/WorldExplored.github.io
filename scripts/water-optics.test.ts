import assert from 'node:assert/strict';
import test from 'node:test';
import { meadowWaterClarity, waterOpacity, waterOpticalDepth } from '../src/components/world/waterOptics';
import { landDistance } from '../src/components/world/terrain';

test('offshore water darkens progressively without an opaque shelf boundary', () => {
  for (const [x,z,dx,dz] of [[38,-8,1,0],[-80,-40,-1,0],[0,-98,0,-1],[0,43,0,1]]) {
    let previous = -1;
    for (let distance=0;distance<=160;distance+=.25) {
      const px=x+dx*distance,pz=z+dz*distance;
      const opacity=waterOpacity(waterOpticalDepth(px,pz,Math.max(0,-landDistance(px,pz))));
      assert.ok(opacity>=previous-.004, `outward opacity at ${px},${pz}`);
      if(previous>=0)assert.ok(Math.abs(opacity-previous)<.013, 'no abrupt visibility cutoff');
      previous=opacity;
    }
    assert.ok(previous>.94,'distant ocean becomes opaque');
  }
});
test('both reef arms retain useful visibility and finite water color depth',()=>{
  for(const [x,z] of [[-2,-42],[-46,-37],[-46,-55],[-61,-37]]){
    const opacity=waterOpacity(waterOpticalDepth(x,z,-landDistance(x,z)));
    assert.ok(opacity>.05&&opacity<.35,`${x},${z}: ${opacity}`);
  }
});

// The exported seabed must disappear beneath deep water before its mesh boundary.
test('deep water obscures all four outer seabed edges', () => {
  for (const [x, z] of [[-145, -37], [-145, -55], [0, -170], [90, -50], [0, 75]]) {
    assert.ok(waterOpacity(waterOpticalDepth(x, z, -landDistance(x, z))) > .975);
  }
});


test('meadow water retains reflections while softly revealing its bottom habitat',()=>{
  assert.equal(meadowWaterClarity(-55,-3),1);
  assert.equal(meadowWaterClarity(0,-3),0);
  const depth=waterOpticalDepth(-55,-3,-landDistance(-55,-3));
  assert.ok(waterOpacity(depth,.6,1)<waterOpacity(depth,.6)*.6);
  assert.ok(waterOpacity(depth,.01,1)>.9,'grazing sky reflections remain at the horizon');
  let previous=1;
  for(let x=-55;x<-35;x+=.05){const clarity=meadowWaterClarity(x,-3);assert.ok(Math.abs(previous-clarity)<.025,'clear-water edge has no abrupt optical seam');previous=clarity;}
});
