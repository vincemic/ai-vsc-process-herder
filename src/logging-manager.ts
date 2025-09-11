import * as fs from "fs";
import * as path from "path";
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
export class LoggingManager extends EventEmitter {
  private logFile: string;
  private metricsFile: string;
  private logs: LogEntry[] = [];
  private metrics = new Map<string, Metric>();
  private maxLogEntries: number;
  private logLevel: LogLevel;
  private categories = new Set<string>();
  private saveInterval?: NodeJS.Timeout;

  constructor(
    workspaceRoot?: string,
    options?: {
      maxLogEntries?: number;
      logLevel?: LogLevel;
    },
  ) {
    super();

    const root = workspaceRoot || process.cwd();
    const logsDir = path.join(root, ".vscode", "process-herder", "logs");

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logFile = path.join(logsDir, "process-herder.log");
    this.metricsFile = path.join(logsDir, "metrics.json");
    this.maxLogEntries = options?.maxLogEntries || 10000;
    this.logLevel = options?.logLevel || "info";

    this.loadExistingLogs();
    this.loadExistingMetrics();
    this.setupPeriodicSave();
  }

  /**
   * Log a message with specified level
   */
  log(
    level: LogLevel,
    category: string,
    message: string,
    metadata?: Record<string, any>,
    processId?: number,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      metadata,
      processId,
      sessionId: this.getCurrentSessionId(),
    };

    this.addLogEntry(entry);
    this.emit("log", entry);

