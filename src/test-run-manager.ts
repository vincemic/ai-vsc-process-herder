import { EventEmitter } from "events";
import { ProcessManager, ProcessRole, ReadinessConfig } from "./process-manager.js";

export interface TestRunConfig {
  id: string;
  name?: string;
  backend?: {
    command: string;
    args?: string[];
    cwd?: string;
    readiness?: ReadinessConfig;
    singleton?: boolean;
  };
  frontend?: {
    command: string;
    args?: string[];
    cwd?: string;
    readiness?: ReadinessConfig;
    singleton?: boolean;
  };
  tests: {
    command: string;
    args?: string[];
    cwd?: string;
    readiness?: ReadinessConfig; // e.g. log pattern indicating test harness started
  };
  autoStop?: boolean; // stop services after tests finish
  keepBackends?: boolean; // leave backend/frontends running
  createdAt?: Date;
}

export interface TestRunState extends TestRunConfig {
  status: "pending" | "starting" | "running" | "completed" | "failed" | "aborted";
  backendPid?: number;
  frontendPid?: number;
  testPid?: number;
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
  logs: string[];
}

export class TestRunManager extends EventEmitter {
  private runs = new Map<string, TestRunState>();
  constructor(private processManager: ProcessManager) { super(); }

  listRuns(): TestRunState[] { return Array.from(this.runs.values()); }
  getRun(id: string): TestRunState | undefined { return this.runs.get(id); }

  async startRun(config: TestRunConfig): Promise<TestRunState> {
    if (this.runs.has(config.id)) throw new Error(`Test run '${config.id}' already exists`);
    const state: TestRunState = { ...config, status: "pending", createdAt: new Date(), logs: [] };
    this.runs.set(config.id, state);
    this.emit("run-created", state);
    try {
      state.status = "starting";
      // Start backend first if present
      if (config.backend) {
        const backend = await this.processManager.startProcess(
          config.backend.command,
          config.backend.args || [],
          {
            cwd: config.backend.cwd,
            name: `${config.id}-backend`,
            role: "backend" as ProcessRole,
            singleton: config.backend.singleton ?? true,
            readiness: config.backend.readiness,
          },
        );
        state.backendPid = backend.processId;
        state.logs.push(`Backend PID ${backend.processId} ready=${backend.ready}`);
      }
      // Start frontend if present
      if (config.frontend) {
        const frontend = await this.processManager.startProcess(
          config.frontend.command,
          config.frontend.args || [],
          {
            cwd: config.frontend.cwd,
            name: `${config.id}-frontend`,
            role: "frontend" as ProcessRole,
            singleton: config.frontend.singleton ?? true,
            readiness: config.frontend.readiness,
          },
        );
        state.frontendPid = frontend.processId;
        state.logs.push(`Frontend PID ${frontend.processId} ready=${frontend.ready}`);
      }
      // Start tests
      const testProc = await this.processManager.startProcess(
        config.tests.command,
        config.tests.args || [],
        {
          cwd: config.tests.cwd,
          name: `${config.id}-tests`,
          role: "test" as ProcessRole,
          readiness: config.tests.readiness,
        },
      );
      state.testPid = testProc.processId;
      state.startedAt = new Date();
      state.status = "running";
      state.logs.push(`Tests PID ${testProc.processId} started`);
      this.emit("run-started", state);
      // Poll test process until exit
      this.monitorTestProcess(state).catch(() => {});
      return state;
    } catch (e) {
      state.status = "failed";
      state.error = e instanceof Error ? e.message : String(e);
      state.finishedAt = new Date();
      this.emit("run-failed", state);
      throw e;
    }
  }

  async abortRun(id: string): Promise<TestRunState> {
    const run = this.runs.get(id);
    if (!run) throw new Error(`Test run '${id}' not found`);
    if (run.status === "completed" || run.status === "failed" || run.status === "aborted") return run;
    run.status = "aborted";
    run.finishedAt = new Date();
    await this.stopIfExists(run.testPid);
    if (!run.keepBackends) {
      await this.stopIfExists(run.backendPid);
      await this.stopIfExists(run.frontendPid);
    }
    this.emit("run-aborted", run);
    return run;
  }

  private async monitorTestProcess(run: TestRunState): Promise<void> {
    if (!run.testPid) return;
    // Simple polling loop
    const pid = run.testPid;
    const interval = setInterval(async () => {
      try {
        const status = await this.processManager.getProcessStatus(pid);
        if (!status.isRunning) {
          clearInterval(interval);
          run.finishedAt = new Date();
          run.status = status.lastError ? "failed" : "completed";
          run.logs.push(`Test process exited (error=${!!status.lastError})`);
          if (run.autoStop || (!run.keepBackends && run.status === "completed")) {
            await this.stopIfExists(run.backendPid);
            await this.stopIfExists(run.frontendPid);
          }
          this.emit("run-finished", run);
        }
      } catch (e) {
        clearInterval(interval);
        run.finishedAt = new Date();
        run.status = "failed";
        run.error = e instanceof Error ? e.message : String(e);
        this.emit("run-failed", run);
      }
    }, 1000);
  }

  private async stopIfExists(pid?: number): Promise<void> {
    if (!pid) return;
    try { await this.processManager.stopProcess(pid); } catch { /* ignore */ }
  }
}
