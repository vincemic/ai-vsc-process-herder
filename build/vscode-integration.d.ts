export interface VSCodeStatus {
    hasWorkspace: boolean;
    workspaceFolders: string[];
    hasTasksJson: boolean;
    hasLaunchJson: boolean;
    hasSettingsJson: boolean;
    extensions: VSCodeExtension[];
}
export interface VSCodeExtension {
    id: string;
    name: string;
    version?: string;
    enabled: boolean;
}
export interface VSCodeWorkspace {
    folders: WorkspaceFolder[];
    settings?: Record<string, any>;
    extensions?: {
        recommendations?: string[];
        unwantedRecommendations?: string[];
    };
}
export interface WorkspaceFolder {
    name: string;
    path: string;
}
/**
 * Handles integration with VS Code workspace and configuration
 */
export declare class VSCodeIntegration {
    constructor();
    /**
     * Get overall VS Code integration status
     */
    getStatus(): Promise<VSCodeStatus>;
    /**
     * Get workspace folders
     */
    getWorkspaceFolders(): Promise<string[]>;
    /**
     * Check if a directory is a VS Code workspace
     */
    private isVSCodeWorkspace;
    /**
     * Find workspace file in directory
     */
    private findWorkspaceFile;
    /**
     * Parse VS Code workspace file
     */
    private parseWorkspaceFile;
    /**
     * Get installed VS Code extensions
     */
    getExtensions(): Promise<VSCodeExtension[]>;
    /**
     * Get VS Code settings for a workspace
     */
    getWorkspaceSettings(workspaceRoot?: string): Promise<Record<string, any>>;
    /**
     * Update VS Code settings for a workspace
     */
    updateWorkspaceSettings(settings: Record<string, any>, workspaceRoot?: string): Promise<void>;
    /**
     * Get launch configuration for debugging
     */
    getLaunchConfig(workspaceRoot?: string): Promise<any>;
    /**
     * Create or update launch configuration
     */
    updateLaunchConfig(config: any, workspaceRoot?: string): Promise<void>;
    /**
     * Get recommended extensions for workspace
     */
    getRecommendedExtensions(workspaceRoot?: string): Promise<string[]>;
    /**
     * Update recommended extensions
     */
    updateRecommendedExtensions(recommendations: string[], workspaceRoot?: string): Promise<void>;
    /**
     * Check if VS Code is currently running
     */
    isVSCodeRunning(): Promise<boolean>;
    /**
     * Get VS Code version if available
     */
    getVSCodeVersion(): Promise<string | null>;
    /**
     * Remove JSON comments that VS Code allows
     */
    private removeJsonComments;
    /**
     * Validate VS Code configuration file
     */
    validateConfig(filePath: string): Promise<{
        valid: boolean;
        errors: string[];
    }>;
    /**
     * Create initial VS Code workspace structure
     */
    initializeWorkspace(workspaceRoot?: string): Promise<void>;
}
//# sourceMappingURL=vscode-integration.d.ts.map