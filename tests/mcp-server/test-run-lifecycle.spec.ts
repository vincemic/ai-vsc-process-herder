import { test, expect } from '@playwright/test';
import { MCPServerTestClient, MCPAssertions } from '../utils/mcp-test-client';

// NOTE: This test focuses on the new test run orchestration tools:
// - start-test-run
// - get-test-run-status
// - list-test-runs
// - abort-test-run
// It uses simple Node commands so it does not depend on repo-specific dev servers.

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Creates a trivial backend script that listens on a port to satisfy port readiness.
 * We inline a tiny HTTP server to avoid external files.
 */
const backendCommand = 'node';
const backendArgs = ['-e', `
  const http = require('http');
  const server = http.createServer((req,res)=>{res.end('ok');});
  server.listen(3100, ()=> console.log('backend listening 3100'));
  // keep alive for a while
  setTimeout(()=>{}, 60000);
`];

/**
 * Frontend simulation with an HTTP readiness endpoint.
 */
const frontendCommand = 'node';
const frontendArgs = ['-e', `
  const http = require('http');
  const server = http.createServer((req,res)=>{res.end('frontend');});
  server.listen(3200, ()=> console.log('frontend up 3200'));
  setTimeout(()=>{}, 60000);
`];

/**
 * Tests command prints a log line used for log readiness then exits quickly.
 */
const testsCommand = 'node';
const testsArgs = ['-e', `
  console.log('TESTS STARTING');
  setTimeout(()=>{ console.log('ALL TESTS PASSED'); process.exit(0);}, 750);
`];

test.describe('Test Run Orchestration', () => {
  let client: MCPServerTestClient;

  test.beforeAll(async () => {
    client = new MCPServerTestClient();
    await client.startServer();
    await client.initialize();
  });

  test.afterAll(async () => {
    await client.stopServer();
  });

  test('start-test-run -> running -> completed (autoStop)', async () => {
    const runId = 'run-complete-1';
    const resp = await client.callTool('start-test-run', {
      id: runId,
      backend: {
        command: backendCommand,
        args: backendArgs,
        readiness: { type: 'port', value: 3100, timeoutMs: 8000 }
      },
      frontend: {
        command: frontendCommand,
        args: frontendArgs,
        readiness: { type: 'http', value: 'http://localhost:3200', timeoutMs: 8000 }
      },
      tests: {
        command: testsCommand,
        args: testsArgs,
        readiness: { type: 'log', value: 'TESTS STARTING', timeoutMs: 4000 }
      },
      autoStop: true,
      keepBackends: false
    });

    const startData = MCPAssertions.parseToolContent(resp);
    expect(startData.success).toBeTruthy();
    expect(startData.run.id).toBe(runId);

    // Poll status until completed
    let status = 'pending';
    const maxWait = Date.now() + 20000;
    while (Date.now() < maxWait) {
      const statusResp = await client.callTool('get-test-run-status', { id: runId });
      const statusData = MCPAssertions.parseToolContent(statusResp);
      status = statusData.status;
      if (status === 'completed' || status === 'failed') break;
      await sleep(800);
    }
    expect(['completed']).toContain(status);
  });

  test('abort-test-run transitions to aborted', async () => {
    const runId = 'run-abort-1';
    const resp = await client.callTool('start-test-run', {
      id: runId,
      backend: {
        command: backendCommand,
        args: backendArgs,
        readiness: { type: 'port', value: 3100, timeoutMs: 8000 }
      },
      tests: {
        command: testsCommand,
        args: testsArgs,
        readiness: { type: 'log', value: 'TESTS STARTING', timeoutMs: 4000 }
      },
      // do not autoStop so we can abort mid-flight quickly
      autoStop: false
    });

    MCPAssertions.parseToolContent(resp); // ensure no error

    // Abort after a short delay
    await sleep(500);
    const abortResp = await client.callTool('abort-test-run', { id: runId });
    const abortData = MCPAssertions.parseToolContent(abortResp);
    expect(abortData.status).toBe('aborted');

    // Confirm via status tool
    const statusResp = await client.callTool('get-test-run-status', { id: runId });
    const statusData = MCPAssertions.parseToolContent(statusResp);
    expect(statusData.status).toBe('aborted');
  });

  test('list-test-runs includes previous runs', async () => {
    const resp = await client.callTool('list-test-runs', {});
    const data = MCPAssertions.parseToolContent(resp);
    // We should have at least the two runs created above
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.some((r: any) => r.id === 'run-complete-1')).toBeTruthy();
    expect(data.some((r: any) => r.id === 'run-abort-1')).toBeTruthy();
  });
});
