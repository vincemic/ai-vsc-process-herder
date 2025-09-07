import { test, expect } from '@playwright/test';
import { MCPServerTestClient, MCPAssertions } from '../utils/mcp-test-client';

/**
 * Test suite for basic MCP server functionality
 * Tests the core MCP protocol implementation
 */
test.describe('MCP Server Basic Functionality', () => {
  let client: MCPServerTestClient;

  test.beforeEach(async () => {
    client = new MCPServerTestClient();
    await client.startServer();
  });

  test.afterEach(async () => {
    await client.stopServer();
  });

  test('should initialize successfully', async () => {
    const response = await client.initialize();
    
    MCPAssertions.assertSuccess(response);
    expect(response.result).toHaveProperty('protocolVersion');
    expect(response.result).toHaveProperty('capabilities');
    expect(response.result).toHaveProperty('serverInfo');
    
    // Verify server info
    expect(response.result.serverInfo.name).toBe('vscode-process-herder');
    expect(response.result.serverInfo.version).toBe('1.0.0');
  });

  test('should list available tools', async () => {
    await client.initialize();
    const response = await client.listTools();
    
    MCPAssertions.assertResult(response, ['tools']);
    
    const tools = response.result.tools;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    
    // Check for expected tools
    const toolNames = tools.map((tool: any) => tool.name);
    expect(toolNames).toContain('list-tasks');
    expect(toolNames).toContain('start-task');
    expect(toolNames).toContain('stop-process');
    expect(toolNames).toContain('list-processes');
    expect(toolNames).toContain('get-process-status');
    expect(toolNames).toContain('detect-project-type');
  });

  test('should list available resources', async () => {
    await client.initialize();
    const response = await client.listResources();
    
    MCPAssertions.assertResult(response, ['resources']);
    
    const resources = response.result.resources;
    expect(Array.isArray(resources)).toBe(true);
    
    // Check for expected resources
    const resourceUris = resources.map((resource: any) => resource.uri);
    expect(resourceUris).toContain('file://.vscode/tasks.json');
    expect(resourceUris).toContain('logs://process-herder/all-processes');
  });

  test('should list available prompts', async () => {
    await client.initialize();
    const response = await client.listPrompts();
    
    MCPAssertions.assertResult(response, ['prompts']);
    
    const prompts = response.result.prompts;
    expect(Array.isArray(prompts)).toBe(true);
    
    // Check for expected prompts
    const promptNames = prompts.map((prompt: any) => prompt.name);
    expect(promptNames).toContain('dev-workflow-help');
  });

  test('should provide detailed tool information', async () => {
    await client.initialize();
    const response = await client.listTools();
    
    const tools = response.result.tools;
    const listTasksTool = tools.find((tool: any) => tool.name === 'list-tasks');
    
    expect(listTasksTool).toBeDefined();
    expect(listTasksTool.description).toContain('List all available tasks');
    expect(listTasksTool.inputSchema).toBeDefined();
  });

  test('should handle invalid tool calls gracefully', async () => {
    await client.initialize();
    
    try {
      await client.callTool('non-existent-tool');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('should handle malformed requests gracefully', async () => {
    await client.initialize();
    
    // Send malformed JSON
    const response = await client.sendMessage('invalid-method', { invalid: 'data' });
    expect(response.error).toBeDefined();
  });
});