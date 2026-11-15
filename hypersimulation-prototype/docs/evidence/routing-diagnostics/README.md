# Routing diagnostics verification — 2026-11-15

Reproduced a preset failure by setting Boxwork's slope limit to 15°. The habitat's checked footprint is 18.392° and the destination's is 15.929°. Before the fix, resetting endpoints retained that edited limit. Saved field restrictions can independently block presets and remain active when hidden.

Verified fresh Bradbury (0, 0 → 600, 450), Yellowknife (0, 0 → 450, -10) and Boxwork (195, 315 → 5, 225) routes at 20° in both the source planner and the existing port-8374 preview before changes.

Verification after changes:

- `npm test`: 57 frontend tests pass, including API diagnostic transport and validation-error fallback.
- `npm run test:api`: 33 tests pass, including endpoint interpolation-neighbor slopes, multiple endpoint causes, nodata/outside coverage, disconnected slope/exclusion/nodata barriers, jointly blocking constraints, real Boxwork defaults and return endpoint labels.
- `npm run build`: production TypeScript/bundle check passes.
- `tests/route-diagnostics.spec.ts`: 2 browser cases pass. Lowering Boxwork to 15° gives both measured reasons; resetting restores 20° and two candidates; Yellowknife still produces candidates. A hidden saved obstacle is named, survives reset and opens the correct field record.

Inspected [slope rejection](blocked-preset-slopes.png) and [hidden saved restriction](hidden-restriction.png) screenshots. Browser fixtures run against a production build and FastAPI on port 8273. Initial test harness failures (a JSON import in the browser fixture and small-grid fixture radii rejected by API validation) were corrected before the passing runs. Production type checking also caught and resolved an unknown error value in the API test. These were verification-code issues. A subsequent static-serving check ran while the build was replacing `dist/` and saw a transient 404; the suite was rerun after the build completed.

The connectivity diagnostics classify barriers from the existing analytical grid; they do not establish source accuracy, certify walkability, or relax any routing constraint. The exact settings in the user's earlier browser session were not available. Integration startup/laptop performance gates are unchanged.
