import { EventEmitter } from "events";
import { ProcessInfo, ProcessMetadata } from "./process-manager.js";

export interface HealthCheckResult {
  pid: number;
  name: string;
  isHealthy: boolean;
  healthScore: number; // 0-100
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
export class HealthMonitor extends EventEmitter {
  private healthHistory = new Map<number, HealthCheckResult[]>();
  private intervalIds = new Map<number, NodeJS.Timeout>();
  private thresholds: HealthThresholds;

  constructor(thresholds?: Partial<HealthThresholds>) {
    super();
    this.thresholds = {
      maxCpuUsage: 80, // 80%
      maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
      maxMemoryIncrease: 50 * 1024 * 1024, // 50MB
      maxErrorCount: 5,
      unresponsiveTimeout: 30000, // 30 seconds
      ...thresholds,
    };
  }

  /**
   * Start monitoring a process
   */
  startMonitoring(
    pid: number,
    metadata: ProcessMetadata,
    interval = 5000,
  ): void {
    // Stop existing monitoring if any
    this.stopMonitoring(pid);

    const intervalId = setInterval(async () => {
      try {
        const healthResult = await this.performHealthCheck(pid, metadata);
        this.recordHealthCheck(pid, healthResult);

        // Emit events for health changes
        if (!healthResult.isHealthy) {
          this.emit("unhealthy", healthResult);
        }

        for (const issue of healthResult.issues) {
          if (issue.severity === "critical") {
            this.emit("critical", healthResult, issue);
          }
        }
      } catch (error) {
        this.emit("error", pid, error);
      }
    }, interval);

    this.intervalIds.set(pid, intervalId);
    this.emit("monitoring-started", pid);
  }

  /**
   * Stop monitoring a process
   */
  stopMonitoring(pid: number): void {
    const intervalId = this.intervalIds.get(pid);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervalIds.delete(pid);
      this.emit("monitoring-stopped", pid);
    }
  }

  /**
   * Perform comprehensive health check on a process
   */
  async performHealthCheck(
    pid: number,
    metadata: ProcessMetadata,
  ): Promise<HealthCheckResult> {
    const issues: HealthIssue[] = [];
    let healthScore = 100;
    const now = new Date();

    // Get current process info
    const processInfo = await this.getProcessInfo(pid);

    if (!processInfo) {
      return {
        pid,
        name: metadata.name,
        isHealthy: false,
        healthScore: 0,
        issues: [
          {
            type: "zombie",
            severity: "critical",
            message: "Process not found - may have crashed or been terminated",
            timestamp: now,
          },
        ],
        lastCheck: now,
        metrics: this.getDefaultMetrics(),
      };
    }

    // Calculate metrics
    const metrics = await this.calculateMetrics(pid, processInfo, metadata);

    // Check CPU usage
    if (metrics.cpuUsage > this.thresholds.maxCpuUsage) {
      issues.push({
        type: "cpu",
        severity: metrics.cpuUsage > 95 ? "critical" : "high",
        message: `High CPU usage: ${metrics.cpuUsage.toFixed(1)}%`,
        timestamp: now,
      });
      healthScore -= 20;
    }

    // Check memory usage
    if (metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      issues.push({
        type: "memory",
        severity: "high",
        message: `High memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB`,
        timestamp: now,
      });
      healthScore -= 15;
    }

    // Check memory trend
    if (metrics.memoryTrend === "increasing") {
      const history = this.healthHistory.get(pid) || [];
      if (history.length > 0) {
        const lastMetrics = history[history.length - 1].metrics;
        const memoryIncrease = metrics.memoryUsage - lastMetrics.memoryUsage;

        if (memoryIncrease > this.thresholds.maxMemoryIncrease) {
          issues.push({
            type: "memory",
            severity: "medium",
            message: `Memory leak detected: +${(memoryIncrease / 1024 / 1024).toFixed(1)}MB`,
            timestamp: now,
          });
          healthScore -= 10;
        }
      }
    }

    // Check error count
    if (metrics.errorCount > this.thresholds.maxErrorCount) {
      issues.push({
        type: "error",
        severity: "high",
        message: `High error count: ${metrics.errorCount} errors`,
        timestamp: now,
      });
      healthScore -= 25;
    }

    // Check if process is responsive (for tasks with known endpoints)
    if (metadata.isTask && (await this.isProcessUnresponsive(pid, metadata))) {
      issues.push({
        type: "unresponsive",
        severity: "critical",
        message: "Process appears to be unresponsive",
        timestamp: now,
      });
      healthScore -= 30;
    }

    return {
      pid,
      name: metadata.name,
      isHealthy:
        issues.length === 0 || !issues.some((i) => i.severity === "critical"),
      healthScore: Math.max(0, healthScore),
      issues,
      lastCheck: now,
      metrics,
    };
  }

