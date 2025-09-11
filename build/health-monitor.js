import { EventEmitter } from "events";
/**
 * Advanced health monitoring system for tracked processes
 */
export class HealthMonitor extends EventEmitter {
    healthHistory = new Map();
    intervalIds = new Map();
    restartCounts = new Map();
    thresholds;
    constructor(thresholds) {
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
    startMonitoring(pid, metadata, interval = 5000) {
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
            }
            catch (error) {
                this.emit("error", pid, error);
            }
        }, interval);
        this.intervalIds.set(pid, intervalId);
        this.emit("monitoring-started", pid);
    }
    /**
     * Stop monitoring a process
     */
    stopMonitoring(pid) {
        const intervalId = this.intervalIds.get(pid);
        if (intervalId) {
            clearInterval(intervalId);
            this.intervalIds.delete(pid);
            this.restartCounts.delete(pid);
            this.emit("monitoring-stopped", pid);
        }
    }
    /**
     * Perform comprehensive health check on a process
     */
    async performHealthCheck(pid, metadata) {
        const issues = [];
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
            isHealthy: issues.length === 0 || !issues.some((i) => i.severity === "critical"),
            healthScore: Math.max(0, healthScore),
            issues,
            lastCheck: now,
            metrics,
        };
    }
    /**
     * Get health history for a process
     */
    getHealthHistory(pid, limit = 50) {
        const history = this.healthHistory.get(pid) || [];
        return history.slice(-limit);
    }
    /**
     * Get health summary for all monitored processes
     */
    getHealthSummary() {
        let healthy = 0;
        let unhealthy = 0;
        let critical = 0;
        const allIssues = [];
        for (const [pid, history] of this.healthHistory.entries()) {
            if (history.length === 0)
                continue;
            const latest = history[history.length - 1];
            const hasCritical = latest.issues.some((i) => i.severity === "critical");
            if (hasCritical) {
                critical++;
                allIssues.push(...latest.issues.filter((i) => i.severity === "critical"));
            }
            else if (latest.isHealthy) {
                healthy++;
            }
            else {
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
    getProcessesNeedingAttention() {
        const results = [];
        for (const history of this.healthHistory.values()) {
            if (history.length === 0)
                continue;
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
    recordHealthCheck(pid, result) {
        const history = this.healthHistory.get(pid) || [];
        history.push(result);
        // Keep only last 100 entries per process
        if (history.length > 100) {
            history.splice(0, history.length - 100);
        }
        this.healthHistory.set(pid, history);
    }
    /**
     * Record a process restart
     */
    recordProcessRestart(pid) {
        const currentCount = this.restartCounts.get(pid) || 0;
        this.restartCounts.set(pid, currentCount + 1);
        this.emit("process-restarted", { pid, restartCount: currentCount + 1 });
    }
    /**
     * Measure response time for process (basic ping test)
     */
    async measureResponseTime(pid, metadata) {
        // If process has readiness probe, use it for response time measurement
        if (metadata.readiness) {
            const startTime = Date.now();
            try {
                if (metadata.readiness.type === "port") {
                    const port = typeof metadata.readiness.value === 'string'
                        ? parseInt(metadata.readiness.value)
                        : metadata.readiness.value;
                    await this.testPortConnection(port);
                    return Date.now() - startTime;
                }
                else if (metadata.readiness.type === "http") {
                    await this.testHttpConnection(metadata.readiness.value);
                    return Date.now() - startTime;
                }
            }
            catch (error) {
                // If readiness check fails, don't return response time
                return undefined;
            }
        }
        return undefined;
    }
    /**
     * Test TCP port connection
     */
    testPortConnection(port) {
        return new Promise((resolve, reject) => {
            const net = require("net");
            const socket = net.createConnection({ port }, () => {
                socket.destroy();
                resolve();
            });
            socket.on("error", () => {
                socket.destroy();
                reject(new Error(`Port ${port} not reachable`));
            });
            socket.setTimeout(5000, () => {
                socket.destroy();
                reject(new Error(`Port ${port} timeout`));
            });
        });
    }
    /**
     * Test HTTP connection
     */
    testHttpConnection(url) {
        return new Promise((resolve, reject) => {
            const https = url.startsWith("https:") ? require("https") : require("http");
            const req = https.get(url, (res) => {
                resolve();
            });
            req.on("error", reject);
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error(`HTTP request timeout for ${url}`));
            });
        });
    }
    /**
     * Get process info from system
     */
    async getProcessInfo(pid) {
        // This would integrate with ps-list or similar
        try {
            const psList = await import("ps-list");
            const processes = await psList.default();
            return processes.find((p) => p.pid === pid) || null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Safely get time from a Date object or date string
     */
    safeDateToTime(date) {
        if (!date)
            return undefined;
        if (typeof date === 'string') {
            return new Date(date).getTime();
        }
        if (date instanceof Date) {
            return date.getTime();
        }
        return undefined;
    }
    /**
     * Calculate comprehensive metrics for a process
     */
    async calculateMetrics(pid, processInfo, metadata) {
        const history = this.healthHistory.get(pid) || [];
        const previousMetrics = history.length > 0 ? history[history.length - 1].metrics : null;
        const cpuUsage = processInfo.cpu || 0;
        const memoryUsage = processInfo.memory || 0;
        const uptime = metadata.startTime
            ? Date.now() - this.safeDateToTime(metadata.startTime)
            : 0;
        const errorCount = metadata.logs?.filter((log) => log.includes("[ERROR]")).length || 0;
        // Determine memory trend
        let memoryTrend = "stable";
        if (previousMetrics) {
            const memoryDiff = memoryUsage - previousMetrics.memoryUsage;
            const threshold = 5 * 1024 * 1024; // 5MB threshold
            if (memoryDiff > threshold) {
                memoryTrend = "increasing";
            }
            else if (memoryDiff < -threshold) {
                memoryTrend = "decreasing";
            }
        }
        return {
            cpuUsage,
            memoryUsage,
            memoryTrend,
            uptime,
            errorCount,
            restartCount: this.restartCounts.get(pid) || 0,
            responseTime: await this.measureResponseTime(pid, metadata)
        };
    }
    /**
     * Check if process is unresponsive
     */
    async isProcessUnresponsive(pid, metadata) {
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
    getDefaultMetrics() {
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
    cleanup() {
        for (const intervalId of this.intervalIds.values()) {
            clearInterval(intervalId);
        }
        this.intervalIds.clear();
        this.healthHistory.clear();
        this.removeAllListeners();
    }
}
//# sourceMappingURL=health-monitor.js.map