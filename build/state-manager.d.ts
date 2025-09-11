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
export declare class ProcessStateManager {
    private stateFile;
    private snapshotDir;
    private currentSession;
    private autoSaveInterval;
    constructor(workspaceRoot?: string);
    /**
     * Create a new session
     */
    private createNewSession;
    /**
     * Generate unique session ID
     */
    private generateSessionId;
    /**
     * Safely get time from a Date object or date string
     */
    private safeDateToTime;
    /**
     * Deserialize session data from JSON, converting string dates back to Date objects
     */
    private deserializeSessionData;
    /**
     * Deserialize snapshot data from JSON, converting string dates back to Date objects
     */
    private deserializeSnapshotData;
    /**
     * Load previous state from disk
     */
    private loadPreviousState;
    /**
     * Recover processes from previous session
     */
    private recoverProcesses;
    /**
     * Check if a process is still running
     */
    private isProcessRunning;
    /**
     * Mark process for recovery
     */
    private markProcessForRecovery;
    private isTestMode;
    private getCrashGraceMs;
    /**
     * Register a new process state
     */
    registerProcessState(pid: number, metadata: ProcessMetadata): void;
    /**
     * Update process state
     */
    updateProcessState(pid: number, updates: Partial<ProcessState>): void;
    /**
     * Mark process as stopped
     */
    markProcessStopped(pid: number): void;
    /**
     * Mark process as crashed
     */
    markProcessCrashed(pid: number): void;
    /**
     * Get process state
     */
    getProcessState(pid: number): ProcessState | null;
    /**
     * Get all process states
     */
    getAllProcessStates(): ProcessState[];
    /**
     * Get processes by status
     */
    getProcessesByStatus(status: ProcessState["status"]): ProcessState[];
    /**
     * Get session information
     */
    getSessionInfo(): SessionData;
    /**
     * Capture current environment variables
     */
    private captureEnvironment;
    /**
     * Detect ports used by process
     */
    private detectPorts;
    /**
     * Detect process dependencies
     */
    private detectDependencies;
    /**
     * Create a snapshot of current state
     */
    createSnapshot(sessionData?: SessionData): void;
    /**
     * Get system information
     */
    private getSystemInfo;
    /**
     * Clean up old snapshots
     */
    private cleanupOldSnapshots;
    /**
     * Get available snapshots
     */
    getAvailableSnapshots(): {
        filename: string;
        timestamp: Date;
        processCount: number;
    }[];
    /**
     * Load snapshot
     */
    loadSnapshot(filename: string): ProcessSnapshot | null;
    /**
     * Save current state to disk
     */
    private saveState;
    /**
     * Save state synchronously (for cleanup handlers)
     */
    private saveStateSync;
    /**
     * Start auto-save timer
     */
    private startAutoSave;
    /**
     * Export state data
     */
    exportState(): string;
    /**
     * Import state data
     */
    importState(stateData: string): boolean;
    /**
     * Clear all state data
     */
    clearState(): void;
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
    };
    /**
     * Cleanup state manager
     */
    cleanup(): void;
}
//# sourceMappingURL=state-manager.d.ts.map