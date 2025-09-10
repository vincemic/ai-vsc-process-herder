import { EventEmitter } from "events";
import { ProcessManager } from "./process-manager.js";
import { HealthMonitor, HealthCheckResult } from "./health-monitor.js";

export interface RecoveryStrategy {
  name: string;
  conditions: RecoveryCondition[];
  actions: RecoveryAction[];
  maxAttempts: number;
  cooldownPeriod: number; // milliseconds
  enabled: boolean;
}

export interface RecoveryCondition {
  type:
    | "health-score"
    | "error-count"
    | "memory-usage"
    | "cpu-usage"
    | "unresponsive"
    | "crashed";
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  value: number;
  duration?: number; // condition must persist for this duration
}

export interface RecoveryAction {
  type:
    | "restart"
    | "kill-restart"
    | "scale-down"
    | "notify"
    | "cleanup"
    | "custom";
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
    timeWindow: number; // milliseconds
  };
}

/**
 * Advanced process recovery and auto-healing system
 */
export class ProcessRecoveryManager extends EventEmitter {
  private processManager: ProcessManager;
  private healthMonitor: HealthMonitor;
  private recoveryConfigs = new Map<string, ProcessRecoveryConfig>();
  private recoveryAttempts = new Map<number, RecoveryAttempt[]>();
  private conditionTimers = new Map<string, NodeJS.Timeout>();

  constructor(processManager: ProcessManager, healthMonitor: HealthMonitor) {
    super();
    this.processManager = processManager;
    this.healthMonitor = healthMonitor;

    this.setupEventListeners();
    this.loadDefaultStrategies();
  }

  /**
   * Set up event listeners for health monitoring
   */
  private setupEventListeners(): void {
    this.healthMonitor.on("unhealthy", (healthResult: HealthCheckResult) => {
      this.handleUnhealthyProcess(healthResult);
    });

    this.healthMonitor.on("critical", (healthResult: HealthCheckResult) => {
      this.handleCriticalProcess(healthResult);
    });
  }

  /**
   * Load default recovery strategies
   */
  private loadDefaultStrategies(): void {
    // Strategy 1: Restart on high error count
    const errorRecoveryStrategy: RecoveryStrategy = {
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
    const unresponsiveStrategy: RecoveryStrategy = {
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
    const healthScoreStrategy: RecoveryStrategy = {
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
    const memoryStrategy: RecoveryStrategy = {
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
    const defaultConfig: ProcessRecoveryConfig = {
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
  configureProcessRecovery(
    processName: string,
    config: ProcessRecoveryConfig,
  ): void {
    this.recoveryConfigs.set(processName, config);
    this.emit("recovery-configured", processName, config);
  }

  /**
   * Handle unhealthy process
   */
  private async handleUnhealthyProcess(
    healthResult: HealthCheckResult,
  ): Promise<void> {
    const config = this.getProcessConfig(healthResult.name);

    for (const strategy of config.strategies) {
      if (!strategy.enabled) continue;

      if (await this.shouldApplyStrategy(healthResult, strategy)) {
        await this.applyRecoveryStrategy(healthResult, strategy);
        break; // Apply only the first matching strategy
      }
    }
  }

  /**
   * Handle critical process issues
   */
  private async handleCriticalProcess(
    healthResult: HealthCheckResult,
  ): Promise<void> {
    this.emit("critical-alert", {
      processName: healthResult.name,
      pid: healthResult.pid,
      issues: healthResult.issues,
      healthScore: healthResult.healthScore,
      timestamp: new Date(),
    });

    // For critical issues, apply emergency recovery immediately
    const emergencyStrategy: RecoveryStrategy = {
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
  private safeDateToTime(date: Date | string | undefined): number | undefined {
    if (!date) return undefined;
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
  private async shouldApplyStrategy(
    healthResult: HealthCheckResult,
    strategy: RecoveryStrategy,
  ): Promise<boolean> {
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
  private async checkCondition(
    healthResult: HealthCheckResult,
    condition: RecoveryCondition,
  ): Promise<boolean> {
    let value: number;

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
    const conditionMet = this.evaluateCondition(
      value,
      condition.operator,
      condition.value,
    );

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
      } else {
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
  private evaluateCondition(
    actual: number,
    operator: string,
    expected: number,
  ): boolean {
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
  private async applyRecoveryStrategy(
    healthResult: HealthCheckResult,
    strategy: RecoveryStrategy,
  ): Promise<void> {
    const attempt: RecoveryAttempt = {
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
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : String(error);
      this.emit("recovery-failed", attempt);
    }

    this.recordRecoveryAttempt(healthResult.pid, attempt);
  }

  /**
   * Execute a specific recovery action
   */
  private async executeRecoveryAction(
    healthResult: HealthCheckResult,
    action: RecoveryAction,
  ): Promise<void> {
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
  private async performCleanup(healthResult: HealthCheckResult): Promise<void> {
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
  private async executeCustomAction(
    healthResult: HealthCheckResult,
    action: RecoveryAction,
  ): Promise<void> {
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
  private getProcessConfig(processName: string): ProcessRecoveryConfig {
    return (
      this.recoveryConfigs.get(processName) ||
      this.recoveryConfigs.get("default")!
    );
  }

  /**
   * Get recovery attempts for a process and strategy
   */
  private getRecoveryAttempts(
    pid: number,
    strategyName: string,
  ): RecoveryAttempt[] {
    const allAttempts = this.recoveryAttempts.get(pid) || [];
    return allAttempts.filter((attempt) => attempt.strategy === strategyName);
  }

  /**
   * Record a recovery attempt
   */
  private recordRecoveryAttempt(pid: number, attempt: RecoveryAttempt): void {
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
  private clearOldRecoveryAttempts(pid: number, strategyName: string): void {
    const attempts = this.recoveryAttempts.get(pid) || [];
    const filteredAttempts = attempts.filter(
      (attempt) => attempt.strategy !== strategyName,
    );
    this.recoveryAttempts.set(pid, filteredAttempts);
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStatistics(): {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    topFailingProcesses: { name: string; failures: number }[];
    strategiesUsed: { name: string; count: number }[];
  } {
    let totalAttempts = 0;
    let successfulAttempts = 0;
    let failedAttempts = 0;
    const processFailures = new Map<string, number>();
    const strategyUsage = new Map<string, number>();

    for (const attempts of this.recoveryAttempts.values()) {
      for (const attempt of attempts) {
        totalAttempts++;

        if (attempt.success) {
          successfulAttempts++;
        } else {
          failedAttempts++;
          processFailures.set(
            attempt.processName,
            (processFailures.get(attempt.processName) || 0) + 1,
          );
        }

        strategyUsage.set(
          attempt.strategy,
          (strategyUsage.get(attempt.strategy) || 0) + 1,
        );
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
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup recovery manager
   */
  cleanup(): void {
    // Clear all condition timers
    for (const timer of this.conditionTimers.values()) {
      clearTimeout(timer);
    }
    this.conditionTimers.clear();

    this.recoveryAttempts.clear();
    this.removeAllListeners();
  }
}
