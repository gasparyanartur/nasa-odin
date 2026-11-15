# Tour anchors

Stable `data-tour` attributes for a guided tour. Select one with `[data-tour="name"]`. Each name is on one element at a time. Some only exist in a certain state; the line says when.

AI-written (Claude, Anthropic), 2026-11-15.

## Top bar (every place)

- `station-tab` - top bar, Station. Opens the Station.
- `tablet-tab` - top bar, Tablet (needs a chosen region). Opens the tablet.
- `hud-tab` - top bar, HUD · Surface (needs a prepared region). Enters the surface view.

## Station

- `atlas-tab` - Station header, Planetary atlas. Shows the globe and the left rail.
- `history-tab` - Station header, Data & history. Shows the dated records and the outlook.
- `station-help` - Station header, the "i" beside the tabs. Opens the Station help.
- `station-tour` - Station header, Tour, beside the help mark. Starts the guided tour.
- `globe` - the Mars globe itself (the Cesium view). Drag to turn.
- `task-info-geology`, `task-info-safety`, `task-info-water`, `task-info-custom` - the "i" beside each task under "02 / Choose your task". Opens the task details.
- `task-info-geology-pop`, `task-info-safety-pop`, `task-info-water-pop`, `task-info-custom-pop` - the open details label of that "i" (only while open).
- `region-boxwork`, `region-bradbury`, `region-jezero` - left rail, "01 / Choose a region" cards. Selects the region and flies the globe to it.
- `region-marker-boxwork`, `region-marker-bradbury`, `region-marker-jezero` - markers on the globe (only when on screen). Same as the region card.
- `task-geology`, `task-safety`, `task-water`, `task-custom` - left rail, "02 / Choose your task" (after a prepared region is chosen). Picks that walk preset.
- `region-open-tablet` - left rail, Selected region panel, Open tablet. Opens the tablet on Map.
- `explore-boxwork` - left rail, suggested Boxwork card, Explore Boxwork. Selects Boxwork and opens the tablet on Routes.
- `guided-example` - left rail, Start guided Gale example. Opens the prepared Yellowknife Bay example.
- `station-layers` - left rail, Datasets & map layers (a fold-out). Opens the basemap, environmental and geology layers.
- `global-view` - globe, top right, Global view. Clears the region and shows the whole planet.
- `open-tablet` - globe, region card (after a prepared region is chosen), blue Open tablet bar. Opens the tablet on Map.
- `enter-surface` - globe, region card, Enter surface. Enters the surface; with no planned route it first asks.
- `confirm-open-tablet` - the "No excursion planned" confirm in the region card, Open tablet. Opens the tablet on Routes, Plan new route.
- `explore-freely` - the same confirm, I am sure, explore freely. Enters the surface in free exploration.
- `planet-hint` - globe, under Global view (after a basemap or environmental layer change while zoomed in). The hint itself.
- `planet-hint-zoom` - in the hint, Zoom out. Moves the camera to the planet view; the region stays chosen.
- `planet-hint-dismiss` - in the hint, the close mark. Hides the hint.

## Tablet

- `map-tab`, `routes-tab`, `field-tab`, `display-tab`, `events-tab`, `closer-tab` - tablet tool bar: Map, Routes, Field data, Display, Events, Look closer. Opens that tool.
- `tablet-help` - tablet tool bar, the "i" at the end. Opens the tablet help.
- `tablet-tour` - tablet tool bar, Tour, after the help mark. Starts the guided tour.
- `previous-paths` - Routes, the Previous paths panel (Load previous path only).
- `science-walk-card` - Routes on Boxwork, the card button inside the science walk (prepared or planned). Chooses that walk.
- `helmet-preview` - Display, the small schematic helmet preview beside the feature switches.
- `feature-<id>` - Display, the switch of one feature, for example `feature-stops` (Science stops) or `feature-nogo`. Turns it on or off; the walk becomes Custom.
- `mission-pick-geology`, `mission-pick-safety`, `mission-pick-water`, `mission-pick-custom` - Display, the walk choice buttons above the switches. Applies that walk's feature set.
- `close-tablet` - tablet header, Close tablet (or Back to Station). Closes the tablet.
- `plan-new-route` - Routes, Plan new route switch. Shows endpoints, the science walk and route planning.
- `load-previous-path` - Routes, Load previous path switch. Shows Curiosity's path, prepared plans and your saved walks.
- `science-walk` - Routes on Boxwork, the science walk card. Chooses the prepared science walk or plans it again.
- `map-layers` - Map or Routes, map tool bar, Layers. Opens the map layers panel.
- `inspect-data` - Map or Routes, map tool bar, Inspect data. Opens the data evidence panel.
- `log-here` - Map or Routes, map tool bar, Log here. Starts a field record at the astronaut's position.
- `plan-route` - Routes footer (Plan new route only), Plan route. Plans the shortest and gentler routes.
- `preview-route` - Routes footer (when a route, the prepared science walk or a shown previous path exists), Preview route. Runs the helmet camera along it in about one minute; nothing is walked or saved.
- `walk-route` - Routes footer, Walk selected route (or Walk this route, or Enter surface). Enters the surface on that route.
- `return-to-surface` - footer of the other tools, Return to surface. Closes the tablet.
- `display-features` - Display, the feature switches with the helmet preview. Turns features on or off.
- `display-helmet` - Display, the visor, waypoint and clock switches. Sets what the helmet shows.
- `simulation-pace` - Display, Simulation pace. Sets 1x, 5x or 20x (default 20x; the choice is kept in this browser).
- `display-return` - Display, side card, Close tablet · return to surface. Closes the tablet.
- `trigger-event` - Events, Trigger now. Starts the chosen scenario at once.
- `guide-to-habitat` - Events, Guide to habitat (when a return route exists). Switches guidance to the way back.

## HUD

- `hud-tablet` - helmet bottom, Tablet (key T). Opens the tablet.
- `hud-log` - helmet bottom, Log (key L). Starts a field record here.
- `hud-pause` - helmet bottom, Pause (key M). Opens the pause menu.
- `hud-notices` - helmet right, the notice symbol (key N). Opens the notice list.
- `hud-compass` - helmet top centre, the compass (when the visor overlay is on).
- `hud-minimap` - helmet top right, the round minimap (when the HUD minimap is on).
- `preview-controls` - helmet bottom during a route preview. The preview panel.
- `preview-progress` - in the preview panel, the distance done of the total.
- `preview-play` - in the preview panel, Pause or Play (key Space).
- `preview-speed` - in the preview panel, the 1x, 2x and 4x buttons. Sets the preview speed.
- `preview-stop` - in the preview panel, Stop (key Esc). Ends the preview and returns to the tablet.

## The guided tour (`src/tour/`)

The first-start tour plays on the real app through these anchors. A drawn pointer moves to each control and clicks it; the app answers as it does for a visitor.

- `steps.ts` - the step list, one entry per card: the anchor, the caption (one sentence, at most 14 words) and what to do by hand. Edit captions there.
- `engine.ts` - the state machine (order, pause and play, Next, Let me do it, skips, end). Pure, with unit tests.
- `Tour.tsx` - the pointer, the ring, the caption card and the first-visit invitation. `memory.ts` keeps "Not now", started and finished in this browser (key `marswalk.tour.v1`); with blocked storage it lasts until reload.
- `steps.test.ts` fails when a step names an anchor that is neither in this file nor in the source. Rename an anchor here and in `steps.ts` together.
