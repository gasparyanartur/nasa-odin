# Design
AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

Record of the built design system. Values come from `src/styles/` (tokens.css, base.css, components.css, hud.css, print.css, app.css, hatches.svg). The CSS wins if this file drifts.

## Direction
- "Approach Plate": the walk is a flight procedure on one chart - plan view, profile, minimums - drawn like an instrument approach plate (form: plate 3 of 7).
- It refuses the dark map with floating rounded panels: chart-paper panels, ink, one-pixel ruled boxes, no radius, no shadow, over the Mars photobase.
- A cased magenta route is the one strong mark; blue is rover data; hatches carry classes; red and amber appear only for hazard states; B612 is the cockpit face.
- It is told as a guided story with far fewer pieces on screen: one step, one caption, one Next button; every detail panel waits behind Details.

## Colour
Tokens in `tokens.css`. Every text pair is 4.5:1 or more (ratios are in the file).

| Token | Hex | Role and rule |
|---|---|---|
| `--paper` | #f4f1ea | Chart paper, all panel fills |
| `--paper-2` | #ebe7dd | Ruled header cells, second neutral |
| `--white` | #ffffff | Route card print sheet only |
| `--ink` | #14161a | Text, rules, scene backdrop |
| `--ink-2` | #4a4d52 | Secondary text |
| `--magenta` | #b8156f | Planned route and the primary action (Next) only; also the focus ring and selection |
| `--blue` | #1f5fa8 | Rover-measured data only |
| `--red` | #c3341a | RETURN NOW only, always with the octagon and the word |
| `--amber` | #e39a12 | CAUTION only, always with the triangle; a fill under ink text, never amber text on paper |
| `--grey-1..4` | #dcd8ce #a9a59d #6b6862 #14161a | Fixed ramp for hatches |
| `--hud-core` | #ffffff | Helmet strokes |
| `--hud-casing` | #14161a | Dark casing under every helmet stroke and text |
| `--hud-magenta` | #ff63b8 | Helmet route cue |
| `--hud-blue` | #7fb4ff | Helmet measured values |
| `--hud-red` | #ff6a4d | Helmet RETURN NOW |
| `--hud-amber` | #e39a12 | Helmet CAUTION |
| `--sky-plain` | #cdc7bb | Walk view sky, one daylight tone, no gradient |

Never colour alone: a hatch, an icon shape or a word always goes with it.

## Type
- One family: B612 (SIL OFL 1.1), regular 400 and bold 700. Digits are equal width, so numbers always use tabular figures and never reflow.
- Scale, ratio 1.2: `--fs--1` 0.833rem (field labels in the drawer; the story chrome never goes under 14 px); `--fs-0` 1rem (body, table values); `--fs-1` 1.2rem (panel headings, helmet labels); `--fs-2` 1.44rem (card headings); `--fs-3` 1.728rem (helmet values, visor minimum); `--fs-4` 2.074rem (helmet warning word); `--fs-5` 2.488rem (helmet bearing and distance); `--fs-6` 2.986rem (RETURN NOW).
- Line height `--lh-tight` 1.1, `--lh-text` 1.45. Caps tracking `--track-caps` 0.08em.

## Space and rules
- 4 px base: `--sp-1` 0.25rem, `--sp-2` 0.5rem, `--sp-3` 0.75rem, `--sp-4` 1rem, `--sp-5` 1.5rem, `--sp-6` 2rem, `--sp-7` 3rem, `--sp-8` 4rem.
- Rules: `--rule` 1 px ink, `--rule-heavy` 2 px ink, `--rule-light` 1 px `--grey-2`. `--radius` is 0. No shadow; the only box-shadow is the paper band inside the focus ring.
- Linework over the photobase: casing 8 px, gap 5 px, core 3 px. Helmet text casing 0.16em (`--hud-text-casing`); helmet text of 27 px and up (bearing, distance, margins, RETURN NOW) takes `--hud-text-casing-lg` 0.08em, so large type never reads as a heavy outline.
- Targets: `--target` 2.75rem (44 px), `--target-hud` 4rem (64 px).
- Focus: 2 px magenta ring, offset 2 px, paper band so it shows over the image.