    // Console output for important messages
    if (level === "error" || level === "critical") {
      console.error(`[${level.toUpperCase()}] ${category}: ${message}`);
    } else if (level === "warn") {
      console.warn(`[${level.toUpperCase()}] ${category}: ${message}`);
    }
  }

  /**
   * Convenience methods for different log levels
   */
  debug(
    category: string,
    message: string,
    metadata?: Record<string, any>,
    processId?: number,
  ): void {
    this.log("debug", category, message, metadata, processId);
  }

  info(
    category: string,
    message: string,
    metadata?: Record<string, any>,
    processId?: number,
  ): void {
    this.log("info", category, message, metadata, processId);
  }

  warn(
    category: string,
    message: string,
    metadata?: Record<string, any>,
    processId?: number,
  ): void {
    this.log("warn", category, message, metadata, processId);
  }

  error(
    category: string,
    message: string,
    metadata?: Record<string, any>,
    processId?: number,
  ): void {
    this.log("error", category, message, metadata, processId);
  }

  critical(
    category: string,
    message: string,
    metadata?: Record<string, any>,
    processId?: number,
  ): void {
    this.log("critical", category, message, metadata, processId);
  }

  /**
   * Record a metric point
   */
  recordMetric(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    let metric = this.metrics.get(name);

    if (!metric) {
      metric = {
        name,
        type: "gauge",
        description: `Auto-generated metric for ${name}`,
        points: [],
      };
      this.metrics.set(name, metric);
    }

    const point: MetricPoint = {
      timestamp: new Date(),
      value,
      labels,
    };

    metric.points.push(point);

    // Keep only last 1000 points per metric
    if (metric.points.length > 1000) {
      metric.points.splice(0, metric.points.length - 1000);
    }

    this.emit("metric", name, point);
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(
    name: string,
    increment = 1,
    labels?: Record<string, string>,
  ): void {
    let metric = this.metrics.get(name);

    if (!metric) {
      metric = {
        name,
        type: "counter",
        description: `Counter metric for ${name}`,
        points: [{ timestamp: new Date(), value: 0 }],
      };
      this.metrics.set(name, metric);
    }

    const lastValue = metric.points[metric.points.length - 1]?.value || 0;
    this.recordMetric(name, lastValue + increment, labels);
  }

  /**
   * Record histogram metric
   */
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    let metric = this.metrics.get(name);

    if (!metric) {
      metric = {
        name,
        type: "histogram",
        description: `Histogram metric for ${name}`,
        points: [],
      };
      this.metrics.set(name, metric);
    }

    this.recordMetric(name, value, labels);
  }

  /**
   * Get logs with optional filtering
   */
  getLogs(filter?: LogFilter, limit = 1000): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.level) {
        const levelPriority = this.getLevelPriority(filter.level);
        filteredLogs = filteredLogs.filter(
          (log) => this.getLevelPriority(log.level) >= levelPriority,
        );
      }

      if (filter.category) {
        filteredLogs = filteredLogs.filter((log) =>
          log.category.toLowerCase().includes(filter.category!.toLowerCase()),
        );
      }

      if (filter.processId) {
        filteredLogs = filteredLogs.filter(
          (log) => log.processId === filter.processId,
        );
      }

      if (filter.startTime) {
        filteredLogs = filteredLogs.filter(
          (log) => log.timestamp >= filter.startTime!,
        );
      }

      if (filter.endTime) {
        filteredLogs = filteredLogs.filter(
          (log) => log.timestamp <= filter.endTime!,
        );
      }

      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filteredLogs = filteredLogs.filter(
          (log) =>
            log.message.toLowerCase().includes(searchLower) ||
            log.category.toLowerCase().includes(searchLower) ||
            JSON.stringify(log.metadata || {})
              .toLowerCase()
              .includes(searchLower),
        );
      }
    }

    return filteredLogs.slice(-limit);
  }

  /**
   * Get log statistics
   */
  getLogStats(filter?: LogFilter): LogStats {
    const logs = this.getLogs(filter);

    const entriesByLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0,
    };

    const entriesByCategory: Record<string, number> = {};
    let startTime = new Date();
    let endTime = new Date(0);

    for (const log of logs) {
      entriesByLevel[log.level]++;
      entriesByCategory[log.category] =
        (entriesByCategory[log.category] || 0) + 1;

      if (log.timestamp < startTime) startTime = log.timestamp;
      if (log.timestamp > endTime) endTime = log.timestamp;
    }

    return {
      totalEntries: logs.length,
      entriesByLevel,
      entriesByCategory,
      timeRange: { start: startTime, end: endTime },
    };
  }

  /**
   * Get metric data
   */
  getMetric(name: string): Metric | null {
    return this.metrics.get(name) || null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metric statistics
   */
  getMetricStats(
    name: string,
    timeRange?: { start: Date; end: Date },
  ): {
    count: number;
    min: number;
    max: number;
    avg: number;
    latest: number;
  } | null {
    const metric = this.metrics.get(name);
    if (!metric) return null;

    let points = metric.points;

    if (timeRange) {
      points = points.filter(
        (p) => p.timestamp >= timeRange.start && p.timestamp <= timeRange.end,
      );
    }

    if (points.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, latest: 0 };
    }

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const latest = values[values.length - 1];

    return { count: points.length, min, max, avg, latest };
  }

  /**
   * Generate log report
   */
  generateLogReport(timeRange?: { start: Date; end: Date }): string {
    const filter: LogFilter = timeRange
      ? {
          startTime: timeRange.start,
          endTime: timeRange.end,
        }
      : {};

    const stats = this.getLogStats(filter);
    const errorLogs = this.getLogs({ ...filter, level: "error" }, 10);
    const criticalLogs = this.getLogs({ ...filter, level: "critical" }, 10);

    let report = "# Process Herder Log Report\n\n";
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Time Range: ${stats.timeRange.start.toISOString()} - ${stats.timeRange.end.toISOString()}\n\n`;

    report += "## Summary\n";
    report += `- Total Entries: ${stats.totalEntries}\n`;
    report += `- Debug: ${stats.entriesByLevel.debug}\n`;
    report += `- Info: ${stats.entriesByLevel.info}\n`;
    report += `- Warn: ${stats.entriesByLevel.warn}\n`;
    report += `- Error: ${stats.entriesByLevel.error}\n`;
    report += `- Critical: ${stats.entriesByLevel.critical}\n\n`;

    report += "## Categories\n";
    for (const [category, count] of Object.entries(stats.entriesByCategory)) {
      report += `- ${category}: ${count}\n`;
    }
    report += "\n";

    if (criticalLogs.length > 0) {
      report += "## Critical Issues\n";
      for (const log of criticalLogs) {
        report += `- ${log.timestamp.toISOString()}: ${log.message}\n`;
      }
      report += "\n";
    }

    if (errorLogs.length > 0) {
      report += "## Recent Errors\n";
      for (const log of errorLogs) {
        report += `- ${log.timestamp.toISOString()}: ${log.message}\n`;
      }
      report += "\n";
    }

    return report;
  }

  /**
   * Export logs to JSON
   */
  exportLogs(filter?: LogFilter): string {
    const logs = this.getLogs(filter);
    return JSON.stringify(
      {
        exportTime: new Date(),
        filter,
        stats: this.getLogStats(filter),
        logs,
      },
      null,
      2,
    );
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify(
      {
        exportTime: new Date(),
        metrics: this.getAllMetrics(),
      },
      null,
      2,
    );
  }

  /**
   * Clear logs
   */
  clearLogs(olderThan?: Date): number {
    const initialCount = this.logs.length;

    if (olderThan) {
      this.logs = this.logs.filter((log) => log.timestamp >= olderThan);
    } else {
      this.logs = [];
    }

    const clearedCount = initialCount - this.logs.length;
    this.saveLogs();

    return clearedCount;
  }

  /**
   * Clear metrics
   */
  clearMetrics(olderThan?: Date): number {
    let clearedCount = 0;

    if (olderThan) {
      for (const metric of this.metrics.values()) {
        const initialPoints = metric.points.length;
        metric.points = metric.points.filter(
          (point) => point.timestamp >= olderThan,
        );
        clearedCount += initialPoints - metric.points.length;
      }
    } else {
      for (const metric of this.metrics.values()) {
        clearedCount += metric.points.length;
        metric.points = [];
      }
    }

    this.saveMetrics();
    return clearedCount;
  }

  /**
   * Get available categories
   */
  getCategories(): string[] {
    return Array.from(this.categories);
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Check if should log at given level
   */
  private shouldLog(level: LogLevel): boolean {
    return this.getLevelPriority(level) >= this.getLevelPriority(this.logLevel);
  }

  /**
   * Get numeric priority for log level
   */
  private getLevelPriority(level: LogLevel): number {
    const priorities = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      critical: 4,
    };
    return priorities[level] || 0;
  }

  /**
   * Add log entry
   */
  private addLogEntry(entry: LogEntry): void {
    this.logs.push(entry);
    this.categories.add(entry.category);

    // Trim logs if exceeding max entries
    if (this.logs.length > this.maxLogEntries) {
      this.logs.splice(0, this.logs.length - this.maxLogEntries);
    }
  }

  /**
   * Get current session ID (placeholder)
   */
  private getCurrentSessionId(): string {
    return process.env.PROCESS_HERDER_SESSION || "default";
  }

  /**
   * Load existing logs from file
   */
  private loadExistingLogs(): void {
    if (!fs.existsSync(this.logFile)) {
      return;
    }

    try {
      const content = fs.readFileSync(this.logFile, "utf8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          entry.timestamp = new Date(entry.timestamp);
          this.logs.push(entry);
          this.categories.add(entry.category);
        } catch (error) {
          // Skip invalid log entries
        }
      }

      // Trim to max entries
      if (this.logs.length > this.maxLogEntries) {
        this.logs.splice(0, this.logs.length - this.maxLogEntries);
      }
    } catch (error) {
      console.error("Failed to load existing logs:", error);
    }
  }

  /**
   * Load existing metrics from file
   */
  private loadExistingMetrics(): void {
    if (!fs.existsSync(this.metricsFile)) {
      return;
    }

    try {
      const content = fs.readFileSync(this.metricsFile, "utf8");
      const data = JSON.parse(content);

      if (data.metrics) {
        for (const metric of data.metrics) {
          // Convert timestamp strings back to Date objects
          metric.points = metric.points.map((p: any) => ({
            ...p,
            timestamp: new Date(p.timestamp),
          }));
          this.metrics.set(metric.name, metric);
        }
      }
    } catch (error) {
      console.error("Failed to load existing metrics:", error);
    }
  }

  /**
   * Save logs to file
   */
  private saveLogs(): void {
    try {
      const logLines = this.logs.map((entry) => JSON.stringify(entry));
      fs.writeFileSync(this.logFile, logLines.join("\n") + "\n");
    } catch (error) {
      console.error("Failed to save logs:", error);
    }
  }

  /**
   * Save metrics to file
   */
  private saveMetrics(): void {
    try {
      const data = {
        exportTime: new Date(),
        metrics: this.getAllMetrics(),
      };
      fs.writeFileSync(this.metricsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to save metrics:", error);
    }
  }

  /**
   * Setup periodic saving
   */
  private setupPeriodicSave(): void {
    // Save logs and metrics every 60 seconds
    this.saveInterval = setInterval(() => {
      this.saveLogs();
      this.saveMetrics();
    }, 60000);

    // Save on exit
    process.on("exit", () => {
      this.saveLogs();
      this.saveMetrics();
    });
  }

  /**
   * Cleanup logging manager
   */
  cleanup(): void {
    // Clear the periodic save interval
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = undefined;
    }

    this.saveLogs();
    this.saveMetrics();
    this.removeAllListeners();
  }
}
