# Installation Instructions for v1.2.0

## ✅ Working Installation Methods

The package has stabilized further in v1.2.0 (reliability + health tooling). These are the recommended ways to install the VS Code Process Herder MCP server globally:

### Method 1: Local Package Installation (Recommended)

1. Download or clone this repository:
```bash
git clone https://github.com/vincemic/ai-vsc-process-herder.git
cd ai-vsc-process-herder
```

2. Install dependencies and build:
```bash
npm install
npm run build
```

3. Create and install the package (this produces a file like `vscode-process-herder-mcp-1.2.0.tgz`):

```bash
npm pack
npm install -g ./vscode-process-herder-mcp-1.2.0.tgz
```

4. Verify installation:
```bash
vscode-process-herder --help
```

### Method 2: Direct from GitHub Release Asset

Download the tarball from the latest GitHub Release (Assets section) and install globally. Example (PowerShell):

```powershell
Invoke-WebRequest -Uri "https://github.com/vincemic/ai-vsc-process-herder/releases/download/v1.2.0/vscode-process-herder-mcp-1.2.0.tgz" -OutFile vscode-process-herder-mcp-1.2.0.tgz
npm install -g ./vscode-process-herder-mcp-1.2.0.tgz
```

macOS/Linux (curl):

```bash
curl -L -o vscode-process-herder-mcp-1.2.0.tgz \
  https://github.com/vincemic/ai-vsc-process-herder/releases/download/v1.2.0/vscode-process-herder-mcp-1.2.0.tgz
npm install -g ./vscode-process-herder-mcp-1.2.0.tgz
```

Replace `1.2.0` with a newer version as they are released.

## 🐛 Known Issues / Notes

- Windows Git URL installs (`npm install -g git+https://...`) may still have symlink quirks; prefer the published package or release tarball.
- Standalone executables (added in later releases) can be used if Node.js is not desired; see README for details.

## ✅ Improvements Since v1.1.1

Changes in v1.2.0 relevant to installation & usage:

1. **Reliability Enhancements**: Health monitoring & recovery tooling improvements (no extra steps required for install)
2. **Process Metrics & Port Tracking**: Additional runtime observability (bundled in build output)
3. **Documentation Updates**: Clarified global install paths & multi-platform examples
4. **Stabilization**: Internal refactors reduce cold start overhead; no change to install commands

## 🚀 Ready to Use

The package is properly configured for global installation and includes:

- 25+ MCP tools for process & test orchestration
- VS Code tasks integration
- Process monitoring and health management
- Test orchestration capabilities
- Enterprise-grade reliability features

See README.md for complete usage documentation.
