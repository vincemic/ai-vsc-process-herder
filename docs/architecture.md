# Architecture

## Core Components

| Component | Purpose |
|-----------|---------|
| ProcessManager | Spawn, track, restart, readiness, singleton logic |
| TaskManager | VS Code tasks integration |
| ProjectDetector | Workspace analysis & type inference |
| VSCodeIntegration | Multi-root & workspace context exposure |
| HealthMonitor | Health scoring & issue detection |
| RecoveryManager | Strategy-based auto-recovery |
| StateManager | Persistence & reattachment |
| LoggingManager | Structured logs + metrics |
| TestRunManager | Coordinated multi-process test orchestration |
| RoleClassifier | Heuristics for roles & tags |

## Data Flow (High Level)

```text
AI Client -> MCP Request -> index.ts -> Tool Handler -> Managers -> State/Logs -> Response
```

## Process Lifecycle Phases

1. Spawn requested (or singleton reuse)
2. Readiness probe (optional)
3. Health monitoring attaches
4. Recovery strategies evaluate
5. State persisted periodically
6. On exit: classify (normal / crash / recovered)

## Persistence

- `.process-herder/processes.json` for metadata
- Reattachment on startup (verifies OS PIDs)
- Ports & roles inferred re-populated

## Port Inference Sources

- Command/args heuristics (`--port`, `:3000`, env `PORT`)
- Readiness definitions (port/http)
- Log pattern extraction

## Metrics (Examples)

- processStarts (counter)
- restarts
- crashes
- cpuUsage / memoryUsage snapshots

## Health Score Inputs

- Recent exit codes
- Error frequency
- Resource saturation
- Unresponsive detection

## Recovery Strategy Example

```jsonc
{
  "name": "memory-restart",
  "conditions": [ { "type": "memory-usage", "operator": "gt", "value": 2147483648, "duration": 60000 } ],
  "actions": [ { "type": "notify" }, { "type": "restart", "delay": 5000 } ],
  "maxAttempts": 1,
  "cooldownPeriod": 300000
}
```

## Test Run Orchestration Flow

```text
Start test-run -> (start backend -> await readiness) -> (start frontend -> readiness) -> start tests
  | success + autoStop=true => stop backend/frontend (unless keepBackends)
  | failure => mark failed, keep logs, recovery may apply per-process
```

## Logging Categories

- process
- health
- recovery
- readiness
- metrics
- test-run

## Design Principles

- Idempotent operations (singleton reuse)
- Defensive recovery (grace periods)
- Heuristic enrichment (ports, roles) non-blocking
- Structured outputs for AI reasoning

See reliability.md for deeper monitoring & recovery details.
