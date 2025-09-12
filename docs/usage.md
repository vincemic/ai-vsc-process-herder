# Usage Guide

## Configure in VS Code (GitHub Copilot)

```json
{
  "github.copilot.chat.mcpServers": {
    "process-herder": { "command": "vscode-process-herder" }
  }
}
```

## Core Workflows

| Goal | Tool(s) | Example Prompt |
|------|---------|----------------|
| See tasks | list-tasks | "list the available tasks" |
| Start dev server | start-task | "run build project task" |
| Spawn arbitrary command | start-process | "start backend on port 3000" |
| Stop process | stop-process | "stop the vite process" |
| Restart process | restart-process | "restart process ID 1234" |
| Check status | get-process-status | "status for process 1234" |
| All processes | list-processes | "what's running" |
| Health summary | get-health-summary | "overall health" |
| Configure recovery | configure-recovery | "auto restart backend on crash" |
| Start coordinated tests | start-test-run | "run e2e test suite" |

## start-process Input (Conceptual)

```jsonc
{
  "command": "npm",
  "args": ["run", "dev"],
  "role": "backend",
  "singleton": true,
  "readiness": { "type": "port", "value": 3000 }
}
```

## start-test-run Input (Conceptual)

```jsonc
{
  "id": "e2e-001",
  "backend": { "command": "npm", "args": ["run","dev"], "readiness": {"type":"port","value":3000} },
  "frontend": { "command": "npm", "args": ["run","web"], "readiness": {"type":"http","value":"http://localhost:5173"} },
  "tests": { "command": "npx", "args": ["playwright","test"], "readiness": {"type":"log","value":"Running"} },
  "autoStop": true,
  "keepBackends": false
}
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| PROCESS_HERDER_SILENT_RECOVERY | Suppress recovery chatter |
| PROCESS_HERDER_CRASH_GRACE_MS | Grace window before marking crash |

## Troubleshooting Quick Reference

- Tools not found: ensure build done (`npm run build`) and on PATH
- Readiness timeout: increase `timeoutMs` or verify service binding
- Duplicate servers: use `singleton:true`
- Port conflicts: use `detect-port-conflicts` then `stop-processes-by-port`

## AI Prompt Patterns

```text
Use process-herder to start the backend with port readiness on 3000, then run playwright tests once it's ready.
```

```text
Use process-herder to list processes, show health summary, and restart any unhealthy ones.
```
