import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as net from "net";
import * as http from "http";
import * as https from "https";
import kill from "tree-kill";
import { promisify } from "util";
import psList from "ps-list";
import { EventEmitter } from "events";

const killAsync = promisify(kill);

export interface ProcessInfo {
  pid: number;
  name: string;
  cmd: string;
  cpu: number;
  memory: number;
  metadata?: ProcessMetadata;
}

export interface ProcessMetadata {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  startTime: Date;
  isTask?: boolean;
  logs?: string[];
  lastError?: string;
  role?: ProcessRole;
  tags?: string[];
  readiness?: ReadinessConfig;
  ready?: boolean;
  readyAt?: Date;
  reattached?: boolean;
  ports?: number[]; // tracked listening ports (best-effort)
}

export interface ProcessStatus {
  pid: number;
  name: string;
  isRunning: boolean;
  startTime?: Date;
  uptime?: number;
  cpu?: number;
  memory?: number;
  command?: string;
  args?: string[];
  cwd?: string;
  logs?: string[];
  isTask?: boolean;
  lastError?: string;
  role?: ProcessRole;
  ready?: boolean;
  readyAt?: Date;
  reattached?: boolean;
  ports?: number[];
}

export type ProcessRole =
  | "frontend"
  | "backend"
  | "test"
  | "e2e"
  | "utility";

export type ReadinessConfig =
  | { type: "port"; value: number; timeoutMs?: number; intervalMs?: number }
  | { type: "log"; value: string | RegExp; timeoutMs?: number }
  | { type: "http"; value: string; timeoutMs?: number; intervalMs?: number };

/**
 * Manages process lifecycle and monitoring for VS Code development workflows
 */
export class ProcessManager extends EventEmitter {
  private managedProcesses = new Map<number, ProcessMetadata>();
  private processLogs = new Map<number, string[]>();
  private childProcesses = new Map<number, ChildProcess>();
  private singletonIndex = new Map<string, number>();
  private stateDir = path.join(process.cwd(), ".process-herder");
  private stateFile = path.join(this.stateDir, "processes.json");
  private persistTimer?: NodeJS.Timeout;
  private shuttingDownProcesses = new Set<number>();
  private globalShutdown = false;

  constructor() {
    super();
    // Clean up orphaned processes on startup
    this.cleanupOrphanedProcesses();
    this.loadState().catch((e) => console.error("Process state load failed", e));
  }

  /**
   * Find managed processes that are using (or believed to be using) a given port
   */
  findProcessesByPort(port: number): { pid: number; metadata: ProcessMetadata }[] {
    const results: { pid: number; metadata: ProcessMetadata }[] = [];
    for (const [pid, meta] of this.managedProcesses.entries()) {
      if (meta.ports && meta.ports.includes(port)) {
        results.push({ pid, metadata: meta });
      }
    }
    return results;
  }

  /**
   * Return a map of port -> processes (pids) for quick inspection
   */
  listAllPorts(): { port: number; pids: number[] }[] {
    const map = new Map<number, number[]>();
    for (const [pid, meta] of this.managedProcesses.entries()) {
      if (meta.ports) {
        for (const p of meta.ports) {
          if (!map.has(p)) map.set(p, []);
          map.get(p)!.push(pid);
        }
      }
    }
    return Array.from(map.entries())
      .map(([port, pids]) => ({ port, pids: pids.sort((a,b)=>a-b) }))
      .sort((a,b) => a.port - b.port);
  }

