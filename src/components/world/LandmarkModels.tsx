'use client';

import { useEffect, useRef } from 'react';
import { Group, Mesh, MeshStandardMaterial, Uint8BufferAttribute } from 'three';
import { applyBakedRoomLighting } from './RoomLighting';
import type { LandmarkId } from '@/content/world';
import type { ModelProps } from './BuildingKit';
import { ArcadeHall } from './ArcadeHall';
import { CoastalLighthouse } from './CoastalLighthouse';
import { ComputeBuilding } from './ComputeBuilding';
import { ResearchInstitute } from './ResearchInstitute';
import { CampusHall } from './CampusHall';
import { GardenGallery } from './GardenGallery';
import { ReceptionTerminal } from './ReceptionTerminal';
import { LandmarkMechanisms } from './LandmarkMechanisms';
import { ExperienceStudio, HistoryMuseum } from './CivicLandmarks';

export function LandmarkModel({ id, ...props }: ModelProps & { id: LandmarkId }) {
  const group=useRef<Group>(null);
  useEffect(()=>{
    const changed:{mesh:Mesh;original:MeshStandardMaterial;lit:MeshStandardMaterial}[]=[];
    group.current?.traverse(object=>{
      if(!(object instanceof Mesh)||object.geometry.userData.floor?.kind!=='floor'||!(object.material instanceof MeshStandardMaterial))return;
      const original=object.material,normal=object.geometry.attributes.normal,fill=new Uint8Array(normal.count);
      for(let i=0;i<fill.length;i++)fill[i]=normal.getY(i)>.7?255:0;
      object.geometry.setAttribute('aRoomFill',new Uint8BufferAttribute(fill,1,true));
      const lit=applyBakedRoomLighting(original.clone(),true);object.material=lit;changed.push({mesh:object,original,lit});
    });
    return()=>{changed.forEach(({mesh,original,lit})=>{mesh.material=original;lit.dispose();});};
  },[id]);
  const Architecture = id === 'work' ? ComputeBuilding
    : id === 'experience' ? ExperienceStudio
    : id === 'research' ? ResearchInstitute
    : id === 'purdue' ? CampusHall
    : id === 'history' ? HistoryMuseum
    : id === 'about' ? GardenGallery
    : id === 'contact' ? ReceptionTerminal
    : id === 'arcade' ? ArcadeHall
    : CoastalLighthouse;
  const mechanism = id === 'work' || id === 'research' || id === 'contact' || id === 'building';
  return <group ref={group} dispose={null}><Architecture {...props} />{mechanism && <LandmarkMechanisms id={id} {...props} />}</group>;
}