## The story shell
- The app opens as a guided story, one thing per screen (spec section 3): Place, Plan, Walk, Hazard, Check. `state.step` 1 to 5, `?step=N` in the address (with `panel` only while the drawer is open); an old walk link `?view=walk&t=N` opens step 3, or step 4 when N is at or after the hazard start, with N clamped to the end of the walk, and `?step` still wins; `story.js` holds what each step shows (view, camera, layers, overlays, walk time, hazard, play state, caption) and `ui/story.js` draws it.
- Always on the full-bleed scene, and nothing else: the name top left ("Marswalk", "Gale crater - boxwork ridges" under it); the stepper top centre; Details and the "Show sources" switch top right; one caption plate bottom left (bottom centre under 900 px, a full-width sheet under 600 px); the map control cluster bottom right; the credit line on the bottom edge. The three top pieces are paper plates hanging from the top edge (1 px rule, no top rule).
- Stepper `.story-steps`: five buttons, a square number cell and the name; the current step is ink with paper text. At 390 px it reads "Step 2 of 5 - Plan" with five square dots (the current one filled and larger, done ones grey).
- Caption `.caption`: paper plate, 2 px ink rule. From 900 px it docks bottom left, 26 rem wide, its left edge on the name plate's, its foot just above the credit line, so the route keeps the middle of the scene; from 600 to 900 px it sits bottom centre (at most 44 rem); under 600 px it is a sheet edge to edge on the credit line. A headline of about 24 px, one or two plain sentences of 17 px (under 600 px one short sentence), at most four key numbers `.keynums` in a 2 x 2 grid (label in small caps, value about 30 px, 22 px on a phone, one sub line), a one-line map key on the plan and check steps (filled square ridge, open square hollow, magenta route, no-go hatch, blue Curiosity path), the layer chips on the plan step, then Back and at most one secondary control (a drawer tab, the route card), and Next. Next `.story-next` is the magenta primary, 56 px tall, the full plate width on wide screens, with a key cap that shows the Right arrow. Buttons wrap to a new row before they shrink under 44 px.
- Quick layer chips `.story-chips`: one row inside the caption on the plan step, after the small field label "Show": Slope, Rover path, Height (a box that fills when on). The full layer list is in the drawer.
- Walk bar `.walkbar` (walk and hazard steps): a slim paper band under a 2 px ink rule at the very bottom, outside the visor frame: "Step 3 of 5 - Walk" and one line of text (the scenario sentence on the hazard step), Play or Pause, the speed (10x, 60x, 240x), Back and Next. While exploring freely the same band says "Free view" with "Back to the story".
- The scheduled hazard fires only on the hazard step and while exploring freely: on the walk step the walk runs past the hazard start to its end with no hazard. Every plan step (Place, Plan, Check) starts the run again, so it never shows a leftover walk: no red way back, no walked trail, no held alert; the way back and the walked trail are drawn in the walk view only. A held key steps once, and the Enter and Right keys wait for the route like the Next button.
- The end of the story: "Print the route card" (opens the printable sheet) and "Explore freely" (the primary; the caption folds to the free-view bar, the drawer opens, leg labels show).
- Show sources `.story-switch`: a square switch with the words. Off by default (`?sources=1` turns it on).
- Details drawer `.drawer`: right side, 26 rem, under the head; at 390 px a sheet between the head and the caption, and the caption keeps its headline and buttons only. Closed by default and out of the page while closed. Seven tabs in two rows: Limits (the minimums and the legend), Timeline (height profile and timeline score), Layers (the "View" plate with the vertical scale True / 2x on top, the image mode in the Image row), Stations, Editor, Rover check, Credits. Opening it never covers the caption or its Next button: the caption, the credit and the map controls move left of it.
- Map control cluster `.map-cluster`: one column of 48 px buttons: zoom in, zoom out, tilt, turn left, turn right, north up (the arrow turns with the view), fit route. Under 600 px only zoom in, zoom out and fit route show, with "More" (three dots) for the other four. Zoom and turn repeat while held. The one-line hint "Drag to move. Scroll or pinch to zoom." shows once per browser (remembered in local storage when it can be) and goes on the first pointer, wheel, touch or key input or after 8 s; it sits above the cluster (under the head on a phone), never over the route, and never in the walk and hazard steps. Out of the page in the walk view; no tilt button in 2D.
- Station card on the plan step `.station-pop`: a picked tag opens a small card next to it: the shape mark, the id, ridge or hollow, the task, Close. One at a time; Escape closes it and gives the focus back to the tag.
- Map inset `.minimap` (walk and hazard steps): about 180 px (112 px on a phone), bottom right above the actions, north up: the surround image, the route, the red way back, the position dot. No number. A 44 px close control (a cross, "Hide map") sits on its top right corner; while hidden, one small "Map" button in the same corner brings it back.

