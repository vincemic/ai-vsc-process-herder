#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ProcessManager } from "./process-manager.js";
import { TaskManager } from "./task-manager.js";
import { ProjectDetector } from "./project-detector.js";
import { VSCodeIntegration } from "./vscode-integration.js";

/**
 * VS Code Process Herder MCP Server
 * 
 * Provides intelligent process management for VS Code development workflows.
 * This server acts as a bridge between AI assistants and VS Code's task system,
 * enabling standardized process management across development environments.
 */
class VSCodeProcessHerderServer {
  private server: McpServer;
  private processManager: ProcessManager;
  private taskManager: TaskManager;
  private projectDetector: ProjectDetector;
  private vscodeIntegration: VSCodeIntegration;

  constructor() {
    this.server = new McpServer({
      name: "vscode-process-herder",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    });

    // Initialize managers
    this.processManager = new ProcessManager();
    this.taskManager = new TaskManager();
    this.projectDetector = new ProjectDetector();
    this.vscodeIntegration = new VSCodeIntegration();

    this.setupTools();
    this.setupResources();
    this.setupPrompts();
  }

  private setupTools() {
    // Tool: List available VS Code tasks
    this.server.registerTool(
      "list-tasks",
      {
        title: "List VS Code Tasks",
        description: "List all available tasks from VS Code tasks.json configuration",
        inputSchema: {
          workspaceRoot: z.string().optional().describe("Path to workspace root (defaults to current directory)")
        }
      },
      async ({ workspaceRoot }) => {
        try {
          const tasks = await this.taskManager.listTasks(workspaceRoot);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                tasks: tasks.map(task => ({
                  label: task.label,
                  type: task.type,
                  command: task.command,
                  group: task.group,
                  description: task.detail || task.command,
                  isBackground: task.isBackground || false
                })),
                workspaceRoot: this.taskManager.getWorkspaceRoot()
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text", 
              text: `Error listing tasks: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // Tool: Start a specific task
    this.server.registerTool(
      "start-task",
      {
        title: "Start VS Code Task",
        description: "Start a specific VS Code task by name. Returns process information for monitoring.",
        inputSchema: {
          taskName: z.string().describe("Name/label of the task to start"),
          workspaceRoot: z.string().optional().describe("Path to workspace root (defaults to current directory)"),
          args: z.array(z.string()).optional().describe("Additional arguments to pass to the task")
        }
      },
      async ({ taskName, workspaceRoot, args = [] }) => {
        try {
          const result = await this.taskManager.startTask(taskName, workspaceRoot, args);
          
          // Register the process with our process manager
          this.processManager.registerProcess(result.processId, {
            name: taskName,
            command: result.command,
            args: result.args,
            cwd: result.cwd,
            startTime: new Date(),
            isTask: true
          });

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                processId: result.processId,
                taskName,
                command: result.command,
                args: result.args,
                cwd: result.cwd,
                message: `Task '${taskName}' started successfully`
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                taskName,
                error: error instanceof Error ? error.message : String(error)
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    );

    // Tool: Stop a running process
    this.server.registerTool(
      "stop-process",
      {
        title: "Stop Process",
        description: "Stop a running process by ID or name. Gracefully terminates the process.",
        inputSchema: {
          processId: z.number().optional().describe("Process ID to stop"),
          processName: z.string().optional().describe("Process name to stop (if processId not provided)"),
          force: z.boolean().optional().default(false).describe("Force kill the process if graceful shutdown fails")
        }
      },
      async ({ processId, processName, force = false }) => {
        try {
          if (!processId && !processName) {
            throw new Error("Either processId or processName must be provided");
          }

          let targetProcessId = processId;
          
          if (!targetProcessId && processName) {
            const processes = await this.processManager.listProcesses();
            const process = processes.find(p => 
              p.name === processName || 
              p.metadata?.name === processName
            );
            
            if (!process) {
              throw new Error(`Process with name '${processName}' not found`);
            }
            
            targetProcessId = process.pid;
          }

          if (!targetProcessId) {
            throw new Error("Could not determine process ID to stop");
          }

          const result = await this.processManager.stopProcess(targetProcessId, force);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                processId: targetProcessId,
                processName,
                force,
                message: result.message
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                processId,
                processName,
                error: error instanceof Error ? error.message : String(error)
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    );

    // Tool: Restart a process
    this.server.registerTool(
      "restart-process",
      {
        title: "Restart Process",
        description: "Restart a running process by stopping it and starting it again with the same configuration.",
        inputSchema: {
          processId: z.number().optional().describe("Process ID to restart"),
          processName: z.string().optional().describe("Process name to restart (if processId not provided)"),
          force: z.boolean().optional().default(false).describe("Force kill before restart if graceful shutdown fails")
        }
      },
      async ({ processId, processName, force = false }) => {
        try {
          if (!processId && !processName) {
            throw new Error("Either processId or processName must be provided");
          }

          const result = await this.processManager.restartProcess(processId, processName, force);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                oldProcessId: result.oldProcessId,
                newProcessId: result.newProcessId,
                processName: result.processName,
                message: result.message
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                processId,
                processName,
                error: error instanceof Error ? error.message : String(error)
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    );

    // Tool: List running processes
    this.server.registerTool(
      "list-processes",
      {
        title: "List Running Processes",
        description: "List all running processes managed by this server, including tasks and other development processes.",
        inputSchema: {
          includeSystem: z.boolean().optional().default(false).describe("Include system processes in the list"),
          filter: z.string().optional().describe("Filter processes by name or command (case-insensitive)")
        }
      },
      async ({ includeSystem = false, filter }) => {
        try {
          const processes = await this.processManager.listProcesses(includeSystem, filter);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                processes: processes.map(proc => ({
                  pid: proc.pid,
                  name: proc.name,
                  command: proc.cmd,
                  cpu: proc.cpu,
                  memory: proc.memory,
                  startTime: proc.metadata?.startTime,
                  isTask: proc.metadata?.isTask || false,
                  cwd: proc.metadata?.cwd
                })),
                totalCount: processes.length,
                managedCount: processes.filter(p => p.metadata).length
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error listing processes: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // Tool: Get detailed process status
    this.server.registerTool(
      "get-process-status",
      {
        title: "Get Process Status",
        description: "Get detailed status information for a specific process, including health metrics and logs.",
        inputSchema: {
          processId: z.number().optional().describe("Process ID to check"),
          processName: z.string().optional().describe("Process name to check (if processId not provided)")
        }
      },
      async ({ processId, processName }) => {
        try {
          if (!processId && !processName) {
            throw new Error("Either processId or processName must be provided");
          }

          const status = await this.processManager.getProcessStatus(processId, processName);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(status, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
                processId,
                processName
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    );

    // Tool: Detect project type and suggest tasks
    this.server.registerTool(
      "detect-project-type",
      {
        title: "Detect Project Type",
        description: "Analyze the current workspace to detect project type and suggest common development tasks.",
        inputSchema: {
          workspaceRoot: z.string().optional().describe("Path to workspace root (defaults to current directory)")
        }
      },
      async ({ workspaceRoot }) => {
        try {
          const detection = await this.projectDetector.detectProject(workspaceRoot);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                projectType: detection.type,
                frameworks: detection.frameworks,
                packageManagers: detection.packageManagers,
                suggestedTasks: detection.suggestedTasks,
                confidence: detection.confidence,
                workspaceRoot: detection.workspaceRoot,
                findings: detection.findings
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error detecting project type: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // Tool: Get VS Code integration status
    this.server.registerTool(
      "get-vscode-status",
      {
        title: "Get VS Code Status",
        description: "Check VS Code integration status and available workspaces.",
        inputSchema: {}
      },
      async () => {
        try {
          const status = await this.vscodeIntegration.getStatus();
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(status, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error getting VS Code status: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );
  }

  private setupResources() {
    // Resource: tasks.json content
    this.server.registerResource(
      "tasks-config",
      "file://.vscode/tasks.json",
      {
        title: "VS Code Tasks Configuration",
        description: "Current tasks.json configuration for the workspace"
      },
      async () => {
        try {
          const tasksContent = await this.taskManager.getTasksConfig();
          return {
            contents: [{
              uri: "file://.vscode/tasks.json",
              text: JSON.stringify(tasksContent, null, 2),
              mimeType: "application/json"
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: "file://.vscode/tasks.json",
              text: `Error reading tasks.json: ${error instanceof Error ? error.message : String(error)}`,
              mimeType: "text/plain"
            }]
          };
        }
      }
    );

    // Resource: Process logs
    this.server.registerResource(
      "process-logs",
      "logs://process-herder/all-processes",
      {
        title: "Process Logs",
        description: "Combined logs from all managed processes"
      },
      async () => {
        try {
          const logs = await this.processManager.getAllLogs();
          return {
            contents: [{
              uri: "logs://process-herder/all-processes",
              text: logs,
              mimeType: "text/plain"
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: "logs://process-herder/all-processes",
              text: `Error getting process logs: ${error instanceof Error ? error.message : String(error)}`,
              mimeType: "text/plain"
            }]
          };
        }
      }
    );
  }

  private setupPrompts() {
    // Prompt: Development workflow assistance
    this.server.registerPrompt(
      "dev-workflow-help",
      {
        title: "Development Workflow Helper",
        description: "Get help with common development workflow tasks and process management"
      },
      async () => {
        const detection = await this.projectDetector.detectProject();
        const tasks = await this.taskManager.listTasks().catch(() => []);
        const processes = await this.processManager.listProcesses().catch(() => []);

        return {
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: `I'm working on a ${detection.type} project with ${detection.frameworks.join(", ")} frameworks. 

Available tasks: ${tasks.map((t: any) => t.label).join(", ")}
Running processes: ${processes.length} (${processes.filter((p: any) => p.metadata).length} managed)

What development workflow tasks can you help me with? I need assistance with:
- Starting and stopping development servers
- Running tests and builds
- Managing multiple processes
- Monitoring process health

Please suggest the most relevant tasks for my project type and current state.`
            }
          }]
        };
      }
    );
  }

  async connect() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Setup cleanup handlers
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
    process.on('exit', () => this.cleanup());
  }

  private async cleanup() {
    console.error("Shutting down VS Code Process Herder...");
    await this.processManager.cleanup();
  }
}

// Start the server
async function main() {
  const server = new VSCodeProcessHerderServer();
  await server.connect();
  console.error("VS Code Process Herder MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});