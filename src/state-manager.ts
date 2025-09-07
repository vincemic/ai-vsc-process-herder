import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ProcessMetadata } from "./process-manager.js";

export interface ProcessState {
  pid: number;
  metadata: ProcessMetadata;
  startTime: Date;
  environment: Record<string, string>;
  workingDirectory: string;
  commandLine: string[];
  ports: number[];
  dependencies: string[];
  status: "running" | "stopped" | "crashed" | "restarting";
  lastSeen: Date;
  sessionId: string;
}

export interface SessionData {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  processes: ProcessState[];
  workspace: string;
  version: string;
}

export interface ProcessSnapshot {
  timestamp: Date;
  processes: ProcessState[];
  systemInfo: SystemInfo;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  memory: {
    total: number;
    free: number;
    used: number;
  };
  cpu: {
    cores: number;
    model: string;
  };
}

/**
 * Manages persistent state for processes across restarts and crashes
 */
export class ProcessStateManager {
  private stateFile: string;
  private snapshotDir: string;
  private currentSession: SessionData;
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor(workspaceRoot?: string) {
    const root = workspaceRoot || process.cwd();
    const stateDir = path.join(root, ".vscode", "process-herder");

    // Ensure state directory exists
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    this.stateFile = path.join(stateDir, "process-state.json");
    this.snapshotDir = path.join(stateDir, "snapshots");

    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true });
    }

    this.currentSession = this.createNewSession(root);
    this.loadPreviousState();
    this.startAutoSave();

    // Setup cleanup handlers
    process.on("exit", () => this.saveStateSync());
    process.on("SIGINT", () => this.saveStateSync());
    process.on("SIGTERM", () => this.saveStateSync());
  }

  /**
   * Create a new session
   */
  private createNewSession(workspace: string): SessionData {
    return {
      sessionId: this.generateSessionId(),
      startTime: new Date(),
      processes: [],
      workspace,
      version: "1.0.0",
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load previous state from disk
   */
  private loadPreviousState(): void {
    if (!fs.existsSync(this.stateFile)) {
      return;
    }

    try {
      const stateData = fs.readFileSync(this.stateFile, "utf8");
      const previousSession: SessionData = JSON.parse(stateData);

      // Process recovery logic - check if any processes should be restored
      const recoverableProcesses = previousSession.processes.filter(
        (p) =>
          p.status === "running" &&
          p.metadata.isTask &&
          Date.now() - new Date(p.lastSeen).getTime() < 300000, // 5 minutes
      );

      if (recoverableProcesses.length > 0) {
        console.error(
          `Found ${recoverableProcesses.length} recoverable processes from previous session`,
        );
        this.recoverProcesses(recoverableProcesses);
      }

      // Create snapshot of previous session
      this.createSnapshot(previousSession);
    } catch (error) {
      console.error("Failed to load previous process state:", error);
    }
  }

  /**
   * Recover processes from previous session
   */
  private async recoverProcesses(processes: ProcessState[]): Promise<void> {
    for (const processState of processes) {
      try {
        // Check if process is still running
        const isStillRunning = await this.isProcessRunning(processState.pid);

        if (isStillRunning) {
          // Process survived the restart - re-register it
          this.registerProcessState(processState.pid, processState.metadata);
          console.error(
            `Recovered running process: ${processState.metadata.name} (PID: ${processState.pid})`,
          );
        } else if (processState.metadata.isTask) {
          // Process crashed - mark for potential restart
          console.error(
            `Process crashed: ${processState.metadata.name}, marked for recovery`,
          );
          this.markProcessForRecovery(processState);
        }
      } catch (error) {
        console.error(
          `Failed to recover process ${processState.metadata.name}:`,
          error,
        );
      }
    }
  }

  /**
   * Check if a process is still running
   */
  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0); // Signal 0 checks if process exists
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Mark process for recovery
   */
  private markProcessForRecovery(processState: ProcessState): void {
    // This could integrate with the recovery manager
    // For now, just emit an event or log
    console.error(`Process ${processState.metadata.name} marked for recovery`);
  }

  /**
   * Register a new process state
   */
  registerProcessState(pid: number, metadata: ProcessMetadata): void {
    const processState: ProcessState = {
      pid,
      metadata,
      startTime: new Date(),
      environment: this.captureEnvironment(),
      workingDirectory: metadata.cwd || process.cwd(),
      commandLine: [metadata.command, ...metadata.args],
      ports: this.detectPorts(metadata),
      dependencies: this.detectDependencies(metadata),
      status: "running",
      lastSeen: new Date(),
      sessionId: this.currentSession.sessionId,
    };

    // Remove any existing state for this PID
    this.currentSession.processes = this.currentSession.processes.filter(
      (p) => p.pid !== pid,
    );

    // Add new state
    this.currentSession.processes.push(processState);

    this.saveState();
  }

  /**
   * Update process state
   */
  updateProcessState(pid: number, updates: Partial<ProcessState>): void {
    const processIndex = this.currentSession.processes.findIndex(
      (p) => p.pid === pid,
    );

    if (processIndex >= 0) {
      this.currentSession.processes[processIndex] = {
        ...this.currentSession.processes[processIndex],
        ...updates,
        lastSeen: new Date(),
      };

      this.saveState();
    }
  }

  /**
   * Mark process as stopped
   */
  markProcessStopped(pid: number): void {
    this.updateProcessState(pid, { status: "stopped" });
  }

  /**
   * Mark process as crashed
   */
  markProcessCrashed(pid: number): void {
    this.updateProcessState(pid, { status: "crashed" });
  }

  /**
   * Get process state
   */
  getProcessState(pid: number): ProcessState | null {
    return this.currentSession.processes.find((p) => p.pid === pid) || null;
  }

  /**
   * Get all process states
   */
  getAllProcessStates(): ProcessState[] {
    return [...this.currentSession.processes];
  }

  /**
   * Get processes by status
   */
  getProcessesByStatus(status: ProcessState["status"]): ProcessState[] {
    return this.currentSession.processes.filter((p) => p.status === status);
  }

  /**
   * Get session information
   */
  getSessionInfo(): SessionData {
    return { ...this.currentSession };
  }

  /**
   * Capture current environment variables
   */
  private captureEnvironment(): Record<string, string> {
    // Capture relevant environment variables
    const relevantVars = [
      "NODE_ENV",
      "PATH",
      "HOME",
      "USER",
      "WORKSPACE",
      "PORT",
      "HOST",
      "DATABASE_URL",
      "API_KEY",
    ];

    const env: Record<string, string> = {};
    for (const varName of relevantVars) {
      if (process.env[varName]) {
        env[varName] = process.env[varName]!;
      }
    }

    return env;
  }

  /**
   * Detect ports used by process
   */
  private detectPorts(metadata: ProcessMetadata): number[] {
    const ports: number[] = [];

    // Look for port numbers in command arguments
    const portRegex = /(?:--port|--PORT|-p)\s+(\d+)/g;
    const commandString = [metadata.command, ...metadata.args].join(" ");

    let match;
    while ((match = portRegex.exec(commandString)) !== null) {
      const port = parseInt(match[1], 10);
      if (port > 0 && port < 65536) {
        ports.push(port);
      }
    }

    // Also check for common development ports
    const commonPorts = [3000, 8000, 8080, 5000, 4200, 3001];
    for (const port of commonPorts) {
      if (commandString.includes(port.toString()) && !ports.includes(port)) {
        ports.push(port);
      }
    }

    return ports;
  }

  /**
   * Detect process dependencies
   */
  private detectDependencies(metadata: ProcessMetadata): string[] {
    const dependencies: string[] = [];

    // Detect based on command
    if (metadata.command.includes("npm") || metadata.command.includes("yarn")) {
      dependencies.push("node_modules");
    }

    if (
      metadata.command.includes("python") ||
      metadata.command.includes("pip")
    ) {
      dependencies.push("python-env");
    }

    // Check for config files
    const configFiles = [
      "package.json",
      "requirements.txt",
      "Cargo.toml",
      "go.mod",
    ];
    for (const file of configFiles) {
      if (fs.existsSync(path.join(metadata.cwd || process.cwd(), file))) {
        dependencies.push(file);
      }
    }

    return dependencies;
  }

  /**
   * Create a snapshot of current state
   */
  createSnapshot(sessionData?: SessionData): void {
    const snapshot: ProcessSnapshot = {
      timestamp: new Date(),
      processes: sessionData?.processes || this.currentSession.processes,
      systemInfo: this.getSystemInfo(),
    };

    const snapshotFile = path.join(
      this.snapshotDir,
      `snapshot-${snapshot.timestamp.toISOString().replace(/[:.]/g, "-")}.json`,
    );

    try {
      fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));

      // Clean up old snapshots (keep last 10)
      this.cleanupOldSnapshots();
    } catch (error) {
      console.error("Failed to create snapshot:", error);
    }
  }

  /**
   * Get system information
   */
  private getSystemInfo(): SystemInfo {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || "Unknown",
      },
    };
  }

  /**
   * Clean up old snapshots
   */
  private cleanupOldSnapshots(): void {
    try {
      const files = fs
        .readdirSync(this.snapshotDir)
        .filter(
          (file) => file.startsWith("snapshot-") && file.endsWith(".json"),
        )
        .map((file) => ({
          name: file,
          path: path.join(this.snapshotDir, file),
          mtime: fs.statSync(path.join(this.snapshotDir, file)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the 10 most recent snapshots
      const filesToDelete = files.slice(10);

      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    } catch (error) {
      console.error("Failed to cleanup old snapshots:", error);
    }
  }

  /**
   * Get available snapshots
   */
  getAvailableSnapshots(): {
    filename: string;
    timestamp: Date;
    processCount: number;
  }[] {
    try {
      const files = fs
        .readdirSync(this.snapshotDir)
        .filter(
          (file) => file.startsWith("snapshot-") && file.endsWith(".json"),
        );

      return files
        .map((file) => {
          try {
            const filePath = path.join(this.snapshotDir, file);
            const snapshot: ProcessSnapshot = JSON.parse(
              fs.readFileSync(filePath, "utf8"),
            );

            return {
              filename: file,
              timestamp: new Date(snapshot.timestamp),
              processCount: snapshot.processes.length,
            };
          } catch (error) {
            return null;
          }
        })
        .filter(Boolean) as {
        filename: string;
        timestamp: Date;
        processCount: number;
      }[];
    } catch (error) {
      return [];
    }
  }

  /**
   * Load snapshot
   */
  loadSnapshot(filename: string): ProcessSnapshot | null {
    try {
      const filePath = path.join(this.snapshotDir, filename);
      const snapshotData = fs.readFileSync(filePath, "utf8");
      return JSON.parse(snapshotData);
    } catch (error) {
      return null;
    }
  }

  /**
   * Save current state to disk
   */
  private saveState(): void {
    this.currentSession.endTime = new Date();

    try {
      fs.writeFileSync(
        this.stateFile,
        JSON.stringify(this.currentSession, null, 2),
      );
    } catch (error) {
      console.error("Failed to save process state:", error);
    }
  }

  /**
   * Save state synchronously (for cleanup handlers)
   */
  private saveStateSync(): void {
    this.saveState();

    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    // Auto-save every 30 seconds
    this.autoSaveInterval = setInterval(() => {
      this.saveState();
    }, 30000);
  }

  /**
   * Export state data
   */
  exportState(): string {
    return JSON.stringify(
      {
        session: this.currentSession,
        snapshots: this.getAvailableSnapshots(),
        exportTime: new Date(),
      },
      null,
      2,
    );
  }

  /**
   * Import state data
   */
  importState(stateData: string): boolean {
    try {
      const data = JSON.parse(stateData);

      if (data.session) {
        this.currentSession = data.session;
        this.saveState();
        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to import state:", error);
      return false;
    }
  }

  /**
   * Clear all state data
   */
  clearState(): void {
    this.currentSession = this.createNewSession(this.currentSession.workspace);
    this.saveState();

    // Clean up snapshots
    try {
      const files = fs.readdirSync(this.snapshotDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.snapshotDir, file));
      }
    } catch (error) {
      console.error("Failed to clear snapshots:", error);
    }
  }

  /**
   * Get state statistics
   */
  getStateStatistics(): {
    sessionDuration: number;
    totalProcesses: number;
    runningProcesses: number;
    crashedProcesses: number;
    stoppedProcesses: number;
    snapshotCount: number;
    lastSave: Date;
  } {
    const now = new Date();
    const sessionDuration =
      now.getTime() - this.currentSession.startTime.getTime();

    return {
      sessionDuration,
      totalProcesses: this.currentSession.processes.length,
      runningProcesses: this.getProcessesByStatus("running").length,
      crashedProcesses: this.getProcessesByStatus("crashed").length,
      stoppedProcesses: this.getProcessesByStatus("stopped").length,
      snapshotCount: this.getAvailableSnapshots().length,
      lastSave: this.currentSession.endTime || this.currentSession.startTime,
    };
  }

  /**
   * Cleanup state manager
   */
  cleanup(): void {
    this.saveStateSync();
  }
}
