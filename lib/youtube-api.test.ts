import { assertEquals, assertRejects } from "$std/assert/mod.ts";
import { YouTubeAPIClient } from "./youtube-api.ts";

// Mock Deno KV for testing
class MockKV {
  private store = new Map<string, any>();

  async get(key: string[]): Promise<{ value: any }> {
    const keyStr = JSON.stringify(key);
    return { value: this.store.get(keyStr) || null };
  }

  async set(key: string[], value: any, options?: { expireIn?: number }): Promise<void> {
    const keyStr = JSON.stringify(key);
    this.store.set(keyStr, value);
  }

  async delete(key: string[]): Promise<void> {
    const keyStr = JSON.stringify(key);
    this.store.delete(keyStr);
  }
}

Deno.test("YouTubeAPIClient - Cache functionality", async () => {
  const mockKv = new MockKV() as any;
  const client = new YouTubeAPIClient(mockKv);

  // Test cache key generation and basic functionality
  const testData = { test: "data" };
  
  // Use reflection to access private methods for testing
  const setCache = (client as any).setCache.bind(client);
  const getFromCache = (client as any).getFromCache.bind(client);

  await setCache("test-key", testData, 5000);
  const cached = await getFromCache("test-key");
  
  assertEquals(cached, testData);
});

Deno.test("YouTubeAPIClient - Rate limit tracking", async () => {
  const mockKv = new MockKV() as any;
  const client = new YouTubeAPIClient(mockKv);

  // Test usage stats functionality
  const stats = await client.getUsageStats();
  assertEquals(stats, null); // Should be null initially

  // Test API usage tracking
  const trackAPIUsage = (client as any).trackAPIUsage.bind(client);
  await trackAPIUsage("subscriptions", 200);

  // Check that usage was tracked
  const updatedStats = await client.getUsageStats();
  assertEquals(updatedStats?.requestCount, 1);
});

Deno.test("YouTubeAPIClient - Error handling", async () => {
  const mockKv = new MockKV() as any;
  const client = new YouTubeAPIClient(mockKv);

  // Test error handling for invalid tokens
  await assertRejects(
    async () => {
      await client.getSubscriptions("invalid-token");
    },
    Error,
    "YouTube API error"
  );
});

Deno.test("YouTubeAPIClient - Batch processing", async () => {
  const mockKv = new MockKV() as any;
  const client = new YouTubeAPIClient(mockKv);

  // Test that batch processing handles empty arrays correctly
  const result = await client.getVideoDetails("valid-token", []);
  assertEquals(result.items.length, 0);
});

Deno.test("YouTubeAPIClient - Token hashing", async () => {
  const mockKv = new MockKV() as any;
  const client = new YouTubeAPIClient(mockKv);

  // Test token hashing utility
  const hashToken = (client as any).hashToken.bind(client);
  const hash1 = hashToken("test-token-1");
  const hash2 = hashToken("test-token-2");
  const hash3 = hashToken("test-token-1"); // Same as hash1

  assertEquals(hash1, hash3);
  assertEquals(typeof hash1, "string");
  assertEquals(typeof hash2, "string");
  assertEquals(hash1.length, 16);
});