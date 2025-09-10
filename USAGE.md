# VS Code Process Herder - Quick Start Guide

## Installation and Setup

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Test the server:**
   ```bash
   node test-server.js
   ```

## MCP Server Integration

### For Claude Desktop
Add to your Claude Desktop configuration (`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vscode-process-herder": {
      "command": "node",
      "args": ["C:\\tmp\\ai-vsc-process-herder\\build\\index.js"],
      "env": {}
    }
  }
}
```

### For GitHub Copilot
The server will be available to GitHub Copilot when configured as an MCP server in VS Code extensions.

## Available Tools

### 1. `list-tasks`
Lists all VS Code tasks from `.vscode/tasks.json`

**Example usage:**
"List the available VS Code tasks"

### 2. `start-task`
Starts a specific VS Code task by name

**Example usage:**
"Start the build project task"
"Run the test task"

### 3. `start-process`

Spawn an arbitrary command (outside tasks.json) with optional metadata and readiness:

Options:

- `role`: frontend | backend | test | e2e | utility
- `tags`: string[] for arbitrary classification
- `singleton`: prevent duplicate identical processes (role|command|cwd|args)
- `readiness`:
  - `{ "type": "port", "value": 3000 }`
  - `{ "type": "http", "value": "http://localhost:3000/health" }`
  - `{ "type": "log", "value": "Started on" }`

Returns: `processId`, `reused?`, `ready?`, `readyAt?`, `role?`.

**Example usage:**

```bash
start-process {"command":"npm","args":["run","dev"],"role":"backend","singleton":true,"readiness":{"type":"port","value":3000}}
```

### 4. `stop-process`

Stops a running process by ID or name

**Example usage:**
"Stop process ID 1234"
"Stop the npm process"

### 5. `restart-process`

Restarts a running process

**Example usage:**
"Restart process ID 1234"
"Restart the development server"

### 6. `list-processes`

Lists all running processes managed by the server

**Example usage:**
"Show me all running processes"
"List development processes"

### 7. `get-process-status`

Gets detailed status for a specific process

**Example usage:**
"Get status for process ID 1234"
"Check the status of the npm process"

### 8. `detect-project-type`

Analyzes the workspace to detect project type and suggest tasks

**Example usage:**
"What type of project is this?"
"Detect my project configuration"

### 9. `get-vscode-status`

Checks VS Code integration status

**Example usage:**
"Check VS Code status"
"Show VS Code workspace information"

## Example AI Assistant Commands

Once integrated with an AI assistant, you can use natural language commands like:

- "Start the development server" → Uses `start-task` to find and run dev server task
- "Stop all running processes" → Uses `list-processes` then `stop-process` for each
- "Check what's running" → Uses `list-processes` to show active processes
- "Restart the build process" → Uses `restart-process` to restart build task
- "Start backend and wait for port 3000" → Uses `start-process` with port readiness
- "Run end-to-end tests once backend ready" → Uses `list-processes` filter by role then `start-process` for test runner (log readiness)
- "What tasks are available?" → Uses `list-tasks` to show all VS Code tasks
- "What kind of project is this?" → Uses `detect-project-type` to analyze workspace

## Development Workflow

### Common Tasks Available

- `install dependencies` - Install npm dependencies
- `build project` - Build the TypeScript project (default build task)
- `start mcp server` - Start the MCP server in development mode
- `test mcp server` - Test the built MCP server
- `lint code` - Lint TypeScript code
- `format code` - Format code with Prettier
- `clean build` - Clean the build directory

### Typical Development Session

1. "Install dependencies" → Runs npm install
2. "Build the project" → Compiles TypeScript
3. "Start the MCP server" → Launches server for testing
4. "List running processes" → Verify server is running
5. "Test the server" → Run test scripts

## Troubleshooting

### Server not responding

- Check that Node.js is installed and accessible
- Verify the build directory exists: `npm run build`
- Test manually: `node build/index.js`

### Tasks not found

- Ensure `.vscode/tasks.json` exists in your workspace
- Check that task names match exactly (case-sensitive)
- Use `list-tasks` to see available tasks

### Process management issues

### Readiness failures

- Confirm the service actually binds the expected port/URL/log line
- Increase timeout: add `timeoutMs` in readiness object
- For log probe ensure pattern spelling/case (string is case-insensitive automatically)

### Persistence & Reattachment

Running processes across server restarts are reattached automatically; metadata is stored in `.process-herder/processes.json`.

### Suppress Recovery Noise (CI/Test)

Set either env var before running tests:

```bash
export PROCESS_HERDER_SILENT_RECOVERY=1
export PROCESS_HERDER_CRASH_GRACE_MS=10000   # optional grace (ms) before marking crash
```

- Process IDs are platform-specific
- Use process names for cross-platform compatibility
- Some processes may require elevated permissions to stop

## Architecture

The MCP server provides a standardized interface for AI assistants to:

- Manage VS Code development workflows
- Start/stop/monitor development processes
- Integrate with existing VS Code task configurations
- Provide intelligent project analysis and suggestions

This eliminates the confusion AI assistants often have about development processes and provides a reliable, consistent interface for process management.
