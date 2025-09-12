import { EventEmitter } from "events";
/**
 * Advanced process recovery and auto-healing system
 */
export class ProcessRecoveryManager extends EventEmitter {
    processManager;
    healthMonitor;
    recoveryConfigs = new Map();
    recoveryAttempts = new Map();
    conditionTimers = new Map();
    shuttingDownProcesses = new Set();
    globalShutdown = false;
    constructor(processManager, healthMonitor) {
        super();
        this.processManager = processManager;
        this.healthMonitor = healthMonitor;
        this.setupEventListeners();
        this.setupProcessManagerListeners();
        this.loadDefaultStrategies();
    }
    /**
     * Set up event listeners for health monitoring
     */
    setupEventListeners() {
        this.healthMonitor.on("unhealthy", (healthResult) => {
            this.handleUnhealthyProcess(healthResult);
        });
        this.healthMonitor.on("critical", (healthResult) => {
            this.handleCriticalProcess(healthResult);
        });
    }
    /**
     * Set up event listeners for process manager shutdown coordination
     */
    setupProcessManagerListeners() {
        this.processManager.on("processShuttingDown", (pid) => {
            this.shuttingDownProcesses.add(pid);
            // Clear any ongoing recovery attempts for this process
            this.clearRecoveryAttempts(pid);
        });
        this.processManager.on("processShutdownIntentional", (pid) => {
            this.shuttingDownProcesses.add(pid);
            this.clearRecoveryAttempts(pid);
        });
        this.processManager.on("globalShutdown", () => {
            this.globalShutdown = true;
            // Clear all recovery attempts during global shutdown
            this.recoveryAttempts.clear();
            // Clear all condition timers
            for (const timer of this.conditionTimers.values()) {
                clearTimeout(timer);
            }
            this.conditionTimers.clear();
        });
    }
    /**
     * Load default recovery strategies
     */
    loadDefaultStrategies() {
        // Strategy 1: Restart on high error count
        const errorRecoveryStrategy = {
            name: "error-restart",
            conditions: [
                {
                    type: "error-count",
                    operator: "gte",
                    value: 5,
                    duration: 30000, // 30 seconds
                },
            ],
            actions: [
                {
                    type: "restart",
                    delay: 2000,
                },
            ],
            maxAttempts: 3,
            cooldownPeriod: 60000, // 1 minute
            enabled: true,
        };
        // Strategy 2: Kill and restart unresponsive processes
        const unresponsiveStrategy = {
            name: "unresponsive-kill-restart",
            conditions: [
                {
                    type: "unresponsive",
                    operator: "eq",
                    value: 1,
                    duration: 60000, // 1 minute
                },
            ],
            actions: [
                { type: "cleanup", delay: 0 },
                { type: "kill-restart", delay: 5000 },
            ],
            maxAttempts: 2,
            cooldownPeriod: 300000, // 5 minutes
            enabled: true,
        };
        // Strategy 3: Restart on low health score
        const healthScoreStrategy = {
            name: "health-score-restart",
            conditions: [
                {
                    type: "health-score",
                    operator: "lt",
                    value: 30,
                    duration: 120000, // 2 minutes
                },
            ],
            actions: [
                {
                    type: "restart",
                    delay: 1000,
                },
            ],
            maxAttempts: 2,
            cooldownPeriod: 180000, // 3 minutes
            enabled: true,
        };
        // Strategy 4: Memory cleanup and restart
        const memoryStrategy = {
            name: "memory-restart",
            conditions: [
                {
                    type: "memory-usage",
                    operator: "gt",
                    value: 2 * 1024 * 1024 * 1024, // 2GB
                    duration: 60000, // 1 minute
                },
            ],
            actions: [
                {
                    type: "notify",
                    delay: 0,
                    parameters: { message: "High memory usage detected" },
                },
                { type: "restart", delay: 5000 },
            ],
            maxAttempts: 1,
            cooldownPeriod: 300000, // 5 minutes
            enabled: true,
        };
        // Default configuration for all processes
        const defaultConfig = {
            processName: "default",
            strategies: [
                errorRecoveryStrategy,
                unresponsiveStrategy,
                healthScoreStrategy,
                memoryStrategy,
            ],
            alertThresholds: {
                maxRestarts: 5,
                timeWindow: 3600000, // 1 hour
            },
        };
        this.recoveryConfigs.set("default", defaultConfig);
    }
    /**
     * Configure recovery strategies for a specific process
     */
    configureProcessRecovery(processName, config) {
        this.recoveryConfigs.set(processName, config);
        this.emit("recovery-configured", processName, config);
    }
    /**
     * Handle unhealthy process
     */
    async handleUnhealthyProcess(healthResult) {
        // Skip recovery for processes that are shutting down
        if (this.shuttingDownProcesses.has(healthResult.pid) || this.globalShutdown) {
            return;
        }
        const config = this.getProcessConfig(healthResult.name);
        for (const strategy of config.strategies) {
            if (!strategy.enabled)
                continue;
            if (await this.shouldApplyStrategy(healthResult, strategy)) {
                await this.applyRecoveryStrategy(healthResult, strategy);
                break; // Apply only the first matching strategy
            }
        }
    }
    /**
     * Handle critical process issues
     */
    async handleCriticalProcess(healthResult) {
        // Skip recovery for processes that are shutting down
        if (this.shuttingDownProcesses.has(healthResult.pid) || this.globalShutdown) {
            return;
        }
        this.emit("critical-alert", {
            processName: healthResult.name,
            pid: healthResult.pid,
            issues: healthResult.issues,
            healthScore: healthResult.healthScore,
            timestamp: new Date(),
        });
        // For critical issues, apply emergency recovery immediately
        const emergencyStrategy = {
            name: "emergency-restart",
            conditions: [],
            actions: [{ type: "kill-restart", delay: 0 }],
            maxAttempts: 1,
            cooldownPeriod: 0,
            enabled: true,
        };
        await this.applyRecoveryStrategy(healthResult, emergencyStrategy);
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
     * Check if a recovery strategy should be applied
     */
    async shouldApplyStrategy(healthResult, strategy) {
        // Check if we've exceeded max attempts
        const attempts = this.getRecoveryAttempts(healthResult.pid, strategy.name);
        if (attempts.length >= strategy.maxAttempts) {
            const lastAttempt = attempts[attempts.length - 1];
            const timeSinceLastAttempt = Date.now() - (this.safeDateToTime(lastAttempt.timestamp) || 0);
            if (timeSinceLastAttempt < strategy.cooldownPeriod) {
                return false; // Still in cooldown period
            }
            // Reset attempts if cooldown period has passed
            this.clearOldRecoveryAttempts(healthResult.pid, strategy.name);
        }
        // Check all conditions
        for (const condition of strategy.conditions) {
            if (!(await this.checkCondition(healthResult, condition))) {
                return false;
            }
        }
        return true;
    }
    /**
     * Check if a specific condition is met
     */
    async checkCondition(healthResult, condition) {
        let value;
        switch (condition.type) {
            case "health-score":
                value = healthResult.healthScore;
                break;
            case "error-count":
                value = healthResult.metrics.errorCount;
                break;
            case "memory-usage":
                value = healthResult.metrics.memoryUsage;
                break;
            case "cpu-usage":
                value = healthResult.metrics.cpuUsage;
                break;
            case "unresponsive":
                value = healthResult.issues.some((i) => i.type === "unresponsive")
                    ? 1
                    : 0;
                break;
            case "crashed":
                value = healthResult.issues.some((i) => i.type === "zombie") ? 1 : 0;
                break;
            default:
                return false;
        }
        // Check the condition
        const conditionMet = this.evaluateCondition(value, condition.operator, condition.value);
        // If condition has a duration requirement, track it
        if (condition.duration && condition.duration > 0) {
            const conditionKey = `${healthResult.pid}-${condition.type}-${condition.operator}-${condition.value}`;
            if (conditionMet) {
                if (!this.conditionTimers.has(conditionKey)) {
                    // Start timer for this condition
                    const timer = setTimeout(() => {
                        this.conditionTimers.delete(conditionKey);
                    }, condition.duration);
                    this.conditionTimers.set(conditionKey, timer);
                    return false; // Condition just started, wait for duration
                }
                // Condition has been met for required duration
                return true;
            }
            else {
                // Condition not met, clear any existing timer
                const timer = this.conditionTimers.get(conditionKey);
                if (timer) {
                    clearTimeout(timer);
                    this.conditionTimers.delete(conditionKey);
                }
                return false;
            }
        }
        return conditionMet;
    }
    /**
     * Evaluate a condition operator
     */
    evaluateCondition(actual, operator, expected) {
        switch (operator) {
            case "gt":
                return actual > expected;
            case "lt":
                return actual < expected;
            case "eq":
                return actual === expected;
            case "gte":
                return actual >= expected;
            case "lte":
                return actual <= expected;
            default:
                return false;
        }
    }
    /**
     * Apply a recovery strategy
     */
    async applyRecoveryStrategy(healthResult, strategy) {
        const attempt = {
            pid: healthResult.pid,
            processName: healthResult.name,
            strategy: strategy.name,
            timestamp: new Date(),
            actions: strategy.actions,
            success: false,
        };
        try {
            this.emit("recovery-started", attempt);
            for (const action of strategy.actions) {
                if (action.delay && action.delay > 0) {
                    await this.delay(action.delay);
                }
                await this.executeRecoveryAction(healthResult, action);
            }
            attempt.success = true;
            this.emit("recovery-success", attempt);
        }
        catch (error) {
            attempt.error = error instanceof Error ? error.message : String(error);
            this.emit("recovery-failed", attempt);
        }
        this.recordRecoveryAttempt(healthResult.pid, attempt);
    }
    /**
     * Execute a specific recovery action
     */
    async executeRecoveryAction(healthResult, action) {
        switch (action.type) {
            case "restart":
                await this.processManager.restartProcess(healthResult.pid);
                this.healthMonitor.recordProcessRestart(healthResult.pid);
                break;
            case "kill-restart":
                await this.processManager.stopProcess(healthResult.pid, true);
                await this.delay(2000); // Wait before restart
                // The restart would need additional logic to re-run the same command
                break;
            case "cleanup":
                await this.performCleanup(healthResult);
                break;
            case "notify":
                this.emit("recovery-notification", {
                    processName: healthResult.name,
                    message: action.parameters?.message || "Recovery action triggered",
                    timestamp: new Date(),
                });
                break;
            case "custom":
                await this.executeCustomAction(healthResult, action);
                break;
            default:
                throw new Error(`Unknown recovery action type: ${action.type}`);
        }
    }
    /**
     * Perform cleanup operations
     */
    async performCleanup(healthResult) {
        // Cleanup could include:
        // - Clearing temporary files
        // - Flushing logs
        // - Releasing resources
        // - Closing file handles
        this.emit("cleanup-performed", {
            processName: healthResult.name,
            pid: healthResult.pid,
            timestamp: new Date(),
        });
    }
    /**
     * Execute custom recovery action
     */
    async executeCustomAction(healthResult, action) {
        // Custom actions would be defined by user configuration
        // This is a placeholder for extensibility
        this.emit("custom-action-executed", {
            processName: healthResult.name,
            action: action.parameters,
            timestamp: new Date(),
        });
    }
    /**
     * Get process configuration
     */
    getProcessConfig(processName) {
        return (this.recoveryConfigs.get(processName) ||
            this.recoveryConfigs.get("default"));
    }
    /**
     * Get recovery attempts for a process and strategy
     */
    getRecoveryAttempts(pid, strategyName) {
        const allAttempts = this.recoveryAttempts.get(pid) || [];
        return allAttempts.filter((attempt) => attempt.strategy === strategyName);
    }
    /**
     * Record a recovery attempt
     */
    recordRecoveryAttempt(pid, attempt) {
        const attempts = this.recoveryAttempts.get(pid) || [];
        attempts.push(attempt);
        // Keep only last 50 attempts per process
        if (attempts.length > 50) {
            attempts.splice(0, attempts.length - 50);
        }
        this.recoveryAttempts.set(pid, attempts);
    }
    /**
     * Clear old recovery attempts for a strategy
     */
    clearOldRecoveryAttempts(pid, strategyName) {
        const attempts = this.recoveryAttempts.get(pid) || [];
        const filteredAttempts = attempts.filter((attempt) => attempt.strategy !== strategyName);
        this.recoveryAttempts.set(pid, filteredAttempts);
    }
    /**
     * Get recovery statistics
     */
    getRecoveryStatistics() {
        let totalAttempts = 0;
        let successfulAttempts = 0;
        let failedAttempts = 0;
        const processFailures = new Map();
        const strategyUsage = new Map();
        for (const attempts of this.recoveryAttempts.values()) {
            for (const attempt of attempts) {
                totalAttempts++;
                if (attempt.success) {
                    successfulAttempts++;
                }
                else {
                    failedAttempts++;
                    processFailures.set(attempt.processName, (processFailures.get(attempt.processName) || 0) + 1);
                }
                strategyUsage.set(attempt.strategy, (strategyUsage.get(attempt.strategy) || 0) + 1);
            }
        }
        const topFailingProcesses = Array.from(processFailures.entries())
            .map(([name, failures]) => ({ name, failures }))
            .sort((a, b) => b.failures - a.failures)
            .slice(0, 5);
        const strategiesUsed = Array.from(strategyUsage.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        return {
            totalAttempts,
            successfulAttempts,
            failedAttempts,
            topFailingProcesses,
            strategiesUsed,
        };
    }
    /**
     * Utility function for delays
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Clear recovery attempts for a specific process
     */
    clearRecoveryAttempts(pid) {
        this.recoveryAttempts.delete(pid);
        // Clear any condition timers for this process
        const timersToDelete = [];
        for (const [key, timer] of this.conditionTimers.entries()) {
            if (key.startsWith(`${pid}-`)) {
                clearTimeout(timer);
                timersToDelete.push(key);
            }
        }
        for (const key of timersToDelete) {
            this.conditionTimers.delete(key);
        }
    }
    /**
     * Cleanup recovery manager
     */
    cleanup() {
        // Clear all condition timers
        for (const timer of this.conditionTimers.values()) {
            clearTimeout(timer);
        }
        this.conditionTimers.clear();
        this.recoveryAttempts.clear();
        this.shuttingDownProcesses.clear();
        this.globalShutdown = false;
        this.removeAllListeners();
    }
}
//# sourceMappingURL=recovery-manager.js.map