#!/usr/bin/env tsx
/**
 * Integration tests for Crownpeak DQM API Client
 * Tests all 15 API endpoints systematically
 */

import { DQMClient } from '../../src/dqmClient.js';
import { loadConfig } from '../../src/config.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test configuration
const TEST_URL = process.env.DQM_TEST_URL || 'https://www.crownpeak.com';
const TEST_WEBSITE_ID = process.env.DQM_WEBSITE_ID;

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];
const createdAssets: string[] = []; // Track assets for cleanup

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logVerbose(title: string, data: any) {
  console.error(`${colors.gray}[VERBOSE] ${title}:`, JSON.stringify(data, null, 2), colors.reset);
}

async function runTest(
  name: string,
  fn: () => Promise<any>,
  verbose: boolean = false
): Promise<any> {
  try {
    log(`\n► ${name}`, colors.blue);
    const result = await fn();
    results.push({ name, passed: true, details: result });
    log(`  ✓ PASS`, colors.green);
    if (verbose) {
      logVerbose(name, result);
    }
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMessage });
    log(`  ✗ FAIL: ${errorMessage}`, colors.red);
    if (verbose && error instanceof Error) {
      logVerbose(`${name} - Error Details`, {
        message: error.message,
        stack: error.stack,
      });
    }
    return null;
  }
}