## Components
- Plate and field label: `.plate` ruled box on paper; `.plate__label` sits on the top rule as a small caps label.
- Minimums table (drawer, Limits tab): `.minimums--tight` - six limits (slope cap, from crew rover, partner spacing, time in suit, dose for the walk, career dose), two lines each: line one the name, the limit, its body and the source as a short code (`.cite`, "DR22"); line two the margin, the bar and the value it comes from. The `.state` cell (pass, caution, at limit, fail, no data; word plus symbol; "no limit" for the walk dose) spans both lines. A source code is a button that opens its row (`#credit-<id>`) in the Credits tab. A "base" tag marks the rows that depend on the assumed base position.
- Number pattern `.num`: `.num__value`, `.num__unit`, `.num__prov`. The origin label is in words: the source name, "derived", "assumption" (italic), "scenario"; a measured value carries "measured" and its sol and local Mars time (`.num__when`, blue). Labels show on demand: with "Show sources" on (quiet, unboxed, ink-2, a little smaller), always in the drawer and on the printed route card, and never otherwise; the helmet's science line keeps its sol and local time. Where the words leave out a method or a note, the label is a focusable note reference that shows the full text on focus and hover. Built only by `num()` in `provenance.js`; `detail.suffix: false` marks a limit printed next to its own source line (`data-prov-near`). `audit()` fails any number without its unit, without its label data, or a digit outside `num()`; in the browser it also fails a label that is hidden where it must show or shown where it must not. Station task text is the team's own wording and is exempt from origin labels (the card marks it `data-nonmetric`).
- Legend `.map-key-plate` (foot of the Limits tab): route (magenta), return path (red, dashed), rover data (blue), the no-go hatch, the two slope hatches, the amber CAUTION and red RETURN NOW marks with their words. Hatch swatches fill with the real patterns of `hatches.svg`, inlined once per page.
- NO DATA: `.nodata`, a ruled box with the word and dashes; never zero, never an old value without its time. The check step says its measured tilt agrees with our slope map only when the rover numbers exist; else it shows "Rover check:" with the NO DATA mark.
- Buttons: `.btn` ruled, 44 px (48 px in the story chrome); `.btn--primary` magenta fill; `.btn__key` key cap; `.btn__sub` reason line when disabled.
- Segmented control `.segmented`, switch `.layer-switch`, tabs `.tabs`.
- Station card `.station-card` (Stations tab): fixed furniture, five grid rows with identical slots in the same order; the Task and Conditions slots each carry a `.plate__label`.
- Timeline score `.score`: blocks as wide as their duration (`--d`), playhead, hazard start flag; the hazard tag sits on one line above the track and opens to the left past half of the walk. Profile `.profile`: ground fill, casing plus core line, station drops and ticks along the top; under it low and high and the caption "vertical exaggerated, not to scale - USGS 1 m terrain".
- Route card (`print.css`): one A4 page, black on white, 9 mm margins; centre rail with one square detent per stop; each row holds the arriving leg (bearing, distance, climb, steepest, time) and the arrival time left of the rail, the station and its task right; the limits table and the notes below. Provenance in full words, small and inline. The sheet is in the page only while it is open; the browser's own print with the sheet closed prints one line, "Open the route card to print it."
- Map tags `.map-tag`: DOM labels placed with `host.project()`, paper box with 1 px rule, at least 14 px. A station tag carries its shape mark (filled square ridge, open square hollow) and its id only; the base tag reads "BASE crew rover" ("assumption" with sources on). A station or base tag is never dropped: it tries right, left, above, below and the four diagonals, then a wider ring, then the compact form. Tags keep clear of every element marked `data-label-avoid` (the story chrome, the map controls, the credit, the open drawer). Leg labels show only while exploring freely; they are the ones that hide on a collision.
- Station points on the scene: a filled ink square for a ridge, an open square (paper inside, ink edge) for a hollow.
- Image credit `.scene-credit`: one unboxed line on a thin paper band flush with the scene's bottom edge (image label with the band-mix note, terrain credit), 14 px. At 390 px and while the drawer is open it is the short line "USGS / NASA / ESA - see Credits"; the Credits tab holds the rows.
- Hatches (`hatches.svg`, grey ramp, patterns never colour): under 10 deg clear; 10 to 15 deg `hatch-caution` sparse ink dots, 12 m period; above 15 deg `hatch-blocked` 45 deg lines, 12 m period, blocked for the planner; no-go zone `hatch-nogo` cased grid on a 35 % tint, 7 m period, with a cased dashed outline. Slope layer is off by default.