  /**
   * Get health history for a process
   */
  getHealthHistory(pid: number, limit = 50): HealthCheckResult[] {
    const history = this.healthHistory.get(pid) || [];
    return history.slice(-limit);
  }

  /**
   * Get health summary for all monitored processes
   */
  getHealthSummary(): {
    healthy: number;
    unhealthy: number;
    critical: number;
    total: number;
    issues: HealthIssue[];
  } {
    let healthy = 0;
    let unhealthy = 0;
    let critical = 0;
    const allIssues: HealthIssue[] = [];

    for (const [pid, history] of this.healthHistory.entries()) {
      if (history.length === 0) continue;

      const latest = history[history.length - 1];
      const hasCritical = latest.issues.some((i) => i.severity === "critical");

      if (hasCritical) {
        critical++;
        allIssues.push(
          ...latest.issues.filter((i) => i.severity === "critical"),
        );
      } else if (latest.isHealthy) {
        healthy++;
      } else {
        unhealthy++;
        allIssues.push(...latest.issues);
      }
    }

    return {
      healthy,
      unhealthy,
      critical,
      total: healthy + unhealthy + critical,
      issues: allIssues.slice(-20), // Last 20 issues
    };
  }

  /**
   * Get processes that need attention
   */
  getProcessesNeedingAttention(): HealthCheckResult[] {
    const results: HealthCheckResult[] = [];

    for (const history of this.healthHistory.values()) {
      if (history.length === 0) continue;

      const latest = history[history.length - 1];
      if (!latest.isHealthy || latest.healthScore < 70) {
        results.push(latest);
      }
    }

    return results.sort((a, b) => a.healthScore - b.healthScore);
  }

  /**
   * Record a health check result
   */
  private recordHealthCheck(pid: number, result: HealthCheckResult): void {
    const history = this.healthHistory.get(pid) || [];
    history.push(result);

    // Keep only last 100 entries per process
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    this.healthHistory.set(pid, history);
  }

  /**
   * Get process information (placeholder - would use ps-list in real implementation)
   */
  private async getProcessInfo(pid: number): Promise<any | null> {
    // This would integrate with ps-list or similar
    try {
      const psList = await import("ps-list");
      const processes = await psList.default();
      return processes.find((p) => p.pid === pid) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate comprehensive metrics for a process
   */
  private async calculateMetrics(
    pid: number,
    processInfo: any,
    metadata: ProcessMetadata,
  ): Promise<ProcessMetrics> {
    const history = this.healthHistory.get(pid) || [];
    const previousMetrics =
      history.length > 0 ? history[history.length - 1].metrics : null;

    const cpuUsage = processInfo.cpu || 0;
    const memoryUsage = processInfo.memory || 0;
    const uptime = metadata.startTime
      ? Date.now() - metadata.startTime.getTime()
      : 0;
    const errorCount =
      metadata.logs?.filter((log) => log.includes("[ERROR]")).length || 0;

    // Determine memory trend
    let memoryTrend: "stable" | "increasing" | "decreasing" = "stable";
    if (previousMetrics) {
      const memoryDiff = memoryUsage - previousMetrics.memoryUsage;
      const threshold = 5 * 1024 * 1024; // 5MB threshold

      if (memoryDiff > threshold) {
        memoryTrend = "increasing";
      } else if (memoryDiff < -threshold) {
        memoryTrend = "decreasing";
      }
    }

    return {
      cpuUsage,
      memoryUsage,
      memoryTrend,
      uptime,
      errorCount,
      restartCount: 0, // TODO: Track this
      responseTime: undefined, // TODO: Implement ping test
    };
  }

  /**
   * Check if process is unresponsive
   */
  private async isProcessUnresponsive(
    pid: number,
    metadata: ProcessMetadata,
  ): Promise<boolean> {
    // This is a placeholder for more sophisticated responsiveness checking
    // Could include:
    // - HTTP health check endpoints
    // - TCP socket checks
    // - File system activity monitoring
    // - Log output monitoring

    return false;
  }

  /**
   * Get default metrics for when process is not found
   */
  private getDefaultMetrics(): ProcessMetrics {
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      memoryTrend: "stable",
      uptime: 0,
      errorCount: 0,
      restartCount: 0,
    };
  }

  /**
   * Cleanup all monitoring
   */
  cleanup(): void {
    for (const intervalId of this.intervalIds.values()) {
      clearInterval(intervalId);
    }
    this.intervalIds.clear();
    this.healthHistory.clear();
    this.removeAllListeners();
  }
}
