/**
 * AI Response Cache
 * Caches AI API responses to reduce API calls and improve performance
 */

const crypto = require('crypto');

// Cache storage with TTL (Time To Live)
const CACHE_TTL = {
  UNDERSTAND_QUERY: 30 * 60 * 1000,      // 30 minutes - query understanding rarely changes
  SUGGESTIONS: 15 * 60 * 1000,           // 15 minutes - suggestions can be cached longer
  OVERVIEW: 60 * 60 * 1000,              // 1 hour - overviews are stable
  RANKING: 30 * 60 * 1000                // 30 minutes - ranking can be cached
};

const caches = {
  understandQuery: new Map(),
  suggestions: new Map(),
  overview: new Map(),
  ranking: new Map()
};

/**
 * Generate cache key from query
 */
function getQueryCacheKey(query) {
  const normalized = query.toLowerCase().trim();
  return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * Generate cache key from query and results (for overview/ranking)
 */
function getResultsCacheKey(query, results) {
  const normalized = query.toLowerCase().trim();
  // Create hash from query + first 3 result IDs (for uniqueness)
  const resultIds = results.slice(0, 3).map(r => r.id || r.url).join('|');
  const combined = `${normalized}|${resultIds}`;
  return crypto.createHash('md5').update(combined).digest('hex');
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry, ttl) {
  if (!entry || !entry.timestamp) return false;
  const now = Date.now();
  return (now - entry.timestamp) < ttl;
}

/**
 * Get cached query understanding
 */
function getCachedUnderstanding(query) {
  const key = getQueryCacheKey(query);
  const cached = caches.understandQuery.get(key);
  
  if (cached && isCacheValid(cached, CACHE_TTL.UNDERSTAND_QUERY)) {
    return cached.data;
  }
  
  if (cached) {
    caches.understandQuery.delete(key);
  }
  
  return null;
}

/**
 * Cache query understanding
 */
function cacheUnderstanding(query, data) {
  const key = getQueryCacheKey(query);
  caches.understandQuery.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Get cached suggestions
 */
function getCachedSuggestions(query) {
  const key = getQueryCacheKey(query);
  const cached = caches.suggestions.get(key);
  
  if (cached && isCacheValid(cached, CACHE_TTL.SUGGESTIONS)) {
    return cached.data;
  }
  
  if (cached) {
    caches.suggestions.delete(key);
  }
  
  return null;
}

/**
 * Cache suggestions
 */
function cacheSuggestions(query, data) {
  const key = getQueryCacheKey(query);
  caches.suggestions.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Get cached overview
 */
function getCachedOverview(query, topResults) {
  const key = getResultsCacheKey(query, topResults);
  const cached = caches.overview.get(key);
  
  if (cached && isCacheValid(cached, CACHE_TTL.OVERVIEW)) {
    return cached.data;
  }
  
  if (cached) {
    caches.overview.delete(key);
  }
  
  return null;
}

/**
 * Cache overview
 */
function cacheOverview(query, topResults, data) {
  const key = getResultsCacheKey(query, topResults);
  caches.overview.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Get cached ranking
 */
function getCachedRanking(query, results) {
  const key = getResultsCacheKey(query, results);
  const cached = caches.ranking.get(key);
  
  if (cached && isCacheValid(cached, CACHE_TTL.RANKING)) {
    return cached.data;
  }
  
  if (cached) {
    caches.ranking.delete(key);
  }
  
  return null;
}

/**
 * Cache ranking
 */
function cacheRanking(query, results, data) {
  const key = getResultsCacheKey(query, results);
  caches.ranking.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Clear all caches (useful for testing or manual refresh)
 */
function clearAllCaches() {
  caches.understandQuery.clear();
  caches.suggestions.clear();
  caches.overview.clear();
  caches.ranking.clear();
}

/**
 * Clean expired cache entries (prevent memory leaks)
 */
function cleanExpiredEntries() {
  const now = Date.now();
  
  // Clean understandQuery cache
  for (const [key, entry] of caches.understandQuery.entries()) {
    if (!isCacheValid(entry, CACHE_TTL.UNDERSTAND_QUERY)) {
      caches.understandQuery.delete(key);
    }
  }
  
  // Clean suggestions cache
  for (const [key, entry] of caches.suggestions.entries()) {
    if (!isCacheValid(entry, CACHE_TTL.SUGGESTIONS)) {
      caches.suggestions.delete(key);
    }
  }
  
  // Clean overview cache
  for (const [key, entry] of caches.overview.entries()) {
    if (!isCacheValid(entry, CACHE_TTL.OVERVIEW)) {
      caches.overview.delete(key);
    }
  }
  
  // Clean ranking cache
  for (const [key, entry] of caches.ranking.entries()) {
    if (!isCacheValid(entry, CACHE_TTL.RANKING)) {
      caches.ranking.delete(key);
    }
  }
}

/**
 * Get cache statistics (for monitoring)
 */
function getCacheStats() {
  cleanExpiredEntries(); // Clean before returning stats
  
  return {
    understandQuery: caches.understandQuery.size,
    suggestions: caches.suggestions.size,
    overview: caches.overview.size,
    ranking: caches.ranking.size,
    total: caches.understandQuery.size + 
           caches.suggestions.size + 
           caches.overview.size + 
           caches.ranking.size,
    ttl: {
      understandQuery: CACHE_TTL.UNDERSTAND_QUERY / 1000 / 60, // minutes
      suggestions: CACHE_TTL.SUGGESTIONS / 1000 / 60,
      overview: CACHE_TTL.OVERVIEW / 1000 / 60,
      ranking: CACHE_TTL.RANKING / 1000 / 60
    }
  };
}

// Clean expired entries every 10 minutes
setInterval(cleanExpiredEntries, 10 * 60 * 1000);

module.exports = {
  getCachedUnderstanding,
  cacheUnderstanding,
  getCachedSuggestions,
  cacheSuggestions,
  getCachedOverview,
  cacheOverview,
  getCachedRanking,
  cacheRanking,
  clearAllCaches,
  getCacheStats,
  cleanExpiredEntries
};