## Helmet display
- Six items in fixed places, priority order: 1 warning; 2 bearing and distance to next station; 3 time margin; 4 distance to rover; 5 distance to partner; 6 science line. Items never move; only content changes.
- Light layout in the story: SIMULATION top left with one fixed line under it, "Times and distances follow assumed walking speed." (no digits); warning and then next station, bearing and distance (large) top centre; the three margins as one compact block top right ("Suit time left", "Rover range left", "Partner range left", each with its value, "of" its limit and a thin bar; at 390 px the value only); the science line or the station card bottom left; the three actions in one row bottom right.
- Three actions, each 64 px or more: Next (N), Acknowledge (A), Return to rover (R). Return keeps its own slot at the left of the row.
- Casing rule: every stroke and every text, red and amber included, has a dark casing (`--hud-casing`, text stroke 0.16em, 2 px cased rules).
- Clear centre: the middle grid area is empty so the terrain shows.
- A station card opens on arrival and the walk runs on through the work time; it closes when the walker leaves the station, or earlier with Acknowledge. It never takes the focus (the status region announces the arrival). Nothing is acknowledged for the crew.
- RETURN NOW: the heading with the red octagon; under it "Solar particle event - scenario" and the event time. Once acknowledged: "Acknowledged - still in force" and "Scenario - not a measured Mars event".
- Warning: caution amber 3 px border with triangle; return red 4 px border with octagon, `--fs-6`.
- Sky tone `--sky-plain`; view fixed, ink backdrop.

## Motion
- `--dur-1` 150 ms, `--dur-2` 200 ms, `--dur-3` 250 ms; ease `--ease-out` cubic-bezier(0.16, 1, 0.3, 1). State changes only.
- The one authored moment: step 1 turns the tilted scene slowly around the middle of the ridges, one turn in about 90 s. It stops for good on the first input anywhere in the app (pointer, wheel, touch, key) and does not start again on Back to step 1; it also stops when the step changes. It never runs with reduced motion, in the 2D view or on a hidden tab. Helmet items settle in (opacity and 6 px rise, `--dur-3`, delayed `--dur-1`).
- The helmet camera looks at a point 8 m ahead along the route, not along the raw grid steps, and turns toward it in real time at no more than 150 degrees a second (a 90 degree corner takes about a second at any replay speed). It holds still at a station, snaps on a seek, step change, Next or hazard start, and finishes its turn when paused. With reduced motion it keeps the look-ahead and skips the turn. The helmet numbers stay the true values.
- Reduced motion: all three durations become 0 ms; base.css also zeroes animation and transition durations.

## Map handling
- Left drag pans; the wheel zooms toward the cursor, about 8 % per notch, one notch at most per wheel event (a trackpad pinch is ctrl + wheel and zooms the same way); right drag or shift + drag turns and tilts; a double click zooms in one step. Touch: one finger pans, two fingers pinch to zoom and twist to turn. Zoom stops at the whole surround and at about 0.1 m per pixel; "Fit route" always brings the walk back.
- Keys: Right or Enter (with no control focused) = Next, Left = Back; with the map focused (it is a tab stop) the arrows pan; `+` and `-` zoom, `T` tilts, `0` puts north up; in the walk steps N, A and R are the helmet actions; Escape closes the station card, then the drawer.

## Layout
- Target sizes: 1366 x 768, 1920 x 1080, 390 x 844. No sideways scroll, no overlap.
- The story chrome measures itself into `--head-h` and `--foot-top`; the helmet layer, the drawer, the map controls and the map inset keep clear of it.
- Camera fit (plan and check steps, "Fit route"): the route, the base and the station tags go into the free rectangle of the scene - below the stepper, above the credit line, right of the caption plate (above it on narrow screens), left of the map cluster and the open drawer (every element marked `data-fit-avoid`) - with a 25 m margin and 24 px padding. The fit never zooms out so far that the page background shows beside the surround image; a strip that opaque chrome covers edge to edge (the phone caption sheet) does not count. It runs again on a resize, when the drawer opens or closes and when the caption changes size, unless the map was moved by hand since. Step 1 puts the middle of the ridges, its turning centre, in the middle of the same free rectangle (a view offset in 3D, so the turn keeps its centre; in 2D the camera is placed again after a layout change unless the map was moved by hand).
- At 600 px and below: the head is two rows (name and the two controls; the stepper line with dots), the caption a full-width sheet with the key numbers 2 x 2, the map controls one column of three plus More, the drawer a sheet, the walk bar two rows, the helmet grid three columns (margins beside the map inset, labels shortened to "Suit", "Rover", "Partner").
- At 600 px and below with "Show sources" on, each helmet origin label sits on its own line under its value, and the science line gives way while RETURN NOW shows (it is last in the priority order).
- Story text is never under 14 px; the drawer keeps the denser chart sizes of the design.
- The first Tab stop is the skip link "Skip to Next".

## Do not
- No video game or film HUD: no glow, scanlines, neon, or sci-fi frames.
- No generic web dashboard: no cards with shadows, rounded panels, or default controls.
- No old-style NASA console: no green-on-black, no dense button banks.
- No result so plain that it is forgotten: keep the cased magenta route and the plate form.
- No filled panels over terrain in the helmet view. Over the plan scene only the story pieces named above; the credit is a line on the edge.
- No numbers drawn in canvas or WebGL; labels are DOM.
- No number without its unit and its origin label (shown on demand, always kept in the data).
- No colour alone for any state.
