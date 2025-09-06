# VS Code Process Herder MCP Server

A TypeScript-based MCP (Model Context Protocol) server that provides intelligent process management for VS Code development workflows. This server acts as a standardized interface for AI assistants like GitHub Copilot to manage development processes without confusion.

## 🚀 Features

- **VS Code Tasks Integration**: Read and execute tasks from `tasks.json`
- **Process Lifecycle Management**: Start, stop, restart, and monitor processes
- **Intelligent Process Detection**: Automatically detect common development scenarios
- **Status Monitoring**: Query running processes and their health
- **Project Type Detection**: Auto-detect project type and suggest relevant tasks
- **Multi-Project Support**: Handle multiple workspace configurations
- **Cross-Platform**: Works on Windows, macOS, and Linux

## 🛠 Installation

### Prerequisites

- Node.js 18 or higher
- VS Code (optional, but recommended)

### Install Dependencies

```bash
npm install
```

### Build the Project

```bash
npm run build
```

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

To use this server with GitHub Copilot or other AI assistants, you'll need to configure it as an MCP server in your AI assistant's settings.

## 🔧 Available Tools

### Process Management

1. **list-tasks**: List all available VS Code tasks from `tasks.json`
2. **start-task**: Start a specific task by name
3. **stop-process**: Stop a running process by ID or name
4. **restart-process**: Restart a process with the same configuration
5. **list-processes**: List all running processes managed by the server
6. **get-process-status**: Get detailed status information for a specific process

### Project Analysis

7. **detect-project-type**: Analyze workspace to detect project type and suggest tasks
8. **get-vscode-status**: Check VS Code integration status and workspaces

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

```bash
# Run tests (when implemented)
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## 📁 Project Structure

```
src/
├── index.ts              # Main MCP server implementation
├── process-manager.ts    # Process lifecycle management
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