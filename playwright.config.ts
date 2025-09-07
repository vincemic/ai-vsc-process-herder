import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for VS Code Process Herder MCP Server
 * 
 * This configuration sets up testing for:
 * - MCP server functionality
 * - Process management operations
 * - Integration testing
 * - Performance testing
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Process management tests should run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1, // Single worker for process management tests
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'mcp-server-tests',
      testMatch: '**/mcp-server/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'process-management-tests',
      testMatch: '**/process-management/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['mcp-server-tests'],
    },
    {
      name: 'integration-tests',
      testMatch: '**/integration/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['process-management-tests'],
    },
    {
      name: 'performance-tests',
      testMatch: '**/performance/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['integration-tests'],
    },
  ],

  // Global setup and teardown
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',

  // Test output
  outputDir: 'test-results/',
});