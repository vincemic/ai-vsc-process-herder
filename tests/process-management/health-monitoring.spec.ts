import { test, expect } from '@playwright/test';
import { MCPServerTestClient, MCPAssertions } from '../utils/mcp-test-client';
import path from 'path';

/**
 * Test suite for health monitoring functionality
 * Tests process health tracking and recovery
 */
test.describe('Health Monitoring', () => {
  let client: MCPServerTestClient;
  const testWorkspaceDir = path.join(process.cwd(), 'test-workspace');

  test.beforeEach(async () => {
    client = new MCPServerTestClient();
    await client.startServer();
    await client.initialize();
  });

  test.afterEach(async () => {
    await client.stopServer();
  });

  test('should get health summary', async () => {
    const response = await client.callTool('get-health-summary');
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.healthSummary).toBeDefined();
    expect(result.processesNeedingAttention).toBeDefined();
    expect(result.recoveryStats).toBeDefined();
    expect(result.timestamp).toBeDefined();
    
    expect(Array.isArray(result.processesNeedingAttention)).toBe(true);
  });

  test('should monitor process health after starting task', async () => {
    // Start a background task
    const startResponse = await client.callTool('start-task', {
      taskName: 'test-server',
      workspaceRoot: testWorkspaceDir
    });
    
    const startResult = MCPAssertions.parseToolContent(startResponse);
    const processId = startResult.processId;
    
    // Wait for health monitoring to kick in
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get process status with health info
    const statusResponse = await client.callTool('get-process-status', {
      processId
    });
    
    MCPAssertions.assertToolSuccess(statusResponse);
    const statusResult = MCPAssertions.parseToolContent(statusResponse);
    
    expect(statusResult.healthHistory).toBeDefined();
    expect(Array.isArray(statusResult.healthHistory)).toBe(true);
    
    // Should have some health data after waiting
    if (statusResult.healthHistory.length > 0) {
      const healthCheck = statusResult.healthHistory[0];
      expect(healthCheck).toHaveProperty('timestamp');
      expect(healthCheck).toHaveProperty('status');
    }
  });

  test('should track recovery statistics', async () => {
    const response = await client.callTool('get-health-summary');
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.recoveryStats).toBeDefined();
    expect(typeof result.recoveryStats).toBe('object');
  });

  test('should configure process recovery', async () => {
    const response = await client.callTool('configure-recovery', {
      processName: 'test-server',
      enabled: true,
      maxRestarts: 5,
      strategy: 'restart'
    });
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.success).toBe(true);
    expect(result.processName).toBe('test-server');
    expect(result.configuration).toBeDefined();
    expect(result.configuration.enabled).toBe(true);
    expect(result.configuration.maxRestarts).toBe(5);
    expect(result.configuration.strategy).toBe('restart');
  });

  test('should configure recovery with different strategies', async () => {
    const strategies = ['restart', 'kill-restart', 'notify-only'];
    
    for (const strategy of strategies) {
      const response = await client.callTool('configure-recovery', {
        processName: `test-process-${strategy}`,
        strategy
      });
      
      MCPAssertions.assertToolSuccess(response);
      const result = MCPAssertions.parseToolContent(response);
      
      expect(result.success).toBe(true);
      expect(result.configuration.strategy).toBe(strategy);
    }
  });

  test('should handle health monitoring for short-lived processes', async () => {
    // Start a quick task that will finish fast
    const startResponse = await client.callTool('start-task', {
      taskName: 'test-build',
      workspaceRoot: testWorkspaceDir
    });
    
    const startResult = MCPAssertions.parseToolContent(startResponse);
    const processId = startResult.processId;
    
    // Wait for task to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to get status - might be gone by now
    const statusResponse = await client.callTool('get-process-status', {
      processId
    });
    
    MCPAssertions.assertToolSuccess(statusResponse);
    const statusResult = MCPAssertions.parseToolContent(statusResponse);
    
    // Should handle completed processes gracefully
    expect(statusResult.error || statusResult.basicStatus).toBeDefined();
  });
});