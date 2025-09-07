import * as fs from "fs";
import * as path from "path";

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
export class ProjectDetector {
  constructor() {}

  /**
   * Analyze workspace to detect project type and characteristics
   */
  async detectProject(workspaceRoot?: string): Promise<ProjectDetection> {
    const root = workspaceRoot || process.cwd();
    const findings: ProjectFinding[] = [];
    const frameworks: string[] = [];
    const packageManagers: string[] = [];
    let projectType = "unknown";
    let confidence = 0;

    // Check for various project indicators
    await this.checkNodeProject(root, findings, frameworks, packageManagers);
    await this.checkPythonProject(root, findings, frameworks, packageManagers);
    await this.checkRustProject(root, findings, frameworks, packageManagers);
    await this.checkGoProject(root, findings, frameworks, packageManagers);
    await this.checkJavaProject(root, findings, frameworks, packageManagers);
    await this.checkDotNetProject(root, findings, frameworks, packageManagers);
    await this.checkWebProject(root, findings, frameworks);

    // Determine primary project type based on findings
    const typeConfidence = this.calculateTypeConfidence(findings);
    const topType = Object.entries(typeConfidence).sort(
      ([, a], [, b]) => b - a,
    )[0];

    if (topType && topType[1] > 0) {
      projectType = topType[0];
      confidence = topType[1];
    }

    // Generate suggested tasks based on detected project type
    const suggestedTasks = this.generateSuggestedTasks(
      projectType,
      frameworks,
      packageManagers,
      root,
    );

    return {
      type: projectType,
      frameworks,
      packageManagers,
      suggestedTasks,
      confidence,
      workspaceRoot: root,
      findings,
    };
  }

  /**
   * Check for Node.js/JavaScript/TypeScript project indicators
   */
  private async checkNodeProject(
    root: string,
    findings: ProjectFinding[],
    frameworks: string[],
    packageManagers: string[],
  ): Promise<void> {
    const packageJsonPath = path.join(root, "package.json");

    if (fs.existsSync(packageJsonPath)) {
      findings.push({
        file: "package.json",
        type: "config",
        description: "Node.js package configuration",
        confidence: 0.9,
      });

      try {
        const packageContent = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8"),
        );

        // Check dependencies for frameworks
        const allDeps = {
          ...packageContent.dependencies,
          ...packageContent.devDependencies,
          ...packageContent.peerDependencies,
        };

        this.detectNodeFrameworks(allDeps, frameworks, findings);

        // Check for scripts
        if (packageContent.scripts) {
          findings.push({
            file: "package.json",
            type: "config",
            description: `Found ${Object.keys(packageContent.scripts).length} npm scripts`,
            confidence: 0.7,
          });
        }
      } catch (error) {
        // Ignore package.json parsing errors
      }

      packageManagers.push("npm");
    }

    // Check for other package managers
    if (fs.existsSync(path.join(root, "yarn.lock"))) {
      packageManagers.push("yarn");
      findings.push({
        file: "yarn.lock",
        type: "config",
        description: "Yarn package manager lockfile",
        confidence: 0.8,
      });
    }

