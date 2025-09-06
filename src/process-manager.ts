import { spawn, ChildProcess } from "child_process";
import kill from "tree-kill";
import { promisify } from "util";
import psList from "ps-list";

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
}

/**
 * Manages process lifecycle and monitoring for VS Code development workflows
 */
export class ProcessManager {
  private managedProcesses = new Map<number, ProcessMetadata>();
  private processLogs = new Map<number, string[]>();
  private childProcesses = new Map<number, ChildProcess>();

  constructor() {
    // Clean up orphaned processes on startup
    this.cleanupOrphanedProcesses();
  }

  /**
   * Register a process for management and monitoring
   */
  registerProcess(pid: number, metadata: ProcessMetadata): void {
    this.managedProcesses.set(pid, metadata);
    this.processLogs.set(pid, []);
    
    // Log the registration
    this.addLog(pid, `Process registered: ${metadata.name} (${metadata.command})`);
  }

  /**
   * Register a child process for direct management
   */
  registerChildProcess(childProcess: ChildProcess, metadata: ProcessMetadata): void {
    if (!childProcess.pid) {
      throw new Error("Child process has no PID");
    }

    this.childProcesses.set(childProcess.pid, childProcess);
    this.registerProcess(childProcess.pid, metadata);

    // Setup logging
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data: Buffer) => {
        this.addLog(childProcess.pid!, `[STDOUT] ${data.toString().trim()}`);
      });
    }

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        this.addLog(childProcess.pid!, `[STDERR] ${data.toString().trim()}`);
      });
    }

    // Handle process exit
    childProcess.on('exit', (code: number | null, signal: string | null) => {
      this.addLog(childProcess.pid!, `Process exited with code ${code}, signal ${signal}`);
      this.unregisterProcess(childProcess.pid!);
    });

    childProcess.on('error', (error: Error) => {
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
    this.managedProcesses.delete(pid);
    this.childProcesses.delete(pid);
    // Keep logs for a while for debugging
    setTimeout(() => this.processLogs.delete(pid), 60000); // 1 minute
  }

  /**
   * Start a new process with the given command and arguments
   */
  async startProcess(
    command: string, 
    args: string[] = [], 
    options: { cwd?: string; name?: string; isTask?: boolean } = {}
  ): Promise<{ processId: number; command: string; args: string[]; cwd: string }> {
    const cwd = options.cwd || process.cwd();
    const name = options.name || command;

    const childProcess = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
      shell: process.platform === 'win32'
    });

    if (!childProcess.pid) {
      throw new Error(`Failed to start process: ${command} ${args.join(' ')}`);
    }

    const metadata: ProcessMetadata = {
      name,
      command,
      args,
      cwd,
      startTime: new Date(),
      isTask: options.isTask,
      logs: []
    };

    this.registerChildProcess(childProcess, metadata);

    return {
      processId: childProcess.pid,
      command,
      args,
      cwd
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

    this.addLog(pid, `Stopping process (force: ${force})`);

    try {
      if (childProcess && !childProcess.killed) {
        if (force) {
          childProcess.kill('SIGKILL');
        } else {
          childProcess.kill('SIGTERM');
          
          // Wait a bit for graceful shutdown
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (!childProcess.killed && childProcess.exitCode === null) {
            this.addLog(pid, "Graceful shutdown failed, force killing");
            childProcess.kill('SIGKILL');
          }
        }
      } else {
        // Try to kill by PID using tree-kill for external processes
        await killAsync(pid);
      }

      this.addLog(pid, "Process stopped successfully");
      return { message: `Process ${metadata.name} (PID: ${pid}) stopped successfully` };
    } catch (error) {
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
    force = false
  ): Promise<{ oldProcessId: number; newProcessId: number; processName: string; message: string }> {
    let targetProcessId = processId;
    
    if (!targetProcessId && processName) {
      const processes = await this.listProcesses();
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
      throw new Error("Could not determine process ID to restart");
    }

    const metadata = this.managedProcesses.get(targetProcessId);
    if (!metadata) {
      throw new Error(`Process with PID ${targetProcessId} is not managed by this server`);
    }

    // Store the process configuration before stopping
    const config = {
      command: metadata.command,
      args: metadata.args,
      cwd: metadata.cwd,
      name: metadata.name,
      isTask: metadata.isTask
    };

    // Stop the old process
    await this.stopProcess(targetProcessId, force);

    // Wait a moment before restarting
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start the new process
    const result = await this.startProcess(config.command, config.args, {
      cwd: config.cwd,
      name: config.name,
      isTask: config.isTask
    });

    return {
      oldProcessId: targetProcessId,
      newProcessId: result.processId,
      processName: config.name,
      message: `Process '${config.name}' restarted successfully (old PID: ${targetProcessId}, new PID: ${result.processId})`
    };
  }

  /**
   * List all running processes, optionally including system processes
   */
  async listProcesses(includeSystem = false, filter?: string): Promise<ProcessInfo[]> {
    try {
      const allProcesses = await psList();
      
      let filteredProcesses = allProcesses;

      // Filter by managed processes if not including system
      if (!includeSystem) {
        filteredProcesses = allProcesses.filter((proc: any) => 
          this.managedProcesses.has(proc.pid)
        );
      }

      // Apply text filter if provided
      if (filter) {
        const filterLower = filter.toLowerCase();
        filteredProcesses = filteredProcesses.filter((proc: any) => 
          proc.name.toLowerCase().includes(filterLower) ||
          proc.cmd.toLowerCase().includes(filterLower) ||
          this.managedProcesses.get(proc.pid)?.name.toLowerCase().includes(filterLower)
        );
      }

      return filteredProcesses.map((proc: any) => ({
        pid: proc.pid,
        name: proc.name,
        cmd: proc.cmd,
        cpu: proc.cpu || 0,
        memory: proc.memory || 0,
        metadata: this.managedProcesses.get(proc.pid)
      }));
    } catch (error) {
      throw new Error(`Failed to list processes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get detailed status for a specific process
   */
  async getProcessStatus(processId?: number, processName?: string): Promise<ProcessStatus> {
    let targetProcessId = processId;
    
    if (!targetProcessId && processName) {
      const processes = await this.listProcesses(true);
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
      throw new Error("Could not determine process ID to check");
    }

    const metadata = this.managedProcesses.get(targetProcessId);
    const logs = this.processLogs.get(targetProcessId) || [];

    try {
      const allProcesses = await psList();
      const processInfo = allProcesses.find((p: any) => p.pid === targetProcessId);
      
      if (!processInfo) {
        return {
          pid: targetProcessId,
          name: metadata?.name || "Unknown",
          isRunning: false,
          startTime: metadata?.startTime,
          uptime: metadata?.startTime ? Date.now() - metadata.startTime.getTime() : undefined,
          command: metadata?.command,
          args: metadata?.args,
          cwd: metadata?.cwd,
          logs: logs.slice(-50), // Last 50 log entries
          isTask: metadata?.isTask,
          lastError: metadata?.lastError
        };
      }

      return {
        pid: targetProcessId,
        name: processInfo.name,
        isRunning: true,
        startTime: metadata?.startTime,
        uptime: metadata?.startTime ? Date.now() - metadata.startTime.getTime() : undefined,
        cpu: processInfo.cpu,
        memory: processInfo.memory,
        command: metadata?.command || processInfo.cmd,
        args: metadata?.args,
        cwd: metadata?.cwd,
        logs: logs.slice(-50), // Last 50 log entries
        isTask: metadata?.isTask,
        lastError: metadata?.lastError
      };
    } catch (error) {
      throw new Error(`Failed to get process status: ${error instanceof Error ? error.message : String(error)}`);
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
    
    return allLogs.join('\n');
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

  /**
   * Cleanup all managed processes
   */
  async cleanup(): Promise<void> {
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
  }
}