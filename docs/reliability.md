# Reliability & Recovery

Consolidated overview of health monitoring, recovery, persistence, logging & metrics.

## Health Monitoring

- Real-time scoring (0-100)
- Issue detection: memory, CPU spikes, unresponsive
- Trend & history retained

## Recovery

- Strategy conditions (memory-usage, error-count, health-score, unresponsive)
- Actions: notify, restart, force-kill, delay
- Cooldowns prevent loops
- Attempt tracking & analytics

### Example Strategy

```jsonc
{
  "name": "cpu-protect",
  "conditions": [ { "type": "cpu-usage", "operator": "gt", "value": 85, "duration": 45000 } ],
  "actions": [ { "type": "notify" }, { "type": "restart", "delay": 3000 } ],
  "maxAttempts": 2,
  "cooldownPeriod": 180000
}
```

## State Persistence

- Periodic snapshot JSON
- Date restoration safeguards
- Reattachment validates PID liveness

## Logging

- Structured categories (process, health, recovery, readiness, metrics, test-run)
- Filter via `get-process-logs` (level, category, regex, limit)

## Metrics

- Counters: processStarts, restarts, crashes
- Gauges: cpu, memory
- Derived health metrics

## Diagnostics Export

```text
export-diagnostics --includeState true --includeLogs true --since 10m
```

## Port & Conflict Tools

- `list-active-ports` aggregated inference
- `detect-port-conflicts` heuristics for overlap
- `stop-processes-by-port` targeted termination

## Best Practices

- Use `singleton:true` for heavy dev servers
- Add readiness probes to avoid race conditions
- Configure recovery only where instability expected
- Keep recovery strategies minimal & observable

## Common Failure Patterns

| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| Repeated restarts | Missing readiness / crash loop | Add log probe or inspect logs |
| High memory score | Leak or heavy build | Strategy: memory-usage + restart |
| Unresponsive | Deadlock / blocked event loop | Force kill then restart |

## Minimal Recovery Registration Prompt

```text
Use process-herder: configure-recovery for the backend dev server to restart if memory usage > 1.5GB for 60s, only once every 5 minutes.
```

See `architecture.md` for broader system flow.
