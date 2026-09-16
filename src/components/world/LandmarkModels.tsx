'use client';

import type { LandmarkId } from '@/content/world';
import type { ModelProps } from './BuildingKit';
import { CoastalLighthouse } from './CoastalLighthouse';
import { ComputeBuilding } from './ComputeBuilding';
import { ResearchInstitute } from './ResearchInstitute';
import { CampusHall } from './CampusHall';
import { GardenGallery } from './GardenGallery';
import { ReceptionTerminal } from './ReceptionTerminal';
import { LandmarkMechanisms } from './LandmarkMechanisms';

export function LandmarkModel({ id, ...props }: ModelProps & { id: LandmarkId }) {
  const Architecture = id === 'work' ? ComputeBuilding : id === 'research' ? ResearchInstitute : id === 'purdue' ? CampusHall : id === 'about' ? GardenGallery : id === 'contact' ? ReceptionTerminal : CoastalLighthouse;
  return <group dispose={null}><Architecture {...props} />{id !== 'purdue' && id !== 'about' && <LandmarkMechanisms id={id} {...props} />}</group>;
}
