/**
 * Crownpeak DQM CMS API Client
 */

import type {
  DQMConfig,
  Website,
  Checkpoint,
  Asset,
  Issue,
  QualityCheckRequest,
  QualityCheckResponse,
  SpellcheckRequest,
  SpellcheckResponse,
  APIError,
} from './types.js';

/**
 * DQM API Client
 */
export class DQMClient {
  private config: DQMConfig;
  private activeQualityChecks = 0;

  constructor(config: DQMConfig) {
    this.config = config;
  }

  /**
   * Make an authenticated request to the DQM API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Add API key as query parameter
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${this.config.baseUrl}${endpoint}${separator}apiKey=${this.config.apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeout
    );

    try {
      // Build headers
      const headers = {
        'x-api-key': this.config.apiKey,
        // Only include Content-Type for requests with a body (POST/PUT)
        ...(options.method && ['POST', 'PUT', 'PATCH'].includes(options.method)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      };

      // Log request details for debugging (stderr to avoid polluting stdio MCP)
      console.error(`[DQM API] ${options.method || 'GET'} ${url}`);
      console.error(`[DQM API] Headers:`, headers);
      if (options.body) {
        console.error(`[DQM API] Request body:`, options.body);
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      console.error(`[DQM API] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const error: APIError = {
          message: `API request failed: ${response.statusText}`,
          statusCode: response.status,
        };

        try {
          const errorData = await response.json() as any;
          error.details = errorData;
          error.message = errorData.message || error.message;
          console.error(`[DQM API] Error details:`, JSON.stringify(errorData, null, 2));
        } catch (parseError) {
          // If response is not JSON, use status text
          console.error(`[DQM API] Could not parse error as JSON`);
        }

        console.error(`[DQM API] Full error:`, error);
        throw error;
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw {
            message: 'Request timeout',
            statusCode: 408,
          } as APIError;
        }
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * List all websites
   */
  async listWebsites(): Promise<Website[]> {
    // API returns a plain array, not wrapped in an object
    return await this.request<Website[]>('/websites');
  }

  /**
   * Get a specific website
   */
  async getWebsite(websiteId: string): Promise<Website> {
    return await this.request<Website>(`/websites/${websiteId}`);
  }

  /**
   * List all checkpoints (optionally filter by website)
   */
  async listCheckpoints(websiteId?: string): Promise<Checkpoint[]> {
    const endpoint = websiteId
      ? `/websites/${websiteId}/checkpoints`
      : '/checkpoints';

    // API returns a plain array, not wrapped in an object
    return await this.request<Checkpoint[]>(endpoint);
  }

  /**
   * Get a specific checkpoint
   */
  async getCheckpoint(checkpointId: string): Promise<Checkpoint> {
    return await this.request<Checkpoint>(`/checkpoints/${checkpointId}`);
  }

  /**
   * Search for assets
   */
  async searchAssets(params: {
    websiteId?: string;
    query?: string;
    limit?: number;
  }): Promise<Asset[]> {
    const searchParams = new URLSearchParams();

    if (params.websiteId) {
      searchParams.append('websiteId', params.websiteId);
    }
    if (params.query) {
      searchParams.append('q', params.query);
    }
    if (params.limit) {
      searchParams.append('limit', params.limit.toString());
    }

    const endpoint = `/assets${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    // API returns a plain array, not wrapped in an object
    return await this.request<Asset[]>(endpoint);
  }

  /**
   * Get a specific asset
   */
  async getAsset(assetId: string): Promise<Asset> {
    return await this.request<Asset>(`/assets/${assetId}`);
  }

  /**
   * Get asset status
   */
  async getAssetStatus(assetId: string): Promise<Asset> {
    return await this.request<Asset>(`/assets/${assetId}/status`);
  }

  /**
   * Get issues for a specific asset
   * Uses the status endpoint which returns checkpoint test results
   */
  async getAssetIssues(assetId: string): Promise<Issue[]> {
    const response = await this.request<any>(
      `/assets/${assetId}/status`
    );

    // Extract issues from checkpoint results
    // The status response contains checkpoint test results
    const issues: Issue[] = [];

    if (response.checkpoints && Array.isArray(response.checkpoints)) {
      for (const checkpoint of response.checkpoints) {
        if (checkpoint.passed === false || checkpoint.errors) {
          const checkpointIssues = checkpoint.errors || [];
          for (const error of checkpointIssues) {
            issues.push({
              id: error.id || `${checkpoint.id}-${issues.length}`,
              severity: checkpoint.severity || 'error',
              message: error.message || checkpoint.message || 'Quality check failed',
              checkpointId: checkpoint.id,
              checkpointName: checkpoint.name,
              location: error.location,
            });
          }
        }
      }
    }

    return this.normalizeIssues(issues);
  }

  /**
   * Create a new asset for quality checking
   */
  private async createAsset(params: {
    websiteId: string;
    url?: string;
    html?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Asset> {
    // API expects form-encoded data, not JSON
    const formData = new URLSearchParams();
    formData.append('websiteId', params.websiteId);
    formData.append('content', params.url || params.html || '');
    formData.append('contentType', 'text/html; charset=UTF-8');

    if (params.metadata) {
      formData.append('metadata', JSON.stringify(params.metadata));
    }

    return await this.request<Asset>('/assets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
  }

  /**
   * Update an existing asset's content
   */
  async updateAsset(assetId: string, params: {
    url?: string;
    html?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Asset> {
    return await this.request<Asset>(`/assets/${assetId}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  }

