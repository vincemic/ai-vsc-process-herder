import { test, expect } from '@playwright/test';
import { MCPServerTestClient, MCPAssertions } from '../utils/mcp-test-client';
import path from 'path';

/**
 * Test suite for performance testing
 * Tests response times and scalability
 */
test.describe('Performance Tests', () => {
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

  test('server initialization should be fast', async () => {
    const startTime = Date.now();
    
    const newClient = new MCPServerTestClient();
    await newClient.startServer();
    
    const initResponse = await newClient.initialize();
    MCPAssertions.assertSuccess(initResponse);
    
    const endTime = Date.now();
    const initTime = endTime - startTime;
    
    console.log(`Server initialization took ${initTime}ms`);
    
    // Should initialize within reasonable time
    expect(initTime).toBeLessThan(5000); // 5 seconds max
    
    await newClient.stopServer();
  });

  test('tool calls should have reasonable response times', async () => {
    const tools = [
      { name: 'list-tasks', args: { workspaceRoot: testWorkspaceDir } },
      { name: 'list-processes', args: {} },
      { name: 'detect-project-type', args: { workspaceRoot: testWorkspaceDir } },
      { name: 'get-health-summary', args: {} }
    ];
    
    for (const tool of tools) {
      const startTime = Date.now();
      
      const response = await client.callTool(tool.name, tool.args);
      MCPAssertions.assertToolSuccess(response);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`${tool.name} took ${responseTime}ms`);
      
      // Most tools should respond quickly
      expect(responseTime).toBeLessThan(3000); // 3 seconds max
    }
  });

  test('concurrent tool calls should handle well', async () => {
    const numberOfCalls = 5;
    const toolCalls = [];
    
    const startTime = Date.now();
    
    // Make multiple concurrent calls
    for (let i = 0; i < numberOfCalls; i++) {
      toolCalls.push(client.callTool('list-tasks', { workspaceRoot: testWorkspaceDir }));
    }
    
    const responses = await Promise.all(toolCalls);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log(`${numberOfCalls} concurrent calls took ${totalTime}ms`);
    
    // All should succeed
    responses.forEach(response => {
      MCPAssertions.assertToolSuccess(response);
    });
    
    // Should handle concurrency reasonably well
    expect(totalTime).toBeLessThan(10000); // 10 seconds max for 5 calls
  });

  test('process management operations should scale', async () => {
    const numberOfTasks = 3;
    const processIds: number[] = [];
    
    // Start multiple tasks
    const startTime = Date.now();
    
    for (let i = 0; i < numberOfTasks; i++) {
      const taskName = i % 2 === 0 ? 'test-build' : 'test-lint';
      
      const startResponse = await client.callTool('start-task', {
        taskName,
        workspaceRoot: testWorkspaceDir
      });
      
      MCPAssertions.assertToolSuccess(startResponse);
      const result = MCPAssertions.parseToolContent(startResponse);
      
      if (result.success) {
        processIds.push(result.processId);
      }
      
      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const startEndTime = Date.now();
    const startDuration = startEndTime - startTime;
    
    console.log(`Starting ${numberOfTasks} tasks took ${startDuration}ms`);
    
    // Wait for tasks to potentially complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check all processes
    const statusStartTime = Date.now();
    
    const statusPromises = processIds.map(pid => 
      client.callTool('get-process-status', { processId: pid })
    );
    
    const statusResponses = await Promise.all(statusPromises);
    
    const statusEndTime = Date.now();
    const statusDuration = statusEndTime - statusStartTime;
    
    console.log(`Checking ${processIds.length} process statuses took ${statusDuration}ms`);
    
    // All status checks should complete
    statusResponses.forEach(response => {
      MCPAssertions.assertToolSuccess(response);
    });
    
    // Should handle multiple processes efficiently
    expect(startDuration).toBeLessThan(numberOfTasks * 2000); // 2s per task max
    expect(statusDuration).toBeLessThan(5000); // 5s max for all status checks
  });

  test('large log retrieval should be performant', async () => {
    // Generate some activity first
    await client.callTool('start-task', {
      taskName: 'test-build',
      workspaceRoot: testWorkspaceDir
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test retrieving large number of logs
    const startTime = Date.now();
    
    const response = await client.callTool('get-process-logs', {
      limit: 1000 // Request many logs
    });
    
    const endTime = Date.now();
    const retrievalTime = endTime - startTime;
    
    console.log(`Retrieving up to 1000 logs took ${retrievalTime}ms`);
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.logs).toBeDefined();
    expect(Array.isArray(result.logs)).toBe(true);
    
    // Should retrieve logs efficiently
    expect(retrievalTime).toBeLessThan(5000); // 5 seconds max
  });

  test('diagnostic export should handle large datasets', async () => {
    // Generate some activity and data
    await client.callTool('start-task', {
      taskName: 'test-server',
      workspaceRoot: testWorkspaceDir
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Export full diagnostics
    const startTime = Date.now();
    
    const response = await client.callTool('export-diagnostics', {
      includeState: true,
      includeLogs: true,
      includeMetrics: true,
      timeRange: { hours: 1 }
    });
    
    const endTime = Date.now();
    const exportTime = endTime - startTime;
    
    console.log(`Full diagnostic export took ${exportTime}ms`);
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.exportTime).toBeDefined();
    expect(result.systemInfo).toBeDefined();
    
    // Should export diagnostics within reasonable time
    expect(exportTime).toBeLessThan(10000); // 10 seconds max
    
    // Check size of exported data
    const dataSize = JSON.stringify(result).length;
    console.log(`Exported data size: ${dataSize} characters`);
    
    expect(dataSize).toBeGreaterThan(100); // Should have substantial data
  });

  test('memory usage should remain stable', async () => {
    const initialMemory = process.memoryUsage();
    console.log('Initial memory usage:', initialMemory);
    
    // Perform various operations
    for (let i = 0; i < 10; i++) {
      await client.callTool('list-tasks', { workspaceRoot: testWorkspaceDir });
      await client.callTool('list-processes');
      await client.callTool('get-health-summary');
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    console.log('Final memory usage:', finalMemory);
    
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
    
    console.log(`Memory increase: ${memoryIncrease} bytes (${memoryIncreasePercent.toFixed(2)}%)`);
    
    // Memory usage shouldn't grow excessively
    expect(memoryIncreasePercent).toBeLessThan(50); // Max 50% increase
  });

  test('error handling should not degrade performance', async () => {
    const startTime = Date.now();
    
    // Make calls that will result in errors
    const errorCalls = [
      client.callTool('start-task', { taskName: 'non-existent-task' }),
      client.callTool('stop-process', { processId: 999999 }),
      client.callTool('get-process-status', { processName: 'non-existent' }),
      client.callTool('detect-project-type', { workspaceRoot: '/invalid/path' })
    ];
    
    const responses = await Promise.all(errorCalls);
    
    const endTime = Date.now();
    const errorHandlingTime = endTime - startTime;
    
    console.log(`Error handling took ${errorHandlingTime}ms`);
    
    // All should complete (with errors, but gracefully)
    responses.forEach(response => {
      MCPAssertions.assertToolSuccess(response);
      const result = MCPAssertions.parseToolContent(response);
      // Should have error info or success: false
      expect(result.error || result.success === false).toBeTruthy();
    });
    
    // Error handling should be fast
    expect(errorHandlingTime).toBeLessThan(5000); // 5 seconds max
  });
});