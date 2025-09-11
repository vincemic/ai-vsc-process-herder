export interface ProjectDetection {
    type: string;
    frameworks: string[];
    packageManagers: string[];
    suggestedTasks: SuggestedTask[];
    confidence: number;
    workspaceRoot: string;
    findings: ProjectFinding[];
}
export interface SuggestedTask {
    label: string;
    command: string;
    args: string[];
    type: "shell" | "process";
    group: string;
    description: string;
}
export interface ProjectFinding {
    file: string;
    type: "config" | "dependency" | "source" | "build";
    description: string;
    confidence: number;
}
/**
 * Detects project type and suggests appropriate development tasks
 */
export declare class ProjectDetector {
    constructor();
    /**
     * Analyze workspace to detect project type and characteristics
     */
    detectProject(workspaceRoot?: string): Promise<ProjectDetection>;
    /**
     * Check for Node.js/JavaScript/TypeScript project indicators
     */
    private checkNodeProject;
    /**
     * Detect Node.js frameworks from dependencies
     */
    private detectNodeFrameworks;
    /**
     * Check for Python project indicators
     */
    private checkPythonProject;
    /**
     * Detect Python frameworks from requirements
     */
    private detectPythonFrameworks;
    /**
     * Check for Rust project indicators
     */
    private checkRustProject;
    /**
     * Check for Go project indicators
     */
    private checkGoProject;
    /**
     * Check for Java project indicators
     */
    private checkJavaProject;
    /**
     * Check for .NET project indicators
     */
    private checkDotNetProject;
    /**
     * Check for web project indicators
     */
    private checkWebProject;
    /**
     * Check if directory contains files with specific extension
     */
    private hasFilesWithExtension;
    /**
     * Check if directory contains files matching pattern
     */
    private hasFilesWithPattern;
    /**
     * Calculate confidence scores for different project types
     */
    private calculateTypeConfidence;
    /**
     * Generate suggested tasks based on detected project characteristics
     */
    private generateSuggestedTasks;
}
//# sourceMappingURL=project-detector.d.ts.map