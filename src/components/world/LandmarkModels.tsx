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
import { ExperienceStudio, HistoryMuseum } from './CivicLandmarks';

export function LandmarkModel({ id, ...props }: ModelProps & { id: LandmarkId }) {
  const Architecture = id === 'work' ? ComputeBuilding
    : id === 'experience' ? ExperienceStudio
    : id === 'research' ? ResearchInstitute
    : id === 'purdue' ? CampusHall
    : id === 'history' ? HistoryMuseum
    : id === 'about' ? GardenGallery
    : id === 'contact' ? ReceptionTerminal
    : CoastalLighthouse;
  const mechanism = id === 'work' || id === 'research' || id === 'contact' || id === 'building';
  return <group dispose={null}><Architecture {...props} />{mechanism && <LandmarkMechanisms id={id} {...props} />}</group>;
}
