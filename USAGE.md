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

### 3. `stop-process`
Stops a running process by ID or name

**Example usage:**
"Stop process ID 1234"
"Stop the npm process"

### 4. `restart-process`
Restarts a running process

**Example usage:**
"Restart process ID 1234"
"Restart the development server"

### 5. `list-processes`
Lists all running processes managed by the server

**Example usage:**
"Show me all running processes"
"List development processes"

### 6. `get-process-status`
Gets detailed status for a specific process

**Example usage:**
"Get status for process ID 1234"
"Check the status of the npm process"

### 7. `detect-project-type`
Analyzes the workspace to detect project type and suggest tasks

**Example usage:**
"What type of project is this?"
"Detect my project configuration"

### 8. `get-vscode-status`
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