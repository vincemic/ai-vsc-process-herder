export interface VSCodeTask {
    label: string;
    type: string;
    command: string;
    args?: string[];
    group?: string | {
        kind: string;
        isDefault?: boolean;
    };
    detail?: string;
    options?: {
        cwd?: string;
        env?: Record<string, string>;
        shell?: boolean | {
            executable: string;
            args?: string[];
        };
    };
    isBackground?: boolean;
    problemMatcher?: string | string[];
    presentation?: {
        echo?: boolean;
        reveal?: string;
        focus?: boolean;
        panel?: string;
        showReuseMessage?: boolean;
        clear?: boolean;
        group?: string;
    };
    runOptions?: {
        runOn?: string;
        instanceLimit?: number;
    };
}
export interface TasksConfig {
    version: string;
    tasks: VSCodeTask[];
}
export interface TaskStartResult {
    processId: number;
    command: string;
    args: string[];
    cwd: string;
}
/**
 * Manages VS Code tasks by reading tasks.json and executing tasks
 */
export declare class TaskManager {
    private workspaceRoot;
    private tasksConfig;
    constructor(workspaceRoot?: string);
    /**
     * Get the current workspace root
     */
    getWorkspaceRoot(): string;
    /**
     * Set the workspace root and reload tasks
     */
    setWorkspaceRoot(workspaceRoot: string): void;
    /**
     * Load and parse tasks.json from the workspace
     */
    private loadTasksConfig;
    /**
     * Remove JSON comments that VS Code allows
     */
    private removeJsonComments;
    /**
     * List all available tasks
     */
    listTasks(workspaceRoot?: string): Promise<VSCodeTask[]>;
    /**
     * Get the raw tasks configuration
     */
    getTasksConfig(workspaceRoot?: string): Promise<TasksConfig>;
    /**
     * Find a task by name/label
     */
    findTask(taskName: string, workspaceRoot?: string): Promise<VSCodeTask | null>;
    /**
     * Start a specific task by name
     */
    startTask(taskName: string, workspaceRoot?: string, additionalArgs?: string[]): Promise<TaskStartResult>;
    /**
     * Determine if a task should use shell
     */
    private shouldUseShell;
    /**
     * Get suggested tasks based on project type
     */
    getSuggestedTasks(workspaceRoot?: string): Promise<VSCodeTask[]>;
    /**
     * Determine task group based on script name
     */
    private getTaskGroup;
    /**
     * Create a new tasks.json file with basic configuration
     */
    createTasksConfig(workspaceRoot?: string, tasks?: VSCodeTask[]): Promise<void>;
    /**
     * Add a new task to the tasks.json file
     */
    addTask(task: VSCodeTask, workspaceRoot?: string): Promise<void>;
    /**
     * Remove a task from the tasks.json file
     */
    removeTask(taskName: string, workspaceRoot?: string): Promise<boolean>;
}
//# sourceMappingURL=task-manager.d.ts.map