async function main() {
  log('═══════════════════════════════════════════', colors.blue);
  log('  Crownpeak DQM API Integration Tests', colors.blue);
  log('═══════════════════════════════════════════', colors.blue);

  // Validate configuration
  if (!TEST_WEBSITE_ID) {
    log('\n✗ ERROR: DQM_WEBSITE_ID environment variable is required for testing', colors.red);
    log('  Please add DQM_WEBSITE_ID to your .env file', colors.yellow);
    process.exit(1);
  }

  const config = loadConfig();
  const client = new DQMClient(config);

  log(`\nTest Configuration:`, colors.gray);
  log(`  API Base URL: ${config.baseUrl}`, colors.gray);
  log(`  Test Website ID: ${TEST_WEBSITE_ID}`, colors.gray);
  log(`  Test URL: ${TEST_URL}`, colors.gray);

  // =========================================================================
  // SCENARIO 1: Discovery Flow
  // =========================================================================
  log('\n\n═══ SCENARIO 1: Discovery Flow ═══', colors.yellow);

  const websites = await runTest('1. List all websites', async () => {
    return await client.listWebsites();
  });

  if (websites && websites.length > 0) {
    await runTest('2. Get specific website details', async () => {
      return await client.getWebsite(TEST_WEBSITE_ID!);
    });
  }

  const checkpoints = await runTest('3. List all checkpoints', async () => {
    return await client.listCheckpoints();
  });

  if (checkpoints && checkpoints.length > 0) {
    await runTest('4. Get specific checkpoint details', async () => {
      return await client.getCheckpoint(checkpoints[0].id);
    });
  }

  await runTest('5. List checkpoints for website', async () => {
    return await client.listCheckpoints(TEST_WEBSITE_ID);
  });

  // =========================================================================
  // SCENARIO 2: Asset Creation & Management
  // =========================================================================
  log('\n\n═══ SCENARIO 2: Asset Creation & Management ═══', colors.yellow);

  let testAssetId: string | null = null;

  const createdAsset = await runTest('6. Create new asset (POST /assets)', async () => {
    const asset = await (client as any).createAsset({
      websiteId: TEST_WEBSITE_ID,
      url: TEST_URL,
      metadata: { test: true, testRun: new Date().toISOString() },
    });
    testAssetId = asset.id;
    createdAssets.push(asset.id);
    return asset;
  });

  if (testAssetId) {
    await runTest('7. Get asset status', async () => {
      return await client.getAssetStatus(testAssetId!);
    });

    await runTest('8. Get asset details', async () => {
      return await client.getAsset(testAssetId!);
    });

    await runTest('9. Get asset content (HTML)', async () => {
      return await client.getAssetContent(testAssetId!);
    });

    await runTest('10. Get asset issues', async () => {
      return await client.getAssetIssues(testAssetId!);
    });

    if (checkpoints && checkpoints.length > 0) {
      await runTest('11. Get asset errors for specific checkpoint', async () => {
        try {
          return await client.getAssetErrors(testAssetId!, checkpoints[0].id);
        } catch (error: any) {
          // Expected: API returns 400 if asset doesn't fail for this checkpoint
          if (error.statusCode === 400 && error.message?.includes('Highlighting not supported')) {
            return { note: 'Expected behavior - asset has no errors for this checkpoint' };
          }
          throw error;
        }
      });
    }

    await runTest('12. Get asset page highlight (beta)', async () => {
      return await client.getAssetPageHighlight(testAssetId!);
    });
  }

  // =========================================================================
  // SCENARIO 3: Asset Update Flow
  // =========================================================================
  log('\n\n═══ SCENARIO 3: Asset Update Flow ═══', colors.yellow);

  if (testAssetId) {
    await runTest('13. Update asset content (PUT /assets)', async () => {
      return await client.updateAsset(testAssetId!, {
        url: TEST_URL,
        metadata: { test: true, updated: true },
      });
    });

    await runTest('14. Get updated asset status', async () => {
      return await client.getAssetStatus(testAssetId!);
    });
  }

  // =========================================================================
  // SCENARIO 4: Search Assets
  // =========================================================================
  log('\n\n═══ SCENARIO 4: Search Assets ═══', colors.yellow);

  await runTest('15. Search assets by website', async () => {
    return await client.searchAssets({
      websiteId: TEST_WEBSITE_ID,
      limit: 5,
    });
  });

  // =========================================================================
  // SCENARIO 5: Quality Check Flow (Full E2E)
  // =========================================================================
  log('\n\n═══ SCENARIO 5: Quality Check Flow ═══', colors.yellow);

  const qualityCheckResult = await runTest('16. Run quality check (full flow)', async () => {
    const result = await client.runQualityCheck({
      websiteId: TEST_WEBSITE_ID!,
      url: TEST_URL,
      metadata: { test: true, qualityCheck: true },
    });

    if (result.assetId) {
      createdAssets.push(result.assetId);
    }

    return result;
  }, true);

  // =========================================================================
  // SCENARIO 6: Spellcheck Flow
  // =========================================================================
  log('\n\n═══ SCENARIO 6: Spellcheck Flow ═══', colors.yellow);

  if (testAssetId) {
    await runTest('17. Spellcheck existing asset', async () => {
      return await client.spellcheckAsset({
        assetId: testAssetId!,
        language: 'en',
      });
    }, true);
  }

  await runTest('18. Spellcheck with new asset creation', async () => {
    const result = await client.spellcheckAsset({
      websiteId: TEST_WEBSITE_ID!,
      url: TEST_URL,
      language: 'en',
    });

    // Track the created asset ID for cleanup
    // We need to extract it from the spellcheck flow

    return result;
  }, true);

  // =========================================================================
  // CLEANUP: Delete Test Assets
  // =========================================================================
  log('\n\n═══ CLEANUP: Delete Test Assets ═══', colors.yellow);

  for (const assetId of createdAssets) {
    await runTest(`19. Delete asset ${assetId.substring(0, 8)}...`, async () => {
      await client.deleteAsset(assetId);
      return { assetId, deleted: true };
    });
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  log('\n\n═══════════════════════════════════════════', colors.blue);
  log('  Test Summary', colors.blue);
  log('═══════════════════════════════════════════', colors.blue);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  log(`\nTotal: ${total} | Passed: ${passed} | Failed: ${failed}`, colors.blue);

  if (failed > 0) {
    log('\n\nFailed Tests:', colors.red);
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        log(`  ✗ ${r.name}`, colors.red);
        log(`    ${r.error}`, colors.gray);
      });
  }

  if (passed === total) {
    log('\n✓ All tests passed!', colors.green);
    process.exit(0);
  } else {
    log(`\n✗ ${failed} test(s) failed`, colors.red);
    process.exit(1);
  }
}

// Run tests
main().catch((error) => {
  log(`\n✗ Fatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
