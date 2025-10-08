/**
 * YouTube API Integration Usage Examples
 * 
 * This file demonstrates how to use the YouTube API integration service
 * that was implemented for task 3 of the youtube-api-integration spec.
 */

import { YouTubeAPIClient } from "./youtube-api.ts";

// Example usage of the YouTube API client
async function exampleUsage() {
  // Initialize Deno KV (in a real application, this would be done in your route handlers)
  const kv = await Deno.openKv();
  
  // Create YouTube API client
  const youtubeClient = new YouTubeAPIClient(kv);
  
  // Example access token (in real usage, this comes from OAuth flow)
  const accessToken = "your-oauth-access-token";

  try {
    // 1. Get user's subscriptions
    console.log("Fetching subscriptions...");
    const subscriptions = await youtubeClient.getSubscriptions(accessToken, 50);
    console.log(`Found ${subscriptions.items.length} subscriptions`);

    // 2. Get videos from a specific channel
    if (subscriptions.items.length > 0) {
      const firstChannel = subscriptions.items[0];
      console.log(`Fetching videos from ${firstChannel.snippet.title}...`);
      
      const videos = await youtubeClient.getChannelVideos(
        accessToken,
        firstChannel.snippet.channelId,
        10, // maxResults
        undefined, // pageToken
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // publishedAfter: last 7 days
      );
      
      console.log(`Found ${videos.items.length} recent videos`);

      // 3. Get detailed information for videos
      if (videos.items.length > 0) {
        const videoIds = videos.items.map(video => video.id.videoId);
        console.log("Fetching video details...");
        
        const videoDetails = await youtubeClient.getVideoDetails(accessToken, videoIds);
        console.log(`Got details for ${videoDetails.items.length} videos`);
        
        // Display some video information
        videoDetails.items.forEach(video => {
          console.log(`- ${video.snippet.title}: ${video.statistics.viewCount} views`);
        });
      }
    }

    // 4. Batch fetch videos from multiple channels
    if (subscriptions.items.length > 1) {
      const channelIds = subscriptions.items.slice(0, 3).map(sub => sub.snippet.channelId);
      console.log("Batch fetching videos from multiple channels...");
      
      const batchResults = await youtubeClient.batchGetChannelVideos(
        accessToken,
        channelIds,
        5 // maxResultsPerChannel
      );
      
      console.log(`Batch results for ${batchResults.size} channels`);
      for (const [channelId, videos] of batchResults) {
        console.log(`Channel ${channelId}: ${videos.items.length} videos`);
      }
    }

    // 5. Get API usage statistics
    const usageStats = await youtubeClient.getUsageStats();
    if (usageStats) {
      console.log(`API Usage: ${usageStats.quotaUsed} quota units used, ${usageStats.requestCount} requests made`);
    }

  } catch (error) {
    console.error("YouTube API error:", error);
    
    // Handle specific error types
    const apiError = error as any;
    if (apiError.quotaExceeded) {
      console.log("Quota exceeded - need to wait until tomorrow");
    } else if (apiError.status === 401) {
      console.log("Authentication failed - need to refresh token");
    } else if (apiError.status === 403) {
      console.log("Access forbidden - check API permissions");
    }
  }
}

// API Endpoint Usage Examples

/**
 * Frontend JavaScript code to call the API endpoints
 */
const frontendExamples = {
  // Get subscriptions
  async getSubscriptions(maxResults = 50, pageToken?: string) {
    const params = new URLSearchParams({ maxResults: maxResults.toString() });
    if (pageToken) params.set("pageToken", pageToken);
    
    const response = await fetch(`/api/youtube/subscriptions?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  },

  // Get videos from a single channel
  async getChannelVideos(channelId: string, maxResults = 25, publishedAfter?: Date) {
    const params = new URLSearchParams({ 
      channelId,
      maxResults: maxResults.toString()
    });
    if (publishedAfter) {
      params.set("publishedAfter", publishedAfter.toISOString());
    }
    
    const response = await fetch(`/api/youtube/videos?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  },

  // Batch get videos from multiple channels
  async batchGetChannelVideos(channelIds: string[], maxResults = 10) {
    const params = new URLSearchParams({
      channelIds: channelIds.join(","),
      maxResults: maxResults.toString()
    });
    
    const response = await fetch(`/api/youtube/videos?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  },

  // Get video details
  async getVideoDetails(videoIds: string[]) {
    const params = new URLSearchParams({
      videoIds: videoIds.join(",")
    });
    
    const response = await fetch(`/api/youtube/video-details?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  },

  // Get API usage statistics
  async getUsageStats() {
    const response = await fetch("/api/youtube/stats");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  },

  // Clear API cache
  async clearCache(pattern?: string) {
    const params = pattern ? new URLSearchParams({ pattern }) : "";
    const response = await fetch(`/api/youtube/stats?${params}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  }
};

/**
 * Error Handling Examples
 */
const errorHandlingExamples = {
  async handleAPICall<T>(apiCall: () => Promise<T>): Promise<T | null> {
    try {
      return await apiCall();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("429")) {
        console.log("Rate limited - implementing exponential backoff");
        await this.delay(1000);
        return null;
      } else if (errorMessage.includes("401")) {
        console.log("Authentication failed - redirecting to login");
        window.location.href = "/api/auth/login";
        return null;
      } else if (errorMessage.includes("quota_exceeded")) {
        console.log("Daily quota exceeded - showing cached data");
        return null;
      } else {
        console.error("Unexpected API error:", error);
        throw error;
      }
    }
  },

  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Export examples for documentation
export { exampleUsage, frontendExamples, errorHandlingExamples };