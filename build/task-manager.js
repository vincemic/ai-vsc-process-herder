import * as fs from "fs";
import * as path from "path";
import crossSpawn from "cross-spawn";
/**
 * Manages VS Code tasks by reading tasks.json and executing tasks
 */
export class TaskManager {
    workspaceRoot = process.cwd();
    tasksConfig = null;
    constructor(workspaceRoot) {
        if (workspaceRoot) {
            this.workspaceRoot = workspaceRoot;
        }
    }
    /**
     * Get the current workspace root
     */
    getWorkspaceRoot() {
        return this.workspaceRoot;
    }
    /**
     * Set the workspace root and reload tasks
     */
    setWorkspaceRoot(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.tasksConfig = null; // Force reload
    }
    /**
     * Load and parse tasks.json from the workspace
     */
    async loadTasksConfig(workspaceRoot) {
        const root = workspaceRoot || this.workspaceRoot;
        const tasksPath = path.join(root, ".vscode", "tasks.json");
        if (!fs.existsSync(tasksPath)) {
            // Return empty config if no tasks.json exists
            return {
                version: "2.0.0",
                tasks: [],
            };
        }
        try {
            const tasksContent = fs.readFileSync(tasksPath, "utf8");
            // Remove JSON comments (VS Code allows them in tasks.json)
            const cleanedContent = this.removeJsonComments(tasksContent);
            const parsed = JSON.parse(cleanedContent);
            // Validate the structure
            if (!parsed.version) {
                parsed.version = "2.0.0";
            }
            if (!Array.isArray(parsed.tasks)) {
                parsed.tasks = [];
            }
            this.tasksConfig = parsed;
            return parsed;
        }
        catch (error) {
            throw new Error(`Failed to parse tasks.json: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Remove JSON comments that VS Code allows
     */
    removeJsonComments(content) {
        // Remove single-line comments
        content = content.replace(/\/\/.*$/gm, "");
        // Remove multi-line comments
        content = content.replace(/\/\*[\s\S]*?\*\//g, "");
        return content;
    }
    /**
     * List all available tasks
     */
    async listTasks(workspaceRoot) {
        const config = await this.loadTasksConfig(workspaceRoot);
        return config.tasks;
    }
    /**
     * Get the raw tasks configuration
     */
    async getTasksConfig(workspaceRoot) {
        return await this.loadTasksConfig(workspaceRoot);
    }
    /**
     * Find a task by name/label
     */
    async findTask(taskName, workspaceRoot) {
        const tasks = await this.listTasks(workspaceRoot);
        return tasks.find((task) => task.label === taskName) || null;
    }
    /**
     * Start a specific task by name
     */
    async startTask(taskName, workspaceRoot, additionalArgs = []) {
        const task = await this.findTask(taskName, workspaceRoot);
        if (!task) {
            throw new Error(`Task '${taskName}' not found in tasks.json`);
        }
        const root = workspaceRoot || this.workspaceRoot;
        const cwd = task.options?.cwd ? path.resolve(root, task.options.cwd) : root;
        // Prepare command and arguments
        let command = task.command;
        let args = [...(task.args || []), ...additionalArgs];
        // Handle shell configuration
        const useShell = this.shouldUseShell(task);
        if (useShell && process.platform === "win32") {
            // On Windows, we need to handle shell commands specially
            args = ["/c", command, ...args];
            command = "cmd";
        }
        // Prepare environment variables
        const env = {
            ...process.env,
            ...(task.options?.env || {}),
        };
        try {
            // Use cross-spawn for better cross-platform support
            const childProcess = crossSpawn(command, args, {
                cwd,
                env,
                stdio: ["pipe", "pipe", "pipe"],
                detached: false,
                shell: useShell && process.platform !== "win32",
            });
            if (!childProcess.pid) {
                throw new Error(`Failed to start task: ${taskName}`);
            }
            return {
                processId: childProcess.pid,
                command,
                args,
                cwd,
            };
        }
        catch (error) {
            throw new Error(`Failed to start task '${taskName}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Determine if a task should use shell
     */
    shouldUseShell(task) {
        // If shell is explicitly configured
        if (task.options?.shell !== undefined) {
            if (typeof task.options.shell === "boolean") {
                return task.options.shell;
            }
            return true; // Object configuration means use shell
        }
        // Default behavior: use shell for shell commands
        if (task.type === "shell") {
            return true;
        }
        // Check if command looks like it needs shell
        const shellIndicators = ["&&", "||", "|", ">", "<", "&", ";"];
        return shellIndicators.some((indicator) => task.command.includes(indicator));
    }
    /**
     * Get suggested tasks based on project type
     */
    async getSuggestedTasks(workspaceRoot) {
        const root = workspaceRoot || this.workspaceRoot;
        const suggestions = [];
        // Check for package.json (Node.js project)
        const packageJsonPath = path.join(root, "package.json");
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageContent = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
                const scripts = packageContent.scripts || {};
                // Convert npm scripts to task suggestions
                for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
                    suggestions.push({
                        label: `npm: ${scriptName}`,
                        type: "shell",
                        command: "npm",
                        args: ["run", scriptName],
                        group: this.getTaskGroup(scriptName),
                        detail: `Run npm script: ${scriptCommand}`,
                    });
                }
            }
            catch (error) {
                // Ignore package.json parsing errors
            }
        }
        // Check for common build files
        const buildFiles = [
            { file: "Makefile", command: "make", type: "Makefile project" },
            { file: "Cargo.toml", command: "cargo", type: "Rust project" },
            { file: "go.mod", command: "go", type: "Go project" },
            { file: "pom.xml", command: "mvn", type: "Maven project" },
            { file: "build.gradle", command: "gradle", type: "Gradle project" },
        ];
        for (const { file, command, type } of buildFiles) {
            if (fs.existsSync(path.join(root, file))) {
                suggestions.push({
                    label: `${type}: build`,
                    type: "shell",
                    command,
                    args: ["build"],
                    group: "build",
                    detail: `Build using ${command}`,
                });
                if (command === "cargo") {
                    suggestions.push({
                        label: `${type}: test`,
                        type: "shell",
                        command,
                        args: ["test"],
                        group: "test",
                        detail: `Test using ${command}`,
                    });
                }
            }
        }
        return suggestions;
    }
    /**
     * Determine task group based on script name
     */
    getTaskGroup(scriptName) {
        if (scriptName.includes("build") || scriptName.includes("compile")) {
            return "build";
        }
        if (scriptName.includes("test")) {
            return "test";
        }
        if (scriptName.includes("start") ||
            scriptName.includes("serve") ||
            scriptName.includes("dev")) {
            return "serve";
        }
        if (scriptName.includes("lint") || scriptName.includes("format")) {
            return "lint";
        }
        return "none";
    }
    /**
     * Create a new tasks.json file with basic configuration
     */
    async createTasksConfig(workspaceRoot, tasks = []) {
        const root = workspaceRoot || this.workspaceRoot;
        const vscodeDir = path.join(root, ".vscode");
        const tasksPath = path.join(vscodeDir, "tasks.json");
        // Create .vscode directory if it doesn't exist
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }
        // Add suggested tasks if none provided
        if (tasks.length === 0) {
            tasks = await this.getSuggestedTasks(root);
        }
        const config = {
            version: "2.0.0",
            tasks,
        };
        const content = JSON.stringify(config, null, 2);
        fs.writeFileSync(tasksPath, content, "utf8");
        // Clear cached config to force reload
        this.tasksConfig = null;
    }
    /**
     * Add a new task to the tasks.json file
     */
    async addTask(task, workspaceRoot) {
        const config = await this.loadTasksConfig(workspaceRoot);
        // Check if task already exists
        const existingIndex = config.tasks.findIndex((t) => t.label === task.label);
        if (existingIndex >= 0) {
            // Replace existing task
            config.tasks[existingIndex] = task;
        }
        else {
            // Add new task
            config.tasks.push(task);
        }
        // Write back to file
        const root = workspaceRoot || this.workspaceRoot;
        const tasksPath = path.join(root, ".vscode", "tasks.json");
        const content = JSON.stringify(config, null, 2);
        fs.writeFileSync(tasksPath, content, "utf8");
        // Update cached config
        this.tasksConfig = config;
    }
    /**
     * Remove a task from the tasks.json file
     */
    async removeTask(taskName, workspaceRoot) {
        const config = await this.loadTasksConfig(workspaceRoot);
        const initialLength = config.tasks.length;
        config.tasks = config.tasks.filter((task) => task.label !== taskName);
        if (config.tasks.length === initialLength) {
            return false; // Task not found
        }
        // Write back to file
        const root = workspaceRoot || this.workspaceRoot;
        const tasksPath = path.join(root, ".vscode", "tasks.json");
        const content = JSON.stringify(config, null, 2);
        fs.writeFileSync(tasksPath, content, "utf8");
        // Update cached config
        this.tasksConfig = config;
        return true;
    }
}
//# sourceMappingURL=task-manager.js.map