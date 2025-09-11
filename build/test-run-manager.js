import { EventEmitter } from "events";
export class TestRunManager extends EventEmitter {
    processManager;
    runs = new Map();
    constructor(processManager) {
        super();
        this.processManager = processManager;
    }
    listRuns() { return Array.from(this.runs.values()); }
    getRun(id) { return this.runs.get(id); }
    async startRun(config) {
        if (this.runs.has(config.id))
            throw new Error(`Test run '${config.id}' already exists`);
        const state = { ...config, status: "pending", createdAt: new Date(), logs: [] };
        this.runs.set(config.id, state);
        this.emit("run-created", state);
        try {
            state.status = "starting";
            // Start backend first if present
            if (config.backend) {
                const backend = await this.processManager.startProcess(config.backend.command, config.backend.args || [], {
                    cwd: config.backend.cwd,
                    name: `${config.id}-backend`,
                    role: "backend",
                    singleton: config.backend.singleton ?? true,
                    readiness: config.backend.readiness,
                });
                state.backendPid = backend.processId;
                state.logs.push(`Backend PID ${backend.processId} ready=${backend.ready}`);
            }
            // Start frontend if present
            if (config.frontend) {
                const frontend = await this.processManager.startProcess(config.frontend.command, config.frontend.args || [], {
                    cwd: config.frontend.cwd,
                    name: `${config.id}-frontend`,
                    role: "frontend",
                    singleton: config.frontend.singleton ?? true,
                    readiness: config.frontend.readiness,
                });
                state.frontendPid = frontend.processId;
                state.logs.push(`Frontend PID ${frontend.processId} ready=${frontend.ready}`);
            }
            // Start tests
            const testProc = await this.processManager.startProcess(config.tests.command, config.tests.args || [], {
                cwd: config.tests.cwd,
                name: `${config.id}-tests`,
                role: "test",
                readiness: config.tests.readiness,
            });
            state.testPid = testProc.processId;
            state.startedAt = new Date();
            state.status = "running";
            state.logs.push(`Tests PID ${testProc.processId} started`);
            this.emit("run-started", state);
            // Poll test process until exit
            this.monitorTestProcess(state).catch(() => { });
            return state;
        }
        catch (e) {
            state.status = "failed";
            state.error = e instanceof Error ? e.message : String(e);
            state.finishedAt = new Date();
            this.emit("run-failed", state);
            throw e;
        }
    }
    async abortRun(id) {
        const run = this.runs.get(id);
        if (!run)
            throw new Error(`Test run '${id}' not found`);
        if (run.status === "completed" || run.status === "failed" || run.status === "aborted")
            return run;
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
    async monitorTestProcess(run) {
        if (!run.testPid)
            return;
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
            }
            catch (e) {
                clearInterval(interval);
                run.finishedAt = new Date();
                run.status = "failed";
                run.error = e instanceof Error ? e.message : String(e);
                this.emit("run-failed", run);
            }
        }, 1000);
    }
    async stopIfExists(pid) {
        if (!pid)
            return;
        try {
            await this.processManager.stopProcess(pid);
        }
        catch { /* ignore */ }
    }
}
//# sourceMappingURL=test-run-manager.js.map