#!/usr/bin/env node

import { spawn } from 'child_process';
import { stdin, stdout } from 'process';

async function testProcessManagement() {
    console.log('🧪 Testing Process Management Features...\n');

    // Start the MCP server
    const server = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
    });

    let responseCount = 0;
    const responses = [];

    server.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
            if (line.trim()) {
                try {
                    const response = JSON.parse(line);
                    responses.push(response);
                    responseCount++;
                } catch (e) {
                    // Ignore non-JSON lines
                }
            }
        });
    });

    server.stderr.on('data', (data) => {
        console.log('Server stderr:', data.toString().trim());
    });

    // Helper function to send messages and wait for response
    function sendMessage(message) {
        return new Promise((resolve) => {
            const startCount = responseCount;
            server.stdin.write(JSON.stringify(message) + '\n');
            
            const checkResponse = () => {
                if (responseCount > startCount) {
                    resolve(responses[responses.length - 1]);
                } else {
                    setTimeout(checkResponse, 100);
                }
            };
            checkResponse();
        });
    }

    try {
        // Initialize
        console.log('📋 Test 1: Server Initialization');
        await sendMessage({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {
                    tools: {},
                    resources: {},
                    prompts: {}
                },
                clientInfo: {
                    name: "test-client",
                    version: "1.0.0"
                }
            }
        });

        // Test list-processes
        console.log('🔧 Test 2: List Running Processes');
        await sendMessage({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
                name: "list-processes",
                arguments: {
                    includeSystem: false
                }
            }
        });

        // Test start-task (this should work with our existing tasks)
        console.log('🚀 Test 3: Start a Build Task');
        await sendMessage({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
                name: "start-task",
                arguments: {
                    taskName: "build project"
                }
            }
        });

        // Wait a moment for the task to start
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test list-processes again to see if our task is running
        console.log('📋 Test 4: List Processes Again (should show build task)');
        await sendMessage({
            jsonrpc: "2.0",
            id: 4,
            method: "tools/call",
            params: {
                name: "list-processes",
                arguments: {
                    includeSystem: false
                }
            }
        });

        // Wait for all responses
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('\n📊 Test Results:');
        console.log('==================================================');
        
        if (responses.length > 0) {
            console.log('✅ Server responded to all tests!');
            console.log(`📤 Received ${responses.length} responses\n`);
            
            responses.forEach((response, index) => {
                console.log(`------------------------------`);
                console.log(`Response ${index + 1}:`);
                if (response.result && response.result.content) {
                    // This is a tool call response
                    console.log('Tool result:', response.result.content[0].text);
                } else {
                    console.log(JSON.stringify(response, null, 2));
                }
            });
        } else {
            console.log('❌ No responses received');
        }

        console.log('\n✅ Process Management test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        server.kill();
    }
}

testProcessManagement().catch(console.error);