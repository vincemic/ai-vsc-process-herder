import { test, expect } from '@playwright/test';
import { MCPServerTestClient, MCPAssertions } from '../utils/mcp-test-client';
import path from 'path';

/**
 * Test suite for end-to-end workflow testing
 * Tests complete development workflow scenarios
 */
test.describe('End-to-End Workflows', () => {
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

  test('complete development workflow: detect -> list -> start -> monitor -> stop', async () => {
    // Step 1: Detect project type
    const detectResponse = await client.callTool('detect-project-type', {
      workspaceRoot: testWorkspaceDir
    });
    
    MCPAssertions.assertToolSuccess(detectResponse);
    const detectResult = MCPAssertions.parseToolContent(detectResponse);
    
    expect(detectResult.projectType).toBeDefined();
    console.log('Detected project type:', detectResult.projectType);
    
    // Step 2: List available tasks
    const listTasksResponse = await client.callTool('list-tasks', {
      workspaceRoot: testWorkspaceDir
    });
    
    MCPAssertions.assertToolSuccess(listTasksResponse);
    const tasksResult = MCPAssertions.parseToolContent(listTasksResponse);
    
    expect(tasksResult.tasks.length).toBeGreaterThan(0);
    console.log('Available tasks:', tasksResult.tasks.map((t: any) => t.label));
    
    // Step 3: Start a background server task
    const startResponse = await client.callTool('start-task', {
      taskName: 'test-server',
      workspaceRoot: testWorkspaceDir
    });
    
    MCPAssertions.assertToolSuccess(startResponse);
    const startResult = MCPAssertions.parseToolContent(startResponse);
    
    expect(startResult.success).toBe(true);
    const processId = startResult.processId;
    console.log('Started process:', processId);
    
    // Step 4: Wait and monitor the process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const statusResponse = await client.callTool('get-process-status', {
      processId
    });
    
    MCPAssertions.assertToolSuccess(statusResponse);
    const statusResult = MCPAssertions.parseToolContent(statusResponse);
    
    expect(statusResult.basicStatus || statusResult.error).toBeDefined();
    console.log('Process status checked');
    
    // Step 5: List all processes to see our managed process
    const listProcessesResponse = await client.callTool('list-processes');
    
    MCPAssertions.assertToolSuccess(listProcessesResponse);
    const processesResult = MCPAssertions.parseToolContent(listProcessesResponse);
    
    expect(processesResult.managedCount).toBeGreaterThan(0);
    console.log('Managed processes:', processesResult.managedCount);
    
    // Step 6: Stop the process
    const stopResponse = await client.callTool('stop-process', {
      processId
    });
    
    MCPAssertions.assertToolSuccess(stopResponse);
    const stopResult = MCPAssertions.parseToolContent(stopResponse);
    
    expect(stopResult.success).toBe(true);
    console.log('Process stopped successfully');
  });

  test('multi-task workflow: start multiple tasks and manage them', async () => {
    const taskNames = ['test-build', 'test-lint'];
    const processIds: number[] = [];
    
    // Start multiple tasks
    for (const taskName of taskNames) {
      const response = await client.callTool('start-task', {
        taskName,
        workspaceRoot: testWorkspaceDir
      });
      
      MCPAssertions.assertToolSuccess(response);
      const result = MCPAssertions.parseToolContent(response);
      
      if (result.success) {
        processIds.push(result.processId);
      }
      
      // Small delay between starts
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    expect(processIds.length).toBeGreaterThan(0);
    console.log('Started processes:', processIds);
    
    // Wait for tasks to potentially complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check health summary
    const healthResponse = await client.callTool('get-health-summary');
    MCPAssertions.assertToolSuccess(healthResponse);
    const healthResult = MCPAssertions.parseToolContent(healthResponse);
    
    expect(healthResult.healthSummary).toBeDefined();
    console.log('Health summary retrieved');
    
    // List processes to see current state
    const listResponse = await client.callTool('list-processes');
    MCPAssertions.assertToolSuccess(listResponse);
    const listResult = MCPAssertions.parseToolContent(listResponse);
    
    console.log('Final process count:', listResult.totalCount);
  });

  test('error recovery workflow: start task, force stop, check recovery', async () => {
    // Start a background task
    const startResponse = await client.callTool('start-task', {
      taskName: 'test-server',
      workspaceRoot: testWorkspaceDir
    });
    
    const startResult = MCPAssertions.parseToolContent(startResponse);
    const processId = startResult.processId;
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Configure recovery for this process type
    const configResponse = await client.callTool('configure-recovery', {
      processName: 'test-server',
      enabled: true,
      maxRestarts: 2,
      strategy: 'restart'
    });
    
    MCPAssertions.assertToolSuccess(configResponse);
    console.log('Recovery configured');
    
    // Force kill the process
    const stopResponse = await client.callTool('stop-process', {
      processId,
      force: true
    });
    
    MCPAssertions.assertToolSuccess(stopResponse);
    const stopResult = MCPAssertions.parseToolContent(stopResponse);
    
    expect(stopResult.success).toBe(true);
    expect(stopResult.force).toBe(true);
    console.log('Process force stopped');
    
    // Check health summary for recovery stats
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const healthResponse = await client.callTool('get-health-summary');
    MCPAssertions.assertToolSuccess(healthResponse);
    const healthResult = MCPAssertions.parseToolContent(healthResponse);
    
    expect(healthResult.recoveryStats).toBeDefined();
    console.log('Recovery stats checked');
  });

  test('logging and diagnostics workflow', async () => {
    // Start some activity
    await client.callTool('start-task', {
      taskName: 'test-build',
      workspaceRoot: testWorkspaceDir
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get process logs
    const logsResponse = await client.callTool('get-process-logs', {
      level: 'info',
      limit: 50
    });
    
    MCPAssertions.assertToolSuccess(logsResponse);
    const logsResult = MCPAssertions.parseToolContent(logsResponse);
    
    expect(logsResult.logs).toBeDefined();
    expect(logsResult.stats).toBeDefined();
    expect(logsResult.categories).toBeDefined();
    expect(Array.isArray(logsResult.logs)).toBe(true);
    console.log('Logs retrieved:', logsResult.logs.length, 'entries');
    
    // Get process metrics
    const metricsResponse = await client.callTool('get-process-metrics');
    
    MCPAssertions.assertToolSuccess(metricsResponse);
    const metricsResult = MCPAssertions.parseToolContent(metricsResponse);
    
    expect(metricsResult.metrics).toBeDefined();
    console.log('Metrics retrieved');
    
    // Export diagnostics
    const diagnosticsResponse = await client.callTool('export-diagnostics', {
      includeState: true,
      includeLogs: true,
      includeMetrics: true
    });
    
    MCPAssertions.assertToolSuccess(diagnosticsResponse);
    const diagnosticsResult = MCPAssertions.parseToolContent(diagnosticsResponse);
    
    expect(diagnosticsResult.exportTime).toBeDefined();
    expect(diagnosticsResult.systemInfo).toBeDefined();
    expect(diagnosticsResult.processState).toBeDefined();
    expect(diagnosticsResult.logs).toBeDefined();
    expect(diagnosticsResult.metrics).toBeDefined();
    console.log('Diagnostics exported successfully');
  });

  test('VS Code integration workflow', async () => {
    // Get VS Code status
    const statusResponse = await client.callTool('get-vscode-status');
    
    MCPAssertions.assertToolSuccess(statusResponse);
    const statusResult = MCPAssertions.parseToolContent(statusResponse);
    
    expect(statusResult).toBeDefined();
    console.log('VS Code status retrieved');
    
    // Get tasks configuration resource
    const tasksResource = await client.getResource('file://.vscode/tasks.json');
    
    MCPAssertions.assertSuccess(tasksResource);
    expect(tasksResource.result.contents).toBeDefined();
    
    const tasksContent = tasksResource.result.contents[0];
    expect(tasksContent.mimeType).toBe('application/json');
    
    const tasksConfig = JSON.parse(tasksContent.text);
    expect(tasksConfig.version).toBe('2.0.0');
    console.log('Tasks configuration retrieved');
    
    // Get process logs resource
    const logsResource = await client.getResource('logs://process-herder/all-processes');
    
    MCPAssertions.assertSuccess(logsResource);
    expect(logsResource.result.contents).toBeDefined();
    
    const logsContent = logsResource.result.contents[0];
    expect(logsContent.mimeType).toBe('text/plain');
    console.log('Process logs resource retrieved');
  });

  test('prompt assistance workflow', async () => {
    // Get development workflow help prompt
    const promptResponse = await client.getPrompt('dev-workflow-help');
    
    MCPAssertions.assertSuccess(promptResponse);
    expect(promptResponse.result.messages).toBeDefined();
    expect(Array.isArray(promptResponse.result.messages)).toBe(true);
    expect(promptResponse.result.messages.length).toBeGreaterThan(0);
    
    const message = promptResponse.result.messages[0];
    expect(message.role).toBe('user');
    expect(message.content.type).toBe('text');
    expect(message.content.text).toContain('development workflow');
    
    console.log('Development workflow prompt retrieved successfully');
  });
});