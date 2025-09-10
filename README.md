# VS Code Process Herder MCP Server

A TypeScript-based MCP (Model Context Protocol) server that provides **enterprise-grade intelligent process management** for VS Code development workflows. This server acts as a standardized interface for AI assistants like GitHub Copilot to manage development processes without confusion.

## 🚀 Features

### Core Process Management (Overview)

- **VS Code Tasks Integration**: Read and execute tasks from `tasks.json`
- **Process Lifecycle Management**: Start, stop, restart, and monitor processes
- **Direct Process Spawning (`start-process`)**: Launch arbitrary commands outside of tasks.json with structured metadata
- **Intelligent Process Detection**: Automatically detect common development scenarios
- **Project Type Detection**: Auto-detect project type and suggest relevant tasks
- **Multi-Project Support**: Handle multiple workspace configurations
- **Cross-Platform**: Works on Windows, macOS, and Linux

### 🆕 Enhanced Reliability Features

- **Advanced Health Monitoring**: Real-time process health assessment with scoring
- **Intelligent Auto-Recovery**: Automatic healing of failed processes with configurable strategies
- **Persistent State Management**: Process state survives restarts and crashes
- **Singleton Process Reuse**: Prevent duplicate identical processes (same role/command/cwd/args) when `singleton=true`
- **Readiness Probes**: Port / HTTP / Log pattern based readiness gating before marking a process as ready
- **Role & Tag Classification**: Frontend / backend / test / e2e / utility roles (auto-inferred heuristics + manual override)
- **Comprehensive Logging & Metrics**: Full observability into process behavior
- **Proactive Issue Detection**: Early warning system for potential problems

> ⚡ **New in v2.0**: The Process Herder now includes enterprise-grade reliability features that make it suitable for production development environments. See [IMPROVEMENTS.md](IMPROVEMENTS.md) for detailed information about the enhancements.

## 🛠 Installation

### Option 1: Global Installation from GitHub (Recommended)

This is the easiest way to install and use the VS Code Process Herder MCP server across all your projects.

#### Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)
- Git (for GitHub access)

#### Install Globally

```powershell
npm install -g git+https://github.com/vincemic/ai-vsc-process-herder.git
```

This command will:

1. Clone the repository from GitHub
2. Install dependencies
3. Build the TypeScript project
4. Install the `vscode-process-herder` command globally

#### Verify Installation

After installation, verify it works:

```powershell
# Check if the command is available
vscode-process-herder --help

# Test the MCP server (should show MCP protocol initialization)
echo '{"jsonrpc": "2.0", "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}, "id": 1}' | vscode-process-herder
```

#### Test with VS Code

1. **Reload VS Code** after configuring the MCP server
2. **Open Copilot Chat** and test with these prompts:

```text
list the available tools from process-herder
```

```text
Use process-herder to detect what type of project this is
```

```text
Use process-herder to list all available VS Code tasks
```

#### Update to Latest Version

To update to the latest version from GitHub:

```powershell
npm update -g vscode-process-herder-mcp
```

Or reinstall:

```powershell
npm uninstall -g vscode-process-herder-mcp
npm install -g git+https://github.com/vincemic/ai-vsc-process-herder.git
```

### Option 2: Local Development Installation

For development or customization purposes:

#### Development Prerequisites

- Node.js 18 or higher
- VS Code (optional, but recommended)

#### Install Dependencies

```bash
npm install
```

#### Build the Project

```bash
npm run build
```

## 🤖 AI Integration Prompts

### Best Prompts for GitHub Copilot & Claude

To ensure AI assistants properly leverage the Process Herder MCP server for VS Code debugging and development workflows, use these proven prompt templates:

#### **Primary Prompt Template**

```text
I'm debugging a [PROJECT_TYPE] project in VS Code. Please use the VS Code Process Herder MCP server to help me:

1. **Analyze the current state**: Check what processes are running and their health
2. **Start debug workflow**: Launch the appropriate development servers and debug configuration
3. **Monitor and troubleshoot**: Track process health and logs during debugging

Current context:
- Project type: [e.g., TypeScript Node.js, React, Python, etc.]
- Issue: [Brief description of what you're debugging]
- Environment: VS Code with Process Herder MCP server available

Please start by checking the current process status and VS Code integration, then suggest the best debugging approach.
```