  /**
   * Check whether a TCP port is open (listening) on a host.
   * Returns true on successful connection, false on timeout/refusal.
   */
  async checkPortOpen(port: number, host = '127.0.0.1', timeoutMs = 2000): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ port, host });
      let finished = false;
      const finish = (result: boolean) => { if (finished) return; finished = true; try { socket.destroy(); } catch { /* ignore */ } resolve(result); };
      const timer = setTimeout(() => finish(false), timeoutMs);
      socket.on('connect', () => { clearTimeout(timer); finish(true); });
      socket.on('error', () => { clearTimeout(timer); finish(false); });
    });
  }

  /**
   * Register a process for management and monitoring
   */
  registerProcess(pid: number, metadata: ProcessMetadata): void {
    this.managedProcesses.set(pid, metadata);
    this.processLogs.set(pid, []);

    // Log the registration
    this.addLog(
      pid,
      `Process registered: ${metadata.name} (${metadata.command})`,
    );

    // Emit event for integration
    this.emit("processRegistered", pid, metadata);
    this.schedulePersist();
  }

  /**
   * Register a child process for direct management
   */
  registerChildProcess(
    childProcess: ChildProcess,
    metadata: ProcessMetadata,
  ): void {
    if (!childProcess.pid) {
      throw new Error("Child process has no PID");
    }

    this.childProcesses.set(childProcess.pid, childProcess);
    this.registerProcess(childProcess.pid, metadata);

    // Setup logging
    if (childProcess.stdout) {
      childProcess.stdout.on("data", (data: Buffer) => {
        this.addLog(childProcess.pid!, `[STDOUT] ${data.toString().trim()}`);
      });
    }

    if (childProcess.stderr) {
      childProcess.stderr.on("data", (data: Buffer) => {
        this.addLog(childProcess.pid!, `[STDERR] ${data.toString().trim()}`);
      });
    }

    // Handle process exit
    childProcess.on("exit", (code: number | null, signal: string | null) => {
      this.addLog(
        childProcess.pid!,
        `Process exited with code ${code}, signal ${signal}`,
      );
      this.unregisterProcess(childProcess.pid!);
    });

    childProcess.on("error", (error: Error) => {
      this.addLog(childProcess.pid!, `[ERROR] ${error.message}`);
      const metadata = this.managedProcesses.get(childProcess.pid!);
      if (metadata) {
        metadata.lastError = error.message;
      }
    });
  }

  /**
   * Unregister a process from management
   */
  unregisterProcess(pid: number): void {
    const wasShuttingDown = this.shuttingDownProcesses.has(pid);
    const metadata = this.managedProcesses.get(pid);
    
    this.managedProcesses.delete(pid);
    this.childProcesses.delete(pid);
    this.shuttingDownProcesses.delete(pid);
    
    // Remove from singleton index if present
    for (const [sig, storedPid] of this.singletonIndex.entries()) {
      if (storedPid === pid) {
        this.singletonIndex.delete(sig);
      }
    }
    
    // Emit events for health monitor and recovery manager
    if (wasShuttingDown || this.globalShutdown) {
      this.emit("processShutdownIntentional", pid, metadata);
    } else {
      this.emit("processUnregistered", pid, metadata);
    }
    
    // Keep logs for a while for debugging
    setTimeout(() => this.processLogs.delete(pid), 60000); // 1 minute
    this.schedulePersist();
  }

  /**
   * Start a new process with the given command and arguments
   */
  async startProcess(
    command: string,
    args: string[] = [],
    options: {
      cwd?: string;
      name?: string;
      isTask?: boolean;
      role?: ProcessRole;
      tags?: string[];
      singleton?: boolean;
      readiness?: ReadinessConfig;
    } = {},
  ): Promise<{
    processId: number;
    command: string;
    args: string[];
    cwd: string;
    role?: ProcessRole;
    ready?: boolean;
    readyAt?: Date;
    reused?: boolean;
  }> {
    const cwd = options.cwd || process.cwd();
    const name = options.name || command;

    // Singleton signature
    const signature = `${options.role || ""}|${command}|${cwd}|${args.join(",")}`;
    if (options.singleton) {
      const existingPid = this.singletonIndex.get(signature);
      if (existingPid && this.managedProcesses.has(existingPid)) {
        const meta = this.managedProcesses.get(existingPid)!;
        return {
          processId: existingPid,
          command,
          args,
          cwd,
          role: meta.role,
          ready: meta.ready,
          readyAt: meta.readyAt,
          reused: true,
        };
      }
    }

    const childProcess = spawn(command, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      detached: false,
      shell: process.platform === "win32",
    });

    if (!childProcess.pid) {
      throw new Error(`Failed to start process: ${command} ${args.join(" ")}`);
    }

    const metadata: ProcessMetadata = {
      name,
      command,
      args,
      cwd,
      startTime: new Date(),
      isTask: options.isTask,
      logs: [],
      role: options.role,
      tags: options.tags,
      readiness: options.readiness,
      ready: !options.readiness, // if no readiness required treat as ready
      ports: this.inferPorts(command, args, options.readiness),
    };

    this.registerChildProcess(childProcess, metadata);

    if (options.singleton) {
      this.singletonIndex.set(signature, childProcess.pid);
    }

    // Handle readiness if configured
    if (options.readiness) {
      try {
        await this.awaitReadiness(childProcess, metadata, options.readiness);
        metadata.ready = true;
        metadata.readyAt = new Date();
        this.addLog(childProcess.pid, `Readiness success (${options.readiness.type})`);
      } catch (err) {
        metadata.ready = false;
        metadata.lastError = `Readiness failed: ${err instanceof Error ? err.message : String(err)}`;
        this.addLog(childProcess.pid, `[ERROR] ${metadata.lastError}`);
      }
    }

    return {
      processId: childProcess.pid,
      command,
      args,
      cwd,
      role: metadata.role,
      ready: metadata.ready,
      readyAt: metadata.readyAt,
    };
  }

  /**
   * Stop a process gracefully, with optional force kill
   */
  async stopProcess(pid: number, force = false): Promise<{ message: string }> {
    const childProcess = this.childProcesses.get(pid);
    const metadata = this.managedProcesses.get(pid);

    if (!metadata) {
      throw new Error(`Process with PID ${pid} is not managed by this server`);
    }

    // Mark process as shutting down to prevent false warnings
    this.shuttingDownProcesses.add(pid);
    this.emit("processShuttingDown", pid, metadata);
    
    this.addLog(pid, `Stopping process (force: ${force})`);

    try {
      if (childProcess && !childProcess.killed) {
        if (force) {
          childProcess.kill("SIGKILL");
        } else {
          childProcess.kill("SIGTERM");

          // Wait a bit for graceful shutdown
          await new Promise((resolve) => setTimeout(resolve, 2000));

          if (!childProcess.killed && childProcess.exitCode === null) {
            this.addLog(pid, "Graceful shutdown failed, force killing");
            childProcess.kill("SIGKILL");
          }
        }
      } else {
        // Try to kill by PID using tree-kill for external processes
        await killAsync(pid);
      }

      this.addLog(pid, "Process stopped successfully");
      return {
        message: `Process ${metadata.name} (PID: ${pid}) stopped successfully`,
      };
    } catch (error) {
      this.shuttingDownProcesses.delete(pid); // Remove from shutdown set if failed
      const errorMsg = `Failed to stop process: ${error instanceof Error ? error.message : String(error)}`;
      this.addLog(pid, `[ERROR] ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Restart a process by stopping it and starting it again
   */
  async restartProcess(
    processId?: number,
    processName?: string,
    force = false,
  ): Promise<{
    oldProcessId: number;
    newProcessId: number;
    processName: string;
    message: string;
  }> {
    let targetProcessId = processId;

    if (!targetProcessId && processName) {
      const processes = await this.listProcesses();
      const process = processes.find(
        (p) => p.name === processName || p.metadata?.name === processName,
      );

      if (!process) {
        throw new Error(`Process with name '${processName}' not found`);
      }

      targetProcessId = process.pid;
    }

    if (!targetProcessId) {
      throw new Error("Could not determine process ID to restart");
    }

    const metadata = this.managedProcesses.get(targetProcessId);
    if (!metadata) {
      throw new Error(
        `Process with PID ${targetProcessId} is not managed by this server`,
      );
    }

    // Store the process configuration before stopping
    const config = {
      command: metadata.command,
      args: metadata.args,
      cwd: metadata.cwd,
      name: metadata.name,
      isTask: metadata.isTask,
    };

    // Stop the old process
    await this.stopProcess(targetProcessId, force);

    // Wait a moment before restarting
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Start the new process
    const result = await this.startProcess(config.command, config.args, {
      cwd: config.cwd,
      name: config.name,
      isTask: config.isTask,
    });

    return {
      oldProcessId: targetProcessId,
      newProcessId: result.processId,
      processName: config.name,
      message: `Process '${config.name}' restarted successfully (old PID: ${targetProcessId}, new PID: ${result.processId})`,
    };
  }

  /**
   * List all running processes, optionally including system processes
   */
  async listProcesses(
    includeSystem = false,
    filter?: string,
  ): Promise<ProcessInfo[]> {
    try {
      const allProcesses = await psList();

      let filteredProcesses = allProcesses;

      // Filter by managed processes if not including system
      if (!includeSystem) {
        filteredProcesses = allProcesses.filter((proc: any) =>
          this.managedProcesses.has(proc.pid),
        );
      }

      // Apply text filter if provided
      if (filter) {
        const filterLower = filter.toLowerCase();
        filteredProcesses = filteredProcesses.filter(
          (proc: any) =>
            proc.name.toLowerCase().includes(filterLower) ||
            proc.cmd.toLowerCase().includes(filterLower) ||
            this.managedProcesses
              .get(proc.pid)
              ?.name.toLowerCase()
              .includes(filterLower),
        );
      }

      return filteredProcesses.map((proc: any) => ({
        pid: proc.pid,
        name: proc.name,
        cmd: proc.cmd,
        cpu: proc.cpu || 0,
        memory: proc.memory || 0,
        metadata: this.managedProcesses.get(proc.pid),
      }));
    } catch (error) {
      throw new Error(
        `Failed to list processes: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Safely get time from a Date object or date string
   */
  private safeDateToTime(date: Date | string | undefined): number | undefined {
    if (!date) return undefined;
    if (typeof date === 'string') {
      return new Date(date).getTime();
    }
    if (date instanceof Date) {
      return date.getTime();
    }
    return undefined;
  }

  /**
   * Get detailed status for a specific process
   */
  async getProcessStatus(
    processId?: number,
    processName?: string,
  ): Promise<ProcessStatus> {
    let targetProcessId = processId;

    if (!targetProcessId && processName) {
      const processes = await this.listProcesses(true);
      const process = processes.find(
        (p) => p.name === processName || p.metadata?.name === processName,
      );

      if (!process) {
        throw new Error(`Process with name '${processName}' not found`);
      }

      targetProcessId = process.pid;
    }

    if (!targetProcessId) {
      throw new Error("Could not determine process ID to check");
    }

    const metadata = this.managedProcesses.get(targetProcessId);
    const logs = this.processLogs.get(targetProcessId) || [];

    try {
      const allProcesses = await psList();
      const processInfo = allProcesses.find(
        (p: any) => p.pid === targetProcessId,
      );

      if (!processInfo) {
        return {
          pid: targetProcessId,
          name: metadata?.name || "Unknown",
          isRunning: false,
          startTime: metadata?.startTime,
          uptime: metadata?.startTime
            ? Date.now() - this.safeDateToTime(metadata.startTime)!
            : undefined,
          command: metadata?.command,
          args: metadata?.args,
          cwd: metadata?.cwd,
          logs: logs.slice(-50), // Last 50 log entries
          isTask: metadata?.isTask,
          lastError: metadata?.lastError,
          role: metadata?.role,
          ready: metadata?.ready,
          readyAt: metadata?.readyAt,
          reattached: metadata?.reattached,
          ports: metadata?.ports,
        };
      }

      return {
        pid: targetProcessId,
        name: processInfo.name,
        isRunning: true,
        startTime: metadata?.startTime,
        uptime: metadata?.startTime
          ? Date.now() - this.safeDateToTime(metadata.startTime)!
          : undefined,
        cpu: processInfo.cpu,
        memory: processInfo.memory,
        command: metadata?.command || processInfo.cmd,
        args: metadata?.args,
        cwd: metadata?.cwd,
        logs: logs.slice(-50), // Last 50 log entries
        isTask: metadata?.isTask,
        lastError: metadata?.lastError,
        role: metadata?.role,
        ready: metadata?.ready,
        readyAt: metadata?.readyAt,
        reattached: metadata?.reattached,
        ports: metadata?.ports,
      };
    } catch (error) {
      throw new Error(
        `Failed to get process status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get combined logs from all managed processes
   */
  async getAllLogs(): Promise<string> {
    const allLogs: string[] = [];

    for (const [pid, logs] of this.processLogs.entries()) {
      const metadata = this.managedProcesses.get(pid);
      const processName = metadata?.name || `PID ${pid}`;

      allLogs.push(`\n=== ${processName} (PID: ${pid}) ===`);
      allLogs.push(...logs.slice(-20)); // Last 20 entries per process
    }

    return allLogs.join("\n");
  }

  /**
   * Add a log entry for a specific process
   */
  private addLog(pid: number, message: string): void {
    const logs = this.processLogs.get(pid) || [];
    const timestamp = new Date().toISOString();
    logs.push(`[${timestamp}] ${message}`);

    // Keep only last 100 log entries per process
    if (logs.length > 100) {
      logs.splice(0, logs.length - 100);
    }

    this.processLogs.set(pid, logs);

    // Opportunistic port extraction from log lines
    const meta = this.managedProcesses.get(pid);
    if (meta) {
      const discovered: number[] = [];
      const push = (v: number) => { if (v > 0 && v < 65536 && (!meta.ports || !meta.ports.includes(v))) discovered.push(v); };
      // Patterns like 'listening on port 3000', 'listening at http://localhost:5173', 'server started :8080'
      const patterns = [
        /listening\s+on\s+port\s+(\d{2,5})/i,
        /listening\s+at[^\d]*(\d{2,5})/i,
        /started[^\d]*(\d{2,5})/i,
        /server\s+running[^\d]*(\d{2,5})/i,
        /:(\d{2,5})\b/, // generic :3000
      ];
      for (const pat of patterns) {
        const m = message.match(pat);
        if (m && m[1]) push(parseInt(m[1],10));
      }
      if (discovered.length) {
        meta.ports = (meta.ports || []).concat(discovered).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
        this.schedulePersist();
      }
    }
  }

  /**
   * Clean up any orphaned processes from previous sessions
   */
  private async cleanupOrphanedProcesses(): Promise<void> {
    // This is a placeholder for more sophisticated cleanup logic
    // In a real implementation, you might want to:
    // 1. Store process metadata in a persistent location
    // 2. Check for processes that should be cleaned up on startup
    // 3. Implement process ownership verification
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistState(), 200);
  }

  private persistState(): void {
    try {
      if (!fs.existsSync(this.stateDir)) fs.mkdirSync(this.stateDir, { recursive: true });
      const data = Array.from(this.managedProcesses.entries()).map(([pid, meta]) => ({
        pid,
        name: meta.name,
        command: meta.command,
        args: meta.args,
        cwd: meta.cwd,
        startTime: meta.startTime.toISOString(),
        isTask: meta.isTask,
        lastError: meta.lastError,
        role: meta.role,
        tags: meta.tags,
        readiness: meta.readiness,
        ready: meta.ready,
        readyAt: meta.readyAt ? meta.readyAt.toISOString() : undefined,
        ports: meta.ports,
      }));
      fs.writeFileSync(this.stateFile, JSON.stringify({ version: 1, processes: data }, null, 2), "utf-8");
    } catch (e) {
      console.error("Persist state failed", e);
    }
  }

  private async loadState(): Promise<void> {
    if (!fs.existsSync(this.stateFile)) return;
    try {
      const raw = fs.readFileSync(this.stateFile, "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.processes)) return;
      const running = await psList();
      const runningSet = new Set(running.map((p: any) => p.pid));
      for (const saved of parsed.processes) {
        if (runningSet.has(saved.pid)) {
          const meta: ProcessMetadata = {
            name: saved.name,
            command: saved.command,
            args: saved.args || [],
            cwd: saved.cwd,
            startTime: saved.startTime ? new Date(saved.startTime) : new Date(),
            isTask: saved.isTask,
            logs: [],
            lastError: saved.lastError,
            role: saved.role,
            tags: saved.tags,
            readiness: saved.readiness,
            ready: saved.ready,
            readyAt: saved.readyAt ? new Date(saved.readyAt) : undefined,
            ports: Array.isArray(saved.ports) ? saved.ports : undefined,
          };
          this.managedProcesses.set(saved.pid, meta);
          this.processLogs.set(saved.pid, [
            `[${new Date().toISOString()}] Reattached to existing process (PID ${saved.pid})`,
          ]);
        }
      }
    } catch (e) {
      console.error("Load state failed", e);
    }
  }

  // Best-effort port inference from command/args/readiness
  private inferPorts(command: string, args: string[], readiness?: ReadinessConfig): number[] | undefined {
    const ports = new Set<number>();
    const push = (v: number) => { if (v > 0 && v < 65536) ports.add(v); };
    const joined = [command, ...args].join(" ");
    const explicitFlags = /(?:--port|--PORT|--serve|--proxy-port|-p)\s+(\d{2,5})/g;
    let m: RegExpExecArray | null;
    while ((m = explicitFlags.exec(joined))) { push(parseInt(m[1],10)); }
    // Common frameworks pattern: :3000 or :5173
    const colonPattern = /:(\d{2,5})\b/g; while ((m = colonPattern.exec(joined))) { push(parseInt(m[1],10)); }
    if (process.env.PORT) { const envPort = parseInt(process.env.PORT,10); if (!isNaN(envPort)) push(envPort); }
    if (readiness && readiness.type === 'port') push(readiness.value);
    return ports.size ? Array.from(ports).sort((a,b)=>a-b) : undefined;
  }

  private awaitReadiness(
    child: ChildProcess,
    metadata: ProcessMetadata,
    readiness: ReadinessConfig,
  ): Promise<void> {
    const timeoutMs = readiness.timeoutMs ?? 20000;
    const start = Date.now();
    return new Promise((resolve, reject) => {
      let resolved = false;
      const finish = (err?: Error) => {
        if (resolved) return;
        resolved = true;
        clearInterval(intervalHandle as any);
        clearTimeout(timeoutHandle);
        if (err) reject(err); else resolve();
      };

      const timeoutHandle = setTimeout(() => {
        finish(new Error(`Timeout after ${timeoutMs}ms waiting for readiness`));
      }, timeoutMs);

      let intervalHandle: NodeJS.Timer | undefined;

      switch (readiness.type) {
        case "port": {
          const port = readiness.value;
            intervalHandle = setInterval(() => {
              const socket = net.createConnection({ port }, () => {
                socket.end();
                finish();
              });
              socket.on("error", () => socket.destroy());
            }, readiness.intervalMs ?? 300);
          break;
        }
        case "http": {
          const url = readiness.value;
          intervalHandle = setInterval(() => {
            const mod = url.startsWith("https") ? https : http;
            const req = mod.get(url, (res) => {
              if (res.statusCode && res.statusCode < 500) {
                res.resume();
                finish();
              } else {
                res.resume();
              }
            });
            req.on("error", () => {});
          }, readiness.intervalMs ?? 500);
          break;
        }
        case "log": {
          const pattern = readiness.value instanceof RegExp ? readiness.value : new RegExp(readiness.value, "i");
          const listener = (data: Buffer) => {
            if (pattern.test(data.toString())) {
              child.stdout?.off("data", listener);
              child.stderr?.off("data", listener);
              finish();
            }
          };
          child.stdout?.on("data", listener);
          child.stderr?.on("data", listener);
          break;
        }
      }

      // If process exits before readiness
      child.on("exit", (code) => {
        if (!resolved) {
          finish(new Error(`Process exited (code ${code}) before readiness`));
        }
      });
    });
  }

  /**
   * Cleanup all managed processes
   */
  async cleanup(): Promise<void> {
    // Set global shutdown flag to prevent false warnings
    this.globalShutdown = true;
    this.emit("globalShutdown");
    
    // Clear any pending persist timer
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = undefined;
    }

    const managedPids = Array.from(this.managedProcesses.keys());

    for (const pid of managedPids) {
      try {
        await this.stopProcess(pid, false);
      } catch (error) {
        console.error(`Failed to cleanup process ${pid}:`, error);
      }
    }

    this.managedProcesses.clear();
    this.processLogs.clear();
    this.childProcesses.clear();
    this.shuttingDownProcesses.clear();
    
    // Persist final state without scheduling new timer
    this.persistState();
  }

  /**
   * Detect potential port conflicts where more than one managed process claims the same port.
   * This is heuristic (based on inferred ports) and does not guarantee an actual TCP bind conflict.
   * Returns sorted array of { port, pids, processes } where length(pids) > 1.
   */
  detectPortConflicts(): { port: number; pids: number[]; processes: { pid: number; name: string; role?: ProcessRole; ready?: boolean }[] }[] {
    const portMap = new Map<number, { pid: number; name: string; role?: ProcessRole; ready?: boolean }[]>();
    for (const [pid, meta] of this.managedProcesses.entries()) {
      if (!meta.ports || !meta.ports.length) continue;
      for (const p of meta.ports) {
        if (!portMap.has(p)) portMap.set(p, []);
        portMap.get(p)!.push({ pid, name: meta.name, role: meta.role, ready: meta.ready });
      }
    }
    const conflicts: { port: number; pids: number[]; processes: { pid: number; name: string; role?: ProcessRole; ready?: boolean }[] }[] = [];
    for (const [port, entries] of portMap.entries()) {
      if (entries.length > 1) {
        conflicts.push({ port, pids: entries.map(e => e.pid).sort((a,b)=>a-b), processes: entries.sort((a,b)=>a.pid-b.pid) });
      }
    }
    return conflicts.sort((a,b) => a.port - b.port);
  }
}
