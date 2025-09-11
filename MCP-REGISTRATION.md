# MCP Server Registration Guide

This document explains how to properly register the VS Code Process Herder MCP server with MCP clients.

## Server Information

- **Name**: vscode-process-herder
- **Version**: 1.1.1
- **Executable**: `node build/index.js`
- **Protocol**: Model Context Protocol (MCP)

## Registration Methods

### 1. Using npm package (Recommended)

If you've installed this package globally:

```bash
npm install -g vscode-process-herder-mcp
```

Then register with your MCP client using:

```json
{
  "servers": {
    "process-herder": {
      "command": "vscode-process-herder",
      "env": {
        "PROCESS_HERDER_SILENT_RECOVERY": "1"
      }
    }
  }
}
```

### 2. Using local build

For local development or if running from source:

```json
{
  "servers": {
    "process-herder": {
      "command": "node",
      "args": ["build/index.js"],
      "cwd": "/path/to/ai-vsc-process-herder",
      "env": {
        "PROCESS_HERDER_SILENT_RECOVERY": "1"
      }
    }
  }
}
```

### 3. Using absolute path

For Windows (adjust path as needed):

```json
{
  "mcpServers": {
    "vscode-process-herder": {
      "command": "node",
      "args": ["C:\\tmp\\ai-vsc-process-herder\\build\\index.js"],
      "env": {
        "PROCESS_HERDER_SILENT_RECOVERY": "1"
      },
      "description": "VS Code Process Herder - Intelligent process management for development workflows"
    }
  }
}
```

## Environment Variables

- `PROCESS_HERDER_SILENT_RECOVERY`: Set to "1" to enable silent recovery mode (recommended for production)

## Verification

After registration, you can verify the server is working by:

1. **Check version**: `node build/index.js --version`
2. **Check help**: `node build/index.js --help`
3. **Test connection**: Use your MCP client to connect and list available tools

## Common MCP Clients

### VS Code with Copilot
Add the configuration to your VS Code settings or workspace configuration.

### Claude Desktop
Add to your Claude Desktop configuration file.

### Custom MCP Client
Use the standard MCP protocol to connect to the server.

## Troubleshooting

1. **Server not starting**: Ensure Node.js is installed and the build directory exists
2. **Permission issues**: Check that the executable has proper permissions
3. **Path issues**: Use absolute paths if relative paths don't work
4. **Environment variables**: Ensure required environment variables are set

## Development

For development and testing:

```bash
# Build the project
npm run build

# Test the server
npm run mcp:run

# Show MCP configuration
npm run mcp:config

# Show installation instructions
npm run mcp:install
```

## Support

For issues related to MCP server registration, please check:
- The server builds correctly (`npm run build`)
- Node.js version compatibility (requires Node.js >= 18.0.0)
- MCP client documentation for specific registration requirements