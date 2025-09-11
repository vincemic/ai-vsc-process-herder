# Installation Instructions for v1.1.1

## ✅ Working Installation Methods

Since we've fixed the dependency issues, here are the recommended ways to install the VS Code Process Herder MCP server globally:

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

3. Create and install the package:
```bash
npm pack
npm install -g ./vscode-process-herder-mcp-1.1.1.tgz
```

4. Verify installation:
```bash
vscode-process-herder --help
```

### Method 2: Direct from Release Asset (When Available)

Once GitHub releases are set up:
```bash
# Download the .tgz file from GitHub releases
npm install -g ./vscode-process-herder-mcp-1.1.1.tgz
```

## 🐛 Known Issues

- **Windows + Git Installation**: `npm install -g git+https://github.com/...` has symlink issues on Windows (npm limitation)
- **GitHub Actions**: Release workflow may need manual triggering

## ✅ What Was Fixed in v1.1.1

1. **Dependencies properly organized**: TypeScript and @types moved to devDependencies
2. **Build script fixed**: No longer tries to compile during Git installation  
3. **Build files included**: Pre-compiled JavaScript included in repository
4. **Package structure corrected**: All necessary files included in npm package

## 🚀 Ready to Use

The package is now properly configured for global installation and includes:
- 25+ MCP tools for process management
- VS Code tasks integration
- Process monitoring and health management
- Test orchestration capabilities
- Enterprise-grade reliability features

See README.md for complete usage documentation.