  /**
   * Run a quality check (create asset and poll until complete)
   */
  async runQualityCheck(params: QualityCheckRequest): Promise<QualityCheckResponse> {
    // Check concurrency limit
    if (this.activeQualityChecks >= this.config.maxConcurrentQualityChecks) {
      throw {
        message: `Maximum concurrent quality checks (${this.config.maxConcurrentQualityChecks}) reached. Please try again later.`,
        statusCode: 429,
      } as APIError;
    }

    this.activeQualityChecks++;

    try {
      // Create the asset
      const asset = await this.createAsset({
        websiteId: params.websiteId,
        url: params.url,
        html: params.html,
        metadata: params.metadata,
      });

      const debug: QualityCheckResponse['debug'] = {
        createResponse: asset,
        statusResponses: [],
      };

      // Poll for completion
      let pollCount = 0;
      let currentAsset = asset;

      console.error(`[DQM API] Polling for asset ${asset.id} to complete processing...`);

      while (pollCount < this.config.qualityCheckMaxPolls) {
        // Wait before polling (except on first iteration)
        if (pollCount > 0) {
          await this.sleep(this.config.qualityCheckPollInterval);
        }

        // Get current status
        currentAsset = await this.getAssetStatus(asset.id);
        debug.statusResponses?.push(currentAsset);

        console.error(`[DQM API] Poll ${pollCount + 1}/${this.config.qualityCheckMaxPolls}: Asset status = ${currentAsset.status}`);

        // Check if completed
        if (currentAsset.status === 'completed' || currentAsset.status === 'failed') {
          console.error(`[DQM API] Asset processing ${currentAsset.status}`);
          break;
        }

        pollCount++;
      }

      // Get issues if completed
      let issues: Issue[] = [];
      if (currentAsset.status === 'completed') {
        issues = await this.getAssetIssues(asset.id);
        debug.issuesResponse = issues;
      }

      return {
        status: currentAsset.status,
        assetId: asset.id,
        score: currentAsset.score,
        issues: this.normalizeIssues(issues),
        debug,
      };
    } finally {
      this.activeQualityChecks--;
    }
  }

  /**
   * Run spellcheck on an asset
   * If assetId is not provided, creates a new asset first
   */
  async spellcheckAsset(params: SpellcheckRequest): Promise<SpellcheckResponse> {
    let assetId = params.assetId;

    // If no assetId provided, create asset first
    if (!assetId) {
      if (!params.websiteId) {
        throw new Error('Either assetId or websiteId must be provided');
      }

      if (!params.url && !params.html) {
        throw new Error('Either url or html must be provided when creating a new asset');
      }

      // Create the asset
      const asset = await this.createAsset({
        websiteId: params.websiteId,
        url: params.url,
        html: params.html,
      });

      assetId = asset.id;

      // Wait for asset to be processed before spellchecking
      let pollCount = 0;
      let currentAsset = asset;

      console.error(`[DQM API] Polling for asset ${assetId} to complete processing before spellcheck...`);

      while (pollCount < this.config.qualityCheckMaxPolls) {
        if (pollCount > 0) {
          await this.sleep(this.config.qualityCheckPollInterval);
        }

        currentAsset = await this.getAssetStatus(assetId);

        console.error(`[DQM API] Poll ${pollCount + 1}/${this.config.qualityCheckMaxPolls}: Asset status = ${currentAsset.status}`);

        if (currentAsset.status === 'completed' || currentAsset.status === 'failed') {
          console.error(`[DQM API] Asset processing ${currentAsset.status}`);
          break;
        }

        pollCount++;
      }

      if (currentAsset.status !== 'completed') {
        throw new Error(`Asset processing did not complete. Status: ${currentAsset.status}`);
      }
    }

    const endpoint = `/assets/${assetId}/spellcheck${
      params.language ? `?language=${params.language}` : ''
    }`;

    return await this.request<SpellcheckResponse>(endpoint);
  }

  /**
   * Normalize issues to a consistent format
   */
  private normalizeIssues(issues: Issue[]): Issue[] {
    return issues.map(issue => ({
      id: issue.id,
      severity: issue.severity || 'info',
      message: issue.message || 'No message provided',
      checkpointId: issue.checkpointId,
      checkpointName: issue.checkpointName,
      location: issue.location,
    }));
  }

  /**
   * Sleep helper for polling
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