    if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) {
      packageManagers.push("pnpm");
      findings.push({
        file: "pnpm-lock.yaml",
        type: "config",
        description: "PNPM package manager lockfile",
        confidence: 0.8,
      });
    }

    // Check for TypeScript
    if (fs.existsSync(path.join(root, "tsconfig.json"))) {
      frameworks.push("TypeScript");
      findings.push({
        file: "tsconfig.json",
        type: "config",
        description: "TypeScript configuration",
        confidence: 0.9,
      });
    }

    // Check for common config files
    const configFiles = [
      { file: ".eslintrc.js", framework: "ESLint" },
      { file: ".eslintrc.json", framework: "ESLint" },
      { file: "prettier.config.js", framework: "Prettier" },
      { file: ".prettierrc", framework: "Prettier" },
      { file: "webpack.config.js", framework: "Webpack" },
      { file: "vite.config.js", framework: "Vite" },
      { file: "vite.config.ts", framework: "Vite" },
    ];

    for (const { file, framework } of configFiles) {
      if (fs.existsSync(path.join(root, file))) {
        frameworks.push(framework);
        findings.push({
          file,
          type: "config",
          description: `${framework} configuration`,
          confidence: 0.7,
        });
      }
    }
  }

  /**
   * Detect Node.js frameworks from dependencies
   */
  private detectNodeFrameworks(
    dependencies: Record<string, string>,
    frameworks: string[],
    findings: ProjectFinding[],
  ): void {
    const frameworkMap = {
      react: "React",
      vue: "Vue.js",
      angular: "Angular",
      "@angular/core": "Angular",
      svelte: "Svelte",
      next: "Next.js",
      nuxt: "Nuxt.js",
      express: "Express.js",
      fastify: "Fastify",
      koa: "Koa.js",
      nest: "NestJS",
      "@nestjs/core": "NestJS",
      gatsby: "Gatsby",
      electron: "Electron",
      jest: "Jest",
      mocha: "Mocha",
      cypress: "Cypress",
      playwright: "Playwright",
    };

    for (const [dep, framework] of Object.entries(frameworkMap)) {
      if (dependencies[dep]) {
        frameworks.push(framework);
        findings.push({
          file: "package.json",
          type: "dependency",
          description: `${framework} framework dependency`,
          confidence: 0.8,
        });
      }
    }
  }

  /**
   * Check for Python project indicators
   */
  private async checkPythonProject(
    root: string,
    findings: ProjectFinding[],
    frameworks: string[],
    packageManagers: string[],
  ): Promise<void> {
    const pythonFiles = [
      "requirements.txt",
      "setup.py",
      "pyproject.toml",
      "Pipfile",
      "environment.yml",
    ];

    for (const file of pythonFiles) {
      if (fs.existsSync(path.join(root, file))) {
        findings.push({
          file,
          type: "config",
          description: "Python project configuration",
          confidence: 0.8,
        });

        if (file === "Pipfile") {
          packageManagers.push("pipenv");
        } else if (file === "pyproject.toml") {
          packageManagers.push("poetry");
        } else {
          packageManagers.push("pip");
        }
      }
    }

    // Check for Python source files
    if (this.hasFilesWithExtension(root, ".py")) {
      findings.push({
        file: "*.py",
        type: "source",
        description: "Python source files found",
        confidence: 0.7,
      });
    }

    // Check for common Python frameworks
    const requirementsPath = path.join(root, "requirements.txt");
    if (fs.existsSync(requirementsPath)) {
      try {
        const content = fs.readFileSync(requirementsPath, "utf8");
        this.detectPythonFrameworks(content, frameworks, findings);
      } catch (error) {
        // Ignore requirements.txt parsing errors
      }
    }
  }

  /**
   * Detect Python frameworks from requirements
   */
  private detectPythonFrameworks(
    requirements: string,
    frameworks: string[],
    findings: ProjectFinding[],
  ): void {
    const frameworkMap = {
      django: "Django",
      flask: "Flask",
      fastapi: "FastAPI",
      pyramid: "Pyramid",
      tornado: "Tornado",
      pytest: "pytest",
      pandas: "Pandas",
      numpy: "NumPy",
      tensorflow: "TensorFlow",
      pytorch: "PyTorch",
    };

    for (const [pkg, framework] of Object.entries(frameworkMap)) {
      if (requirements.toLowerCase().includes(pkg)) {
        frameworks.push(framework);
        findings.push({
          file: "requirements.txt",
          type: "dependency",
          description: `${framework} framework dependency`,
          confidence: 0.7,
        });
      }
    }
  }

  /**
   * Check for Rust project indicators
   */
  private async checkRustProject(
    root: string,
    findings: ProjectFinding[],
    frameworks: string[],
    packageManagers: string[],
  ): Promise<void> {
    if (fs.existsSync(path.join(root, "Cargo.toml"))) {
      packageManagers.push("cargo");
      findings.push({
        file: "Cargo.toml",
        type: "config",
        description: "Rust project configuration",
        confidence: 0.9,
      });

      // Check for Rust source files
      if (this.hasFilesWithExtension(root, ".rs")) {
        findings.push({
          file: "*.rs",
          type: "source",
          description: "Rust source files found",
          confidence: 0.8,
        });
      }
    }
  }

  /**
   * Check for Go project indicators
   */
  private async checkGoProject(
    root: string,
    findings: ProjectFinding[],
    frameworks: string[],
    packageManagers: string[],
  ): Promise<void> {
    if (fs.existsSync(path.join(root, "go.mod"))) {
      packageManagers.push("go");
      findings.push({
        file: "go.mod",
        type: "config",
        description: "Go module configuration",
        confidence: 0.9,
      });

      // Check for Go source files
      if (this.hasFilesWithExtension(root, ".go")) {
        findings.push({
          file: "*.go",
          type: "source",
          description: "Go source files found",
          confidence: 0.8,
        });
      }
    }
  }

  /**
   * Check for Java project indicators
   */
  private async checkJavaProject(
    root: string,
    findings: ProjectFinding[],
    frameworks: string[],
    packageManagers: string[],
  ): Promise<void> {
    if (fs.existsSync(path.join(root, "pom.xml"))) {
      packageManagers.push("maven");
      findings.push({
        file: "pom.xml",
        type: "config",
        description: "Maven project configuration",
        confidence: 0.9,
      });
    }

    if (fs.existsSync(path.join(root, "build.gradle"))) {
      packageManagers.push("gradle");
      findings.push({
        file: "build.gradle",
        type: "config",
        description: "Gradle project configuration",
        confidence: 0.9,
      });
    }

    // Check for Java source files
    if (this.hasFilesWithExtension(root, ".java")) {
      findings.push({
        file: "*.java",
        type: "source",
        description: "Java source files found",
        confidence: 0.7,
      });
    }
  }

  /**
   * Check for .NET project indicators
   */
  private async checkDotNetProject(
    root: string,
    findings: ProjectFinding[],
    frameworks: string[],
    packageManagers: string[],
  ): Promise<void> {
    const dotnetFiles = ["*.csproj", "*.fsproj", "*.vbproj", "*.sln"];

    for (const pattern of dotnetFiles) {
      if (this.hasFilesWithPattern(root, pattern)) {
        packageManagers.push("dotnet");
        findings.push({
          file: pattern,
          type: "config",
          description: ".NET project configuration",
          confidence: 0.9,
        });
        break;
      }
    }

    // Check for C# source files
    if (this.hasFilesWithExtension(root, ".cs")) {
      findings.push({
        file: "*.cs",
        type: "source",
        description: "C# source files found",
        confidence: 0.7,
      });
    }
  }

  /**
   * Check for web project indicators
   */
  private async checkWebProject(
    root: string,
    findings: ProjectFinding[],
    frameworks: string[],
  ): Promise<void> {
    const webFiles = ["index.html", "index.htm"];

    for (const file of webFiles) {
      if (fs.existsSync(path.join(root, file))) {
        findings.push({
          file,
          type: "source",
          description: "Web project entry point",
          confidence: 0.6,
        });
      }
    }

    // Check for CSS frameworks
    if (
      this.hasFilesWithExtension(root, ".css") ||
      this.hasFilesWithExtension(root, ".scss") ||
      this.hasFilesWithExtension(root, ".sass")
    ) {
      findings.push({
        file: "*.css/*.scss/*.sass",
        type: "source",
        description: "Stylesheet files found",
        confidence: 0.5,
      });
    }
  }

  /**
   * Check if directory contains files with specific extension
   */
  private hasFilesWithExtension(root: string, extension: string): boolean {
    try {
      const files = fs.readdirSync(root);
      return files.some((file) => file.endsWith(extension));
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if directory contains files matching pattern
   */
  private hasFilesWithPattern(root: string, pattern: string): boolean {
    try {
      const files = fs.readdirSync(root);
      const regex = new RegExp(pattern.replace("*", ".*"));
      return files.some((file) => regex.test(file));
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate confidence scores for different project types
   */
  private calculateTypeConfidence(
    findings: ProjectFinding[],
  ): Record<string, number> {
    const typeScores: Record<string, number> = {};

    for (const finding of findings) {
      let projectType = "unknown";

      // Map findings to project types
      if (
        finding.file.includes("package.json") ||
        finding.file.includes("node_modules") ||
        finding.file.includes(".js") ||
        finding.file.includes(".ts")
      ) {
        projectType = "javascript";
      } else if (
        finding.file.includes(".py") ||
        finding.file.includes("requirements.txt") ||
        finding.file.includes("setup.py")
      ) {
        projectType = "python";
      } else if (
        finding.file.includes("Cargo.toml") ||
        finding.file.includes(".rs")
      ) {
        projectType = "rust";
      } else if (
        finding.file.includes("go.mod") ||
        finding.file.includes(".go")
      ) {
        projectType = "go";
      } else if (
        finding.file.includes(".java") ||
        finding.file.includes("pom.xml") ||
        finding.file.includes("build.gradle")
      ) {
        projectType = "java";
      } else if (
        finding.file.includes(".cs") ||
        finding.file.includes(".csproj") ||
        finding.file.includes(".sln")
      ) {
        projectType = "dotnet";
      } else if (
        finding.file.includes(".html") ||
        finding.file.includes(".css")
      ) {
        projectType = "web";
      }

      typeScores[projectType] =
        (typeScores[projectType] || 0) + finding.confidence;
    }

    return typeScores;
  }

  /**
   * Generate suggested tasks based on detected project characteristics
   */
  private generateSuggestedTasks(
    projectType: string,
    frameworks: string[],
    packageManagers: string[],
    root: string,
  ): SuggestedTask[] {
    const tasks: SuggestedTask[] = [];

    switch (projectType) {
      case "javascript":
        if (packageManagers.includes("npm")) {
          tasks.push({
            label: "npm install",
            command: "npm",
            args: ["install"],
            type: "shell",
            group: "build",
            description: "Install npm dependencies",
          });

          tasks.push({
            label: "npm start",
            command: "npm",
            args: ["start"],
            type: "shell",
            group: "serve",
            description: "Start development server",
          });

          tasks.push({
            label: "npm test",
            command: "npm",
            args: ["test"],
            type: "shell",
            group: "test",
            description: "Run tests",
          });
        }

        if (frameworks.includes("TypeScript")) {
          tasks.push({
            label: "TypeScript compile",
            command: "tsc",
            args: [],
            type: "shell",
            group: "build",
            description: "Compile TypeScript",
          });
        }
        break;

      case "python":
        if (packageManagers.includes("pip")) {
          tasks.push({
            label: "pip install",
            command: "pip",
            args: ["install", "-r", "requirements.txt"],
            type: "shell",
            group: "build",
            description: "Install Python dependencies",
          });
        }

        tasks.push({
          label: "Python run",
          command: "python",
          args: ["main.py"],
          type: "shell",
          group: "serve",
          description: "Run Python application",
        });

        if (frameworks.includes("pytest")) {
          tasks.push({
            label: "pytest",
            command: "pytest",
            args: [],
            type: "shell",
            group: "test",
            description: "Run Python tests",
          });
        }
        break;

      case "rust":
        tasks.push({
          label: "cargo build",
          command: "cargo",
          args: ["build"],
          type: "shell",
          group: "build",
          description: "Build Rust project",
        });

        tasks.push({
          label: "cargo run",
          command: "cargo",
          args: ["run"],
          type: "shell",
          group: "serve",
          description: "Run Rust application",
        });

        tasks.push({
          label: "cargo test",
          command: "cargo",
          args: ["test"],
          type: "shell",
          group: "test",
          description: "Run Rust tests",
        });
        break;

      case "go":
        tasks.push({
          label: "go build",
          command: "go",
          args: ["build"],
          type: "shell",
          group: "build",
          description: "Build Go project",
        });

        tasks.push({
          label: "go run",
          command: "go",
          args: ["run", "."],
          type: "shell",
          group: "serve",
          description: "Run Go application",
        });

        tasks.push({
          label: "go test",
          command: "go",
          args: ["test"],
          type: "shell",
          group: "test",
          description: "Run Go tests",
        });
        break;

      case "java":
        if (packageManagers.includes("maven")) {
          tasks.push({
            label: "mvn compile",
            command: "mvn",
            args: ["compile"],
            type: "shell",
            group: "build",
            description: "Compile with Maven",
          });

          tasks.push({
            label: "mvn test",
            command: "mvn",
            args: ["test"],
            type: "shell",
            group: "test",
            description: "Run Maven tests",
          });
        }

        if (packageManagers.includes("gradle")) {
          tasks.push({
            label: "gradle build",
            command: "gradle",
            args: ["build"],
            type: "shell",
            group: "build",
            description: "Build with Gradle",
          });

          tasks.push({
            label: "gradle test",
            command: "gradle",
            args: ["test"],
            type: "shell",
            group: "test",
            description: "Run Gradle tests",
          });
        }
        break;

      case "dotnet":
        tasks.push({
          label: "dotnet build",
          command: "dotnet",
          args: ["build"],
          type: "shell",
          group: "build",
          description: "Build .NET project",
        });

        tasks.push({
          label: "dotnet run",
          command: "dotnet",
          args: ["run"],
          type: "shell",
          group: "serve",
          description: "Run .NET application",
        });

        tasks.push({
          label: "dotnet test",
          command: "dotnet",
          args: ["test"],
          type: "shell",
          group: "test",
          description: "Run .NET tests",
        });
        break;
    }

    return tasks;
  }
}
