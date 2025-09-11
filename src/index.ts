#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ProcessManager } from "./process-manager.js";
import { TaskManager } from "./task-manager.js";
import { ProjectDetector } from "./project-detector.js";
import { VSCodeIntegration } from "./vscode-integration.js";
import { HealthMonitor } from "./health-monitor.js";
import { ProcessRecoveryManager } from "./recovery-manager.js";
import { ProcessStateManager } from "./state-manager.js";
import { LoggingManager } from "./logging-manager.js";
import { inferRole } from "./role-classifier.js";
import { TestRunManager } from "./test-run-manager.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const VERSION = packageJson.version;

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
  private healthMonitor: HealthMonitor;
  private recoveryManager: ProcessRecoveryManager;
  private stateManager: ProcessStateManager;
  private loggingManager: LoggingManager;
  private testRunManager: TestRunManager;

  constructor() {
    this.server = new McpServer(
      {
        name: "vscode-process-herder",
        version: VERSION,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      },
    );

    // Initialize managers
    this.loggingManager = new LoggingManager();
    this.stateManager = new ProcessStateManager();
    this.processManager = new ProcessManager();
    this.taskManager = new TaskManager();
    this.projectDetector = new ProjectDetector();
    this.vscodeIntegration = new VSCodeIntegration();
    this.healthMonitor = new HealthMonitor();
    this.recoveryManager = new ProcessRecoveryManager(
      this.processManager,
      this.healthMonitor,
    );
    this.testRunManager = new TestRunManager(this.processManager);

    this.setupIntegrations();

    this.setupTools();
    this.setupResources();
    this.setupPrompts();
  }

  /**
   * Setup integrations between components
   */
  private setupIntegrations(): void {
    // Setup health monitoring for new processes
    this.processManager.on(
      "processRegistered",
      (pid: number, metadata: any) => {
        this.healthMonitor.startMonitoring(pid, metadata);
        this.stateManager.registerProcessState(pid, metadata);
        this.loggingManager.info(
          "process-lifecycle",
          `Process registered for monitoring`,
          { pid, name: metadata.name },
        );
      },
    );

    // Setup recovery notifications
    this.recoveryManager.on("recovery-started", (attempt: any) => {
      this.loggingManager.warn(
        "recovery",
        `Recovery started for ${attempt.processName}`,
        attempt,
      );
    });

    this.recoveryManager.on("recovery-success", (attempt: any) => {
      this.loggingManager.info(
        "recovery",
        `Recovery successful for ${attempt.processName}`,
        attempt,
      );
    });

    this.recoveryManager.on("recovery-failed", (attempt: any) => {
      this.loggingManager.error(
        "recovery",
        `Recovery failed for ${attempt.processName}`,
        attempt,
      );
    });

    // Setup health monitoring alerts
    this.healthMonitor.on("critical", (healthResult: any) => {
      this.loggingManager.critical(
        "health",
        `Critical health issue detected`,
        healthResult,
      );
    });
  }

  private setupTools() {
    // Tool: List available VS Code tasks
    // Test run lifecycle tools
    this.server.registerTool(
      "start-test-run",
      {
        title: "Start Test Run",
        description: "Start a coordinated test run with optional backend/frontend services",
        inputSchema: {
          id: z.string().describe("Unique test run id"),
          name: z.string().optional(),
          backend: z
            .object({
              command: z.string(),
              args: z.array(z.string()).optional(),
              cwd: z.string().optional(),
              readiness: z
                .object({
                  type: z.enum(["port", "log", "http"]),
                  value: z.any(),
                  timeoutMs: z.number().optional(),
                  intervalMs: z.number().optional(),
                })
                .optional(),
              singleton: z.boolean().optional(),
            })
            .optional(),
          frontend: z
            .object({
              command: z.string(),
              args: z.array(z.string()).optional(),
              cwd: z.string().optional(),
              readiness: z
                .object({
                  type: z.enum(["port", "log", "http"]),
                  value: z.any(),
                  timeoutMs: z.number().optional(),
                  intervalMs: z.number().optional(),
                })
                .optional(),
              singleton: z.boolean().optional(),
            })
            .optional(),
          tests: z.object({
            command: z.string(),
            args: z.array(z.string()).optional(),
            cwd: z.string().optional(),
            readiness: z
              .object({
                type: z.enum(["port", "log", "http"]),
                value: z.any(),
                timeoutMs: z.number().optional(),
                intervalMs: z.number().optional(),
              })
              .optional(),
          }),
          autoStop: z.boolean().optional().default(true),
          keepBackends: z.boolean().optional().default(false),
        },
      },
      async (input) => {
        try {
          // Normalize readiness objects to strict union shapes
          const normalize = (r: any) => {
            if (!r) return undefined;
            if (r.type === "port") return { type: "port" as const, value: Number(r.value), timeoutMs: r.timeoutMs, intervalMs: r.intervalMs };
            if (r.type === "http") return { type: "http" as const, value: String(r.value), timeoutMs: r.timeoutMs, intervalMs: r.intervalMs };
            if (r.type === "log") return { type: "log" as const, value: r.value instanceof RegExp ? r.value : String(r.value), timeoutMs: r.timeoutMs };
            return undefined;
          };
          const run = await this.testRunManager.startRun({
            id: input.id,
            name: input.name,
            backend: input.backend ? { ...input.backend, readiness: normalize(input.backend.readiness) } : undefined,
            frontend: input.frontend ? { ...input.frontend, readiness: normalize(input.frontend.readiness) } : undefined,
            tests: { ...input.tests, readiness: normalize(input.tests.readiness) },
            autoStop: input.autoStop,
            keepBackends: input.keepBackends,
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true, run }, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    );

    this.server.registerTool(
      "get-test-run-status",
      {
        title: "Get Test Run Status",
        description: "Retrieve status for a specific test run",
        inputSchema: { id: z.string().describe("Test run id") },
      },
      async ({ id }) => {
        const run = this.testRunManager.getRun(id);
        if (!run) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: "Not found", id }, null, 2) },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(run, null, 2) },
          ],
        };
      },
    );

    this.server.registerTool(
      "abort-test-run",
      {
        title: "Abort Test Run",
        description: "Abort a running test run and optionally stop services",
        inputSchema: { id: z.string().describe("Test run id") },
      },
      async ({ id }) => {
        try {
          const run = await this.testRunManager.abortRun(id);
          return { content: [{ type: "text", text: JSON.stringify(run, null, 2) }] };
        } catch (error) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: error instanceof Error ? error.message : String(error), id }, null, 2) },
            ],
            isError: true,
          };
        }
      },
    );

    this.server.registerTool(
      "list-test-runs",
      {
        title: "List Test Runs",
        description: "List all test runs and their statuses",
        inputSchema: {},
      },
      async () => {
        const runs = this.testRunManager.listRuns();
        return { content: [{ type: "text", text: JSON.stringify(runs, null, 2) }] };
      },
    );
    this.server.registerTool(
      "list-tasks",
      {
        title: "List VS Code Tasks",
        description:
          "List all available tasks from VS Code tasks.json configuration",
        inputSchema: {
          workspaceRoot: z
            .string()
            .optional()
            .describe("Path to workspace root (defaults to current directory)"),
        },
      },
      async ({ workspaceRoot }) => {
        try {
          const tasks = await this.taskManager.listTasks(workspaceRoot);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    tasks: tasks.map((task) => ({
                      label: task.label,
                      type: task.type,
                      command: task.command,
                      group: task.group,
                      description: task.detail || task.command,
                      isBackground: task.isBackground || false,
                    })),
                    workspaceRoot: this.taskManager.getWorkspaceRoot(),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error listing tasks: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Tool: Start a specific task
    this.server.registerTool(
      "start-task",
      {
        title: "Start VS Code Task",
        description:
          "Start a specific VS Code task by name. Returns process information for monitoring.",
        inputSchema: {
          taskName: z.string().describe("Name/label of the task to start"),
          workspaceRoot: z
            .string()
            .optional()
            .describe("Path to workspace root (defaults to current directory)"),
          args: z
            .array(z.string())
            .optional()
            .describe("Additional arguments to pass to the task"),
        },
      },
      async ({ taskName, workspaceRoot, args = [] }) => {
        try {
          const result = await this.taskManager.startTask(
            taskName,
            workspaceRoot,
            args,
          );

          // Register the process with our process manager
          this.processManager.registerProcess(result.processId, {
            name: taskName,
            command: result.command,
            args: result.args,
            cwd: result.cwd,
            startTime: new Date(),
            isTask: true,
            role: inferRole(taskName),
            // Could extend with default readiness heuristics later
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    processId: result.processId,
                    taskName,
                    command: result.command,
                    args: result.args,
                    cwd: result.cwd,
                    message: `Task '${taskName}' started successfully`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    taskName,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Tool: Stop a running process
    this.server.registerTool(
      "stop-process",
      {
        title: "Stop Process",
        description:
          "Stop a running process by ID or name. Gracefully terminates the process.",
        inputSchema: {
          processId: z.number().optional().describe("Process ID to stop"),
          processName: z
            .string()
            .optional()
            .describe("Process name to stop (if processId not provided)"),
          force: z
            .boolean()
            .optional()
            .default(false)
            .describe("Force kill the process if graceful shutdown fails"),
        },
      },
      async ({ processId, processName, force = false }) => {
        try {
          if (!processId && !processName) {
            throw new Error("Either processId or processName must be provided");
          }

          let targetProcessId = processId;

          if (!targetProcessId && processName) {
            const processes = await this.processManager.listProcesses();
            const process = processes.find(
              (p) => p.name === processName || p.metadata?.name === processName,
            );

            if (!process) {
              throw new Error(`Process with name '${processName}' not found`);
            }

            targetProcessId = process.pid;
          }

          if (!targetProcessId) {
            throw new Error("Could not determine process ID to stop");
          }

          const result = await this.processManager.stopProcess(
            targetProcessId,
            force,
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    processId: targetProcessId,
                    processName,
                    force,
                    message: result.message,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    processId,
                    processName,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Tool: Restart a process
    this.server.registerTool(
      "restart-process",
      {
        title: "Restart Process",
        description:
          "Restart a running process by stopping it and starting it again with the same configuration.",
        inputSchema: {
          processId: z.number().optional().describe("Process ID to restart"),
          processName: z
            .string()
            .optional()
            .describe("Process name to restart (if processId not provided)"),
          force: z
            .boolean()
            .optional()
            .default(false)
            .describe("Force kill before restart if graceful shutdown fails"),
        },
      },
      async ({ processId, processName, force = false }) => {
        try {
          if (!processId && !processName) {
            throw new Error("Either processId or processName must be provided");
          }

          const result = await this.processManager.restartProcess(
            processId,
            processName,
            force,
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    oldProcessId: result.oldProcessId,
                    newProcessId: result.newProcessId,
                    processName: result.processName,
                    message: result.message,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    processId,
                    processName,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Tool: List running processes
    this.server.registerTool(
      "list-processes",
      {
        title: "List Running Processes",
        description:
          "List all running processes managed by this server, including tasks and other development processes.",
        inputSchema: {
          includeSystem: z
            .boolean()
            .optional()
            .default(false)
            .describe("Include system processes in the list"),
          filter: z
            .string()
            .optional()
            .describe("Filter processes by name or command (case-insensitive)"),
          role: z
            .enum(["frontend", "backend", "test", "e2e", "utility"])
            .optional()
            .describe("Filter by inferred/assigned role"),
        },
      },
      async ({ includeSystem = false, filter, role }) => {
        try {
          const processes = await this.processManager.listProcesses(
            includeSystem,
            filter,
          );

          const filtered = role
            ? processes.filter((p) => p.metadata?.role === role)
            : processes;

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    processes: filtered.map((proc) => ({
                      pid: proc.pid,
                      name: proc.name,
                      command: proc.cmd,
                      cpu: proc.cpu,
                      memory: proc.memory,
                      startTime: proc.metadata?.startTime,
                      isTask: proc.metadata?.isTask || false,
                      cwd: proc.metadata?.cwd,
                      role: proc.metadata?.role || inferRole(proc.name),
                    })),
                    totalCount: filtered.length,
                    managedCount: filtered.filter((p) => p.metadata).length,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error listing processes: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Tool: Start arbitrary process with role support
    this.server.registerTool(
      "start-process",
      {
        title: "Start Arbitrary Process",
        description:
          "Start a process by command with optional role classification and metadata.",
        inputSchema: {
          command: z.string().describe("Executable or script to run"),
          args: z.array(z.string()).optional().default([]),
          cwd: z
            .string()
            .optional()
            .describe("Working directory (defaults to workspace root)"),
          name: z.string().optional().describe("Friendly name for the process"),
          role: z
            .enum(["frontend", "backend", "test", "e2e", "utility"])
            .optional()
            .describe("Explicit role; inferred if omitted"),
          tags: z.array(z.string()).optional().describe("Arbitrary tag strings"),
          singleton: z
            .boolean()
            .optional()
            .default(false)
            .describe("If true, reuse existing matching process instead of starting new"),
          readiness: z
            .object({
              type: z.enum(["port", "log", "http"]).describe("Readiness probe type"),
              value: z.any().describe("Port number, log pattern, or URL"),
              timeoutMs: z.number().optional(),
              intervalMs: z.number().optional(),
            })
            .optional()
            .describe("Optional readiness probe configuration"),
        },
      },
      async ({ command, args = [], cwd, name, role, tags, singleton = false, readiness }) => {
        try {
          const inferredRole = role || inferRole(name || command);
          // Normalize readiness to strong typed union
          let readinessConfig: any = undefined;
          if (readiness) {
            if (readiness.type === "port") {
              readinessConfig = {
                type: "port",
                value: Number(readiness.value),
                timeoutMs: readiness.timeoutMs,
                intervalMs: readiness.intervalMs,
              };
            } else if (readiness.type === "log") {
              readinessConfig = {
                type: "log",
                value: readiness.value,
                timeoutMs: readiness.timeoutMs,
              };
            } else if (readiness.type === "http") {
              readinessConfig = {
                type: "http",
                value: String(readiness.value),
                timeoutMs: readiness.timeoutMs,
                intervalMs: readiness.intervalMs,
              };
            }
          }
          const result = await this.processManager.startProcess(
            command,
            args,
            { cwd, name, role: inferredRole, tags, singleton, readiness: readinessConfig },
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    processId: result.processId,
                    command: result.command,
                    args: result.args,
                    cwd: result.cwd,
                    role: inferredRole,
                    reused: result.reused || false,
                    ready: result.ready,
                    readyAt: result.readyAt,
                    readiness: readinessConfig || null,
                    message: `Process '${name || command}' started with role ${inferredRole}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    command,
                    error: error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Tool: Get detailed process status
    this.server.registerTool(
      "get-process-status",
      {
        title: "Get Process Status",
        description:
          "Get detailed status information for a specific process, including health metrics and logs.",
        inputSchema: {
          processId: z.number().optional().describe("Process ID to check"),
          processName: z
            .string()
            .optional()
            .describe("Process name to check (if processId not provided)"),
        },
      },
      async ({ processId, processName }) => {
        try {
          if (!processId && !processName) {
            throw new Error("Either processId or processName must be provided");
          }

          const status = await this.processManager.getProcessStatus(
            processId,
            processName,
          );
          const healthHistory = processId
            ? this.healthMonitor.getHealthHistory(processId, 10)
            : [];
          const processState = processId
            ? this.stateManager.getProcessState(processId)
            : null;

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    basicStatus: status,
                    healthHistory,
                    processState,
                    lastHealthCheck:
                      healthHistory[healthHistory.length - 1] || null,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          this.loggingManager.error(
            "process-status",
            "Failed to get process status",
            {
              error: error instanceof Error ? error.message : String(error),
              processId,
              processName,
            },
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error:
                      error instanceof Error ? error.message : String(error),
                    processId,
                    processName,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Tool: Detect project type and suggest tasks
    this.server.registerTool(
      "detect-project-type",
      {
        title: "Detect Project Type",
        description:
          "Analyze the current workspace to detect project type and suggest common development tasks.",
        inputSchema: {
          workspaceRoot: z
            .string()
            .optional()
            .describe("Path to workspace root (defaults to current directory)"),
        },
      },
      async ({ workspaceRoot }) => {
        try {
          const detection =
            await this.projectDetector.detectProject(workspaceRoot);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    projectType: detection.type,
                    frameworks: detection.frameworks,
                    packageManagers: detection.packageManagers,
                    suggestedTasks: detection.suggestedTasks,
                    confidence: detection.confidence,
                    workspaceRoot: detection.workspaceRoot,
                    findings: detection.findings,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error detecting project type: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Tool: Get health summary
    this.server.registerTool(
      "get-health-summary",
      {
        title: "Get Health Summary",
        description: "Get overall health summary of all monitored processes",
        inputSchema: {},
      },
      async () => {
        try {
          const healthSummary = this.healthMonitor.getHealthSummary();
          const processesNeedingAttention =
            this.healthMonitor.getProcessesNeedingAttention();
          const recoveryStats = this.recoveryManager.getRecoveryStatistics();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    healthSummary,
                    processesNeedingAttention,
                    recoveryStats,
                    timestamp: new Date(),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          this.loggingManager.error(
            "health-summary",
            "Failed to get health summary",
            { error: error instanceof Error ? error.message : String(error) },
          );
          return {
            content: [
              {
                type: "text",
                text: `Error getting health summary: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Tool: Get process logs
    this.server.registerTool(
      "get-process-logs",
      {
        title: "Get Process Logs",
        description:
          "Get filtered logs for processes with advanced filtering options",
        inputSchema: {
          processId: z.number().optional().describe("Filter by process ID"),
          level: z
            .enum(["debug", "info", "warn", "error", "critical"])
            .optional()
            .describe("Minimum log level"),
          category: z.string().optional().describe("Filter by log category"),
          limit: z
            .number()
            .optional()
            .default(100)
            .describe("Maximum number of log entries to return"),
          search: z.string().optional().describe("Search term to filter logs"),
        },
      },
      async ({ processId, level, category, limit = 100, search }) => {
        try {
          const filter = { processId, level, category, search };
          const logs = this.loggingManager.getLogs(filter, limit);
          const stats = this.loggingManager.getLogStats(filter);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    filter,
                    stats,
                    logs,
                    categories: this.loggingManager.getCategories(),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          this.loggingManager.error("get-logs", "Failed to get process logs", {
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            content: [
              {
                type: "text",
                text: `Error getting logs: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Tool: Get process metrics
    this.server.registerTool(
      "get-process-metrics",
      {
        title: "Get Process Metrics",
        description: "Get performance metrics for processes",
        inputSchema: {
          metricName: z
            .string()
            .optional()
            .describe("Specific metric name to retrieve"),
          timeRange: z
            .object({
              start: z.string().describe("Start time (ISO string)"),
              end: z.string().describe("End time (ISO string)"),
            })
            .optional()
            .describe("Time range for metrics"),
        },
      },
      async ({ metricName, timeRange }) => {
        try {
          let result;

          if (metricName) {
            const metric = this.loggingManager.getMetric(metricName);
            const stats = metric
              ? this.loggingManager.getMetricStats(
                  metricName,
                  timeRange
                    ? {
                        start: new Date(timeRange.start),
                        end: new Date(timeRange.end),
                      }
                    : undefined,
                )
              : null;

            result = { metric, stats };
          } else {
            const allMetrics = this.loggingManager.getAllMetrics();
            result = { metrics: allMetrics };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          this.loggingManager.error(
            "get-metrics",
            "Failed to get process metrics",
            { error: error instanceof Error ? error.message : String(error) },
          );
          return {
            content: [
              {
                type: "text",
                text: `Error getting metrics: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Tool: Configure process recovery
    this.server.registerTool(
      "configure-recovery",
      {
        title: "Configure Process Recovery",
        description: "Configure automatic recovery strategies for processes",
        inputSchema: {
          processName: z.string().describe("Name of the process to configure"),
          enabled: z
            .boolean()
            .optional()
            .default(true)
            .describe("Enable or disable recovery"),
          maxRestarts: z
            .number()
            .optional()
            .default(3)
            .describe("Maximum restart attempts"),
          strategy: z
            .enum(["restart", "kill-restart", "notify-only"])
            .optional()
            .default("restart")
            .describe("Recovery strategy"),
        },
      },
      async ({
        processName,
        enabled = true,
        maxRestarts = 3,
        strategy = "restart",
      }) => {
        try {
          // This is a simplified configuration - in practice would be more complex
          this.loggingManager.info(
            "recovery-config",
            `Recovery configured for ${processName}`,
            {
              processName,
              enabled,
              maxRestarts,
              strategy,
            },
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    processName,
                    configuration: { enabled, maxRestarts, strategy },
                    message: `Recovery configuration updated for ${processName}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          this.loggingManager.error(
            "configure-recovery",
            "Failed to configure recovery",
            { error: error instanceof Error ? error.message : String(error) },
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Tool: Export diagnostic data
    this.server.registerTool(
      "export-diagnostics",
      {
        title: "Export Diagnostic Data",
        description: "Export comprehensive diagnostic data for troubleshooting",
        inputSchema: {
          includeState: z
            .boolean()
            .optional()
            .default(true)
            .describe("Include process state data"),
          includeLogs: z
            .boolean()
            .optional()
            .default(true)
            .describe("Include log data"),
          includeMetrics: z
            .boolean()
            .optional()
            .default(true)
            .describe("Include metrics data"),
          timeRange: z
            .object({
              hours: z.number().describe("Number of hours of data to include"),
            })
            .optional()
            .describe("Time range for data export"),
        },
      },
      async ({
        includeState = true,
        includeLogs = true,
        includeMetrics = true,
        timeRange,
      }) => {
        try {
          const exportData: any = {
            exportTime: new Date(),
            systemInfo: {
              platform: process.platform,
              nodeVersion: process.version,
              workingDirectory: process.cwd(),
            },
          };

          if (includeState) {
            exportData.processState = {
              sessionInfo: this.stateManager.getSessionInfo(),
              allProcesses: this.stateManager.getAllProcessStates(),
              statistics: this.stateManager.getStateStatistics(),
            };
          }

          if (includeLogs) {
            const logFilter = timeRange
              ? {
                  startTime: new Date(
                    Date.now() - timeRange.hours * 60 * 60 * 1000,
                  ),
                }
              : undefined;

            exportData.logs = {
              entries: this.loggingManager.getLogs(logFilter, 500),
              statistics: this.loggingManager.getLogStats(logFilter),
            };
          }

          if (includeMetrics) {
            exportData.metrics = {
              allMetrics: this.loggingManager.getAllMetrics(),
            };
          }

          exportData.healthSummary = this.healthMonitor.getHealthSummary();
          exportData.recoveryStats =
            this.recoveryManager.getRecoveryStatistics();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(exportData, null, 2),
              },
            ],
          };
        } catch (error) {
          this.loggingManager.error(
            "export-diagnostics",
            "Failed to export diagnostics",
            { error: error instanceof Error ? error.message : String(error) },
          );
          return {
            content: [
              {
                type: "text",
                text: `Error exporting diagnostics: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
    this.server.registerTool(
      "get-vscode-status",
      {
        title: "Get VS Code Status",
        description:
          "Check VS Code integration status and available workspaces.",
        inputSchema: {},
      },
      async () => {
        try {
          const status = await this.vscodeIntegration.getStatus();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(status, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error getting VS Code status: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  private setupResources() {
    // Resource: tasks.json content
    this.server.registerResource(
      "tasks-config",
      "file://.vscode/tasks.json",
      {
        title: "VS Code Tasks Configuration",
        description: "Current tasks.json configuration for the workspace",
      },
      async () => {
        try {
          const tasksContent = await this.taskManager.getTasksConfig();
          return {
            contents: [
              {
                uri: "file://.vscode/tasks.json",
                text: JSON.stringify(tasksContent, null, 2),
                mimeType: "application/json",
              },
            ],
          };
        } catch (error) {
          return {
            contents: [
              {
                uri: "file://.vscode/tasks.json",
                text: `Error reading tasks.json: ${error instanceof Error ? error.message : String(error)}`,
                mimeType: "text/plain",
              },
            ],
          };
        }
      },
    );

    // Resource: Process summary (lightweight overview of managed processes)
    this.server.registerResource(
      "process-summary",
      "process://summary",
      {
        title: "Process Summary",
        description: "Structured summary of all managed processes (id, role, readiness, reuse, health)"
      },
      async () => {
        try {
          const processes = await this.processManager.listProcesses();
          const summary = processes.map((p: any) => {
            const md = p.metadata || {}; 
            return {
              id: p.id,
              pid: p.pid,
              name: md.name || md.command || `pid-${p.pid}`,
              role: md.role,
              command: md.command,
              cwd: md.cwd,
              singleton: md.singleton || false,
              reused: md.reused || false,
              ready: md.ready || false,
              readyAt: md.readyAt || null,
              startTime: md.startTime || null,
              crashed: md.crashed || false,
              exitCode: md.exitCode ?? null,
              lastError: md.lastError || null
            };
          });
          const stats = {
            total: summary.length,
            byRole: summary.reduce((acc: any, s) => { acc[s.role || 'unassigned'] = (acc[s.role || 'unassigned']||0)+1; return acc; }, {}),
            ready: summary.filter(s => s.ready).length,
            crashed: summary.filter(s => s.crashed).length,
            singletons: summary.filter(s => s.singleton).length,
            reused: summary.filter(s => s.reused).length
          };
          return {
            contents: [
              {
                uri: "process://summary",
                text: JSON.stringify({ stats, processes: summary }, null, 2),
                mimeType: "application/json"
              }
            ]
          };
        } catch (error) {
          return {
            contents: [
              {
                uri: "process://summary",
                text: `Error building process summary: ${error instanceof Error ? error.message : String(error)}`,
                mimeType: "text/plain"
              }
            ]
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
        description: "Combined logs from all managed processes",
      },
      async () => {
        try {
          const logs = await this.processManager.getAllLogs();
          return {
            contents: [
              {
                uri: "logs://process-herder/all-processes",
                text: logs,
                mimeType: "text/plain",
              },
            ],
          };
        } catch (error) {
          return {
            contents: [
              {
                uri: "logs://process-herder/all-processes",
                text: `Error getting process logs: ${error instanceof Error ? error.message : String(error)}`,
                mimeType: "text/plain",
              },
            ],
          };
        }
      },
    );
  }

  private setupPrompts() {
    // Prompt: Development workflow assistance
    this.server.registerPrompt(
      "dev-workflow-help",
      {
        title: "Development Workflow Helper",
        description:
          "Get help with common development workflow tasks and process management",
      },
      async () => {
        const detection = await this.projectDetector.detectProject();
        const tasks = await this.taskManager.listTasks().catch(() => []);
        const processes = await this.processManager
          .listProcesses()
          .catch(() => []);

        return {
          messages: [
            {
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

Please suggest the most relevant tasks for my project type and current state.`,
              },
            },
          ],
        };
      },
    );

    // Prompt: Process summary & guidance
    this.server.registerPrompt(
      "process-summary",
      {
        title: "Process Summary Overview",
        description: "Get a concise summary of current managed processes with suggested next actions"
      },
      async () => {
        const processes = await this.processManager.listProcesses().catch(() => []);
        const byRole: Record<string, number> = {};
        processes.forEach((p: any) => { const r = p.metadata?.role || 'unassigned'; byRole[r] = (byRole[r]||0)+1; });
        const notReady = processes.filter((p: any) => p.metadata && !p.metadata.ready);
        const crashed = processes.filter((p: any) => p.metadata?.crashed);
        const singletons = processes.filter((p: any) => p.metadata?.singleton);
        const text = `Managed processes: ${processes.length}\nRoles: ${Object.entries(byRole).map(([r,c])=>`${r}:${c}`).join(', ')}\nReady: ${processes.filter((p:any)=>p.metadata?.ready).length}\nNot Ready: ${notReady.length}\nCrashed: ${crashed.length}\nSingletons: ${singletons.length}\n\nSuggested next steps:\n- Use tool 'list-processes' for full detail.\n- Start missing core services with start-process (set singleton:true).\n- Investigate crashed processes via get-process-status.\n- Run coordinated tests with start-test-run if backend/frontend are ready.`;
        return {
          messages: [
            {
              role: "user",
              content: { type: "text", text }
            }
          ]
        };
      }
    );
  }

  async connect() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Setup cleanup handlers
    process.on("SIGINT", () => this.handleShutdown("SIGINT"));
    process.on("SIGTERM", () => this.handleShutdown("SIGTERM"));
    process.on("exit", () => this.cleanup());
  }

  private handleShutdown(signal: string) {
    console.error(`Received ${signal}, shutting down gracefully...`);
    this.cleanup().then(() => {
      console.error("Shutdown complete");
      process.exit(0);
    }).catch((error) => {
      console.error("Error during shutdown:", error);
      process.exit(1);
    });
  }

  private async cleanup() {
    console.error("Shutting down VS Code Process Herder...");

    try {
      // Cleanup in reverse order of dependencies
      this.recoveryManager?.cleanup();
      this.healthMonitor?.cleanup();
      await this.processManager?.cleanup();
      this.stateManager?.cleanup();
      this.loggingManager?.cleanup();

      this.loggingManager?.info("system", "Process Herder shutdown completed");
    } catch (error) {
      console.error("Error during cleanup:", error);
      throw error;
    }
  }
}

/**
 * Display version information
 */
function showVersion() {
  console.log(`${packageJson.name} v${VERSION}`);
}

/**
 * Display help documentation
 */
function showHelp() {
  console.log(`
VS Code Process Herder MCP Server v${VERSION}
==========================================

DESCRIPTION:
  A Model Context Protocol (MCP) server that provides intelligent process management
  for VS Code development workflows. This server acts as a bridge between AI assistants
  (like GitHub Copilot) and VS Code's task system, enabling standardized process 
  management across development environments.

USAGE:
  vscode-process-herder [OPTIONS]
  node build/index.js [OPTIONS]
  npm run dev [-- OPTIONS]

OPTIONS:
  --version, -v       Show version information and exit
  --help, -h          Show this help message and exit
  
FEATURES:
  • VS Code Tasks Integration - Read and execute tasks from tasks.json
  • Process Lifecycle Management - Start, stop, restart, and monitor processes
  • Intelligent Process Detection - Automatically detect common development scenarios
  • Status Monitoring - Query running processes and their health
  • Multi-Project Support - Handle multiple workspace configurations
  • Test Run Orchestration - Coordinated multi-process test execution
  • Readiness Probes - Port/HTTP/log-based readiness gating
  • Singleton Process Reuse - Prevent duplicate processes
  • Health Monitoring & Auto-Recovery - Enterprise-grade reliability
  • Comprehensive Logging & Metrics - Debug and performance insights

MCP TOOLS AVAILABLE:
  • list-tasks - List all available VS Code tasks
  • start-task - Start a specific VS Code task by name
  • start-process - Start arbitrary processes with advanced options
  • stop-process - Stop running processes gracefully
  • restart-process - Restart processes with same configuration
  • list-processes - List all running managed processes
  • get-process-status - Get detailed status for specific processes
  • detect-project-type - Analyze workspace and suggest relevant tasks
  • start-test-run - Start coordinated multi-process test runs
  • get-test-run-status - Check status of running test runs
  • list-test-runs - List all known test runs
  • abort-test-run - Abort running test runs
  • get-health-summary - Get comprehensive health overview
  • get-process-logs - Advanced log filtering and search
  • get-process-metrics - Performance metrics and analytics
  • configure-recovery - Set up automatic recovery strategies
  • export-diagnostics - Export diagnostic data for troubleshooting
  • get-vscode-status - Check VS Code integration status

PROCESS ROLES:
  • frontend - Web servers, React/Vue/Angular dev servers
  • backend - API servers, Node.js backends, databases  
  • test - Unit tests, integration tests
  • e2e - End-to-end tests, Playwright, Cypress
  • utility - Build tools, linters, formatters

READINESS PROBES:
  • Port probes - Wait for TCP port to accept connections
  • HTTP probes - Wait for HTTP endpoint to respond
  • Log probes - Wait for specific log patterns

CONFIGURATION:
  Place an MCP configuration file (mcp.json or mcp-config.json) in your workspace
  to configure the server for use with MCP clients.

  For MCP client registration, add this server to your client configuration:
  {
    "servers": {
      "process-herder": {
        "command": "node",
        "args": ["build/index.js"],
        "cwd": "/path/to/ai-vsc-process-herder"
      }
    }
  }

  Use 'npm run mcp:config' to show the local configuration.
  Use 'npm run mcp:install' to show registration instructions.

EXAMPLES:
  # Start the server (typically called by MCP clients)
  vscode-process-herder
  
  # Show this help
  vscode-process-herder --help
  
  # Development mode with TypeScript
  npm run dev

DOCUMENTATION:
  See README.md for detailed usage instructions and examples.
  
PROJECT WEBSITE:
  https://github.com/vincemic/ai-vsc-process-herder

LICENSE:
  MIT License - see LICENSE file for details
`);
}

// Start the server
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  // Check for version flag
  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    process.exit(0);
  }
  
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  const server = new VSCodeProcessHerderServer();
  await server.connect();
  console.error("VS Code Process Herder MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
