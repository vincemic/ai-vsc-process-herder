#!/usr/bin/env node

/**
 * Simple test script to verify MCP server functionality
 * This simulates how an AI assistant would interact with the server
 */

import { spawn } from 'child_process';
import * as path from 'path';

const serverPath = path.join(process.cwd(), 'build', 'index.js');

async function testMCPServer() {
  console.log('🧪 Testing VS Code Process Herder MCP Server...\n');

  // Start the MCP server
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  let responseData = '';
  let errorData = '';

  server.stdout.on('data', (data) => {
    responseData += data.toString();
  });

  server.stderr.on('data', (data) => {
    errorData += data.toString();
    console.log('Server stderr:', data.toString());
  });

  // Test 1: Initialize the server
  console.log('📋 Test 1: Server Initialization');
  const initMessage = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  };

  server.stdin.write(JSON.stringify(initMessage) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: List available tools
  console.log('🔧 Test 2: List Tools');
  const listToolsMessage = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  };

  server.stdin.write(JSON.stringify(listToolsMessage) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Call list-tasks tool
  console.log('📋 Test 3: List VS Code Tasks');
  const listTasksMessage = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "list-tasks",
      arguments: {}
    }
  };

  server.stdin.write(JSON.stringify(listTasksMessage) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: Detect project type
  console.log('🔍 Test 4: Detect Project Type');
  const detectProjectMessage = {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "detect-project-type",
      arguments: {}
    }
  };

  server.stdin.write(JSON.stringify(detectProjectMessage) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Close the server
  server.stdin.end();
  server.kill();

  // Output results
  console.log('\n📊 Test Results:');
  console.log('='.repeat(50));
  
  if (errorData) {
    console.log('❌ Server errors detected:');
    console.log(errorData);
  } else {
    console.log('✅ No server errors detected');
  }

  if (responseData) {
    console.log('\n📤 Server responses:');
    console.log('-'.repeat(30));
    
    // Try to parse and format JSON responses
    const lines = responseData.split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        console.log(JSON.stringify(parsed, null, 2));
        console.log('-'.repeat(30));
      } catch (error) {
        console.log('Raw response:', line);
      }
    }
  } else {
    console.log('⚠️  No responses received from server');
  }

  console.log('\n🎯 Summary:');
  console.log(`- Server started: ${errorData.includes('running on stdio') ? '✅' : '❌'}`);
  console.log(`- Responses received: ${responseData.length > 0 ? '✅' : '❌'}`);
  console.log(`- No errors: ${!errorData || errorData.includes('running on stdio') ? '✅' : '❌'}`);
}

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('❌ Test failed with error:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Test failed with rejection:', reason);
  process.exit(1);
});

// Run the test
testMCPServer().then(() => {
  console.log('\n✅ MCP Server test completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});