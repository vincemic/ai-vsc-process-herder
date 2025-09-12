# Tool Catalog

Concise reference of MCP tools grouped by category.

## Core Process Management

- list-tasks
- start-task
- start-process
- stop-process
- restart-process
- list-processes
- get-process-status

## Project Analysis

- detect-project-type
- get-vscode-status

## Reliability & Diagnostics

- get-health-summary
- configure-recovery
- get-process-logs
- get-process-metrics
- export-diagnostics

## Port & Conflict Utilities

- list-active-ports
- find-processes-by-port
- detect-port-conflicts
- check-port-status
- stop-processes-by-port

## Test Run Orchestration

- start-test-run
- get-test-run-status
- list-test-runs
- abort-test-run

## Tool Usage Pattern

```text
call process-herder start-process {"command":"npm","args":["run","dev"],"role":"backend","singleton":true,"readiness":{"type":"port","value":3000}}
```

## Readiness Probe Shapes

```jsonc
{ "type": "port", "value": 3000, "timeoutMs": 20000 }
{ "type": "http", "value": "http://localhost:3000/health", "timeoutMs": 30000 }
{ "type": "log",  "value": "Started", "timeoutMs": 20000 }
```

## Roles

frontend | backend | test | e2e | utility

## Return Fields (Common)

- processId
- reused
- role
- ready / readyAt
- ports
- lastError

Refer to architecture and reliability docs for deeper semantics.
