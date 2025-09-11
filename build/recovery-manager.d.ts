import { EventEmitter } from "events";
import { ProcessManager } from "./process-manager.js";
import { HealthMonitor } from "./health-monitor.js";
export interface RecoveryStrategy {
    name: string;
    conditions: RecoveryCondition[];
    actions: RecoveryAction[];
    maxAttempts: number;
    cooldownPeriod: number;
    enabled: boolean;
}
export interface RecoveryCondition {
    type: "health-score" | "error-count" | "memory-usage" | "cpu-usage" | "unresponsive" | "crashed";
    operator: "gt" | "lt" | "eq" | "gte" | "lte";
    value: number;
    duration?: number;
}
export interface RecoveryAction {
    type: "restart" | "kill-restart" | "scale-down" | "notify" | "cleanup" | "custom";
    delay?: number;
    parameters?: Record<string, any>;
}
export interface RecoveryAttempt {
    pid: number;
    processName: string;
    strategy: string;
    timestamp: Date;
    actions: RecoveryAction[];
    success: boolean;
    error?: string;
}
export interface ProcessRecoveryConfig {
    processName: string;
    strategies: RecoveryStrategy[];
    alertThresholds: {
        maxRestarts: number;
        timeWindow: number;
    };
}
/**
 * Advanced process recovery and auto-healing system
 */
export declare class ProcessRecoveryManager extends EventEmitter {
    private processManager;
    private healthMonitor;
    private recoveryConfigs;
    private recoveryAttempts;
    private conditionTimers;
    constructor(processManager: ProcessManager, healthMonitor: HealthMonitor);
    /**
     * Set up event listeners for health monitoring
     */
    private setupEventListeners;
    /**
     * Load default recovery strategies
     */
    private loadDefaultStrategies;
    /**
     * Configure recovery strategies for a specific process
     */
    configureProcessRecovery(processName: string, config: ProcessRecoveryConfig): void;
    /**
     * Handle unhealthy process
     */
    private handleUnhealthyProcess;
    /**
     * Handle critical process issues
     */
    private handleCriticalProcess;
    /**
     * Safely get time from a Date object or date string
     */
    private safeDateToTime;
    /**
     * Check if a recovery strategy should be applied
     */
    private shouldApplyStrategy;
    /**
     * Check if a specific condition is met
     */
    private checkCondition;
    /**
     * Evaluate a condition operator
     */
    private evaluateCondition;
    /**
     * Apply a recovery strategy
     */
    private applyRecoveryStrategy;
    /**
     * Execute a specific recovery action
     */
    private executeRecoveryAction;
    /**
     * Perform cleanup operations
     */
    private performCleanup;
    /**
     * Execute custom recovery action
     */
    private executeCustomAction;
    /**
     * Get process configuration
     */
    private getProcessConfig;
    /**
     * Get recovery attempts for a process and strategy
     */
    private getRecoveryAttempts;
    /**
     * Record a recovery attempt
     */
    private recordRecoveryAttempt;
    /**
     * Clear old recovery attempts for a strategy
     */
    private clearOldRecoveryAttempts;
    /**
     * Get recovery statistics
     */
    getRecoveryStatistics(): {
        totalAttempts: number;
        successfulAttempts: number;
        failedAttempts: number;
        topFailingProcesses: {
            name: string;
            failures: number;
        }[];
        strategiesUsed: {
            name: string;
            count: number;
        }[];
    };
    /**
     * Utility function for delays
     */
    private delay;
    /**
     * Cleanup recovery manager
     */
    cleanup(): void;
}
//# sourceMappingURL=recovery-manager.d.ts.map