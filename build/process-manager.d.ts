import { ChildProcess } from "child_process";
import { EventEmitter } from "events";
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
}
export type ProcessRole = "frontend" | "backend" | "test" | "e2e" | "utility";
export type ReadinessConfig = {
    type: "port";
    value: number;
    timeoutMs?: number;
    intervalMs?: number;
} | {
    type: "log";
    value: string | RegExp;
    timeoutMs?: number;
} | {
    type: "http";
    value: string;
    timeoutMs?: number;
    intervalMs?: number;
};
/**
 * Manages process lifecycle and monitoring for VS Code development workflows
 */
export declare class ProcessManager extends EventEmitter {
    private managedProcesses;
    private processLogs;
    private childProcesses;
    private singletonIndex;
    private stateDir;
    private stateFile;
    private persistTimer?;
    constructor();
    /**
     * Register a process for management and monitoring
     */
    registerProcess(pid: number, metadata: ProcessMetadata): void;
    /**
     * Register a child process for direct management
     */
    registerChildProcess(childProcess: ChildProcess, metadata: ProcessMetadata): void;
    /**
     * Unregister a process from management
     */
    unregisterProcess(pid: number): void;
    /**
     * Start a new process with the given command and arguments
     */
    startProcess(command: string, args?: string[], options?: {
        cwd?: string;
        name?: string;
        isTask?: boolean;
        role?: ProcessRole;
        tags?: string[];
        singleton?: boolean;
        readiness?: ReadinessConfig;
    }): Promise<{
        processId: number;
        command: string;
        args: string[];
        cwd: string;
        role?: ProcessRole;
        ready?: boolean;
        readyAt?: Date;
        reused?: boolean;
    }>;
    /**
     * Stop a process gracefully, with optional force kill
     */
    stopProcess(pid: number, force?: boolean): Promise<{
        message: string;
    }>;
    /**
     * Restart a process by stopping it and starting it again
     */
    restartProcess(processId?: number, processName?: string, force?: boolean): Promise<{
        oldProcessId: number;
        newProcessId: number;
        processName: string;
        message: string;
    }>;
    /**
     * List all running processes, optionally including system processes
     */
    listProcesses(includeSystem?: boolean, filter?: string): Promise<ProcessInfo[]>;
    /**
     * Safely get time from a Date object or date string
     */
    private safeDateToTime;
    /**
     * Get detailed status for a specific process
     */
    getProcessStatus(processId?: number, processName?: string): Promise<ProcessStatus>;
    /**
     * Get combined logs from all managed processes
     */
    getAllLogs(): Promise<string>;
    /**
     * Add a log entry for a specific process
     */
    private addLog;
    /**
     * Clean up any orphaned processes from previous sessions
     */
    private cleanupOrphanedProcesses;
    private schedulePersist;
    private persistState;
    private loadState;
    private awaitReadiness;
    /**
     * Cleanup all managed processes
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=process-manager.d.ts.map