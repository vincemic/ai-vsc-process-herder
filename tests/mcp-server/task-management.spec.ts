import { test, expect } from '@playwright/test';
import { MCPServerTestClient, MCPAssertions } from '../utils/mcp-test-client';
import path from 'path';

/**
 * Test suite for task management functionality
 * Tests VS Code task integration and execution
 */
test.describe('Task Management', () => {
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

  test('should list tasks from test workspace', async () => {
    const response = await client.callTool('list-tasks', {
      workspaceRoot: testWorkspaceDir
    });
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.tasks).toBeDefined();
    expect(Array.isArray(result.tasks)).toBe(true);
    expect(result.tasks.length).toBeGreaterThan(0);
    
    // Check for expected test tasks
    const taskLabels = result.tasks.map((task: any) => task.label);
    expect(taskLabels).toContain('test-build');
    expect(taskLabels).toContain('test-server');
    expect(taskLabels).toContain('test-lint');
  });

  test('should provide detailed task information', async () => {
    const response = await client.callTool('list-tasks', {
      workspaceRoot: testWorkspaceDir
    });
    
    const result = MCPAssertions.parseToolContent(response);
    const buildTask = result.tasks.find((task: any) => task.label === 'test-build');
    
    expect(buildTask).toBeDefined();
    expect(buildTask.type).toBe('shell');
    expect(buildTask.command).toBe('echo');
    expect(buildTask.description).toContain('Test build task');
    expect(buildTask.isBackground).toBe(false);
  });

  test('should start a simple task successfully', async () => {
    const response = await client.callTool('start-task', {
      taskName: 'test-build',
      workspaceRoot: testWorkspaceDir
    });
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.success).toBe(true);
    expect(result.processId).toBeGreaterThan(0);
    expect(result.taskName).toBe('test-build');
    // On Windows, echo commands are often executed through cmd
    expect(result.command).toBeTruthy();
    expect(result.message).toContain('started successfully');
  });

  test('should handle non-existent task gracefully', async () => {
    const response = await client.callTool('start-task', {
      taskName: 'non-existent-task',
      workspaceRoot: testWorkspaceDir
    });
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('should handle invalid workspace path', async () => {
    const response = await client.callTool('list-tasks', {
      workspaceRoot: '/non/existent/path'
    });
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    // Should handle gracefully and return empty tasks or error
    expect(result.tasks || result.error).toBeDefined();
  });

  test('should start background task and track it', async () => {
    // Start background server task
    const startResponse = await client.callTool('start-task', {
      taskName: 'test-server',
      workspaceRoot: testWorkspaceDir
    });
    
    MCPAssertions.assertToolSuccess(startResponse);
    const startResult = MCPAssertions.parseToolContent(startResponse);
    
    expect(startResult.success).toBe(true);
    const processId = startResult.processId;
    
    // Wait a moment for the process to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // List processes to verify it's running
    const listResponse = await client.callTool('list-processes');
    MCPAssertions.assertToolSuccess(listResponse);
    const listResult = MCPAssertions.parseToolContent(listResponse);
    
    const managedProcesses = listResult.processes.filter((proc: any) => proc.isTask);
    expect(managedProcesses.length).toBeGreaterThan(0);
    
    // Find our process
    const ourProcess = managedProcesses.find((proc: any) => proc.pid === processId);
    expect(ourProcess).toBeDefined();
  });

  test('should get task resource content', async () => {
    const response = await client.getResource('file://.vscode/tasks.json');
    
    MCPAssertions.assertSuccess(response);
    expect(response.result.contents).toBeDefined();
    expect(Array.isArray(response.result.contents)).toBe(true);
    
    const content = response.result.contents[0];
    expect(content.uri).toBe('file://.vscode/tasks.json');
    expect(content.mimeType).toBe('application/json');
    
    // Parse and verify tasks content
    const tasksConfig = JSON.parse(content.text);
    expect(tasksConfig.version).toBe('2.0.0');
    expect(tasksConfig.tasks).toBeDefined();
    expect(Array.isArray(tasksConfig.tasks)).toBe(true);
  });
});