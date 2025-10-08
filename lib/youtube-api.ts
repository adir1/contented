/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
/// <reference lib="es2022" />

export interface YouTubeAPIError extends Error {
  status?: number;
  code?: string;
  quotaExceeded?: boolean;
}

export interface SubscriptionResponse {
  items: {
    id: string;
    snippet: {
      channelId: string;
      title: string;
      description: string;
      thumbnails: {
        default: { url: string };
        medium: { url: string };
        high: { url: string };
      };
    };
  }[];
  nextPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

export interface VideoResponse {
  items: {
    id: { videoId: string };
    snippet: {
      title: string;
      description: string;
      channelId: string;
      channelTitle: string;
      publishedAt: string;
      thumbnails: {
        default: { url: string };
        medium: { url: string };
        high: { url: string };
      };
    };
  }[];
  nextPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

export interface VideoDetailsResponse {
  items: {
    id: string;
    snippet: {
      title: string;
      description: string;
      channelId: string;
      channelTitle: string;
      publishedAt: string;
      thumbnails: {
        default: { url: string };
        medium: { url: string };
        high: { url: string };
      };
    };
    statistics: {
      viewCount: string;
      likeCount: string;
      commentCount?: string;
    };
    contentDetails: {
      duration: string;
    };
  }[];
}

export interface CacheEntry<T> {
  data: T;
  cachedAt: Date;
  expiresAt: Date;
}

export interface RateLimitInfo {
  quotaUsed: number;
  resetTime: Date;
  requestCount: number;
}

export class YouTubeAPIClient {
  private kv: Deno.Kv;
  private baseUrl = "https://www.googleapis.com/youtube/v3";
  private defaultCacheTTL = 5 * 60 * 1000; // 5 minutes
  private subscriptionsCacheTTL = 30 * 60 * 1000; // 30 minutes
  private videosCacheTTL = 10 * 60 * 1000; // 10 minutes

  constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  /**
   * Get user's YouTube subscriptions
   */
  async getSubscriptions(
    accessToken: string,
    maxResults = 50,
    pageToken?: string
  ): Promise<SubscriptionResponse> {
    const cacheKey = `subscriptions:${this.hashToken(accessToken)}:${pageToken || 'first'}:${maxResults}`;
    
    // Try to get from cache first
    const cached = await this.getFromCache<SubscriptionResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const params = new URLSearchParams({
      part: "snippet",
      mine: "true",
      maxResults: maxResults.toString(),
      order: "alphabetical",
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const url = `${this.baseUrl}/subscriptions?${params.toString()}`;
    
    try {
      const response = await this.makeRequest(url, accessToken);
      const data = await response.json() as SubscriptionResponse;
      
      // Cache the response
      await this.setCache(cacheKey, data, this.subscriptionsCacheTTL);
      
      // Track API usage
      await this.trackAPIUsage("subscriptions", response.status);
      
      return data;
    } catch (error) {
      throw this.handleAPIError(error, "getSubscriptions");
    }
  }

  /**
   * Get videos from a specific channel
   */
  async getChannelVideos(
    accessToken: string,
    channelId: string,
    maxResults = 25,
    pageToken?: string,
    publishedAfter?: Date
  ): Promise<VideoResponse> {
    const cacheKey = `channel_videos:${channelId}:${pageToken || 'first'}:${maxResults}:${publishedAfter?.toISOString() || 'all'}`;
    
    // Try to get from cache first
    const cached = await this.getFromCache<VideoResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const params = new URLSearchParams({
      part: "snippet",
      channelId,
      type: "video",
      order: "date",
      maxResults: maxResults.toString(),
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    if (publishedAfter) {
      params.set("publishedAfter", publishedAfter.toISOString());
    }

    const url = `${this.baseUrl}/search?${params.toString()}`;
    
    try {
      const response = await this.makeRequest(url, accessToken);
      const data = await response.json() as VideoResponse;
      
      // Cache the response
      await this.setCache(cacheKey, data, this.videosCacheTTL);
      
      // Track API usage
      await this.trackAPIUsage("search", response.status);
      
      return data;
    } catch (error) {
      throw this.handleAPIError(error, "getChannelVideos");
    }
  }

  /**
   * Get detailed information for multiple videos
   */
  async getVideoDetails(
    accessToken: string,
    videoIds: string[]
  ): Promise<VideoDetailsResponse> {
    if (videoIds.length === 0) {
      return { items: [] };
    }

    // YouTube API allows up to 50 video IDs per request
    const batchSize = 50;
    const batches: string[][] = [];
    
    for (let i = 0; i < videoIds.length; i += batchSize) {
      batches.push(videoIds.slice(i, i + batchSize));
    }

    const allResults: VideoDetailsResponse["items"] = [];

    for (const batch of batches) {
      const cacheKey = `video_details:${batch.sort().join(',')}`;
      
      // Try to get from cache first
      let batchData = await this.getFromCache<VideoDetailsResponse>(cacheKey);
      
      if (!batchData) {
        const params = new URLSearchParams({
          part: "snippet,statistics,contentDetails",
          id: batch.join(","),
        });

        const url = `${this.baseUrl}/videos?${params.toString()}`;
        
        try {
          const response = await this.makeRequest(url, accessToken);
          batchData = await response.json() as VideoDetailsResponse;
          
          // Cache the response
          await this.setCache(cacheKey, batchData, this.videosCacheTTL);
          
          // Track API usage
          await this.trackAPIUsage("videos", response.status);
        } catch (error) {
          throw this.handleAPIError(error, "getVideoDetails");
        }
      }

      allResults.push(...batchData.items);
    }

    return { items: allResults };
  }

  /**
   * Batch request for multiple channels' recent videos
   */
  async batchGetChannelVideos(
    accessToken: string,
    channelIds: string[],
    maxResultsPerChannel = 10,
    publishedAfter?: Date
  ): Promise<Map<string, VideoResponse>> {
    const results = new Map<string, VideoResponse>();
    
    // Process channels in smaller batches to avoid overwhelming the API
    const batchSize = 5;
    const batches: string[][] = [];
    
    for (let i = 0; i < channelIds.length; i += batchSize) {
      batches.push(channelIds.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (channelId) => {
        try {
          const videos = await this.getChannelVideos(
            accessToken,
            channelId,
            maxResultsPerChannel,
            undefined,
            publishedAfter
          );
          return { channelId, videos };
        } catch (error) {
          console.error(`Failed to fetch videos for channel ${channelId}:`, error);
          // Return empty result for failed channels to not break the entire batch
          return { channelId, videos: { items: [], pageInfo: { totalResults: 0, resultsPerPage: 0 } } };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const { channelId, videos } of batchResults) {
        results.set(channelId, videos);
      }

      // Add delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.delay(100); // 100ms delay between batches
      }
    }

    return results;
  }

  /**
   * Make HTTP request with proper error handling and rate limiting
   */
  private async makeRequest(url: string, accessToken: string): Promise<Response> {
    // Check rate limits before making request
    await this.checkRateLimit();

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 403 && errorData.error?.errors?.[0]?.reason === "quotaExceeded") {
        const error = new Error("YouTube API quota exceeded") as YouTubeAPIError;
        error.status = 403;
        error.code = "quotaExceeded";
        error.quotaExceeded = true;
        throw error;
      }

      if (response.status === 429) {
        // Rate limited - implement exponential backoff
        await this.handleRateLimit();
        throw new Error("Rate limited - retry after backoff");
      }

      const error = new Error(`YouTube API error: ${response.status} ${response.statusText}`) as YouTubeAPIError;
      error.status = response.status;
      error.code = errorData.error?.code;
      throw error;
    }

    return response;
  }

  /**
   * Handle API errors with proper categorization
   */
  private handleAPIError(error: unknown, operation: string): YouTubeAPIError {
    if (error instanceof Error) {
      const apiError = error as YouTubeAPIError;
      
      // Add context about which operation failed
      apiError.message = `${operation} failed: ${apiError.message}`;
      
      return apiError;
    }

    const unknownError = new Error(`${operation} failed: Unknown error`) as YouTubeAPIError;
    unknownError.status = 500;
    return unknownError;
  }

  /**
   * Cache management
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const result = await this.kv.get(["youtube_cache", key]);
      
      if (!result.value) {
        return null;
      }

      const cacheEntry = result.value as CacheEntry<T>;
      
      // Check if cache entry has expired
      if (new Date() > cacheEntry.expiresAt) {
        await this.kv.delete(["youtube_cache", key]);
        return null;
      }

      return cacheEntry.data;
    } catch (error) {
      console.error("Cache read error:", error);
      return null;
    }
  }

  private async setCache<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const cacheEntry: CacheEntry<T> = {
        data,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + ttl),
      };

      await this.kv.set(["youtube_cache", key], cacheEntry, { expireIn: ttl });
    } catch (error) {
      console.error("Cache write error:", error);
      // Don't throw - caching failures shouldn't break the API
    }
  }

  /**
   * Rate limiting management
   */
  private async checkRateLimit(): Promise<void> {
    const rateLimitKey = ["rate_limit", "youtube_api"];
    const result = await this.kv.get(rateLimitKey);
    
    if (result.value) {
      const rateLimitInfo = result.value as RateLimitInfo;
      
      // Check if we're approaching quota limits
      if (rateLimitInfo.quotaUsed > 9000) { // YouTube API has 10,000 quota units per day
        throw new Error("Approaching daily quota limit");
      }
    }
  }

  private async handleRateLimit(): Promise<void> {
    // Implement exponential backoff
    const backoffTime = Math.min(1000 * Math.pow(2, 3), 30000); // Max 30 seconds
    await this.delay(backoffTime);
  }

  private async trackAPIUsage(endpoint: string, status: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const usageKey = ["api_usage", today];
      
      const result = await this.kv.get(usageKey);
      const currentUsage = result.value as RateLimitInfo || {
        quotaUsed: 0,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        requestCount: 0,
      };

      // Estimate quota usage based on endpoint
      let quotaCost = 1;
      switch (endpoint) {
        case "subscriptions":
          quotaCost = 1;
          break;
        case "search":
          quotaCost = 100;
          break;
        case "videos":
          quotaCost = 1;
          break;
      }

      const updatedUsage: RateLimitInfo = {
        quotaUsed: currentUsage.quotaUsed + quotaCost,
        resetTime: currentUsage.resetTime,
        requestCount: currentUsage.requestCount + 1,
      };

      await this.kv.set(usageKey, updatedUsage, { expireIn: 24 * 60 * 60 * 1000 });
    } catch (error) {
      console.error("Failed to track API usage:", error);
      // Don't throw - usage tracking failures shouldn't break the API
    }
  }

  /**
   * Utility methods
   */
  private hashToken(token: string): string {
    // Create a simple hash of the token for cache keys (don't store the actual token)
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    return Array.from(data)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 16); // Use first 16 characters
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache for specific patterns
   */
  async clearCache(pattern?: string): Promise<void> {
    try {
      // This is a simplified cache clearing - in a real implementation,
      // you might want to iterate through cache keys and delete matching ones
      if (pattern) {
        console.log(`Cache clearing for pattern ${pattern} not fully implemented`);
      } else {
        // Clear all YouTube cache
        console.log("Full cache clearing not implemented - cache entries will expire naturally");
      }
    } catch (error) {
      console.error("Cache clearing error:", error);
    }
  }

  /**
   * Get API usage statistics
   */
  async getUsageStats(): Promise<RateLimitInfo | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const usageKey = ["api_usage", today];
      const result = await this.kv.get(usageKey);
      
      return result.value as RateLimitInfo || null;
    } catch (error) {
      console.error("Failed to get usage stats:", error);
      return null;
    }
  }
}