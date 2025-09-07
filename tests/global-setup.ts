import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Global setup for Playwright tests
 * Prepares the MCP server environment and builds the project
 */
async function globalSetup() {
  console.log('🔧 Setting up test environment...');

  // Ensure the project is built
  console.log('📦 Building project...');
  await buildProject();

  // Create test workspace directory
  const testWorkspaceDir = path.join(process.cwd(), 'test-workspace');
  await ensureDirectory(testWorkspaceDir);

  // Create test tasks.json
  await createTestTasksConfig(testWorkspaceDir);

  // Create test package.json for project detection
  await createTestPackageJson(testWorkspaceDir);

  console.log('✅ Test environment setup complete');
}

async function buildProject(): Promise<void> {
  return new Promise((resolve, reject) => {
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
      shell: true
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Build failed with code ${code}`));
      }
    });
  });
}

async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

async function createTestTasksConfig(workspaceDir: string): Promise<void> {
  const vscodeDir = path.join(workspaceDir, '.vscode');
  await ensureDirectory(vscodeDir);

  const tasksConfig = {
    version: '2.0.0',
    tasks: [
      {
        label: 'test-server',
        type: 'shell',
        command: 'node',
        args: ['-e', 'console.log("Test server running..."); setTimeout(() => {}, 5000);'],
        group: 'build',
        isBackground: true,
        detail: 'Test background server task'
      },
      {
        label: 'test-build',
        type: 'shell',
        command: 'echo',
        args: ['Building test project...'],
        group: {
          kind: 'build',
          isDefault: true
        },
        detail: 'Test build task'
      },
      {
        label: 'test-lint',
        type: 'shell',
        command: 'echo',
        args: ['Linting test project...'],
        group: 'build',
        detail: 'Test lint task'
      }
    ]
  };

  await fs.writeFile(
    path.join(vscodeDir, 'tasks.json'),
    JSON.stringify(tasksConfig, null, 2)
  );
}

async function createTestPackageJson(workspaceDir: string): Promise<void> {
  const packageJson = {
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project for MCP server testing',
    scripts: {
      dev: 'node server.js',
      build: 'echo "Building..."',
      test: 'echo "Testing..."'
    },
    dependencies: {
      express: '^4.18.0',
      react: '^18.0.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.0.0'
    }
  };

  await fs.writeFile(
    path.join(workspaceDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

export default globalSetup;