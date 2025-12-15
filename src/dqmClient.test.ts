/**
 * Tests for DQM Client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DQMClient } from './dqmClient.js';
import type { DQMConfig, Website, Checkpoint, Asset, Issue } from './types.js';

// Mock configuration
const mockConfig: DQMConfig = {
  apiKey: 'test-api-key',
  baseUrl: 'https://api.example.com',
  requestTimeout: 5000,
  enableDestructiveTools: false,
  maxConcurrentQualityChecks: 3,
  qualityCheckMaxPolls: 10,
  qualityCheckPollInterval: 100,
};

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('DQMClient', () => {
  let client: DQMClient;

  beforeEach(() => {
    client = new DQMClient(mockConfig);
    mockFetch.mockReset();
  });

  describe('listWebsites', () => {
    it('should list websites successfully', async () => {
      const mockWebsites: Website[] = [
        { id: '1', name: 'Website 1', url: 'https://example1.com' },
        { id: '2', name: 'Website 2', url: 'https://example2.com' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ websites: mockWebsites }),
      });

      const result = await client.listWebsites();

      expect(result).toEqual(mockWebsites);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/websites',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
          }),
        })
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid API key' }),
      });

      await expect(client.listWebsites()).rejects.toMatchObject({
        message: 'Invalid API key',
        statusCode: 401,
      });
    });
  });

  describe('getWebsite', () => {
    it('should get a specific website', async () => {
      const mockWebsite: Website = {
        id: '1',
        name: 'Website 1',
        url: 'https://example1.com',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWebsite,
      });

      const result = await client.getWebsite('1');

      expect(result).toEqual(mockWebsite);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/websites/1',
        expect.any(Object)
      );
    });
  });

  describe('listCheckpoints', () => {
    it('should list all checkpoints', async () => {
      const mockCheckpoints: Checkpoint[] = [
        { id: '1', name: 'Checkpoint 1', severity: 'error' },
        { id: '2', name: 'Checkpoint 2', severity: 'warning' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ checkpoints: mockCheckpoints }),
      });

      const result = await client.listCheckpoints();

      expect(result).toEqual(mockCheckpoints);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/checkpoints',
        expect.any(Object)
      );
    });

    it('should filter checkpoints by website', async () => {
      const mockCheckpoints: Checkpoint[] = [
        { id: '1', name: 'Checkpoint 1', severity: 'error' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ checkpoints: mockCheckpoints }),
      });

      const result = await client.listCheckpoints('website-1');

      expect(result).toEqual(mockCheckpoints);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/websites/website-1/checkpoints',
        expect.any(Object)
      );
    });
  });

  describe('searchAssets', () => {
    it('should search assets with filters', async () => {
      const mockAssets: Asset[] = [
        { id: '1', websiteId: 'web-1', status: 'completed', score: 95 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ assets: mockAssets }),
      });

      const result = await client.searchAssets({
        websiteId: 'web-1',
        query: 'test',
        limit: 10,
      });

      expect(result).toEqual(mockAssets);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/assets?'),
        expect.any(Object)
      );
    });
  });

  describe('getAssetIssues', () => {
    it('should normalize issues correctly', async () => {
      const mockIssues: Issue[] = [
        {
          id: '1',
          severity: 'error',
          message: 'Test error',
          checkpointId: 'cp-1',
          checkpointName: 'Checkpoint 1',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ assetId: 'asset-1', issues: mockIssues }),
      });

      const result = await client.getAssetIssues('asset-1');

      expect(result).toEqual(mockIssues);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('severity');
      expect(result[0]).toHaveProperty('message');
    });
  });

  describe('runQualityCheck', () => {
    it('should run quality check and poll until complete', async () => {
      const mockAsset: Asset = {
        id: 'asset-1',
        websiteId: 'web-1',
        status: 'pending',
      };

      const mockCompletedAsset: Asset = {
        ...mockAsset,
        status: 'completed',
        score: 90,
      };

      const mockIssues: Issue[] = [
        {
          id: '1',
          severity: 'warning',
          message: 'Test warning',
        },
      ];

      // Mock asset creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAsset,
      });

      // Mock status check (completed)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCompletedAsset,
      });

      // Mock get issues
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ assetId: 'asset-1', issues: mockIssues }),
      });

      const result = await client.runQualityCheck({
        websiteId: 'web-1',
        url: 'https://example.com',
      });

      expect(result.status).toBe('completed');
      expect(result.assetId).toBe('asset-1');
      expect(result.score).toBe(90);
      expect(result.issues).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should enforce concurrency limit', async () => {
      // Set up a quality check that never completes
      mockFetch.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ id: 'asset-1', websiteId: 'web-1', status: 'processing' }),
          }), 10000)
        )
      );

      // Start max concurrent checks
      const promises = [];
      for (let i = 0; i < mockConfig.maxConcurrentQualityChecks; i++) {
        promises.push(
          client.runQualityCheck({ websiteId: 'web-1', url: 'https://example.com' })
        );
      }

      // Try to start one more
      await expect(
        client.runQualityCheck({ websiteId: 'web-1', url: 'https://example.com' })
      ).rejects.toMatchObject({
        statusCode: 429,
      });
    });
  });

  // Note: Timeout tests are difficult to test with mocked fetch
  // The timeout mechanism is implemented in the DQMClient.request method
});
