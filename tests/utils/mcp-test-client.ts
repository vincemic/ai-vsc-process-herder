import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';

export interface MCPMessage {
  jsonrpc: string;
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export interface MCPServerResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * MCP Server Test Client
 * Provides utilities for testing MCP server functionality
 */
export class MCPServerTestClient extends EventEmitter {
  private serverProcess: ChildProcess | null = null;
  private messageId = 1;
  private responseQueue: Map<string | number, (response: MCPMessage) => void> = new Map();

  constructor(private serverPath?: string) {
    super();
    this.serverPath = serverPath || path.join(process.cwd(), 'build', 'index.js');
  }

  /**
   * Start the MCP server process
   */
  async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', [this.serverPath!], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });

      if (!this.serverProcess.stdin || !this.serverProcess.stdout) {
        reject(new Error('Failed to create server process pipes'));
        return;
      }

      // Handle server output
      this.serverProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        
        for (const line of lines) {
          try {
            const message = JSON.parse(line) as MCPMessage;
            this.handleServerMessage(message);
          } catch (error) {
            // Ignore non-JSON output (like startup messages)
            console.log('Server output:', line);
          }
        }
      });

      this.serverProcess.stderr?.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      this.serverProcess.on('error', (error) => {
        reject(error);
      });

      this.serverProcess.on('close', (code) => {
        this.emit('serverClosed', code);
      });

      // Wait a moment for server to start
      setTimeout(resolve, 1000);
    });
  }

  /**
   * Stop the MCP server process
   */
  async stopServer(): Promise<void> {
    return new Promise((resolve) => {
      if (this.serverProcess) {
        this.serverProcess.on('close', () => resolve());
        this.serverProcess.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (this.serverProcess && !this.serverProcess.killed) {
            this.serverProcess.kill('SIGKILL');
            resolve();
          }
        }, 5000);
      } else {
        resolve();
      }
    });
  }

  /**
   * Send a message to the MCP server
   */
  async sendMessage(method: string, params?: any): Promise<MCPMessage> {
    return new Promise((resolve, reject) => {
      if (!this.serverProcess?.stdin) {
        reject(new Error('Server not started'));
        return;
      }

      const id = this.messageId++;
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      // Store response handler
      this.responseQueue.set(id, resolve);

      // Send message
      const messageString = JSON.stringify(message) + '\n';
      this.serverProcess.stdin.write(messageString);

      // Set timeout for response
      setTimeout(() => {
        if (this.responseQueue.has(id)) {
          this.responseQueue.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Initialize MCP server connection
   */
  async initialize(): Promise<MCPMessage> {
    return this.sendMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: true
        },
        sampling: {}
      },
      clientInfo: {
        name: 'playwright-test-client',
        version: '1.0.0'
      }
    });
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, arguments_?: any): Promise<MCPMessage> {
    return this.sendMessage('tools/call', {
      name,
      arguments: arguments_ || {}
    });
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPMessage> {
    return this.sendMessage('tools/list');
  }

  /**
   * List available resources
   */
  async listResources(): Promise<MCPMessage> {
    return this.sendMessage('resources/list');
  }

  /**
   * Get a resource
   */
  async getResource(uri: string): Promise<MCPMessage> {
    return this.sendMessage('resources/read', { uri });
  }

  /**
   * List available prompts
   */
  async listPrompts(): Promise<MCPMessage> {
    return this.sendMessage('prompts/list');
  }

  /**
   * Get a prompt
   */
  async getPrompt(name: string, arguments_?: any): Promise<MCPMessage> {
    return this.sendMessage('prompts/get', {
      name,
      arguments: arguments_ || {}
    });
  }

  private handleServerMessage(message: MCPMessage): void {
    if (message.id && this.responseQueue.has(message.id)) {
      const handler = this.responseQueue.get(message.id)!;
      this.responseQueue.delete(message.id);
      handler(message);
    } else {
      // Handle notifications or unmatched responses
      this.emit('notification', message);
    }
  }
}

/**
 * Test utilities for process management
 */
export class ProcessTestUtils {
  /**
   * Create a long-running test process
   */
  static createTestProcess(duration: number = 5000): ChildProcess {
    return spawn('node', [
      '-e', 
      `console.log('Test process started'); setTimeout(() => console.log('Test process finished'), ${duration});`
    ], {
      stdio: 'pipe'
    });
  }

  /**
   * Wait for a process to exit
   */
  static waitForProcessExit(process: ChildProcess, timeout: number = 10000): Promise<number | null> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Process exit timeout'));
      }, timeout);

      process.on('exit', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });
  }

  /**
   * Get current running Node processes
   */
  static async getNodeProcesses(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const proc = spawn('tasklist', ['/FI', 'IMAGENAME eq node.exe', '/FO', 'CSV'], {
        stdio: 'pipe'
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          const lines = output.split('\n').filter(line => line.trim());
          const processes = lines.slice(1).map(line => {
            const parts = line.split(',').map(part => part.replace(/"/g, ''));
            return {
              name: parts[0],
              pid: parseInt(parts[1]),
              sessionName: parts[2],
              sessionNumber: parts[3],
              memUsage: parts[4]
            };
          }).filter(proc => !isNaN(proc.pid));
          resolve(processes);
        } else {
          reject(new Error(`Failed to list processes: ${code}`));
        }
      });
    });
  }
}

/**
 * File system utilities for testing
 */
export class FileTestUtils {
  /**
   * Create a temporary test file
   */
  static async createTempFile(content: string, filename: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content);
    return filePath;
  }

  /**
   * Clean up temporary files
   */
  static async cleanupTempFile(filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      const dir = path.dirname(filePath);
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp file:', error);
    }
  }
}

/**
 * Assertion utilities for MCP responses
 */
export class MCPAssertions {
  /**
   * Assert that an MCP response is successful
   */
  static assertSuccess(response: MCPMessage): void {
    if (response.error) {
      throw new Error(`MCP call failed: ${JSON.stringify(response.error)}`);
    }
    if (!response.result) {
      throw new Error('MCP response missing result');
    }
  }

  /**
   * Assert that an MCP response contains expected data
   */
  static assertResult(response: MCPMessage, expectedKeys: string[]): void {
    this.assertSuccess(response);
    
    for (const key of expectedKeys) {
      if (!(key in response.result)) {
        throw new Error(`MCP response missing expected key: ${key}`);
      }
    }
  }

  /**
   * Assert that a tool response is successful
   */
  static assertToolSuccess(response: MCPMessage): void {
    this.assertSuccess(response);
    
    if (!response.result.content || !Array.isArray(response.result.content)) {
      throw new Error('Tool response missing content array');
    }
  }

  /**
   * Parse tool response content as JSON
   */
  static parseToolContent(response: MCPMessage): any {
    this.assertToolSuccess(response);
    
    const content = response.result.content[0];
    if (content.type !== 'text') {
      throw new Error('Expected text content in tool response');
    }
    
    try {
      return JSON.parse(content.text);
    } catch (error) {
      throw new Error(`Failed to parse tool response as JSON: ${error}`);
    }
  }
}