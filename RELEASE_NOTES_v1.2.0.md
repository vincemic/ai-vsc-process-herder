# Release Notes v1.2.0

## Added

- Port conflict detection: `detect-port-conflicts` tool surfaces ports claimed by multiple managed processes with process details.
- Port validation & control: `check-port-status`, `stop-processes-by-port` tools.
- Enhanced `process-summary` resource now includes per-process `ports` and aggregated `ports` map.

## Improvements

- Cross-platform clean task via new `clean` script using `rimraf`; updated VS Code task to call `npm run clean`.
- Added `checkPortOpen` helper and persisted port inference logic (command/args, readiness, log patterns).

## Documentation

- README updated with new port tools, conflict detection, and summary enhancements.

## Notes

- Port conflict detection is heuristic (based on inferred/observed ports) and does not guarantee an active socket bind collision.
- Consider future enhancement: active socket enumeration to confirm conflicts.
