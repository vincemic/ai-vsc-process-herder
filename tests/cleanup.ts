import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Cleanup script for test environment
 * Kills any leftover test processes and cleans up files
 */
async function cleanup() {
  console.log('🧹 Cleaning up test environment...');

  // Kill any Node processes that might be hanging around from tests
  try {
    if (process.platform === 'win32') {
      // On Windows, kill any node processes that might be test processes
      const proc = spawn('taskkill', ['/F', '/IM', 'node.exe', '/T'], { stdio: 'ignore' });
      await new Promise(resolve => {
        proc.on('close', () => resolve(void 0));
        setTimeout(() => {
          proc.kill();
          resolve(void 0);
        }, 5000);
      });
    } else {
      // On Unix-like systems
      spawn('pkill', ['-f', 'node.*test'], { stdio: 'ignore' });
    }
  } catch (error) {
    console.warn('Warning: Could not kill test processes:', error);
  }

  // Clean up test workspace
  const testWorkspaceDir = path.join(process.cwd(), 'test-workspace');
  try {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processes to die
    await fs.rm(testWorkspaceDir, { recursive: true, force: true });
    console.log('📁 Test workspace cleaned');
  } catch (error) {
    console.warn('Warning: Could not clean test workspace:', error);
  }

  // Clean up any temp directories from tests
  try {
    const tempDirs = await fs.readdir(process.cwd());
    for (const dir of tempDirs) {
      if (dir.startsWith('mcp-test-') || dir.startsWith('playwright-test-')) {
        try {
          await fs.rm(path.join(process.cwd(), dir), { recursive: true, force: true });
          console.log(`🗑️  Cleaned temp directory: ${dir}`);
        } catch {
          // Ignore errors for individual temp dirs
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not scan for temp directories:', error);
  }

  console.log('✅ Cleanup complete');
}

// Run cleanup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanup().catch(console.error);
}

export default cleanup;