#### **For Initial Debug Setup**

```text
I need to debug my VS Code project. Use the Process Herder MCP server to:
1. Run `get-vscode-status` to check VS Code integration
2. Run `detect-project-type` to analyze my workspace
3. Run `list-tasks` to see available VS Code tasks
4. Start the appropriate debug workflow based on the project type

Then guide me through the debugging process using the MCP tools.
```

#### **For Multi-Process Debugging**

```text
I'm debugging a full-stack application in VS Code. Use the Process Herder MCP server to:
1. Check current running processes with `list-processes`
2. Start a coordinated test run with `start-test-run` including:
   - Backend service with readiness probe
   - Frontend service with readiness probe  
   - Debug configuration
3. Monitor the health and logs of all processes

Project has both backend and frontend components that need to run simultaneously.
```

#### **For Troubleshooting Existing Issues**

```text
I have processes running but something isn't working correctly. Use the Process Herder MCP server to:
1. Get `get-health-summary` for overall system status
2. Use `get-process-status` for specific failing processes
3. Check `get-process-logs` for error messages
4. Suggest recovery actions using `restart-process` or `configure-recovery`

Help me diagnose and fix the issues.
```

#### **Complete Example Prompt**

```text
I'm debugging a TypeScript Node.js MCP server project in VS Code. The build completed successfully, but I need to test the MCP functionality.

Please use the VS Code Process Herder MCP server to help me:

1. **Initial Analysis**:
   - Run `get-vscode-status` to verify VS Code integration
   - Run `detect-project-type` to confirm project setup
   - Run `list-tasks` to see what VS Code tasks are available

2. **Start Debug Session**:
   - Use the "Debug MCP Server" launch configuration 
   - Start the MCP server process with proper monitoring
   - Set up health monitoring and logging

3. **Test MCP Tools**:
   - Start a test run using the MCP server's own tools
   - Monitor process health during testing
   - Capture any errors or issues in the logs

4. **Troubleshoot Issues**:
   - If anything fails, use process status and logs to diagnose
   - Suggest recovery strategies

The project has tasks for building, testing, and running the MCP server. I want to ensure everything works correctly before deploying.
```

### **Key Phrases for Triggering MCP Usage**

Always include these phrases in your prompts to ensure AI assistants use the MCP server:

- **"Use the Process Herder MCP server"** or **"Use the VS Code Process Herder MCP"**
- **"Check the MCP tools available"**
- **"Start with process analysis"**
- **"Monitor process health"**
- **"Use coordinated workflow"**

### **Workflow-Specific Prompts**

#### **For Test Debugging**

```text
I need to debug failing tests. Use the Process Herder MCP to:
1. Start backend services with readiness probes
2. Launch test processes with proper dependencies
3. Use `start-test-run` for coordinated execution
4. Monitor test progress and capture detailed logs
```

#### **For Performance Debugging**

```text
I'm debugging performance issues. Use the Process Herder MCP to:
1. Get baseline metrics with `get-process-metrics`
2. Monitor resource usage during debugging
3. Use `get-health-summary` to identify bottlenecks
4. Set up process monitoring with alerts
```

### **Pro Tips for Effective MCP Usage**

1. **Always mention the MCP server by name** in your prompts
2. **Be specific about the workflow** (debugging, testing, development)
3. **Include your project context** (language, framework, current state)
4. **Ask for step-by-step analysis** using the MCP tools
5. **Request health monitoring** throughout the process
6. **Mention specific MCP tool names** when you know what you need

## 📖 Usage

### Starting the MCP Server

```bash
# Direct execution
node build/index.js

# Or using npm script
npm run dev
```

The server runs on stdio and follows the MCP protocol specification.

### Integration with AI Assistants

After global installation, you can configure the MCP server in your AI assistant's settings using the global `vscode-process-herder` command.

#### GitHub Copilot (VS Code)

Add the following configuration to your VS Code `settings.json`:

**Location Options:**

