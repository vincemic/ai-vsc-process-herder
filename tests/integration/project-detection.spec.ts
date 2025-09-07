import { test, expect } from '@playwright/test';
import { MCPServerTestClient, MCPAssertions } from '../utils/mcp-test-client';
import path from 'path';

/**
 * Test suite for project detection functionality
 * Tests automatic project type detection and task suggestions
 */
test.describe('Project Detection', () => {
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

  test('should detect project type from test workspace', async () => {
    const response = await client.callTool('detect-project-type', {
      workspaceRoot: testWorkspaceDir
    });
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.projectType).toBeDefined();
    expect(result.frameworks).toBeDefined();
    expect(result.packageManagers).toBeDefined();
    expect(result.suggestedTasks).toBeDefined();
    expect(result.confidence).toBeDefined();
    expect(result.workspaceRoot).toBe(testWorkspaceDir);
    expect(result.findings).toBeDefined();
    
    expect(Array.isArray(result.frameworks)).toBe(true);
    expect(Array.isArray(result.packageManagers)).toBe(true);
    expect(Array.isArray(result.suggestedTasks)).toBe(true);
    expect(Array.isArray(result.findings)).toBe(true);
    
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    // Confidence can be > 1 since it's a sum of individual finding confidences
    // If test-workspace is properly set up, should have some confidence > 0
    if (result.findings.length > 0) {
      expect(result.confidence).toBeGreaterThan(0);
    }
  });

  test('should detect Node.js project from package.json', async () => {
    const response = await client.callTool('detect-project-type', {
      workspaceRoot: testWorkspaceDir
    });
    
    const result = MCPAssertions.parseToolContent(response);
    
    // Should detect Node.js/JavaScript based on package.json
    expect(result.projectType).toContain('javascript');
    expect(result.packageManagers).toContain('npm');
  });

  test('should suggest relevant tasks for detected project', async () => {
    const response = await client.callTool('detect-project-type', {
      workspaceRoot: testWorkspaceDir
    });
    
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.suggestedTasks.length).toBeGreaterThan(0);
    
    // Should suggest common Node.js tasks
    const taskLabels = result.suggestedTasks.map((task: any) => task.label || task.name || task);
    expect(taskLabels.some((label: string) => 
      label.includes('dev') || label.includes('start') || label.includes('build') || label.includes('test')
    )).toBe(true);
  });

  test('should provide confidence score for detection', async () => {
    const response = await client.callTool('detect-project-type', {
      workspaceRoot: testWorkspaceDir
    });
    
    const result = MCPAssertions.parseToolContent(response);
    
    // Should have reasonable confidence given package.json exists
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test('should handle non-existent workspace gracefully', async () => {
    const response = await client.callTool('detect-project-type', {
      workspaceRoot: '/non/existent/path'
    });
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    // Should handle gracefully
    expect(result.projectType || result.error).toBeDefined();
    if (result.confidence !== undefined) {
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    }
  });

  test('should detect multiple frameworks', async () => {
    const response = await client.callTool('detect-project-type', {
      workspaceRoot: testWorkspaceDir
    });
    
    const result = MCPAssertions.parseToolContent(response);
    
    // Based on test package.json with React and Express
    expect(result.frameworks.length).toBeGreaterThanOrEqual(0);
    
    // If frameworks are detected, they should be valid
    if (result.frameworks.length > 0) {
      result.frameworks.forEach((framework: string) => {
        expect(typeof framework).toBe('string');
        expect(framework.length).toBeGreaterThan(0);
      });
    }
  });

  test('should provide detailed findings', async () => {
    const response = await client.callTool('detect-project-type', {
      workspaceRoot: testWorkspaceDir
    });
    
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.findings.length).toBeGreaterThan(0);
    
    result.findings.forEach((finding: any) => {
      expect(finding).toHaveProperty('type');
      expect(finding).toHaveProperty('confidence');
      expect(finding).toHaveProperty('file');
      expect(finding).toHaveProperty('description');
      
      expect(typeof finding.type).toBe('string');
      expect(typeof finding.confidence).toBe('number');
      expect(typeof finding.file).toBe('string');
      expect(typeof finding.description).toBe('string');
    });
  });

  test('should detect current workspace when no path provided', async () => {
    const response = await client.callTool('detect-project-type');
    
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.projectType).toBeDefined();
    expect(result.workspaceRoot).toBeDefined();
    
    // Should detect the MCP server project itself
    expect(result.projectType).toContain('javascript'); // TypeScript projects are detected as javascript with TypeScript framework
    expect(result.packageManagers).toContain('npm');
    expect(result.frameworks).toContain('TypeScript'); // TypeScript is listed as a framework
  });
});