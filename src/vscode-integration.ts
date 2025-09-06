import * as fs from "fs";
import * as path from "path";

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
export class VSCodeIntegration {
  constructor() {}

  /**
   * Get overall VS Code integration status
   */
  async getStatus(): Promise<VSCodeStatus> {
    const workspaceFolders = await this.getWorkspaceFolders();
    const hasWorkspace = workspaceFolders.length > 0;

    // Check for VS Code configuration files in each workspace folder
    let hasTasksJson = false;
    let hasLaunchJson = false;
    let hasSettingsJson = false;

    for (const folder of workspaceFolders) {
      const vscodeDir = path.join(folder, '.vscode');
      
      if (fs.existsSync(path.join(vscodeDir, 'tasks.json'))) {
        hasTasksJson = true;
      }
      
      if (fs.existsSync(path.join(vscodeDir, 'launch.json'))) {
        hasLaunchJson = true;
      }
      
      if (fs.existsSync(path.join(vscodeDir, 'settings.json'))) {
        hasSettingsJson = true;
      }
    }

    // Get extensions (this is a placeholder - in real implementation you'd need VS Code API)
    const extensions = await this.getExtensions();

    return {
      hasWorkspace,
      workspaceFolders,
      hasTasksJson,
      hasLaunchJson,
      hasSettingsJson,
      extensions
    };
  }

  /**
   * Get workspace folders
   */
  async getWorkspaceFolders(): Promise<string[]> {
    // In a real implementation, this would use VS Code API
    // For now, we'll check common patterns and environment variables
    
    const folders: string[] = [];
    
    // Check current working directory
    const cwd = process.cwd();
    if (this.isVSCodeWorkspace(cwd)) {
      folders.push(cwd);
    }

    // Check for workspace file
    const workspaceFile = this.findWorkspaceFile(cwd);
    if (workspaceFile) {
      const workspaceFolders = await this.parseWorkspaceFile(workspaceFile);
      folders.push(...workspaceFolders);
    }

    // Check environment variables that might indicate VS Code usage
    if (process.env.VSCODE_WORKSPACE) {
      folders.push(process.env.VSCODE_WORKSPACE);
    }

    // Remove duplicates and return
    return [...new Set(folders)];
  }

  /**
   * Check if a directory is a VS Code workspace
   */
  private isVSCodeWorkspace(dir: string): boolean {
    const vscodeDir = path.join(dir, '.vscode');
    return fs.existsSync(vscodeDir) && fs.statSync(vscodeDir).isDirectory();
  }