- **User Settings** (applies to all workspaces): `File → Preferences → Settings → Open Settings (JSON)`
- **Workspace Settings** (applies to current workspace only): `.vscode/settings.json` in your project

**Recommended Configuration (Global Installation):**

```json
{
  "github.copilot.chat.mcpServers": {
    "process-herder": {
      "command": "vscode-process-herder",
      "env": {
        "PROCESS_HERDER_SILENT_RECOVERY": "1"
      }
    }
  }
}
```

**Alternative Configurations:**

*Minimal configuration:*

```json
{
  "github.copilot.chat.mcpServers": {
    "process-herder": {
      "command": "vscode-process-herder"
    }
  }
}
```

*With additional environment variables:*

```json
{
  "github.copilot.chat.mcpServers": {
    "process-herder": {
      "command": "vscode-process-herder",
      "env": {
        "PROCESS_HERDER_SILENT_RECOVERY": "1",
        "PROCESS_HERDER_CRASH_GRACE_MS": "5000"
      }
    }
  }
}
```

**For Local Development** (if you cloned the repo instead of global install):

```json
{
  "github.copilot.chat.mcpServers": {
    "process-herder": {
      "command": "node",
      "args": ["${workspaceFolder}/build/index.js"],
      "cwd": "${workspaceFolder}",
      "env": {
        "PROCESS_HERDER_SILENT_RECOVERY": "1"
      }
    }
  }
}
```

**After Configuration:**

1. **Restart VS Code** to load the new MCP server configuration
2. **Open Copilot Chat** (`Ctrl+Shift+I` or `Cmd+Shift+I`)
3. **Test the connection** with: `list the available tools from process-herder`
4. **Verify functionality** with: `Use process-herder to detect what type of project this is`

#### Anthropic Claude (Desktop / Web)

Create or edit the Claude MCP config file:

- **macOS**: `~/Library/Application Support/Claude/mcp/servers.json`
- **Windows**: `%APPDATA%/Claude/mcp/servers.json` (e.g. `C:\Users\<username>\AppData\Roaming\Claude\mcp\servers.json`)

Add this entry for global installation:

```json
{
  "process-herder": {
    "command": "vscode-process-herder",
    "env": {
      "PROCESS_HERDER_SILENT_RECOVERY": "1"
    }
  }
}
```

**For local development** (if you cloned the repo instead of global install):

```jsonc
{
   "process-herder": {
      "command": "node",
      "args": ["C:/path/to/ai-vsc-process-herder/build/index.js"],
      "env": {
         "PROCESS_HERDER_SILENT_RECOVERY": "1"
      },
      "cwd": "C:/path/to/ai-vsc-process-herder"
   }
}
```

Restart Claude. Ask: “Use process-herder to list processes.”

#### MCP CLI (Reference Client)

Install the reference CLI (if not already):

```bash
npx @modelcontextprotocol/cli@latest --help
```

Run the server directly:

```bash
npx @modelcontextprotocol/cli run --server "node build/index.js"
```

Or use the included `mcp.json` (already in repo) or create your own:

```json
{
   "servers": {
      "process-herder": {
         "command": "node",
         "args": ["build/index.js"],
         "cwd": "."
      }
   }
}
```

Then:

```bash
npx @modelcontextprotocol/cli shell --config mcp.json
```

Or via provided npm script (after build):

```bash
npm run mcp:shell
```

Test inside the shell:

```text
> tools list process-herder
> call process-herder list-processes
```

#### Quick Verification Prompts

- “list the available tools”
- “start a backend dev server on port 3000 using start-process”
- “start-test-run with a backend (port 3000) and tests that log READY”

#### Useful Environment Variables

- `PROCESS_HERDER_SILENT_RECOVERY=1` suppresses verbose recovery chatter (good for chat sessions & CI).
- `PROCESS_HERDER_CRASH_GRACE_MS=5000` customizes crash grace period (milliseconds) before classifying exits as failures.

#### Troubleshooting

- If tools don’t appear: ensure `npm run build` completed and paths are correct (Windows paths require escaped backslashes in JSON).
- If readiness never resolves: verify port/URL/log pattern and increase `timeoutMs` in the readiness spec.
- If duplicate processes spawn unexpectedly: add `singleton:true` to `start-process` or backend/frontend sections in `start-test-run`.

