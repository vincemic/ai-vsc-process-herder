# VS Code Process Herder MCP Server

Enterprise-grade process orchestration for AI-assisted VS Code workflows (Model Context Protocol server).

Focus: start / monitor / heal / coordinate dev servers, tasks, and test runs safely for AI agents (Copilot, Claude, MCP CLI).

## Quick Install

```bash
npm install -g vscode-process-herder-mcp
```

Or grab release tarball / executables: https://github.com/vincemic/ai-vsc-process-herder/releases

## Minimal VS Code (settings.json)

```json
{
  "github.copilot.chat.mcpServers": {
    "process-herder": { "command": "vscode-process-herder" }
  }
}
```

Verify in Copilot Chat: `list the available tools from process-herder`.

## Key Capabilities

- Task & direct process spawning (`start-process`, readiness probes)
- Health + metrics + logs + recovery strategies
- Test run orchestration (`start-test-run` backend/frontend/tests)
- Port inference & conflict insight
- Persistent state + reattach after restart

## Most Used Tools

`list-tasks`, `start-task`, `start-process`, `list-processes`, `get-health-summary`, `get-process-logs`, `start-test-run`, `get-test-run-status`, `abort-test-run`.

Full catalog: see `docs/tools.md`.

## Typical Prompt Pattern

```
Use the Process Herder MCP server to:
1. get-vscode-status
2. detect-project-type
3. list-tasks
4. start needed dev servers (readiness probes)
5. start-test-run (if tests)
6. monitor with get-health-summary
```

## Documentation

- Overview & index: `docs/README.md`
- Install: `docs/installation.md`
- Usage & workflows: `docs/usage.md`
- Tools reference: `docs/tools.md`
- Architecture: `docs/architecture.md`
- Reliability & recovery: `docs/reliability.md`
- Testing strategy: `docs/testing.md`
- Release workflow: `docs/releases.md`
- Changelog: `CHANGELOG.md`

## Contributing

PRs welcome. Please add tests (Playwright) for new behavior where appropriate.

## License

MIT

---
For deeper details, dive into the `docs/` directory.