  /**
   * Find workspace file in directory
   */
  private findWorkspaceFile(dir: string): string | null {
    try {
      const files = fs.readdirSync(dir);
      const workspaceFile = files.find(file => file.endsWith('.code-workspace'));
      return workspaceFile ? path.join(dir, workspaceFile) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse VS Code workspace file
   */
  private async parseWorkspaceFile(workspaceFile: string): Promise<string[]> {
    try {
      const content = fs.readFileSync(workspaceFile, 'utf8');
      const workspace = JSON.parse(content) as VSCodeWorkspace;
      
      const folders: string[] = [];
      const workspaceDir = path.dirname(workspaceFile);
      
      for (const folder of workspace.folders || []) {
        let folderPath = folder.path;
        
        // Resolve relative paths
        if (!path.isAbsolute(folderPath)) {
          folderPath = path.resolve(workspaceDir, folderPath);
        }
        
        folders.push(folderPath);
      }
      
      return folders;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get installed VS Code extensions
   */
  async getExtensions(): Promise<VSCodeExtension[]> {
    // This is a placeholder implementation
    // In a real implementation, you would need to:
    // 1. Use VS Code Extension API if running in extension context
    // 2. Parse VS Code extension directories
    // 3. Check extension manifests
    
    const extensions: VSCodeExtension[] = [
      {
        id: "ms-vscode.vscode-typescript-next",
        name: "TypeScript Importer",
        version: "4.9.0",
        enabled: true
      },
      {
        id: "ms-python.python",
        name: "Python",
        version: "2023.1.0",
        enabled: true
      }
    ];

    return extensions;
  }

  /**
   * Get VS Code settings for a workspace
   */
  async getWorkspaceSettings(workspaceRoot?: string): Promise<Record<string, any>> {
    const root = workspaceRoot || process.cwd();
    const settingsPath = path.join(root, '.vscode', 'settings.json');
    
    if (!fs.existsSync(settingsPath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(settingsPath, 'utf8');
      // Remove JSON comments that VS Code allows
      const cleanedContent = this.removeJsonComments(content);
      return JSON.parse(cleanedContent);
    } catch (error) {
      throw new Error(`Failed to parse VS Code settings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update VS Code settings for a workspace
   */
  async updateWorkspaceSettings(
    settings: Record<string, any>, 
    workspaceRoot?: string
  ): Promise<void> {
    const root = workspaceRoot || process.cwd();
    const vscodeDir = path.join(root, '.vscode');
    const settingsPath = path.join(vscodeDir, 'settings.json');

    // Create .vscode directory if it doesn't exist
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    // Read existing settings
    let existingSettings = {};
    if (fs.existsSync(settingsPath)) {
      try {
        existingSettings = await this.getWorkspaceSettings(root);
      } catch (error) {
        // If we can't parse existing settings, start fresh
      }
    }

    // Merge settings
    const mergedSettings = { ...existingSettings, ...settings };

    // Write back to file
    const content = JSON.stringify(mergedSettings, null, 2);
    fs.writeFileSync(settingsPath, content, 'utf8');
  }

  /**
   * Get launch configuration for debugging
   */
  async getLaunchConfig(workspaceRoot?: string): Promise<any> {
    const root = workspaceRoot || process.cwd();
    const launchPath = path.join(root, '.vscode', 'launch.json');
    
    if (!fs.existsSync(launchPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(launchPath, 'utf8');
      const cleanedContent = this.removeJsonComments(content);
      return JSON.parse(cleanedContent);
    } catch (error) {
      throw new Error(`Failed to parse launch.json: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create or update launch configuration
   */
  async updateLaunchConfig(
    config: any, 
    workspaceRoot?: string
  ): Promise<void> {
    const root = workspaceRoot || process.cwd();
    const vscodeDir = path.join(root, '.vscode');
    const launchPath = path.join(vscodeDir, 'launch.json');

    // Create .vscode directory if it doesn't exist
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    // Write launch configuration
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(launchPath, content, 'utf8');
  }

  /**
   * Get recommended extensions for workspace
   */
  async getRecommendedExtensions(workspaceRoot?: string): Promise<string[]> {
    const root = workspaceRoot || process.cwd();
    const extensionsPath = path.join(root, '.vscode', 'extensions.json');
    
    if (!fs.existsSync(extensionsPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(extensionsPath, 'utf8');
      const cleanedContent = this.removeJsonComments(content);
      const config = JSON.parse(cleanedContent);
      return config.recommendations || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Update recommended extensions
   */
  async updateRecommendedExtensions(
    recommendations: string[], 
    workspaceRoot?: string
  ): Promise<void> {
    const root = workspaceRoot || process.cwd();
    const vscodeDir = path.join(root, '.vscode');
    const extensionsPath = path.join(vscodeDir, 'extensions.json');

    // Create .vscode directory if it doesn't exist
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    // Read existing config
    let existingConfig = {};
    if (fs.existsSync(extensionsPath)) {
      try {
        const content = fs.readFileSync(extensionsPath, 'utf8');
        const cleanedContent = this.removeJsonComments(content);
        existingConfig = JSON.parse(cleanedContent);
      } catch (error) {
        // If we can't parse existing config, start fresh
      }
    }

    // Update recommendations
    const config = { ...existingConfig, recommendations };

    // Write back to file
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(extensionsPath, content, 'utf8');
  }

  /**
   * Check if VS Code is currently running
   */
  async isVSCodeRunning(): Promise<boolean> {
    // This is a placeholder implementation
    // In a real implementation, you might:
    // 1. Check for VS Code processes
    // 2. Check for VS Code socket files
    // 3. Use VS Code API if available
    
    // Check for environment variables that indicate VS Code
    return !!(
      process.env.VSCODE_PID || 
      process.env.VSCODE_IPC_HOOK || 
      process.env.VSCODE_WORKSPACE ||
      process.env.TERM_PROGRAM === 'vscode'
    );
  }

  /**
   * Get VS Code version if available
   */
  async getVSCodeVersion(): Promise<string | null> {
    // This is a placeholder - in real implementation you'd check VS Code installation
    return null;
  }

  /**
   * Remove JSON comments that VS Code allows
   */
  private removeJsonComments(content: string): string {
    // Remove single-line comments
    content = content.replace(/\/\/.*$/gm, '');
    
    // Remove multi-line comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    
    return content;
  }

  /**
   * Validate VS Code configuration file
   */
  async validateConfig(filePath: string): Promise<{ valid: boolean; errors: string[] }> {
    if (!fs.existsSync(filePath)) {
      return { valid: false, errors: [`File does not exist: ${filePath}`] };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const cleanedContent = this.removeJsonComments(content);
      JSON.parse(cleanedContent);
      return { valid: true, errors: [] };
    } catch (error) {
      return { 
        valid: false, 
        errors: [`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`] 
      };
    }
  }

  /**
   * Create initial VS Code workspace structure
   */
  async initializeWorkspace(workspaceRoot?: string): Promise<void> {
    const root = workspaceRoot || process.cwd();
    const vscodeDir = path.join(root, '.vscode');

    // Create .vscode directory
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    // Create basic settings.json if it doesn't exist
    const settingsPath = path.join(vscodeDir, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      const defaultSettings = {
        "editor.tabSize": 2,
        "editor.insertSpaces": true,
        "files.autoSave": "afterDelay",
        "terminal.integrated.defaultProfile.windows": "PowerShell"
      };
      
      await this.updateWorkspaceSettings(defaultSettings, root);
    }

    // Create basic extensions.json if it doesn't exist
    const extensionsPath = path.join(vscodeDir, 'extensions.json');
    if (!fs.existsSync(extensionsPath)) {
      const defaultRecommendations = [
        "ms-vscode.vscode-typescript-next",
        "esbenp.prettier-vscode",
        "ms-vscode.vscode-eslint"
      ];
      
      await this.updateRecommendedExtensions(defaultRecommendations, root);
    }
  }
}