---

## 🔧 Available Tools

### Core Process Management

1. **list-tasks**: List all available VS Code tasks from `tasks.json`
1. **start-task**: Start a specific task by name (auto-infers role)
1. **start-process**: Spawn an arbitrary command with options: `cwd`, `role`, `tags`, `singleton`, `readiness` (port|log|http). Returns `reused=true` if an existing singleton instance was reused and exposes `ready/readyAt` when readiness succeeds.
1. **stop-process**: Stop a running process by ID or name
1. **restart-process**: Restart a process with the same configuration
1. **list-processes**: List all running managed processes (supports optional role filtering)
1. **get-process-status**: Get detailed status information for a specific process (includes readiness + role)

### Project Analysis

1. **detect-project-type**: Analyze workspace to detect project type and suggest tasks
1. **get-vscode-status**: Check VS Code integration status and workspaces

### 🆕 Enhanced Reliability Tools

1. **get-health-summary**: Get comprehensive health overview of all monitored processes
1. **configure-recovery**: Set up automatic recovery strategies for processes
1. **get-process-logs**: Advanced log filtering and search with category support
1. **get-process-metrics**: Performance metrics and analytics for tracked processes
1. **export-diagnostics**: Export comprehensive diagnostic data for troubleshooting

### 🧪 Test Run Orchestration (New)

Coordinated multi-process test executions:

1. **start-test-run**: Start a test run with optional `backend`, `frontend`, and required `tests` sections. Each section supports `command`, `args`, `cwd`, `readiness` (port|http|log), plus `singleton` for backend/frontend. Returns a run state object with PIDs.
1. **get-test-run-status**: Retrieve the live status of a run (`pending|starting|running|completed|failed|aborted`) with PIDs and timestamps.
1. **list-test-runs**: List all known test runs.
1. **abort-test-run**: Abort a running test run; stops test process and (unless `keepBackends` true) associated backend/frontend.

Example `start-test-run` input (conceptual):

```json
{
   "id": "e2e-001",
   "backend": { "command": "npm", "args": ["run", "dev"], "readiness": { "type": "port", "value": 3000 } },
   "frontend": { "command": "npm", "args": ["run", "web"], "readiness": { "type": "http", "value": "http://localhost:5173" } },
   "tests": { "command": "npx", "args": ["playwright", "test"], "readiness": { "type": "log", "value": "Running" } },
   "autoStop": true,
   "keepBackends": false
}
```

Behavior:

- Backends/frontends start (with readiness) before launching tests.
- Tests are polled until exit; on completion success and `autoStop` true, supporting services are stopped (unless `keepBackends`).
- Supports singleton reuse for heavy services to accelerate iterative test runs.

### Tool: start-process (Details)

Input shape (conceptual):

```json
{
   command: string,
   args?: string[],
   cwd?: string,
   role?: "frontend"|"backend"|"test"|"e2e"|"utility",
   tags?: string[],
   singleton?: boolean,
   readiness?:
      | { type: "port", value: number, timeoutMs?: number, intervalMs?: number }
      | { type: "http", value: string, timeoutMs?: number, intervalMs?: number }
      | { type: "log", value: string, timeoutMs?: number }
}
```

Return fields (subset): `processId`, `reused?`, `role?`, `ready?`, `readyAt?`.

Use cases:

- Launch a backend server: `start-process {"command":"npm","args":["run","dev"],"role":"backend","singleton":true,"readiness":{"type":"port","value":3000}}`
- Launch a playwright test runner with log readiness: `start-process {"command":"npx","args":["playwright","test"],"role":"e2e","readiness":{"type":"log","value":"\\u001b[32m\\[INFO\\]"}}`

If a process with the same signature (role|command|cwd|args) exists and `singleton:true`, the existing process metadata is returned instead of spawning a duplicate.

### Readiness Probes

- Port: Polls attempting TCP connect until success.
- HTTP: Performs HTTP(S) GET expecting a non-5xx status.
- Log: Waits for a pattern (string or regex) to appear in stdout/stderr.
Timeout defaults to 20s if not specified. On timeout or early exit the process remains managed but `ready=false` and `lastError` records the failure.

