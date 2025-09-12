import { EventEmitter } from "events";
import { ProcessMetadata } from "./process-manager.js";
export interface HealthCheckResult {
    pid: number;
    name: string;
    isHealthy: boolean;
    healthScore: number;
    issues: HealthIssue[];
    lastCheck: Date;
    metrics: ProcessMetrics;
}
export interface HealthIssue {
    type: "memory" | "cpu" | "unresponsive" | "error" | "zombie" | "resource";
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    timestamp: Date;
}
export interface ProcessMetrics {
    cpuUsage: number;
    memoryUsage: number;
    memoryTrend: "stable" | "increasing" | "decreasing";
    uptime: number;
    errorCount: number;
    restartCount: number;
    responseTime?: number;
}
export interface HealthThresholds {
    maxCpuUsage: number;
    maxMemoryUsage: number;
    maxMemoryIncrease: number;
    maxErrorCount: number;
    unresponsiveTimeout: number;
}
/**
 * Advanced health monitoring system for tracked processes
 */
export declare class HealthMonitor extends EventEmitter {
    private healthHistory;
    private intervalIds;
    private restartCounts;
    private thresholds;
    private shuttingDownProcesses;
    private globalShutdown;
    constructor(thresholds?: Partial<HealthThresholds>);
    /**
     * Connect to ProcessManager events for shutdown coordination
     */
    connectToProcessManager(processManager: any): void;
    /**
     * Start monitoring a process
     */
    startMonitoring(pid: number, metadata: ProcessMetadata, interval?: number): void;
    /**
     * Stop monitoring a process
     */
    stopMonitoring(pid: number): void;
    /**
     * Perform comprehensive health check on a process
     */
    performHealthCheck(pid: number, metadata: ProcessMetadata): Promise<HealthCheckResult>;
    /**
     * Get health history for a process
     */
    getHealthHistory(pid: number, limit?: number): HealthCheckResult[];
    /**
     * Get health summary for all monitored processes
     */
    getHealthSummary(): {
        healthy: number;
        unhealthy: number;
        critical: number;
        total: number;
        issues: HealthIssue[];
    };
    /**
     * Get processes that need attention
     */
    getProcessesNeedingAttention(): HealthCheckResult[];
    /**
     * Record a health check result
     */
    private recordHealthCheck;
    /**
     * Record a process restart
     */
    recordProcessRestart(pid: number): void;
    /**
     * Measure response time for process (basic ping test)
     */
    private measureResponseTime;
    /**
     * Test TCP port connection
     */
    private testPortConnection;
    /**
     * Test HTTP connection
     */
    private testHttpConnection;
    /**
     * Get process info from system
     */
    private getProcessInfo;
    /**
     * Safely get time from a Date object or date string
     */
    private safeDateToTime;
    /**
     * Calculate comprehensive metrics for a process
     */
    private calculateMetrics;
    /**
     * Check if process is unresponsive
     */
    private isProcessUnresponsive;
    /**
     * Get default metrics for when process is not found
     */
    private getDefaultMetrics;
    /**
     * Cleanup all monitoring
     */
    cleanup(): void;
}
//# sourceMappingURL=health-monitor.d.ts.map