import test from 'node:test';
import assert from 'node:assert/strict';
import { createLandscapePlan, generatePlantPositions, generatePlantPositionsAsync } from '../src/components/world/terrain';

test('incremental planting yields to input and preserves deterministic placement',async()=>{
  const plan=createLandscapePlan();let turns=0;const interval=setInterval(()=>turns++,0);
  try{
    const actual=await generatePlantPositionsAsync(4000,plan,new AbortController().signal);
    assert.deepEqual(actual,generatePlantPositions(4000,plan));assert.ok(turns>1);
  }finally{clearInterval(interval);}
});
test('abandoned startup cancels queued planting',async()=>{
  const controller=new AbortController();const pending=generatePlantPositionsAsync(18000,createLandscapePlan(),controller.signal);controller.abort();assert.equal(await pending,null);
});
