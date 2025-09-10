# Verifying GitHub Copilot MCP Server Integration

This guide helps you verify that GitHub Copilot can successfully access and use the "process-herder" MCP server.

## ✅ Configuration Check

Your VS Code workspace is already configured! The `.vscode/settings.json` includes:

```jsonc
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

## 🔧 Prerequisites

1. **Build the MCP server** (already done):
   ```bash
   npm run build
   ```

2. **Ensure VS Code has GitHub Copilot extension** installed and activated

3. **Reload VS Code** after configuration changes

## 🧪 Testing GitHub Copilot Integration

### Test 1: Basic Tool Discovery

In GitHub Copilot Chat, ask:

```
List the available tools from the process-herder MCP server
```

**Expected Result**: Copilot should show a list of 17 tools including:
- `list-tasks`
- `start-task` 
- `start-process`
- `start-test-run`
- `list-processes`
- etc.

### Test 2: Task Listing

Ask Copilot:
```
Use process-herder to list all available VS Code tasks
```

**Expected Result**: Should show the tasks from your `tasks.json`:
- install dependencies
- build project  
- start mcp server
- test mcp server
- lint code
- format code
- clean build

### Test 3: Process Management

Ask Copilot:
```
Use process-herder to start the MCP server in development mode
```

**Expected Result**: Copilot should use `start-task` or `start-process` to launch the "start mcp server" task.

### Test 4: Development Workflow

Ask Copilot:
```
Help me set up a development environment using process-herder. Start the necessary services and monitor their health.
```

**Expected Result**: Copilot should:
1. Detect the project type
2. Start appropriate development servers
3. Monitor process status
4. Report when services are ready

## 🐛 Troubleshooting

### Issue: Tools Not Appearing

**Symptoms**: Copilot says it doesn't have access to process-herder tools

**Solutions**:
1. Reload VS Code (`Ctrl+Shift+P` → "Developer: Reload Window")
2. Check that the build succeeded: `npm run build`
3. Verify the file path in settings.json is correct
4. Check VS Code output for MCP server errors

### Issue: MCP Server Won't Start

**Symptoms**: Error messages about the MCP server failing to start

**Solutions**:
1. Test the server manually:
   ```bash
   node build/index.js
   ```
2. Check for missing dependencies: `npm install`
3. Verify Node.js version (requires Node.js 18+)
4. Check file permissions

### Issue: Commands Fail

**Symptoms**: Process-herder tools execute but return errors

**Solutions**:
1. Check that you're in a valid workspace with `tasks.json`
2. Verify workspace paths are correct
3. Check process logs using `get-process-logs` tool
4. Use `get-health-summary` to diagnose issues

## 📋 Available Tools Reference

When working with GitHub Copilot, reference these tool categories:

### Core Process Management
- `list-tasks` - See available VS Code tasks
- `start-task` - Execute VS Code tasks
- `start-process` - Launch custom commands
- `stop-process` - Stop running processes
- `restart-process` - Restart processes
- `list-processes` - View running processes
- `get-process-status` - Get detailed process info

### Advanced Features  
- `start-test-run` - Coordinate multi-process testing
- `get-health-summary` - System health overview
- `get-process-logs` - View process logs
- `detect-project-type` - Analyze project structure
- `configure-recovery` - Set up auto-recovery
- `get-process-metrics` - Performance metrics
- `export-diagnostics` - Export debug data

## 🎯 Example Conversations

### Starting Development Server
```
User: "Start the development server for this project"
Copilot: "I'll use the process-herder to start your development server..."
[Uses start-task "start mcp server" or detects project type and starts appropriate service]
```

### Running Tests
```
User: "Run the tests and show me the results"
Copilot: "I'll start the test suite using process-herder..."
[Uses start-task "test mcp server" and monitors the results]
```

### Debugging Issues
```
User: "Something is wrong with my server, can you help debug?"
Copilot: "Let me check the process status and logs..."
[Uses list-processes, get-process-status, get-process-logs to diagnose]
```

## 🚀 Best Practices

1. **Let Copilot choose tools**: The AI will select the most appropriate process-herder tool based on your request
2. **Use natural language**: Ask in plain English rather than trying to specify exact tool names
3. **Provide context**: Mention what you're trying to achieve (testing, development, debugging)
4. **Follow up**: Ask for status updates or logs if processes don't behave as expected

## 📝 Notes

- The process-herder maintains state across VS Code sessions
- Processes started through process-herder are monitored for health and can auto-recover
- Use `singleton: true` behavior to prevent duplicate heavy processes
- Readiness probes ensure services are ready before dependent processes start

---

Your GitHub Copilot should now be fully equipped to manage your development processes intelligently using the process-herder MCP server! 🎉