<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# VS Code Process Herder MCP Server

This is a TypeScript MCP server project that provides intelligent process management for VS Code development workflows.

## Project Overview

The VS Code Process Herder MCP server provides standardized tools for AI assistants (like GitHub Copilot) to manage development processes through VS Code's task system. This eliminates the confusion AI assistants often have about starting, stopping, and monitoring development processes.

## Key Features

- **VS Code Tasks Integration**: Read and execute tasks from tasks.json
- **Process Lifecycle Management**: Start, stop, restart, and monitor processes
- **Intelligent Process Detection**: Automatically detect common development scenarios
- **Status Monitoring**: Query running processes and their health
- **Error Handling**: Graceful error handling with meaningful feedback
- **Multi-Project Support**: Handle multiple workspace configurations

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

## Tools Provided

1. **list-tasks**: List available VS Code tasks
2. **start-task**: Start a specific task by name
3. **stop-process**: Stop a running process
4. **restart-process**: Restart a process
5. **list-processes**: List all running processes
6. **get-process-status**: Get detailed status of a process
7. **detect-project-type**: Auto-detect project configuration

## Workflow Support

- Frontend/backend development
- Testing workflows
- Build processes
- Development servers
- Custom scripts and tools

---

- [x] ✅ **Clarify Project Requirements** - MCP server for VS Code process management with TypeScript
- [x] ✅ **Scaffold the Project** - TypeScript MCP server structure created
- [ ] **Customize the Project** - Implement core MCP server functionality
- [ ] **Install Required Extensions** - Install TypeScript and MCP-related extensions
- [ ] **Compile the Project** - Build TypeScript and resolve dependencies
- [ ] **Create and Run Task** - Set up development and testing tasks
- [ ] **Launch the Project** - Test MCP server functionality
- [ ] **Ensure Documentation is Complete** - Update README and clean up instructions
