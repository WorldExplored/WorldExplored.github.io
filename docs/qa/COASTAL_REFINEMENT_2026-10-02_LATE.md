# Coastal refinement — 2 October 2026, late afternoon

Addresses the 3:50–3:52 PM screenshots and associated requests.

## Changes

- Reduced the mythical crab to 58% of its previous linear scale, with an 84-second crawl, rest and retreat cycle. Eight jointed legs and hinged pincers move independently. The chamber floor is 2.18 m lower and excavates the real seafloor; its apron and outer perimeter follow the rendered reef surface.
- Replaced repeated dock colonies with individually seeded shell counts, shell shapes, algae filaments, rotation and tint. Static growth is merged into one draw per dock assembly. Precisely joined dock prisms replace the overlapping stem and tilted plank ends.
- Moderated broadleaf trees to approximately 3.7–6.6 m. Crown spread, trunk thickness, branch form and leaf palette vary independently. Groundcover exclusions follow physical roots and building foundations rather than tree canopies. Fine grass now uses 16 short, separately rooted blades in a low irregular mat. The same 18,000 instances fill narrow house/path strips; mat tessellation drops from 50 to 48 triangles. The existing 5,800 larger meadow tufts are redistributed, increasing city accents from 1,569 to 2,978.
- Added mounted trough planters to city storeys. Offset floors have visible bearing brackets, columns and transfer beams. City and landmark interiors use smooth pearl/cyan resin finishes rather than a mineral surface map.
- Added long-billed marlin, striped lionfish and a flying-fish school. The school accelerates, climbs, glides, folds its fins and reenters in staggered groups, leaving short-lived spray and ripples. A silver shoal patrols outside the crab chamber.

## Verification

Geometry checks cover exact dock top-face intersections, planter-to-bracket and bracket-to-wall contact, offset-floor bearing surfaces, unique shellfish colonies, population and draw limits, real cave entrance triangles, and every transformed crab vertex over 168 poses. The crab audit includes approximately three million vertices, with a 1.7 cm minimum floor clearance and over 70 cm of roof clearance. Fish route checks sample coast, cave, reef and vessel clearance across ten minutes; flight checks verify gravity, water-surface reentry, low-tier populations and reduced-motion behavior.

Browser review found and corrected raised sand wedges at the cave entrance. The front apron now follows the actual excavated floor instead of interpolating above it. Close views confirmed the repaired quay, mounted planters, floor supports, resin materials, lionfish, and staggered flying-fish reentry. The deeper chamber is visible from above-water viewpoints, with the smaller crab sheltered below its roof. Review also caught a marlin route hidden in opaque offshore water and an older squid home without a usable exit. The marlin now follows a nearshore shelf route; resident homes require a clear swept exit. All ten older marine residents travel and rest.

- `npm test`: **471 passed, 0 failed**.
- `npm run check`: lint, TypeScript and production static export passed.
- Browser entry reached all five stages, plants ready and zero pending textures before enabling entry. One final desktop run reported **4,368 ms** locally; entering had no second loading phase. This is an observation on this machine, not a cross-device speed guarantee.
- Mobile entry and History navigation worked at 390 × 844 with no horizontal overflow. The final desktop scene and fish/cave views reported no browser console errors.
- Low grass retains 18,000 high-tier instances and one draw. A spatial sample of suitable city soil found 99.1% of points within 0.5 m of grass. Individual grass meshes fell from 50 to 48 triangles; city architecture remains within the existing draw budget. New fish use 16 instanced batches with smaller populations at lower quality.

## Local evidence

Screenshots and camera/runtime metadata are stored in the ignored `.tmp/qa/oct2late/` directory. Principal captures: `crab-sunken`, `crab-motion`, `dock-joint`, `colonies`, `resin-supports`, `understory-final`, `marlin-final`, `flying-fish`, `fish-reentry` and `lionfish`.
