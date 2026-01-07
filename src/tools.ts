/**
 * MCP Tools for Crownpeak DQM API
 */

import { z } from 'zod';
import type { DQMClient } from './dqmClient.js';

/**
 * Tool definitions for the MCP server
 */

// Website Tools
export const listWebsitesTool = {
  name: 'list_websites',
  description: 'List all websites in the Crownpeak DQM account',
  inputSchema: z.object({}),
};

export const getWebsiteTool = {
  name: 'get_website',
  description: 'Get details of a specific website',
  inputSchema: z.object({
    websiteId: z.string().describe('The ID of the website to retrieve'),
  }),
};

// Checkpoint Tools
export const listCheckpointsTool = {
  name: 'list_checkpoints',
  description: 'List all checkpoints (quality rules), optionally filtered by website',
  inputSchema: z.object({
    websiteId: z.string().optional().describe('Optional website ID to filter checkpoints'),
  }),
};

export const getCheckpointTool = {
  name: 'get_checkpoint',
  description: 'Get details of a specific checkpoint (quality rule)',
  inputSchema: z.object({
    checkpointId: z.string().describe('The ID of the checkpoint to retrieve'),
  }),
};

// Asset Tools
export const searchAssetsTool = {
  name: 'search_assets',
  description: 'Search for assets (pages that have been scanned)',
  inputSchema: z.object({
    websiteId: z.string().optional().describe('Filter by website ID'),
    query: z.string().optional().describe('Search query'),
    limit: z.number().optional().describe('Maximum number of results to return'),
  }),
};

export const getAssetTool = {
  name: 'get_asset',
  description: 'Get details of a specific asset',
  inputSchema: z.object({
    assetId: z.string().describe('The ID of the asset to retrieve'),
  }),
};

export const getAssetStatusTool = {
  name: 'get_asset_status',
  description: 'Get the current status of an asset scan',
  inputSchema: z.object({
    assetId: z.string().describe('The ID of the asset to check'),
  }),
};

export const getAssetIssuesTool = {
  name: 'get_asset_issues',
  description: 'Get all quality issues found for a specific asset',
  inputSchema: z.object({
    assetId: z.string().describe('The ID of the asset'),
  }),
};

export const updateAssetTool = {
  name: 'update_asset',
  description: 'Update the content of an existing asset (URL or HTML)',
  inputSchema: z.object({
    assetId: z.string().describe('The ID of the asset to update'),
    url: z.string().optional().describe('The new URL for the asset'),
    html: z.string().optional().describe('The new HTML content for the asset'),
    metadata: z.record(z.unknown()).optional().describe('Optional metadata for the asset'),
  }),
};

export const getAssetContentTool = {
  name: 'get_asset_content',
  description: 'Get the HTML content for a specific asset',
  inputSchema: z.object({
    assetId: z.string().describe('The ID of the asset'),
  }),
};

export const getAssetErrorsTool = {
  name: 'get_asset_errors',
  description: 'Get asset errors for a specific checkpoint, with content highlighting the issues',
  inputSchema: z.object({
    assetId: z.string().describe('The ID of the asset'),
    checkpointId: z.string().describe('The ID of the checkpoint to get errors for'),
  }),
};

export const getAssetPageHighlightTool = {
  name: 'get_asset_pagehighlight',
  description: '(Beta) Get asset content with all page highlightable issues highlighted',
  inputSchema: z.object({
    assetId: z.string().describe('The ID of the asset'),
  }),
};

export const deleteAssetTool = {
  name: 'delete_asset',
  description: 'Delete a specific asset from DQM storage',
  inputSchema: z.object({
    assetId: z.string().describe('The ID of the asset to delete'),
  }),
};

// Quality Check Tool
export const runQualityCheckTool = {
  name: 'run_quality_check',
  description: 'Run a quality check on a URL or HTML content. This will create an asset, scan it, and return the results.',
  inputSchema: z.object({
    websiteId: z.string().describe('The ID of the website this asset belongs to'),
    url: z.string().optional().describe('The URL to scan (if checking a live page)'),
    html: z.string().optional().describe('Raw HTML content to scan (if checking HTML directly)'),
    metadata: z.record(z.unknown()).optional().describe('Optional metadata for the asset'),
  }),
};

// Spellcheck Tool
export const spellcheckAssetTool = {
  name: 'spellcheck_asset',
  description: 'Run spellcheck on an asset. Either provide an existing assetId, or provide websiteId + (url or html) to create a new asset first.',
  inputSchema: z.object({
    assetId: z.string().optional().describe('The ID of an existing asset to spellcheck'),
    websiteId: z.string().optional().describe('The ID of the website (required if creating a new asset)'),
    url: z.string().optional().describe('The URL to scan (if creating a new asset from a live page)'),
    html: z.string().optional().describe('Raw HTML content to scan (if creating a new asset from HTML)'),
    language: z.string().optional().describe('Language code for spellcheck (e.g., en, es, fr)'),
  }),
};

/**
 * All available tools
 */
export const allTools = [
  listWebsitesTool,
  getWebsiteTool,
  listCheckpointsTool,
  getCheckpointTool,
  searchAssetsTool,
  getAssetTool,
  getAssetStatusTool,
  getAssetIssuesTool,
  updateAssetTool,
  getAssetContentTool,
  getAssetErrorsTool,
  getAssetPageHighlightTool,
  deleteAssetTool,
  runQualityCheckTool,
  spellcheckAssetTool,
];

/**
 * Tool handlers
 */
export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  client: DQMClient
): Promise<unknown> {
  switch (toolName) {
    case 'list_websites':
      return await client.listWebsites();

    case 'get_website':
      return await client.getWebsite(args.websiteId as string);

    case 'list_checkpoints':
      return await client.listCheckpoints(args.websiteId as string | undefined);

    case 'get_checkpoint':
      return await client.getCheckpoint(args.checkpointId as string);

    case 'search_assets':
      return await client.searchAssets({
        websiteId: args.websiteId as string | undefined,
        query: args.query as string | undefined,
        limit: args.limit as number | undefined,
      });

    case 'get_asset':
      return await client.getAsset(args.assetId as string);

    case 'get_asset_status':
      return await client.getAssetStatus(args.assetId as string);

    case 'get_asset_issues':
      return await client.getAssetIssues(args.assetId as string);

    case 'update_asset':
      return await client.updateAsset(args.assetId as string, {
        url: args.url as string | undefined,
        html: args.html as string | undefined,
        metadata: args.metadata as Record<string, unknown> | undefined,
      });

    case 'get_asset_content':
      return await client.getAssetContent(args.assetId as string);

    case 'get_asset_errors':
      return await client.getAssetErrors(
        args.assetId as string,
        args.checkpointId as string
      );

    case 'get_asset_pagehighlight':
      return await client.getAssetPageHighlight(args.assetId as string);

    case 'delete_asset':
      await client.deleteAsset(args.assetId as string);
      return { success: true, message: 'Asset deleted successfully' };

    case 'run_quality_check':
      return await client.runQualityCheck({
        websiteId: args.websiteId as string,
        url: args.url as string | undefined,
        html: args.html as string | undefined,
        metadata: args.metadata as Record<string, unknown> | undefined,
      });

    case 'spellcheck_asset':
      return await client.spellcheckAsset({
        assetId: args.assetId as string | undefined,
        websiteId: args.websiteId as string | undefined,
        url: args.url as string | undefined,
        html: args.html as string | undefined,
        language: args.language as string | undefined,
      });

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
