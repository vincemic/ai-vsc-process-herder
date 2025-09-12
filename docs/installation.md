# Installation

## Global (NPM Registry)

```bash
npm install -g vscode-process-herder-mcp
```

Verify:

```bash
vscode-process-herder --help
```

## From GitHub Release Asset

Replace version with latest tag.

Windows PowerShell:

```powershell
Invoke-WebRequest -Uri "https://github.com/vincemic/ai-vsc-process-herder/releases/download/v1.2.0/vscode-process-herder-mcp-1.2.0.tgz" -OutFile vscode-process-herder-mcp-1.2.0.tgz
npm install -g ./vscode-process-herder-mcp-1.2.0.tgz
```

macOS/Linux:

```bash
curl -L -o vscode-process-herder-mcp-1.2.0.tgz \
  https://github.com/vincemic/ai-vsc-process-herder/releases/download/v1.2.0/vscode-process-herder-mcp-1.2.0.tgz
npm install -g ./vscode-process-herder-mcp-1.2.0.tgz
```

git clone https://github.com/vincemic/ai-vsc-process-herder.git
## From Source (Development)

```bash
git clone https://github.com/vincemic/ai-vsc-process-herder.git # repo: https://github.com/vincemic/ai-vsc-process-herder
cd ai-vsc-process-herder
npm install
npm run build
npm link # or: npm install -g .
```

## Building Local Tarball

```bash
npm pack
npm install -g ./vscode-process-herder-mcp-*.tgz
```

## Standalone Executables (Future / When Provided)

Download platform binary from Releases and place on PATH.

## Environment Variables

- `PROCESS_HERDER_SILENT_RECOVERY=1` reduce recovery chatter
- `PROCESS_HERDER_CRASH_GRACE_MS=5000` grace before classifying crash

## Update

```bash
npm update -g vscode-process-herder-mcp
```
