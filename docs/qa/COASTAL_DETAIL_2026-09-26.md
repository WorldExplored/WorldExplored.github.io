# Coastal detail pass — 26 September 2026

## Changes

- Seaweed uses clustered recruitment, four distinct growth forms, mixed green/bronze tones and varied lengths and widths. Island planting adds mixed grasses, ferns, flowering shrubs, climbers and three beach palms.
- Cloud families share consistent altitude shelves. Removed periodic surface noise that produced a checkerboard appearance.
- Rain intersects actual building roof triangles and bridge decks. Ground puddles shrink and fade over 7–13 seconds; ocean impacts remain short ripples. Roof indexing excludes interior decoration and only rebuilds when architecture changes.
- Broader sand transitions meet the existing mesh boundary. Exposed lighthouse swells, pooled ballistic spray, foam arcs and a temporary wet-sand response share the shoreline wave phase.
- City fronts and streets align; the arcade moves to the front-left waterfront with a connected approach. Entry fixtures illuminate small local areas, while grass and building shells no longer glow on hover. Main interior finishes use pale mineral surfaces.
- Visitor vessel is 11.8 m long with two passenger decks; two small launches have distinct hulls and equipment. A crossing reservation keeps the larger vessel clear of the ferry.
- Added crawling octopuses, sea snakes, darting squid, variable crabs and a rare offshore whale. Faster gull flights retain exclusive perches and smooth landing turns. Lighthouse shaft is wider with cyan and green bands.

## Verification

`npm run check` passes (lint, strict TypeScript, static production build). `npm test` passes 396/396 tests.

Tests cover rendered bank continuity, reef/cave clearance, actual building roof catchments, rain expiry, paused animation, resource retention, plant shader substitutions, train envelopes, marine routes and a 20-minute vessel/ferry simulation. The train clearance test now handles projected zero-length glass edges explicitly; clearance requirements were retained.

Local browser review at 1280×720 covered cloud shading, seaweed/kelp, daytime shore grading, nighttime entrance lights, the larger boat berth, the relocated arcade, octopus anatomy, offshore whale breach and lighthouse spray. The arcade opens beside its visible building. At 390×844, entry, arcade selection, game start and close controls work. Browser console review found no scene errors after fixing the plant scalar GLSL literals. Rain review showed roof-level impacts and later disappearance.

Local captures are retained under `.tmp/qa/september25d/` (ignored): `release-overview`, `cloud-close`, `night-town`, `rain-roof`, `visitor-final`, `arcade-night`, `kelp-final`, `whale-final`, `octopus-final`, `surf-crest`, and `shore-final`.

## Rendering budget

Cached distant plant geometry preserves population while removing about 1.60 million triangles from an overview main pass before culling. Close detail returns as the camera approaches. New marine residents use 10 draws; shore spray/foam uses 2 pooled draws. Roof candidate triangles fall from 135,073 to 61,278; the concentrated 900-drop Work-roof query benchmark fell from 217 ms to 18 ms on this machine. These are local measurements, not cross-device guarantees.
