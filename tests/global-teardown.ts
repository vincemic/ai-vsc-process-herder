import { promises as fs } from 'fs';
import path from 'path';

/**
 * Global teardown for Playwright tests
 * Cleans up test environment and resources
 */
async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');

  // Clean up test workspace
  const testWorkspaceDir = path.join(process.cwd(), 'test-workspace');
  try {
    await fs.rm(testWorkspaceDir, { recursive: true, force: true });
    console.log('📁 Test workspace cleaned up');
  } catch (error) {
    console.warn('⚠️  Could not clean up test workspace:', error);
  }

  console.log('✅ Test environment cleanup complete');
}

export default globalTeardown;