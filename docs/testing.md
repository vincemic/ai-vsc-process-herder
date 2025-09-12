# Testing

## Overview

Playwright-based end-to-end + integration + performance testing.

## Categories

- MCP Server (tool registration, protocol)
- Process Management (lifecycle, readiness, ports)
- Integration (project detection, workflows)
- Performance (startup, concurrency)
- Reliability (health, recovery)

## Commands

```bash
npm test
npm run test:ui
npm run test:debug
npm run test:mcp
npm run test:process
npm run test:integration
npm run test:performance
npm run test:cleanup
```

## Reports

- HTML: `playwright-report/` (`npx playwright show-report`)
- JUnit/XML: `test-results/results.xml`
- JSON Summary: `test-results/results.json`

## Fixtures

- Delayed server / delayed log emitters
- Test client wrapper for MCP messaging

## Reliability Tips

- Use `PROCESS_HERDER_SILENT_RECOVERY=1` in CI for quieter logs
- Add log readiness to reduce flakiness

## Adding a New Test

1. Create file under `tests/<category>/` ending in `.spec.ts`
2. Import `@playwright/test`
3. Use existing fixtures or create small helper
4. Run targeted: `npx playwright test tests/<category>/<file>.spec.ts`

## Sample Assertion Pattern

```ts
const response = await client.callTool('list-processes', {});
expect(response).toMatchObject({ success: true });
```

## Performance Focus Areas

- Tool list latency < 100ms typical
- Process spawn orchestration under load

## Troubleshooting Failing Tests

- Ensure fresh build: `npm run build`
- Clean state: delete `.process-herder/`
- Increase readiness timeout for slow CI machines

## Minimal CI Step

```bash
npm ci
npm run build
npm test
```
