# VS Code Process Herder MCP v1.1.1 Release Notes

## 🔧 Critical Fix Release

This release fixes dependency issues that prevented global installation from GitHub repositories.

## 🐛 Fixed Issues

### Dependencies & Installation
- **Fixed TypeScript compilation errors during GitHub installation** - Moved TypeScript and @types packages to devDependencies
- **Fixed missing Node.js type definitions** - Properly configured @types/node as dev dependency  
- **Fixed prepare script causing build failures** - Changed to prepublishOnly for proper packaging
- **Fixed missing build files in Git repositories** - Build output now included in repository for Git-based installations

### Installation Methods

#### ✅ Working Installation Methods

1. **From Local Package** (Recommended):
```bash
# Download the .tgz file and install
npm install -g ./vscode-process-herder-mcp-1.1.1.tgz
```

2. **From Repository Clone**:
```bash
git clone https://github.com/vincemic/ai-vsc-process-herder.git
cd ai-vsc-process-herder
npm install && npm run build
npm pack
npm install -g ./vscode-process-herder-mcp-1.1.1.tgz
```

#### ⚠️ Known Issues

- **Windows Git Installation**: `npm install -g git+https://github.com/...` still has symlink issues on Windows (npm limitation)

## 📦 What's Included

- **NPM Package**: `vscode-process-herder-mcp-1.1.1.tgz` (116.8 kB)
- **Pre-compiled JavaScript**: Ready to run without TypeScript compilation
- **Complete MCP Server**: All 25+ tools for process management
- **Cross-platform Support**: Works on Windows, macOS, and Linux

## 🚀 Features

### Core Process Management
- Start, stop, restart, and monitor VS Code tasks and arbitrary processes
- Intelligent process classification (frontend, backend, test, e2e, utility)
- Singleton process management to prevent duplicates
- Advanced readiness probes (port, HTTP, log-based)

### Test Orchestration  
- Coordinated multi-process test runs
- Backend + frontend + test process coordination
- Test run lifecycle management and monitoring

### Enterprise Features
- Health monitoring and auto-recovery
- Comprehensive logging with search and filtering
- Performance metrics and analytics
- Diagnostic data export for troubleshooting

### VS Code Integration
- Native tasks.json parsing and execution
- Project type detection and task recommendations
- Workspace-aware process management

## 🔧 Usage

After installation, the server provides 25+ MCP tools accessible to AI assistants:

```bash
# Verify installation
vscode-process-herder --help

# Start the MCP server (typically called by MCP clients)
vscode-process-herder
```

## 📋 MCP Tools Available

### Task Management
- `list-tasks` - List all available VS Code tasks
- `start-task` - Start a specific VS Code task by name
- `detect-project-type` - Analyze workspace and suggest relevant tasks

### Process Management
- `start-process` - Start processes with advanced options (singleton, readiness probes)
- `stop-process` - Stop running processes gracefully  
- `restart-process` - Restart processes with same configuration
- `list-processes` - List all running managed processes
- `get-process-status` - Get detailed status for specific processes

### Test Orchestration
- `start-test-run` - Start coordinated multi-process test runs
- `get-test-run-status` - Check status of running test runs
- `list-test-runs` - List all known test runs
- `abort-test-run` - Abort running test runs

### Monitoring & Diagnostics
- `get-health-summary` - Get comprehensive health overview
- `get-process-logs` - Advanced log filtering and search
- `get-process-metrics` - Performance metrics and analytics
- `configure-recovery` - Set up automatic recovery strategies
- `export-diagnostics` - Export diagnostic data for troubleshooting
- `get-vscode-status` - Check VS Code integration status

## 🔗 Links

- **Repository**: https://github.com/vincemic/ai-vsc-process-herder
- **Documentation**: See README.md for detailed usage instructions
- **Issues**: Report bugs and feature requests on GitHub

## 📄 License

MIT License - see LICENSE file for details

---

**Installation Recommendation**: Download the `vscode-process-herder-mcp-1.1.1.tgz` file from this release and install with `npm install -g ./vscode-process-herder-mcp-1.1.1.tgz`