# Expedition feedback evidence

Review date: 2026-11-15. Scope: FR-030–FR-032, linked to the [implementation plan](../../plans/2026-11-15-expedition-feedback.md).

- [Station help](station-help.png): explicit control guide and hover/focus/click information button. Tooltips use a viewport-bounded overlay rather than being clipped inside scrolling panels.
- [Saved traverse comparison](traverse-comparison.png): two actual sampled walks, selected overlays and distance/time differences; this example uses short test walks.
- [Rover reference controls](rover-reference.png): Boxwork-only published Curiosity geometry, source and comparison limits.
- [Tablet event feed](tablet-events.png): simulated event setup, active log, warnings and independent habitat-return action.
- [HUD hazard](hud-dust.png): a declared dust area on measured terrain, left event card and return guidance. This is a scenario overlay, not measured dust or a physical radiation model.
- HUD size matrix: [1280 × 720](hud-1280.png), [1366 × 768](hud-1366.png), [1440 × 900](hud-1440.png), [800 × 700](hud-800.png). Assertions check round map geometry and visor insets; the 800 px case represents a resized laptop window.

`tests/expedition-feedback.spec.ts` exercises actual pointer-locked movement, saving/comparing/reloading/deleting walks, site-gated rover evidence, mission-time scheduling and pause, acknowledgement, affected map areas, return guidance with retained pose/time, renderer recovery and restart. Unit checks cover distance/time sampling, persistence validation and failed writes, exact hazard timing/footprints and the surface exposure mask's shelter hole.

Screenshots use Chromium with software WebGL. They establish local appearance and workflows, not target-laptop frame rates, unfamiliar-user usability or public hosting. See the plan's review note for final check outcomes.

## Follow-up review

Boxwork is first and suggested at Station. Normal startup opens the global Mars view with no region selected. The blue **Plan route** action calculates guidance and reveals the alternatives; Under **Routes**, **Plan new route** and **Load previous path** share the same sidebar and map. Loaded overlays remain visible when switching back to planning, without replacing guidance or moving the astronaut.

- [Previous paths](previous-paths-followup.png): historical Curiosity geometry and a prepared Boxwork ridge plan share the saved-path library with recorded walks. Visibility persists after reload; the screenshot shows the example enabled and Curiosity disabled. Prepared plans are explicitly labeled as not executed.
- Curved visor, Boxwork: [1280 × 720](boxwork-visor-followup-1280.png), [800 × 700](boxwork-visor-followup-800.png).
- Curved visor, Bradbury: [1280 × 720](yellowknife-visor-followup-1280.png), [800 × 700](yellowknife-visor-followup-800.png).

The follow-up layout check tests both sites at 1280 × 720, 1366 × 768, 1440 × 900, 1920 × 1080, 2560 × 1440 and 800 × 700, including both clocks and projected captions against the actual rounded visor shape. It caught an unpositioned loading-status message and insufficient vertical margins. Both were corrected. Exact source geometry and terrain-valid example segments are checked separately from the UI. `npm run prepare:paths` reproduces the libraries from the prepared terrain and existing rover evidence.

See [follow-up verification](followup-verification.json) for final results. The original verification record above describes the earlier feedback implementation.

Unified Routes follow-up: the pinned **Plan new route / Load previous path** selector now lives in the same sidebar. The [updated screenshot](previous-paths-followup.png) and [review record](routes-verification.json) cover the integrated workflow and retained overlays/guidance.
