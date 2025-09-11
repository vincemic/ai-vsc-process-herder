import { EventEmitter } from "events";
import { ProcessManager, ReadinessConfig } from "./process-manager.js";
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
        readiness?: ReadinessConfig;
    };
    autoStop?: boolean;
    keepBackends?: boolean;
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
export declare class TestRunManager extends EventEmitter {
    private processManager;
    private runs;
    constructor(processManager: ProcessManager);
    listRuns(): TestRunState[];
    getRun(id: string): TestRunState | undefined;
    startRun(config: TestRunConfig): Promise<TestRunState>;
    abortRun(id: string): Promise<TestRunState>;
    private monitorTestProcess;
    private stopIfExists;
}
//# sourceMappingURL=test-run-manager.d.ts.map