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
- `preview-controls` - helmet bottom during a route preview. The preview panel.
- `preview-progress` - in the preview panel, the distance done of the total.
- `preview-play` - in the preview panel, Pause or Play (key Space).
- `preview-speed` - in the preview panel, the 1x, 2x and 4x buttons. Sets the preview speed.
- `preview-stop` - in the preview panel, Stop (key Esc). Ends the preview and returns to the tablet.
