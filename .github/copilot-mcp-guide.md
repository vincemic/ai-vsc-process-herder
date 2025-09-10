# GitHub Copilot MCP Server Integration Guide

## Process Herder MCP Server Usage

This guide explains how GitHub Copilot should use the "process-herder" MCP server for managing VS Code tasks and processes during development, testing, and debugging workflows.

## 🎯 When to Use Process Herder

GitHub Copilot should automatically use the process-herder MCP server when users ask for:

### Development Server Management
- "Start the development server"
- "Run the backend API"  
- "Launch the frontend"
- "Start the database"

### Testing Workflows
- "Run the tests"
- "Execute e2e tests"
- "Start integration testing"
- "Run test suite with backend"

### Build and Deployment
- "Build the project"
- "Compile TypeScript"
- "Bundle the application"
- "Run linting"

### Debugging and Monitoring
- "Check running processes"
- "See process logs"
- "Monitor server health"
- "Restart failed service"

## 🛠️ Tool Selection Guide

### For Starting Services

1. **Use `list-tasks` first** to see available VS Code tasks
2. **Use `start-task`** for pre-configured tasks in tasks.json
3. **Use `start-process`** for custom commands or when you need:
   - Singleton behavior (`singleton: true`)
   - Readiness probes (`readiness` config)
   - Role classification (`role` parameter)
   - Custom working directory (`cwd`)

### For Testing Workflows

1. **Use `start-test-run`** for coordinated multi-process testing:
   - Backend + Frontend + Tests coordination
   - Automatic readiness waiting
   - Proper startup sequencing
   
2. **Use individual tools** for simple scenarios:
   - `start-task` for basic test execution
   - `start-process` for custom test setups

### For Process Management

1. **Use `list-processes`** to see what's running
2. **Use `get-process-status`** for detailed information
3. **Use `stop-process`** or `restart-process` for lifecycle management
4. **Use `get-health-summary`** for overall system health

## 📋 Common Workflow Patterns

### Pattern 1: Full-Stack Development Setup

```
1. start-process backend with readiness probe:
   {
     "command": "npm",
     "args": ["run", "api"],
     "role": "backend", 
     "singleton": true,
     "readiness": {"type": "port", "value": 3001}
   }

2. start-process frontend with readiness probe:
   {
     "command": "npm", 
     "args": ["run", "dev"],
     "role": "frontend",
     "singleton": true, 
     "readiness": {"type": "http", "value": "http://localhost:3000"}
   }
```

### Pattern 2: E2E Testing Workflow

```
1. start-test-run with coordinated services:
   {
     "id": "e2e-test-run",
     "backend": {
       "command": "npm",
       "args": ["run", "start:test"],
       "readiness": {"type": "port", "value": 3001}
     },
     "tests": {
       "command": "npx", 
       "args": ["playwright", "test"],
       "readiness": {"type": "log", "value": "Running"}
     },
     "autoStop": true
   }
```

### Pattern 3: Build and Test

```
1. start-task "build project" (if available in tasks.json)
2. start-task "test mcp server" (if available)
   
OR

1. start-process build:
   {
     "command": "npm",
     "args": ["run", "build"], 
     "role": "utility"
   }
   
2. Wait for completion, then start-process test
```

### Pattern 4: Debugging Failed Services

```
1. list-processes (to see what's running)
2. get-process-status for specific process
3. get-process-logs for error investigation  
4. restart-process or stop-process as needed
5. get-health-summary for overall status
```

## 🔧 Tool Parameter Guidelines

### readiness Probe Configuration

**Port Probes** - For services that bind to ports:
```json
{
  "type": "port",
  "value": 3000,
  "timeoutMs": 30000,
  "intervalMs": 1000
}
```

**HTTP Probes** - For web services with health endpoints:
```json
{
  "type": "http", 
  "value": "http://localhost:3000/health",
  "timeoutMs": 30000,
  "intervalMs": 2000
}
```

**Log Probes** - For services that log startup messages:
```json
{
  "type": "log",
  "value": "Server ready|Listening on|Started successfully", 
  "timeoutMs": 20000
}
```

### Role Classification

Always specify roles when possible to help with orchestration:

- `"frontend"` - React, Vue, Angular dev servers, static file servers
- `"backend"` - API servers, Node.js services, Python Flask/Django
- `"test"` - Unit test runners, Jest, Mocha, pytest
- `"e2e"` - Playwright, Cypress, Selenium tests
- `"utility"` - Build tools, linters, compilers, deployment scripts

### Singleton Usage

Use `singleton: true` for:
- Heavy services (databases, large build processes)
- Services that bind to specific ports
- Development servers that should only run once
- Background services

## 🚨 Error Handling Best Practices

1. **Always check tool responses** for success/failure
2. **Use `get-process-logs`** to investigate failures
3. **Try `restart-process`** for transient failures
4. **Use `get-health-summary`** to understand system state
5. **Provide meaningful error messages** to users with suggested fixes

## 💡 Optimization Tips

1. **Reuse singleton processes** instead of restarting
2. **Use readiness probes** to prevent race conditions
3. **Group related operations** with `start-test-run`
4. **Check existing processes** with `list-processes` before starting new ones
5. **Use role filtering** with `list-processes` to find specific service types

## 🎯 User Experience Guidelines

When using the MCP server:

1. **Explain what you're doing**: "I'll start the backend server and wait for it to be ready..."
2. **Show progress**: "Waiting for the server to start on port 3000..."
3. **Handle errors gracefully**: "The server failed to start. Let me check the logs..."
4. **Provide next steps**: "The backend is ready! Now I'll start the frontend..."

This ensures users understand what's happening and builds confidence in the AI assistant's capabilities.