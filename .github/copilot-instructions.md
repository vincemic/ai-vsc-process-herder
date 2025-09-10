<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# VS Code Process Herder MCP Server

This is a TypeScript MCP server project that provides intelligent process management for VS Code development workflows.

## 🤖 GitHub Copilot Instructions

**GitHub Copilot has access to the "process-herder" MCP Server for managing VS Code tasks and processes during testing and debugging workflows.**

### When to Use the Process Herder MCP Server

Use the process-herder MCP server when you need to:

1. **Start development servers** (frontend, backend, API servers)
2. **Run tests** (unit tests, integration tests, e2e tests)
3. **Manage build processes** (compilation, bundling, deployment)
4. **Debug applications** (start debug servers, monitor processes)
5. **Orchestrate multi-process workflows** (full-stack development)
6. **Monitor process health** and troubleshoot issues

### Available MCP Tools

#### Core Process Management

- `list-tasks` - List all available VS Code tasks from tasks.json
- `start-task` - Start a specific VS Code task by name (auto-detects role)
- `start-process` - Spawn arbitrary commands with advanced options (singleton, readiness probes)
- `stop-process` - Stop a running process by ID or name
- `restart-process` - Restart a process with the same configuration
- `list-processes` - List all running managed processes (with optional role filtering)
- `get-process-status` - Get detailed status for a specific process

#### Project Analysis

- `detect-project-type` - Analyze workspace and suggest relevant tasks
- `get-vscode-status` - Check VS Code integration status

#### Advanced Features

- `get-health-summary` - Get comprehensive health overview of all processes
- `configure-recovery` - Set up automatic recovery strategies
- `get-process-logs` - Advanced log filtering and search
- `get-process-metrics` - Performance metrics and analytics
- `export-diagnostics` - Export diagnostic data for troubleshooting

#### Test Run Orchestration

- `start-test-run` - Start coordinated multi-process test runs (backend + frontend + tests)
- `get-test-run-status` - Check status of running test runs
- `list-test-runs` - List all known test runs
- `abort-test-run` - Abort a running test run

### Usage Patterns

#### Starting Development Servers

```
Use process-herder to start the development server:
- Check available tasks with list-tasks
- Start with start-task "start mcp server" or start-process for custom commands
- Use singleton=true for heavy processes to prevent duplicates
- Add readiness probes (port/http/log) to wait for service availability
```

#### Running Tests

```
Use process-herder for test execution:
- Start backend services first with readiness probes
- Launch test processes with proper dependencies
- Use start-test-run for coordinated multi-process test workflows
- Monitor test progress with get-test-run-status
```

#### Debugging Workflows

```
Use process-herder for debugging:
- Start processes with detailed logging enabled
- Monitor process health with get-health-summary
- Check process logs with get-process-logs
- Use get-process-status for detailed diagnostics
```

### Process Roles and Classification

The process-herder automatically classifies processes by role:

- **frontend** - Web servers, React/Vue/Angular dev servers
- **backend** - API servers, Node.js backends, databases
- **test** - Unit tests, integration tests
- **e2e** - End-to-end tests, Playwright, Cypress
- **utility** - Build tools, linters, formatters

### Readiness Probes

Use readiness probes to ensure services are ready before starting dependent processes:

- **Port probes**: `{"type": "port", "value": 3000}` - Wait for TCP port to accept connections
- **HTTP probes**: `{"type": "http", "value": "http://localhost:3000/health"}` - Wait for HTTP endpoint
- **Log probes**: `{"type": "log", "value": "Server ready"}` - Wait for log pattern

### Singleton Process Management

Use `singleton: true` to prevent duplicate processes with the same command/args/cwd combination. Useful for:

- Heavy development servers
- Database instances
- Background services

### Example Workflows

#### Full-Stack Development Setup

1. `start-process` backend with port readiness probe
2. `start-process` frontend with HTTP readiness probe
3. `start-test-run` for coordinated e2e testing

#### Debugging Failed Tests

1. `list-processes` to see running processes
2. `get-process-logs` to examine error logs
3. `get-health-summary` for overall system health
4. `restart-process` to retry failed processes

## Project Overview

The VS Code Process Herder MCP server provides standardized tools for AI assistants (like GitHub Copilot) to manage development processes through VS Code's task system. This eliminates the confusion AI assistants often have about starting, stopping, and monitoring development processes.

## Key Features

- **VS Code Tasks Integration**: Read and execute tasks from tasks.json
- **Process Lifecycle Management**: Start, stop, restart, and monitor processes
- **Intelligent Process Detection**: Automatically detect common development scenarios
- **Status Monitoring**: Query running processes and their health
- **Error Handling**: Graceful error handling with meaningful feedback
- **Multi-Project Support**: Handle multiple workspace configurations
- **Enterprise-Grade Reliability**: Health monitoring, auto-recovery, persistent state
- **Test Run Orchestration**: Coordinated multi-process test execution
- **Readiness Probes**: Port/HTTP/log-based readiness gating
- **Singleton Process Reuse**: Prevent duplicate processes

## Architecture

- **TypeScript-based MCP Server** using the official MCP TypeScript SDK
- **VS Code Integration** through tasks.json parsing and execution
- **Process Management** with Node.js child_process APIs
- **State Tracking** for process monitoring and lifecycle management

## Development Guidelines

- Follow MCP protocol specifications strictly
- Use proper TypeScript types throughout
- Implement comprehensive error handling
- Provide clear tool descriptions for AI assistants
- Maintain process state consistently
- Use structured logging for debugging

## Workflow Support

- Frontend/backend development
- Testing workflows (unit, integration, e2e)
- Build processes
- Development servers
- Custom scripts and tools
- Multi-process orchestration
- Health monitoring and recovery

---

- [x] ✅ **Clarify Project Requirements** - MCP server for VS Code process management with TypeScript
- [x] ✅ **Scaffold the Project** - TypeScript MCP server structure created
- [ ] **Customize the Project** - Implement core MCP server functionality
- [ ] **Install Required Extensions** - Install TypeScript and MCP-related extensions
- [ ] **Compile the Project** - Build TypeScript and resolve dependencies
- [ ] **Create and Run Task** - Set up development and testing tasks
- [ ] **Launch the Project** - Test MCP server functionality
- [ ] **Ensure Documentation is Complete** - Update README and clean up instructions