### Roles & Tags

Roles help the AI orchestrate workflows (e.g. ensure backend is ready before e2e tests). Roles are inferred for tasks (e.g. names containing `dev`, `serve` → frontend; `api`, `server` → backend; `test`, `playwright` → test/e2e) but can be overridden explicitly with `start-process`.

### Singleton Behavior

Prevent duplicated heavy services: pass `singleton:true`. If already running, the call is idempotent and returns `reused:true` plus current readiness state.

### Persistence & Reattachment

Managed process metadata (excluding logs) is periodically persisted to `.process-herder/processes.json`. On server restart, still-running PIDs are reattached and a reattachment log entry is injected. This allows AI clients to resume coordination without manually restarting everything.

### State & Logs

Logs (last 100 entries per process) are kept in-memory; summary APIs expose recent slices. Persisted JSON intentionally omits verbose logs for performance.

## 🏗 Architecture

### Core Components

- **ProcessManager**: Handles process lifecycle and monitoring
- **TaskManager**: Manages VS Code tasks and configurations
- **ProjectDetector**: Analyzes projects and suggests appropriate tasks
- **VSCodeIntegration**: Integrates with VS Code workspace settings

### Supported Project Types

- **JavaScript/TypeScript**: npm, yarn, pnpm support with framework detection
- **Python**: pip, pipenv, poetry support with framework detection
- **Rust**: Cargo support with standard commands
- **Go**: Go modules with standard commands
- **Java**: Maven and Gradle support
- **.NET**: dotnet CLI support
- **Web Projects**: HTML/CSS detection

## 📋 Example Tasks

### Starting a Development Server

```bash
# AI Assistant can use:
start-task "npm start"
```

### Running Tests

```bash
# AI Assistant can use:
start-task "npm test"
```

### Managing Processes

```bash
# List all running processes
list-processes

# Stop a specific process
stop-process --processName "npm start"

# Restart a process
restart-process --processName "npm start"
```

## 🔄 Development Workflow

### Common Scenarios

1. **Frontend Development**
   - Start development server
   - Run build process
   - Execute tests
   - Monitor process health

2. **Backend Development**
   - Start API server
   - Run database migrations
   - Execute integration tests
   - Monitor logs

3. **Full-Stack Development**
   - Manage multiple processes (frontend + backend)
   - Coordinate startup order
   - Monitor all services

## 🚨 Error Handling

The server provides comprehensive error handling with:

- Graceful process termination
- Meaningful error messages
- Process state recovery
- Timeout handling for unresponsive processes

## 🧪 Testing

The project uses Playwright for comprehensive end-to-end testing:

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in debug mode
npm run test:debug

# Show test report
npm run test:report

# Lint code
npm run lint

# Format code
npm run format
```

Test results are available in the `playwright-report/` directory after running tests.

## 📁 Project Structure

```text
src/
├── index.ts              # Main MCP server implementation
├── process-manager.ts    # Process lifecycle management
│   (singleton reuse, readiness probes, persistence)
├── task-manager.ts       # VS Code tasks integration
├── project-detector.ts   # Project type detection
└── vscode-integration.ts # VS Code workspace integration

build/                    # Compiled JavaScript output
.vscode/                  # VS Code configuration
├── tasks.json           # VS Code tasks
└── settings.json        # Workspace settings
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Related

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [VS Code Tasks](https://code.visualstudio.com/docs/editor/tasks)
- [GitHub Copilot](https://github.com/features/copilot)

## 🐛 Troubleshooting

### Common Issues

1. **Process won't start**: Check that the command exists and is in PATH
2. **Permission denied**: Ensure proper file permissions for executables
3. **Port conflicts**: Check if ports are already in use
4. **VS Code tasks not found**: Verify `tasks.json` exists and is valid

### Debug Mode

Set environment variable for verbose logging:

```bash
DEBUG=vscode-process-herder node build/index.js
```

## 📚 API Reference

See the inline documentation in the source code for detailed API reference and examples.
