import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Vector3 } from 'three';
import { coastalRockGeometry, createCoastalRocks, ROCK_ARCHETYPES } from '../src/components/world/coastalRocks';
import { coastalBiome } from '../src/components/world/coastalBiome';
import { archipelagoGeometry, createLandscapePlan, generatePlantPositions, groundRouteAt, islandAt, terrainHeight } from '../src/components/world/terrain';

test('six stone archetypes have distinct angular outlines and planar embedded bases',()=>{
  const signatures=new Set<string>();
  for(let kind=0;kind<ROCK_ARCHETYPES.length;kind++){
    const g=coastalRockGeometry(kind);g.computeBoundingBox();const p=g.attributes.position;
    assert.equal(g.boundingBox!.min.y,0);assert.ok(g.boundingBox!.max.y>.4);assert.ok(p.count<250);
    const base=new Set<number>();for(let i=0;i<p.count;i++)if(p.getY(i)===0)base.add(p.getX(i));assert.ok(base.size>=6);
    signatures.add(JSON.stringify(g.boundingBox));assert.ok(g.attributes.color);g.dispose();
  }
  assert.equal(signatures.size,6);
  const sites=createLandscapePlan().rocks,rocks=createCoastalRocks(sites),matrix=new Matrix4(),v=new Vector3();
  for(let kind=0;kind<6;kind++){
    const batch=rocks.root.children[kind] as import('three').InstancedMesh;
    sites.filter((_,i)=>i%6===kind).forEach((site,i)=>{batch.getMatrixAt(i,matrix);v.setFromMatrixPosition(matrix);assert.ok(v.y<terrainHeight(site.x,site.z));});
  }
  rocks.dispose();
});

test('grass roots use the terrain ecological field and ground carries paving on its own vertices',()=>{
  const plan=createLandscapePlan();for(const plant of generatePlantPositions(1200,plan)){
    const biome=coastalBiome(plant.x,plant.z,islandAt(plant.x,plant.z).distance,terrainHeight(plant.x,plant.z));
    assert.ok(biome.grass>0);assert.ok(groundRouteAt(plant.x,plant.z).distance>plant.reach-.01);
  }
  const geometry=archipelagoGeometry();assert.ok(geometry.attributes.aEcology);assert.ok(geometry.attributes.aPaving);
  const ecology=geometry.attributes.aEcology;let dry=0,green=0,town=0;for(let i=0;i<ecology.count;i++){if(ecology.getX(i)<.03)dry++;if(ecology.getX(i)>.4)green++;if(ecology.getZ(i)>.9)town++;}
  assert.ok(dry>1000&&green>100&&town>100);geometry.dispose();
});
