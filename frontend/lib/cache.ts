/**
 * Search Results Cache
 * Caches search results to avoid showing loading state during pagination
 */

interface CachedSearchResult {
  results: any[];
  total: number;
  categoryCounts: Record<string, number>;
  totalPages: number;
  overview?: string | null;
  didYouMean?: string | null;
  intent?: string;
  timestamp: number;
}

interface CacheKey {
  query: string;
  category: string;
  page: number;
}

// Cache storage with TTL (Time To Live) of 5 minutes
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const cache = new Map<string, CachedSearchResult>();

/**
 * Generate cache key from query, category, and page
 */
function getCacheKey(query: string, category: string = '', page: number = 1): string {
  return `${query.toLowerCase().trim()}|${category}|${page}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CachedSearchResult): boolean {
  const now = Date.now();
  return (now - entry.timestamp) < CACHE_TTL;
}

/**
 * Get cached search results
 */
export function getCachedResults(
  query: string,
  category: string = '',
  page: number = 1
): CachedSearchResult | null {
  const key = getCacheKey(query, category, page);
  const cached = cache.get(key);
  
  if (cached && isCacheValid(cached)) {
    return cached;
  }
  
  // Remove expired entry
  if (cached) {
    cache.delete(key);
  }
  
  return null;
}

/**
 * Cache search results
 */
export function cacheResults(
  query: string,
  category: string = '',
  page: number = 1,
  data: Omit<CachedSearchResult, 'timestamp'>
): void {
  const key = getCacheKey(query, category, page);
  cache.set(key, {
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * Clear cache for a specific query (useful when new search is performed)
 */
export function clearCacheForQuery(query: string): void {
  const keysToDelete: string[] = [];
  cache.forEach((_, key) => {
    if (key.startsWith(`${query.toLowerCase().trim()}|`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => cache.delete(key));
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  cache.clear();
}

/**
 * Pre-cache all pages for a search query (optional optimization)
 */
export function preCacheAllPages(
  query: string,
  category: string = '',
  totalPages: number,
  fetchPage: (page: number) => Promise<CachedSearchResult>
): void {
  // Pre-cache next few pages in background (don't await)
  const pagesToPreCache = Math.min(3, totalPages); // Pre-cache up to 3 pages ahead
  for (let page = 2; page <= pagesToPreCache; page++) {
    fetchPage(page).then(data => {
      cacheResults(query, category, page, data);
    }).catch(() => {
      // Silently fail - pre-caching is optional
    });
  }
}

