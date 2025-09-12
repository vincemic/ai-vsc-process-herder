# Changelog

All notable changes to this project will be documented here.

## [1.2.0] - 2025-09-11

### Added

- Port conflict detection: `detect-port-conflicts`.
- Port utilities: `check-port-status`, `stop-processes-by-port`.
- Enhanced `process-summary` with per-process and aggregated ports.

### Improved

- Cross-platform clean task via `rimraf`.
- Persisted port inference (command/args, readiness, logs).

### Documentation

- Updated README with port tools and summary enhancements.
- Consolidated install instructions.

### Notes

- Conflict detection is heuristic; future enhancement may add active socket enumeration.

## [1.1.1] - 2025-09-xx

### Fixed

- Dependency layout (TypeScript tooling moved to devDependencies).
- Prepublish build script alignment (`prepublishOnly`).
- Included build artifacts for Git-based install.

### Installation

- Documented working local tarball + clone flows.

### Features Recap

- 25+ MCP tools (process management, orchestration, health, recovery).

## Format

Use `npm version <type>` and keep sections: Added / Changed / Fixed / Improved / Removed / Docs / Security.
