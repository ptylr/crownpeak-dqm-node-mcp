/**
 * Crownpeak DQM CMS API Client
 */

import type {
  DQMConfig,
  Website,
  ListWebsitesResponse,
  Checkpoint,
  ListCheckpointsResponse,
  Asset,
  SearchAssetsResponse,
  AssetIssuesResponse,
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
    const url = `${this.config.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeout
    );

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const error: APIError = {
          message: `API request failed: ${response.statusText}`,
          statusCode: response.status,
        };

        try {
          const errorData = await response.json() as any;
          error.details = errorData;
          error.message = errorData.message || error.message;
        } catch {
          // If response is not JSON, use status text
        }

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
    const response = await this.request<ListWebsitesResponse>('/websites');
    return response.websites || [];
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

    const response = await this.request<ListCheckpointsResponse>(endpoint);
    return response.checkpoints || [];
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
    const response = await this.request<SearchAssetsResponse>(endpoint);
    return response.assets || [];
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
   */
  async getAssetIssues(assetId: string): Promise<Issue[]> {
    const response = await this.request<AssetIssuesResponse>(
      `/assets/${assetId}/issues`
    );
    return this.normalizeIssues(response.issues || []);
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
    return await this.request<Asset>('/assets', {
      method: 'POST',
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

      while (pollCount < this.config.qualityCheckMaxPolls) {
        // Wait before polling (except on first iteration)
        if (pollCount > 0) {
          await this.sleep(this.config.qualityCheckPollInterval);
        }

        // Get current status
        currentAsset = await this.getAssetStatus(asset.id);
        debug.statusResponses?.push(currentAsset);

        // Check if completed
        if (currentAsset.status === 'completed' || currentAsset.status === 'failed') {
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
   */
  async spellcheckAsset(params: SpellcheckRequest): Promise<SpellcheckResponse> {
    const endpoint = `/assets/${params.assetId}/spellcheck${
      params.language ? `?language=${params.language}` : ''
    }`;

    return await this.request<SpellcheckResponse>(endpoint, {
      method: 'POST',
    });
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
