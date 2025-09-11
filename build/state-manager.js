import * as fs from "fs";
import * as path from "path";
import * as os from "os";
/**
 * Manages persistent state for processes across restarts and crashes
 */
export class ProcessStateManager {
    stateFile;
    snapshotDir;
    currentSession;
    autoSaveInterval = null;
    constructor(workspaceRoot) {
        const root = workspaceRoot || process.cwd();
        const stateDir = path.join(root, ".vscode", "process-herder");
        // Ensure state directory exists
        if (!fs.existsSync(stateDir)) {
            fs.mkdirSync(stateDir, { recursive: true });
        }
        this.stateFile = path.join(stateDir, "process-state.json");
        this.snapshotDir = path.join(stateDir, "snapshots");
        if (!fs.existsSync(this.snapshotDir)) {
            fs.mkdirSync(this.snapshotDir, { recursive: true });
        }
        this.currentSession = this.createNewSession(root);
        this.loadPreviousState();
        this.startAutoSave();
        // Setup cleanup handlers
        process.on("exit", () => this.saveStateSync());
        process.on("SIGINT", () => this.saveStateSync());
        process.on("SIGTERM", () => this.saveStateSync());
    }
    /**
     * Create a new session
     */
    createNewSession(workspace) {
        return {
            sessionId: this.generateSessionId(),
            startTime: new Date(),
            processes: [],
            workspace,
            version: "1.0.0",
        };
    }
    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
     * Deserialize session data from JSON, converting string dates back to Date objects
     */
    deserializeSessionData(rawSession) {
        const session = {
            ...rawSession,
            startTime: new Date(rawSession.startTime),
            endTime: rawSession.endTime ? new Date(rawSession.endTime) : undefined,
            processes: rawSession.processes.map((p) => ({
                ...p,
                startTime: new Date(p.startTime),
                lastSeen: new Date(p.lastSeen),
                metadata: {
                    ...p.metadata,
                    startTime: p.metadata.startTime ? new Date(p.metadata.startTime) : undefined,
                    readyAt: p.metadata.readyAt ? new Date(p.metadata.readyAt) : undefined,
                },
            })),
        };
        return session;
    }
    /**
     * Deserialize snapshot data from JSON, converting string dates back to Date objects
     */
    deserializeSnapshotData(rawSnapshot) {
        const snapshot = {
            ...rawSnapshot,
            timestamp: new Date(rawSnapshot.timestamp),
            processes: rawSnapshot.processes.map((p) => ({
                ...p,
                startTime: new Date(p.startTime),
                lastSeen: new Date(p.lastSeen),
                metadata: {
                    ...p.metadata,
                    startTime: p.metadata.startTime ? new Date(p.metadata.startTime) : undefined,
                    readyAt: p.metadata.readyAt ? new Date(p.metadata.readyAt) : undefined,
                },
            })),
        };
        return snapshot;
    }
    /**
     * Load previous state from disk
     */
    loadPreviousState() {
        if (!fs.existsSync(this.stateFile)) {
            return;
        }
        try {
            const stateData = fs.readFileSync(this.stateFile, "utf8");
            const rawSession = JSON.parse(stateData);
            // Deserialize dates properly
            const previousSession = this.deserializeSessionData(rawSession);
            // Process recovery logic - check if any processes should be restored
            const recoverableProcesses = previousSession.processes.filter((p) => p.status === "running" &&
                p.metadata.isTask &&
                Date.now() - (this.safeDateToTime(p.lastSeen) || 0) < 300000);
            if (recoverableProcesses.length > 0) {
                if (!this.isTestMode()) {
                    console.error(`Found ${recoverableProcesses.length} recoverable processes from previous session`);
                }
                this.recoverProcesses(recoverableProcesses);
            }
            // Create snapshot of previous session
            this.createSnapshot(previousSession);
        }
        catch (error) {
            console.error("Failed to load previous process state:", error);
        }
    }
    /**
     * Recover processes from previous session
     */
    async recoverProcesses(processes) {
        for (const processState of processes) {
            try {
                // Check if process is still running
                const isStillRunning = await this.isProcessRunning(processState.pid);
                if (isStillRunning) {
                    // Process survived the restart - re-register it
                    this.registerProcessState(processState.pid, processState.metadata);
                    if (!this.isTestMode()) {
                        console.error(`Recovered running process: ${processState.metadata.name} (PID: ${processState.pid})`);
                    }
                }
                else if (processState.metadata.isTask) {
                    // Process crashed - only mark if beyond grace period
                    if (Date.now() - (this.safeDateToTime(processState.startTime) || 0) > this.getCrashGraceMs()) {
                        if (!this.isTestMode()) {
                            console.error(`Process crashed: ${processState.metadata.name}, marked for recovery`);
                        }
                        this.markProcessForRecovery(processState);
                    }
                }
            }
            catch (error) {
                if (!this.isTestMode()) {
                    console.error(`Failed to recover process ${processState.metadata.name}:`, error);
                }
            }
        }
    }
    /**
     * Check if a process is still running
     */
    async isProcessRunning(pid) {
        try {
            process.kill(pid, 0); // Signal 0 checks if process exists
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Mark process for recovery
     */
    markProcessForRecovery(processState) {
        if (!this.isTestMode()) {
            console.error(`Process ${processState.metadata.name} marked for recovery`);
        }
    }
    isTestMode() {
        return process.env.CI === 'true' || process.env.NODE_ENV === 'test' || !!process.env.PROCESS_HERDER_SILENT_RECOVERY;
    }
    getCrashGraceMs() {
        const val = process.env.PROCESS_HERDER_CRASH_GRACE_MS;
        if (val) {
            const n = parseInt(val, 10);
            if (!isNaN(n) && n >= 0)
                return n;
        }
        return 5000; // default 5s grace
    }
    /**
     * Register a new process state
     */
    registerProcessState(pid, metadata) {
        const processState = {
            pid,
            metadata,
            startTime: new Date(),
            environment: this.captureEnvironment(),
            workingDirectory: metadata.cwd || process.cwd(),
            commandLine: [metadata.command, ...metadata.args],
            ports: this.detectPorts(metadata),
            dependencies: this.detectDependencies(metadata),
            status: "running",
            lastSeen: new Date(),
            sessionId: this.currentSession.sessionId,
        };
        // Remove any existing state for this PID
        this.currentSession.processes = this.currentSession.processes.filter((p) => p.pid !== pid);
        // Add new state
        this.currentSession.processes.push(processState);
        this.saveState();
    }
    /**
     * Update process state
     */
    updateProcessState(pid, updates) {
        const processIndex = this.currentSession.processes.findIndex((p) => p.pid === pid);
        if (processIndex >= 0) {
            this.currentSession.processes[processIndex] = {
                ...this.currentSession.processes[processIndex],
                ...updates,
                lastSeen: new Date(),
            };
            this.saveState();
        }
    }
    /**
     * Mark process as stopped
     */
    markProcessStopped(pid) {
        this.updateProcessState(pid, { status: "stopped" });
    }
    /**
     * Mark process as crashed
     */
    markProcessCrashed(pid) {
        this.updateProcessState(pid, { status: "crashed" });
    }
    /**
     * Get process state
     */
    getProcessState(pid) {
        return this.currentSession.processes.find((p) => p.pid === pid) || null;
    }
    /**
     * Get all process states
     */
    getAllProcessStates() {
        return [...this.currentSession.processes];
    }
    /**
     * Get processes by status
     */
    getProcessesByStatus(status) {
        return this.currentSession.processes.filter((p) => p.status === status);
    }
    /**
     * Get session information
     */
    getSessionInfo() {
        return { ...this.currentSession };
    }
    /**
     * Capture current environment variables
     */
    captureEnvironment() {
        // Capture relevant environment variables
        const relevantVars = [
            "NODE_ENV",
            "PATH",
            "HOME",
            "USER",
            "WORKSPACE",
            "PORT",
            "HOST",
            "DATABASE_URL",
            "API_KEY",
        ];
        const env = {};
        for (const varName of relevantVars) {
            if (process.env[varName]) {
                env[varName] = process.env[varName];
            }
        }
        return env;
    }
    /**
     * Detect ports used by process
     */
    detectPorts(metadata) {
        const ports = [];
        // Look for port numbers in command arguments
        const portRegex = /(?:--port|--PORT|-p)\s+(\d+)/g;
        const commandString = [metadata.command, ...metadata.args].join(" ");
        let match;
        while ((match = portRegex.exec(commandString)) !== null) {
            const port = parseInt(match[1], 10);
            if (port > 0 && port < 65536) {
                ports.push(port);
            }
        }
        // Also check for common development ports
        const commonPorts = [3000, 8000, 8080, 5000, 4200, 3001];
        for (const port of commonPorts) {
            if (commandString.includes(port.toString()) && !ports.includes(port)) {
                ports.push(port);
            }
        }
        return ports;
    }
    /**
     * Detect process dependencies
     */
    detectDependencies(metadata) {
        const dependencies = [];
        // Detect based on command
        if (metadata.command.includes("npm") || metadata.command.includes("yarn")) {
            dependencies.push("node_modules");
        }
        if (metadata.command.includes("python") ||
            metadata.command.includes("pip")) {
            dependencies.push("python-env");
        }
        // Check for config files
        const configFiles = [
            "package.json",
            "requirements.txt",
            "Cargo.toml",
            "go.mod",
        ];
        for (const file of configFiles) {
            if (fs.existsSync(path.join(metadata.cwd || process.cwd(), file))) {
                dependencies.push(file);
            }
        }
        return dependencies;
    }
    /**
     * Create a snapshot of current state
     */
    createSnapshot(sessionData) {
        const snapshot = {
            timestamp: new Date(),
            processes: sessionData?.processes || this.currentSession.processes,
            systemInfo: this.getSystemInfo(),
        };
        const snapshotFile = path.join(this.snapshotDir, `snapshot-${snapshot.timestamp.toISOString().replace(/[:.]/g, "-")}.json`);
        try {
            fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));
            // Clean up old snapshots (keep last 10)
            this.cleanupOldSnapshots();
        }
        catch (error) {
            console.error("Failed to create snapshot:", error);
        }
    }
    /**
     * Get system information
     */
    getSystemInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem(),
            },
            cpu: {
                cores: os.cpus().length,
                model: os.cpus()[0]?.model || "Unknown",
            },
        };
    }
    /**
     * Clean up old snapshots
     */
    cleanupOldSnapshots() {
        try {
            const files = fs
                .readdirSync(this.snapshotDir)
                .filter((file) => file.startsWith("snapshot-") && file.endsWith(".json"))
                .map((file) => ({
                name: file,
                path: path.join(this.snapshotDir, file),
                mtime: fs.statSync(path.join(this.snapshotDir, file)).mtime,
            }))
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
            // Keep only the 10 most recent snapshots
            const filesToDelete = files.slice(10);
            for (const file of filesToDelete) {
                fs.unlinkSync(file.path);
            }
        }
        catch (error) {
            console.error("Failed to cleanup old snapshots:", error);
        }
    }
    /**
     * Get available snapshots
     */
    getAvailableSnapshots() {
        try {
            const files = fs
                .readdirSync(this.snapshotDir)
                .filter((file) => file.startsWith("snapshot-") && file.endsWith(".json"));
            return files
                .map((file) => {
                try {
                    const filePath = path.join(this.snapshotDir, file);
                    const snapshot = JSON.parse(fs.readFileSync(filePath, "utf8"));
                    return {
                        filename: file,
                        timestamp: new Date(snapshot.timestamp),
                        processCount: snapshot.processes.length,
                    };
                }
                catch (error) {
                    return null;
                }
            })
                .filter(Boolean);
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Load snapshot
     */
    loadSnapshot(filename) {
        try {
            const filePath = path.join(this.snapshotDir, filename);
            const snapshotData = fs.readFileSync(filePath, "utf8");
            const rawSnapshot = JSON.parse(snapshotData);
            // Deserialize dates properly
            return this.deserializeSnapshotData(rawSnapshot);
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Save current state to disk
     */
    saveState() {
        this.currentSession.endTime = new Date();
        try {
            fs.writeFileSync(this.stateFile, JSON.stringify(this.currentSession, null, 2));
        }
        catch (error) {
            console.error("Failed to save process state:", error);
        }
    }
    /**
     * Save state synchronously (for cleanup handlers)
     */
    saveStateSync() {
        this.saveState();
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }
    /**
     * Start auto-save timer
     */
    startAutoSave() {
        // Auto-save every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            this.saveState();
        }, 30000);
    }
    /**
     * Export state data
     */
    exportState() {
        return JSON.stringify({
            session: this.currentSession,
            snapshots: this.getAvailableSnapshots(),
            exportTime: new Date(),
        }, null, 2);
    }
    /**
     * Import state data
     */
    importState(stateData) {
        try {
            const data = JSON.parse(stateData);
            if (data.session) {
                this.currentSession = data.session;
                this.saveState();
                return true;
            }
            return false;
        }
        catch (error) {
            console.error("Failed to import state:", error);
            return false;
        }
    }
    /**
     * Clear all state data
     */
    clearState() {
        this.currentSession = this.createNewSession(this.currentSession.workspace);
        this.saveState();
        // Clean up snapshots
        try {
            const files = fs.readdirSync(this.snapshotDir);
            for (const file of files) {
                fs.unlinkSync(path.join(this.snapshotDir, file));
            }
        }
        catch (error) {
            console.error("Failed to clear snapshots:", error);
        }
    }
    /**
     * Get state statistics
     */
    getStateStatistics() {
        const now = new Date();
        const sessionDuration = now.getTime() - (this.safeDateToTime(this.currentSession.startTime) || now.getTime());
        return {
            sessionDuration,
            totalProcesses: this.currentSession.processes.length,
            runningProcesses: this.getProcessesByStatus("running").length,
            crashedProcesses: this.getProcessesByStatus("crashed").length,
            stoppedProcesses: this.getProcessesByStatus("stopped").length,
            snapshotCount: this.getAvailableSnapshots().length,
            lastSave: this.currentSession.endTime || this.currentSession.startTime,
        };
    }
    /**
     * Cleanup state manager
     */
    cleanup() {
        this.saveStateSync();
    }
}
//# sourceMappingURL=state-manager.js.map