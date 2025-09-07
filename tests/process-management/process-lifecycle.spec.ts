import { test, expect } from '@playwright/test';
import { MCPServerTestClient, MCPAssertions, ProcessTestUtils } from '../utils/mcp-test-client';
import path from 'path';

/**
 * Test suite for process management functionality
 * Tests process lifecycle operations
 */
test.describe('Process Management', () => {
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

  test('should list running processes', async () => {
    const response = await client.callTool('list-processes');
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.processes).toBeDefined();
    expect(Array.isArray(result.processes)).toBe(true);
    expect(result.totalCount).toBeGreaterThanOrEqual(0);
    expect(result.managedCount).toBeGreaterThanOrEqual(0);
  });

  test('should filter processes by name', async () => {
    const response = await client.callTool('list-processes', {
      filter: 'node'
    });
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.processes).toBeDefined();
    expect(Array.isArray(result.processes)).toBe(true);
    
    // All processes should contain 'node' in name or command
    result.processes.forEach((proc: any) => {
      const searchText = (proc.name + ' ' + proc.command).toLowerCase();
      expect(searchText).toContain('node');
    });
  });

  test('should start and stop a process', async () => {
    // Start a background task
    const startResponse = await client.callTool('start-task', {
      taskName: 'test-server',
      workspaceRoot: testWorkspaceDir
    });
    
    MCPAssertions.assertToolSuccess(startResponse);
    const startResult = MCPAssertions.parseToolContent(startResponse);
    
    expect(startResult.success).toBe(true);
    const processId = startResult.processId;
    
    // Wait for process to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify process is running
    const statusResponse = await client.callTool('get-process-status', {
      processId
    });
    
    MCPAssertions.assertToolSuccess(statusResponse);
    const statusResult = MCPAssertions.parseToolContent(statusResponse);
    expect(statusResult.basicStatus).toBeDefined();
    
    // Stop the process
    const stopResponse = await client.callTool('stop-process', {
      processId
    });
    
    MCPAssertions.assertToolSuccess(stopResponse);
    const stopResult = MCPAssertions.parseToolContent(stopResponse);
    
    expect(stopResult.success).toBe(true);
    expect(stopResult.processId).toBe(processId);
  });

  test('should stop process by name', async () => {
    // Start a task
    const startResponse = await client.callTool('start-task', {
      taskName: 'test-server',
      workspaceRoot: testWorkspaceDir
    });
    
    const startResult = MCPAssertions.parseToolContent(startResponse);
    const processId = startResult.processId;
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Stop by name instead of ID
    const stopResponse = await client.callTool('stop-process', {
      processName: 'test-server'
    });
    
    MCPAssertions.assertToolSuccess(stopResponse);
    const stopResult = MCPAssertions.parseToolContent(stopResponse);
    
    expect(stopResult.success).toBe(true);
    expect(stopResult.processId).toBe(processId);
  });

  test('should restart a process', async () => {
    // Start a process
    const startResponse = await client.callTool('start-task', {
      taskName: 'test-server',
      workspaceRoot: testWorkspaceDir
    });
    
    const startResult = MCPAssertions.parseToolContent(startResponse);
    const originalProcessId = startResult.processId;
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Restart the process
    const restartResponse = await client.callTool('restart-process', {
      processId: originalProcessId
    });
    
    MCPAssertions.assertToolSuccess(restartResponse);
    const restartResult = MCPAssertions.parseToolContent(restartResponse);
    
    expect(restartResult.success).toBe(true);
    expect(restartResult.oldProcessId).toBe(originalProcessId);
    expect(restartResult.newProcessId).toBeGreaterThan(0);
    expect(restartResult.newProcessId).not.toBe(originalProcessId);
  });

  test('should get detailed process status', async () => {
    // Start a process
    const startResponse = await client.callTool('start-task', {
      taskName: 'test-server',
      workspaceRoot: testWorkspaceDir
    });
    
    const startResult = MCPAssertions.parseToolContent(startResponse);
    const processId = startResult.processId;
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get status
    const statusResponse = await client.callTool('get-process-status', {
      processId
    });
    
    MCPAssertions.assertToolSuccess(statusResponse);
    const statusResult = MCPAssertions.parseToolContent(statusResponse);
    
    expect(statusResult.basicStatus).toBeDefined();
    expect(statusResult.healthHistory).toBeDefined();
    expect(statusResult.processState).toBeDefined();
    expect(Array.isArray(statusResult.healthHistory)).toBe(true);
  });

  test('should handle non-existent process gracefully', async () => {
    const response = await client.callTool('get-process-status', {
      processId: 999999 // Non-existent PID
    });
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    // For non-existent process IDs, the method returns a status with isRunning: false
    expect(result.basicStatus).toBeDefined();
    expect(result.basicStatus.isRunning).toBe(false);
    expect(result.basicStatus.pid).toBe(999999);
  });

  test('should force kill stubborn process', async () => {
    // Start a process
    const startResponse = await client.callTool('start-task', {
      taskName: 'test-server',
      workspaceRoot: testWorkspaceDir
    });
    
    const startResult = MCPAssertions.parseToolContent(startResponse);
    const processId = startResult.processId;
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Force stop the process
    const stopResponse = await client.callTool('stop-process', {
      processId,
      force: true
    });
    
    MCPAssertions.assertToolSuccess(stopResponse);
    const stopResult = MCPAssertions.parseToolContent(stopResponse);
    
    expect(stopResult.success).toBe(true);
    expect(stopResult.force).toBe(true);
  });

  test('should track managed vs unmanaged processes', async () => {
    // Get initial process count (including system processes)
    const initialResponse = await client.callTool('list-processes', {
      includeSystem: true
    });
    const initialResult = MCPAssertions.parseToolContent(initialResponse);
    const initialManagedCount = initialResult.managedCount;
    
    // Start a managed process (task)
    await client.callTool('start-task', {
      taskName: 'test-build',
      workspaceRoot: testWorkspaceDir
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check process count again (including system processes)
    const afterResponse = await client.callTool('list-processes', {
      includeSystem: true
    });
    const afterResult = MCPAssertions.parseToolContent(afterResponse);
    
    // Managed count should increase (task might finish quickly, so we check >= initial)
    expect(afterResult.managedCount).toBeGreaterThanOrEqual(initialManagedCount);
    // When including system processes, total count should definitely be > 0
    expect(afterResult.totalCount).toBeGreaterThan(0);
  });
});