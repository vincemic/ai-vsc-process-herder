import { EventEmitter } from "events";
export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";
export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    category: string;
    message: string;
    metadata?: Record<string, any>;
    processId?: number;
    sessionId?: string;
}
export interface LogFilter {
    level?: LogLevel;
    category?: string;
    processId?: number;
    startTime?: Date;
    endTime?: Date;
    search?: string;
}
export interface LogStats {
    totalEntries: number;
    entriesByLevel: Record<LogLevel, number>;
    entriesByCategory: Record<string, number>;
    timeRange: {
        start: Date;
        end: Date;
    };
}
export interface MetricPoint {
    timestamp: Date;
    value: number;
    labels?: Record<string, string>;
}
export interface Metric {
    name: string;
    type: "counter" | "gauge" | "histogram";
    description: string;
    points: MetricPoint[];
}
/**
 * Advanced logging and metrics system for process tracking
 */
export declare class LoggingManager extends EventEmitter {
    private logFile;
    private metricsFile;
    private logs;
    private metrics;
    private maxLogEntries;
    private logLevel;
    private categories;
    private saveInterval?;
    constructor(workspaceRoot?: string, options?: {
        maxLogEntries?: number;
        logLevel?: LogLevel;
    });
    /**
     * Log a message with specified level
     */
    log(level: LogLevel, category: string, message: string, metadata?: Record<string, any>, processId?: number): void;
    /**
     * Convenience methods for different log levels
     */
    debug(category: string, message: string, metadata?: Record<string, any>, processId?: number): void;
    info(category: string, message: string, metadata?: Record<string, any>, processId?: number): void;
    warn(category: string, message: string, metadata?: Record<string, any>, processId?: number): void;
    error(category: string, message: string, metadata?: Record<string, any>, processId?: number): void;
    critical(category: string, message: string, metadata?: Record<string, any>, processId?: number): void;
    /**
     * Record a metric point
     */
    recordMetric(name: string, value: number, labels?: Record<string, string>): void;
    /**
     * Increment a counter metric
     */
    incrementCounter(name: string, increment?: number, labels?: Record<string, string>): void;
    /**
     * Record histogram metric
     */
    recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
    /**
     * Get logs with optional filtering
     */
    getLogs(filter?: LogFilter, limit?: number): LogEntry[];
    /**
     * Get log statistics
     */
    getLogStats(filter?: LogFilter): LogStats;
    /**
     * Get metric data
     */
    getMetric(name: string): Metric | null;
    /**
     * Get all metrics
     */
    getAllMetrics(): Metric[];
    /**
     * Get metric statistics
     */
    getMetricStats(name: string, timeRange?: {
        start: Date;
        end: Date;
    }): {
        count: number;
        min: number;
        max: number;
        avg: number;
        latest: number;
    } | null;
    /**
     * Generate log report
     */
    generateLogReport(timeRange?: {
        start: Date;
        end: Date;
    }): string;
    /**
     * Export logs to JSON
     */
    exportLogs(filter?: LogFilter): string;
    /**
     * Export metrics to JSON
     */
    exportMetrics(): string;
    /**
     * Clear logs
     */
    clearLogs(olderThan?: Date): number;
    /**
     * Clear metrics
     */
    clearMetrics(olderThan?: Date): number;
    /**
     * Get available categories
     */
    getCategories(): string[];
    /**
     * Set log level
     */
    setLogLevel(level: LogLevel): void;
    /**
     * Get current log level
     */
    getLogLevel(): LogLevel;
    /**
     * Check if should log at given level
     */
    private shouldLog;
    /**
     * Get numeric priority for log level
     */
    private getLevelPriority;
    /**
     * Add log entry
     */
    private addLogEntry;
    /**
     * Get current session ID (placeholder)
     */
    private getCurrentSessionId;
    /**
     * Load existing logs from file
     */
    private loadExistingLogs;
    /**
     * Load existing metrics from file
     */
    private loadExistingMetrics;
    /**
     * Save logs to file
     */
    private saveLogs;
    /**
     * Save metrics to file
     */
    private saveMetrics;
    /**
     * Setup periodic saving
     */
    private setupPeriodicSave;
    /**
     * Cleanup logging manager
     */
    cleanup(): void;
}
//# sourceMappingURL=logging-manager.d.ts.map