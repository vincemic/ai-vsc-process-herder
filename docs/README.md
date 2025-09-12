# Documentation Index

Welcome to the VS Code Process Herder MCP Server documentation.

## Key Topics

- [Quick Start](./README.md#quick-start)
- [Installation](./installation.md)
- [Usage Guide](./usage.md)
- [Tool Catalog](./tools.md)
- [Architecture](./architecture.md)
- [Reliability & Recovery](./reliability.md)
- [Testing](./testing.md)
- [Releases & Versioning](./releases.md)
- [Changelog](../CHANGELOG.md)

## Quick Start

```bash
npm install -g vscode-process-herder-mcp
vscode-process-herder --help
```

Configure in VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcpServers": {
    "process-herder": { "command": "vscode-process-herder" }
  }
}
```

Then in Copilot Chat: `list the available tools from process-herder`.

## Documentation Philosophy

Concise, task-focused pages. Root README gives overview; this folder houses deeper reference.
