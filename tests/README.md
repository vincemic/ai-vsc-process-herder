# Playwright Testing for VS Code Process Herder MCP Server

This document describes the comprehensive Playwright testing setup for the VS Code Process Herder MCP (Model Context Protocol) Server.

## Overview

The test suite is designed to thoroughly test the MCP server functionality, process management capabilities, integration scenarios, and performance characteristics. Tests are organized into four main categories:

1. **MCP Server Tests** - Core MCP protocol functionality
2. **Process Management Tests** - Process lifecycle and health monitoring
3. **Integration Tests** - End-to-end workflows and project detection
4. **Performance Tests** - Load testing and scalability verification

## Test Structure

```
tests/
├── mcp-server/              # Core MCP protocol tests
│   ├── basic-functionality.spec.ts
│   └── task-management.spec.ts
├── process-management/      # Process lifecycle tests
│   ├── process-lifecycle.spec.ts
│   └── health-monitoring.spec.ts
├── integration/             # End-to-end workflow tests
│   ├── project-detection.spec.ts
│   └── end-to-end-workflows.spec.ts
├── performance/             # Performance and load tests
│   └── load-testing.spec.ts
├── utils/                   # Test utilities and helpers
│   └── mcp-test-client.ts
├── global-setup.ts         # Global test setup
└── global-teardown.ts      # Global test cleanup
```

## Setup and Installation

### Prerequisites

1. Node.js 18+ installed
2. Project built (`npm run build`)
3. Playwright installed

### Installation

```bash
# Install Playwright dependencies
npm install --save-dev @playwright/test playwright

# Install Playwright browsers
npx playwright install
```

## Running Tests

### All Tests
```bash
# Run all Playwright tests
npm test

# Run tests with UI
npm run test:ui
```

### Specific Test Categories
```bash
# Run only MCP server tests
npm run test:mcp

# Run only process management tests
npm run test:process

# Run only integration tests
npm run test:integration

# Run only performance tests
npm run test:performance
```

### Interactive Mode
```bash
# Run tests with UI mode
npm run test:playwright:ui

# Run tests in headed mode (see browser)
npm run test:playwright:headed

# Debug tests
npm run test:playwright:debug
```

## Test Categories

### 1. MCP Server Tests (`tests/mcp-server/`)

Tests the core MCP protocol implementation:

- **Basic Functionality**: Server initialization, tool listing, resource discovery
- **Task Management**: VS Code task integration, task execution, workspace handling

**Key Test Areas:**
- MCP protocol compliance
- Tool registration and discovery
- Resource management
- Error handling
- Prompt functionality

### 2. Process Management Tests (`tests/process-management/`)

Tests process lifecycle and health monitoring:

- **Process Lifecycle**: Start, stop, restart, status monitoring
- **Health Monitoring**: Health tracking, recovery configuration, diagnostics

**Key Test Areas:**
- Process creation and termination
- Process status monitoring
- Health tracking and alerts
- Recovery strategies
- Process filtering and search

### 3. Integration Tests (`tests/integration/`)

Tests complete workflows and system integration:

- **Project Detection**: Automatic project type detection, framework identification
- **End-to-End Workflows**: Complete development scenarios, multi-task management

**Key Test Areas:**
- Project type detection accuracy
- Complete development workflows
- Resource and prompt integration
- VS Code integration
- Multi-process scenarios

### 4. Performance Tests (`tests/performance/`)

Tests system performance and scalability:

- **Load Testing**: Response times, concurrent operations, memory usage
- **Scalability**: Multiple process handling, large data export

**Key Test Areas:**
- Server startup time
- Tool response times
- Concurrent request handling
- Memory usage stability
- Large dataset handling

## Test Utilities

### MCPServerTestClient

The main testing utility that provides:

- **Server Management**: Start/stop MCP server processes
- **Protocol Communication**: Send MCP messages and handle responses
- **Tool Testing**: Convenient tool invocation with response validation
- **Resource Testing**: Resource retrieval and validation

### ProcessTestUtils

Utilities for process testing:

- Test process creation and management
- Process monitoring and validation
- System process listing

### MCPAssertions

Assertion helpers for MCP responses:

- Response validation
- Error checking
- Content parsing and validation

## Configuration

### Playwright Configuration (`playwright.config.ts`)

- **Sequential Execution**: Process management tests run sequentially to avoid conflicts
- **Single Worker**: Uses one worker to prevent process interference
- **Comprehensive Reporting**: HTML, JSON, and JUnit reports
- **Retry Logic**: Configurable retries for CI environments

### Test Environment Setup

Tests use a dedicated test workspace (`test-workspace/`) with:

- Test `tasks.json` configuration
- Sample `package.json` for project detection
- Isolated environment for safe testing

## Writing New Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { MCPServerTestClient, MCPAssertions } from '../utils/mcp-test-client';

test.describe('My Test Suite', () => {
  let client: MCPServerTestClient;

  test.beforeEach(async () => {
    client = new MCPServerTestClient();
    await client.startServer();
    await client.initialize();
  });

  test.afterEach(async () => {
    await client.stopServer();
  });

  test('should test something', async () => {
    const response = await client.callTool('tool-name', { args });
    MCPAssertions.assertToolSuccess(response);
    const result = MCPAssertions.parseToolContent(response);
    
    expect(result.someProperty).toBe('expected-value');
  });
});
```

### Best Practices

1. **Use MCPAssertions**: Always validate MCP responses using provided assertion helpers
2. **Clean Setup/Teardown**: Use beforeEach/afterEach for consistent test environments
3. **Meaningful Assertions**: Test both success cases and error conditions
4. **Process Cleanup**: Ensure started processes are properly stopped
5. **Async Handling**: Properly handle async operations and timeouts

## Troubleshooting

### Common Issues

1. **Build Required**: Ensure project is built before running tests (`npm run build`)
2. **Port Conflicts**: Tests create isolated server instances to avoid conflicts
3. **Process Cleanup**: Tests include cleanup logic to prevent orphaned processes
4. **Timeout Issues**: Adjust timeouts in `playwright.config.ts` if needed

### Debug Mode

Use debug mode to step through tests interactively:

```bash
npm run test:playwright:debug
```

### Verbose Output

Enable detailed logging by setting environment variables:

```bash
DEBUG=pw:api npm run test:playwright
```

## CI/CD Integration

The test suite is designed for CI/CD environments:

- **Deterministic**: Tests are designed to be stable and repeatable
- **Isolated**: Each test runs in isolation with proper cleanup
- **Reporting**: Multiple report formats for integration with CI tools
- **Retry Logic**: Configurable retry logic for flaky test resilience

### GitHub Actions Example

```yaml
- name: Run Playwright Tests
  run: |
    npm run build
    npm run test:playwright
  env:
    CI: true

- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: test-results/
```

## Metrics and Reporting

Tests generate comprehensive reports:

- **HTML Report**: Interactive test results with screenshots and traces
- **JSON Report**: Machine-readable results for integration
- **JUnit Report**: Compatible with most CI/CD systems
- **Performance Metrics**: Response times and resource usage data

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Add tests to the appropriate category directory
3. Use the provided test utilities and assertion helpers
4. Include both positive and negative test cases
5. Update this documentation if adding new test categories

## Support

For issues with the test setup:

1. Check that the project builds successfully
2. Verify all dependencies are installed
3. Review the Playwright documentation for configuration options
4. Check the test output for specific error messages