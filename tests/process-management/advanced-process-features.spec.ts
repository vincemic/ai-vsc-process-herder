import { test, expect } from '@playwright/test';
import { MCPServerTestClient, MCPAssertions } from '../utils/mcp-test-client';
import path from 'path';

test.describe('Advanced Process Features', () => {
  let client: MCPServerTestClient;

  test.beforeEach(async () => {
    client = new MCPServerTestClient();
    await client.startServer();
    await client.initialize();
  });

  test.afterEach(async () => {
    await client.stopServer();
  });

  test('should start process with port readiness and report ready=true', async () => {
    const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'delayed-server.js');
    const port = 35671; // arbitrary test port

    const response = await client.callTool('start-process', {
      command: 'node',
      args: [fixturePath, String(port)],
      name: 'port-ready-server',
      role: 'backend',
      readiness: { type: 'port', value: port, timeoutMs: 8000 },
      singleton: true
    });

    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    expect(result.success).toBe(true);
    expect(result.ready).toBe(true);
    expect(result.role).toBe('backend');
    expect(result.reused).toBe(false);
  });

  test('should reuse singleton process and return reused=true', async () => {
    const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'delayed-server.js');
    const port = 35672;
    const first = await client.callTool('start-process', {
      command: 'node',
      args: [fixturePath, String(port)],
      name: 'singleton-server',
      role: 'backend',
      readiness: { type: 'port', value: port, timeoutMs: 8000 },
      singleton: true
    });
    const firstResult = MCPAssertions.parseToolContent(first);
    expect(firstResult.reused || false).toBe(false);

    const second = await client.callTool('start-process', {
      command: 'node',
      args: [fixturePath, String(port)],
      name: 'singleton-server',
      role: 'backend',
      singleton: true
    });
    const secondResult = MCPAssertions.parseToolContent(second);
    expect(secondResult.reused).toBe(true);
    expect(secondResult.processId).toBe(firstResult.processId);
  });

  test('should resolve readiness via log pattern', async () => {
    const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'delayed-log.js');
    const response = await client.callTool('start-process', {
      command: 'node',
      args: [fixturePath, '150'],
      name: 'log-ready-process',
      role: 'utility',
      readiness: { type: 'log', value: 'READY_SIGNAL', timeoutMs: 4000 }
    });
    const result = MCPAssertions.parseToolContent(response);
    expect(result.ready).toBe(true);
    expect(result.role).toBe('utility');
  });

  test('should mark readiness failure when log pattern not found', async () => {
    // Use a simple long-lived node script that won't emit the pattern
    const response = await client.callTool('start-process', {
      command: 'node',
      args: ['-e', "setTimeout(()=>{},1500)"] ,
      name: 'missing-log-process',
      role: 'utility',
      readiness: { type: 'log', value: 'NON_EXISTENT_PATTERN', timeoutMs: 300 }
    });
    const result = MCPAssertions.parseToolContent(response);
    // Readiness failure yields ready=false (or undefined -> treat as false)
    expect(result.ready === false || result.ready === undefined).toBe(true);
  });

  test('should filter processes by role', async () => {
    const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'delayed-log.js');
    await client.callTool('start-process', {
      command: 'node',
      args: [fixturePath, '50'],
      name: 'backend-one',
      role: 'backend'
    });
    await client.callTool('start-process', {
      command: 'node',
      args: [fixturePath, '60'],
      name: 'utility-one',
      role: 'utility'
    });

    const listBackend = await client.callTool('list-processes', { role: 'backend' });
    const backendResult = MCPAssertions.parseToolContent(listBackend);
    expect(Array.isArray(backendResult.processes)).toBe(true);
    expect(backendResult.processes.length).toBeGreaterThan(0);
    backendResult.processes.forEach((p: any) => expect(p.role).toBe('backend'));
  });
});
