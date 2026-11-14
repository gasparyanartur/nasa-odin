# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML, CSS and plain ES modules with a vendored three.js. No build step, no server. Decided in the approved spec (`../spec.md`, section 6).

## Users

Two users with equal weight (confirmed by Arda, 2026-11-14):
- The crew member who plans one walk from inside a parked pressurized crew rover.
- The suited astronaut who follows that walk and reads a helmet display through a visor, in gloves, in bright light.
Hackathon judges see the product for 30 seconds or 7 slides and may never open it.

## Product Purpose

Plan and then replay one astronaut walk at the boxwork ridges on Mount Sharp in Gale crater, on one 3D scene built from the real 1 m terrain and the real 25 cm orbit image. Success: a route through science stations that respects named limits, shown as margins, with values that Curiosity measured on a named Mars day.

## Positioning

One place at walking scale with measured data and honest labels. Every number on screen carries a unit and its origin: a source with its sol, "assumption", or "scenario".

## Operating Context

NASA Space Apps 2026, challenge "Interplanetary Survival Guide: Martian Map". Models named by the spec: Apollo traverse maps and cuff checklists, Artemis traverse planning. The helmet display is a labelled simulation.

## Capabilities and Constraints

- Plan view (camera straight down over the 3D scene) and helmet view (eye height) of the same scene. A 2D fallback from the same files.
- Layers: image, height, slope, thermal, atmosphere, radiation, space weather, rover path, stations, no-go zones, drill sites.
- Constraints table, printable route card, station cards, hazard scenario with a return path, rover check.
- The default image is the USGS July 2025 colour mosaic, never called true colour; greyscale is a second mode. No AI-made images. No NASA logo.
- Helmet view: at most three actions, at most six items in fixed places, bright strokes on a clear centre, no filled panels over the terrain, red and amber always with an icon shape and a word, "NO DATA" with dashes for missing values, SI units.
- Walk inputs (stations, no-go zones, tasks, assumption values) can be changed in the Editor. A value with no source is labelled assumption.
- One type family, one size scale, one colour set. No default browser controls.

## Brand Commitments

Arda named four results that would feel wrong (2026-11-14): a video game or film HUD; a generic web dashboard; an old-style NASA console; a result so plain that a judge forgets it.

## Evidence on Hand

Real data files cut from USGS and NASA sources (see `sources.json`). One real panorama, PIA26559, credit NASA/JPL-Caltech/MSSS. No user testing exists: the wording is "designed against named NASA human-systems rules", never "tested with astronauts".

## Product Principles

1. The terrain is the product; the interface stays off it.
2. Margins before raw values.
3. Every number is honest about its origin.
4. A suited user can operate it: few actions, large targets, no fine motor input.
5. It works when a part fails: no route, no data, no 3D.

## Accessibility & Inclusion

Keyboard only and touch only for the full demo story, visible focus, never colour alone, layouts at 1366 x 768, 1920 x 1080 and 390 x 844.
