const path = require('path');
const fs = require('fs');

function findRootEnv() {
  let currentPath = __dirname;
  const rootPath = path.resolve(currentPath, '../../');
  const rootEnvPath = path.join(rootPath, '.env');
  
  if (fs.existsSync(rootEnvPath)) {
    return rootEnvPath;
  }
  
  const cwdEnvPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(cwdEnvPath)) {
    return cwdEnvPath;
  }
  
  return path.resolve(__dirname, '../../.env');
}

const envPath = findRootEnv();
require('dotenv').config({ path: envPath });
const express = require('express');
const cors = require('cors');
const { Client } = require('@elastic/elasticsearch');
const axios = require('axios');
const {
  understandQuery,
  generateSuggestions,
  generateOverview,
  rankResults,
  buildElasticsearchQuery
} = require('./ai-service');

const app = express();
const PORT = process.env.API_PORT || 3001;
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1400';
const STRAPI_API_KEY_RAW = process.env.STRAPI_API_KEY || '';
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

// Clean API key (remove whitespace, quotes, etc.)
function getCleanApiKey() {
  if (!STRAPI_API_KEY_RAW) return '';
  return STRAPI_API_KEY_RAW.trim().replace(/^["']|["']$/g, '').trim();
}

const STRAPI_API_KEY = getCleanApiKey();

const esClientConfig = {
  node: ELASTICSEARCH_URL,
};

if (process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD) {
  esClientConfig.auth = {
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
  };
}

const esClient = new Client(esClientConfig);

// Middleware
app.use(cors());
app.use(express.json());

/**
 * GET /suggest - AI-powered autocomplete suggestions
 */
app.get('/suggest', async (req, res) => {
  try {
    const query = req.query.q || '';
    
    if (!query || query.length < 1) {
      return res.json({ suggestions: [] });
    }
    
    // Use AI to generate suggestions
    const aiSuggestions = await generateSuggestions(query);
    
    // Also get Elasticsearch results for context
    const esQuery = buildElasticsearchQuery(
      { intent: 'search', keywords: [query], expandedTerms: [], synonyms: [] },
      null
    );
    
    const esResponse = await esClient.search({
      index: 'search_items',
      size: 5,
      query: esQuery
    });
    
    const esResults = (esResponse.hits?.hits || []).map(hit => ({
      id: hit._id || '',
      url: hit._source?.url || '',
      title: hit._source?.title || '',
      description: hit._source?.description || '',
      category: hit._source?.category || ''
    }));
    
    // Generate more contextual suggestions using ES results
    const contextualSuggestions = await generateSuggestions(query, esResults);
    
    // Combine AI suggestions with ES results
    const allSuggestions = [...new Set([...aiSuggestions, ...contextualSuggestions])].slice(0, 6);
    
    // Map to ES results format for display
    const suggestions = allSuggestions.map((suggestion, index) => {
      // Try to find matching ES result
      const matchingResult = esResults.find(r => 
        r.title.toLowerCase().includes(suggestion.toLowerCase()) ||
        suggestion.toLowerCase().includes(r.title.toLowerCase())
      );
      
      if (matchingResult) {
        return matchingResult;
      }
      
      // Create suggestion from AI text
      return {
        id: `ai-suggestion-${index}`,
        url: '',
        title: suggestion,
        description: '',
        category: ''
      };
    });
    
    // Add ES results that weren't already included
    esResults.forEach(result => {
      if (!suggestions.find(s => s.id === result.id)) {
        suggestions.push(result);
      }
    });
    
    // Limit to 6 suggestions
    const finalSuggestions = suggestions.slice(0, 6);
    
    res.json({ suggestions: finalSuggestions });
  } catch (error) {
    console.error('[Suggest] Error:', error.message);
    // Return empty suggestions on error instead of crashing
    res.json({ suggestions: [] });
  }
});

/**
 * GET /search - AI-powered search with overview and ranking
 */
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const category = req.query.category || '';
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const from = (page - 1) * pageSize;
    
    // Allow empty query if category is specified (for category-only navigation)
    if (!query && !category) {
      return res.json({ 
        results: [], 
        total: 0, 
        page: 1, 
        totalPages: 0,
        overview: null,
        didYouMean: null
      });
    }
    
    // Use AI to understand the query
    let understanding;
    try {
      understanding = await understandQuery(query);
    } catch (aiError) {
      console.error('[Search] Error in AI understanding:', aiError.message);
      // Fallback understanding
      understanding = {
        intent: 'search',
        category: null,
        keywords: query.split(/\s+/).filter(w => w.length > 0),
        correctedQuery: null,
        expandedTerms: [],
        synonyms: [],
        didYouMean: null
      };
    }
    
    // Only use detected category if intent explicitly indicates category search
    // OR if user explicitly selected a category filter
    // This prevents AI from incorrectly filtering to one category when user wants all categories
    const shouldUseDetectedCategory = understanding.intent === 'category-keyword' || 
                                      understanding.intent === 'category-only';
    const targetCategory = category || (shouldUseDetectedCategory ? understanding.category : null);
    
    // Build Elasticsearch query using AI understanding
    const esQuery = buildElasticsearchQuery(understanding, targetCategory);
    
    // Execute search
    const response = await esClient.search({
      index: 'search_items',
      size: Math.min(pageSize * 2, 100), // Get more results for AI ranking
      from: from,
      query: esQuery,
      sort: [
        '_score',
        { last_modified: { order: 'desc' } }
      ]
    });
    
    // Handle different Elasticsearch client response formats
    const hits = response.hits || response.body?.hits || {};
    const hitsArray = hits.hits || [];
    
    const totalHits = typeof hits.total === 'object' ? hits.total.value : hits.total;
    
    // Map results
    let results = hitsArray.map(hit => ({
      id: hit._id,
      url: hit._source?.url || '',
      title: hit._source?.title || '',
      description: hit._source?.description || '',
      content: hit._source?.content || hit._source?.page_description || '',
      page_description: hit._source?.page_description || '', // Full page content for smart summaries
      category: hit._source?.category || '',
      last_modified: hit._source?.last_modified || '',
      score: hit._score
    }));
    
    // Use AI to rank results by relevance
    if (results.length > 0 && query.trim().length > 0) {
      results = await rankResults(query, results, understanding.intent);
    }
    
    // Limit to page size
    results = results.slice(0, pageSize);
    
    // Generate AI Overview (only on first page)
    let overview = null;
    if (page === 1 && query.trim().length > 0 && results.length > 0) {
      try {
        overview = await generateOverview(query, results, understanding.intent);
      } catch (overviewError) {
        console.error('[Search] Error generating overview:', overviewError.message);
        overview = null;
      }
    }
    
    // Handle Elasticsearch total field
    let total = 0;
    if (hits.total) {
      if (typeof hits.total === 'object' && hits.total.value !== undefined) {
        total = hits.total.value;
      } else if (typeof hits.total === 'number') {
        total = hits.total;
      }
    }
    
    // Get category counts using aggregations
    let categoryCounts = {};
    try {
      const aggResponse = await esClient.search({
        index: 'search_items',
        size: 0,
        query: esQuery,
        aggs: {
          categories: {
            terms: {
              field: 'category',
              size: 20
            }
          }
        }
      });
      
      const aggHits = aggResponse.hits || aggResponse.body?.hits || {};
      const buckets = aggResponse.aggregations?.categories?.buckets || 
                      aggResponse.body?.aggregations?.categories?.buckets || [];
      
      // Process buckets
      buckets.forEach(bucket => {
        const key = bucket.key || '';
        categoryCounts[key] = bucket.doc_count;
      });
      
      // Set "All Categories" count
      let allTotal = 0;
      if (aggHits.total) {
        if (typeof aggHits.total === 'object' && aggHits.total.value !== undefined) {
          allTotal = aggHits.total.value;
        } else if (typeof aggHits.total === 'number') {
          allTotal = aggHits.total;
        }
      }
      categoryCounts[''] = allTotal;
    } catch (aggError) {
      console.error('[Search] Error getting category counts:', aggError.message);
    }
    
    const totalPages = Math.ceil(total / pageSize);
    
    // Log search query (only on first page)
    if (page === 1) {
      try {
        const userId = req.query.user_id || req.headers['x-user-id'];
        if (userId && STRAPI_API_KEY) {
          await axios.post(
            `${STRAPI_URL}/api/search-logs`,
            {
              data: {
                user_id: userId,
                query: query,
                url: 'search:query-only',
                clicked: false,
                timestamp: new Date().toISOString()
              }
            },
            {
              headers: {
                'Authorization': `Bearer ${STRAPI_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );
        }
      } catch (logError) {
        // Silently fail if API key is missing/invalid (non-critical feature)
        if (logError.response && logError.response.status !== 401) {
          console.error('[Search] Error logging search query:', logError.message);
        }
      }
    }
    
    res.json({
      results: results,
      total: total,
      categoryCounts: categoryCounts,
      page: page,
      pageSize: pageSize,
      totalPages: totalPages,
      overview: overview,
      didYouMean: understanding.didYouMean || understanding.correctedQuery || null,
      intent: understanding.intent,
      understanding: {
        category: understanding.category,
        keywords: understanding.keywords,
        expandedTerms: understanding.expandedTerms
      }
    });
  } catch (error) {
    console.error('[Search] Error:', error.message);
    if (error.meta && error.meta.body) {
      console.error('[Search] Elasticsearch error:', JSON.stringify(error.meta.body, null, 2));
    }
    res.status(500).json({ 
      error: 'Search failed', 
      message: error.message,
      results: [],
      total: 0
    });
  }
});

/**
 * GET /trending - Get trending searches (simplified, can be enhanced with AI)
 */
app.get('/trending', async (req, res) => {
  try {
    if (!STRAPI_API_KEY) {
      return res.json({ trending: [] });
    }
    
    // Get most searched queries from Strapi
    const response = await axios.get(
      `${STRAPI_URL}/api/search-logs`,
      {
        params: {
          'filters[clicked][$eq]': false,
          'sort': 'timestamp:desc',
          'pagination[limit]': 100
        },
        headers: {
          'Authorization': `Bearer ${STRAPI_API_KEY}`
        }
      }
    );
    
    const logs = response.data.data || [];
    
    // Count query frequency
    const queryCounts = {};
    logs.forEach(log => {
      const query = log.attributes?.query || '';
      if (query && query.trim().length > 0 && !query.includes('|category:') && !query.includes('|keyword:')) {
        queryCounts[query] = (queryCounts[query] || 0) + 1;
      }
    });
    
    // Get top 3 queries
    const trending = Object.entries(queryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([query, count]) => ({
        query: query,
        originalQuery: query,
        count: count
      }));
    
    res.json({ trending });
  } catch (error) {
    if (error.response && error.response.status === 401) {
      // Log warning if API key exists but is invalid
      if (STRAPI_API_KEY) {
        console.warn('[Trending] 401 Unauthorized - STRAPI_API_KEY may be invalid or expired');
        console.warn(`[Trending] Attempted URL: ${STRAPI_URL}/api/search-logs`);
        console.warn(`[Trending] API Key length: ${STRAPI_API_KEY.length} chars`);
        // Check if Strapi is accessible
        axios.get(`${STRAPI_URL}/api/search-logs`, { timeout: 2000 })
          .catch(err => {
            if (err.code === 'ECONNREFUSED') {
              console.error('[Trending] Cannot connect to Strapi - is it running?');
            }
          });
      }
      // Return empty trending instead of error
      return res.json({ trending: [] });
    }
    console.error('[Trending] Error:', error.message);
    res.json({ trending: [] });
  }
});

/**
 * POST /log/click - Log click and update last_visited
 */
app.post('/log/click', async (req, res) => {
  try {
    const { user_id, url, title } = req.body;
    
    if (!user_id || !url) {
      return res.status(400).json({ error: 'user_id and url are required' });
    }
    
    if (!STRAPI_API_KEY) {
      console.warn('[Log Click] STRAPI_API_KEY not set, skipping log');
      return res.json({ success: true, skipped: true });
    }
    
    // Check if log exists
    let existingLogs;
    try {
      existingLogs = await axios.get(
      `${STRAPI_URL}/api/search-logs`,
      {
        params: {
          'filters[user_id][$eq]': user_id,
          'filters[url][$eq]': url,
          'sort': 'timestamp:desc',
          'pagination[limit]': 1
        },
        headers: {
          'Authorization': `Bearer ${STRAPI_API_KEY}`
        }
      }
      );
    } catch (strapiError) {
      if (strapiError.response && strapiError.response.status === 401) {
        console.error('[Log Click] 401 Unauthorized - Check STRAPI_API_KEY in root .env file');
        return res.json({ success: false, error: 'Failed to log (auth error)' });
      }
      throw strapiError;
    }
    
    const now = new Date().toISOString();
    
    try {
      if (existingLogs.data.data && existingLogs.data.data.length > 0) {
      // Update existing log
      const logId = existingLogs.data.data[0].id;
      await axios.put(
        `${STRAPI_URL}/api/search-logs/${logId}`,
        {
          data: {
            clicked: true,
            last_visited: now,
            title: title || existingLogs.data.data[0]?.attributes?.title || ''
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${STRAPI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } else {
      // Create new log
      await axios.post(
        `${STRAPI_URL}/api/search-logs`,
        {
          data: {
            user_id,
            url,
            title: title || '',
            clicked: true,
            last_visited: now,
            timestamp: now
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${STRAPI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      }
      
      res.json({ success: true });
    } catch (strapiError) {
      if (strapiError.response && strapiError.response.status === 401) {
        console.error('[Log Click] 401 Unauthorized - Check STRAPI_API_KEY in root .env file');
        return res.json({ success: false, error: 'Failed to log (auth error)' });
      }
      throw strapiError;
    }
  } catch (error) {
    console.error('[Log Click] Error:', error.message);
    if (error.response) {
      console.error('[Log Click] Strapi response:', error.response.status, error.response.data);
    }
    // Don't fail the request if logging fails
    res.json({ success: false, error: 'Failed to log click' });
  }
});

/**
 * GET /history - Get user's click history
 */
app.get('/history', async (req, res) => {
  try {
    const user_id = req.query.user_id;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const sort = req.query.sort || 'newest'; // 'newest' or 'oldest'
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    if (!STRAPI_API_KEY) {
      return res.json({ history: [], total: 0, page: 1, totalPages: 0 });
    }
    
    const sortOrder = sort === 'oldest' ? 'asc' : 'desc';
    const from = (page - 1) * pageSize;
    
    const response = await axios.get(
      `${STRAPI_URL}/api/search-logs`,
      {
        params: {
          'filters[user_id][$eq]': user_id,
          'filters[clicked][$eq]': true,
          'sort': `last_visited:${sortOrder}`,
          'pagination[limit]': pageSize,
          'pagination[start]': from
        },
        headers: {
          'Authorization': `Bearer ${STRAPI_API_KEY}`
        }
      }
    );
    
    const logs = response.data.data || [];
    const total = response.data.meta?.pagination?.total || 0;
    
    const history = logs.map(log => ({
      id: log.id,
      url: log.attributes?.url || '',
      title: log.attributes?.title || '',
      last_visited: log.attributes?.last_visited || log.attributes?.timestamp || ''
    }));
    
    const totalPages = Math.ceil(total / pageSize);
    
    res.json({
      history: history,
      total: total,
      page: page,
      pageSize: pageSize,
      totalPages: totalPages
    });
  } catch (error) {
    if (error.response && error.response.status === 401) {
      // Log warning if API key exists but is invalid
      if (STRAPI_API_KEY) {
        console.warn('[History] 401 Unauthorized - STRAPI_API_KEY may be invalid or expired');
        console.warn(`[History] Attempted URL: ${STRAPI_URL}/api/search-logs`);
        console.warn(`[History] User ID: ${req.query.user_id}`);
      }
      // Return empty history instead of error
      return res.json({ history: [], total: 0, page: 1, totalPages: 0 });
    }
    console.error('[History] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * DELETE /history - Clear user's click history
 */
app.delete('/history', async (req, res) => {
  try {
    const user_id = req.query.user_id;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    // Get all logs for user
    const response = await axios.get(
      `${STRAPI_URL}/api/search-logs`,
      {
        params: {
          'filters[user_id][$eq]': user_id,
          'filters[clicked][$eq]': true
        },
        headers: {
          'Authorization': `Bearer ${STRAPI_API_KEY}`
        }
      }
    );
    
    // Delete each log
    const logs = response.data.data || [];
    const deletePromises = logs.map(log => 
      axios.delete(`${STRAPI_URL}/api/search-logs/${log.id}`, {
        headers: {
          'Authorization': `Bearer ${STRAPI_API_KEY}`
        }
      })
    );
    
    await Promise.all(deletePromises);
    
    res.json({ success: true, deleted: logs.length });
  } catch (error) {
    console.error('[Delete History] Error:', error.message);
    res.status(500).json({ error: 'Failed to delete history' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Cache statistics endpoint
app.get('/cache/stats', (req, res) => {
  const { getCacheStats } = require('./ai-cache');
  const stats = getCacheStats();
  res.json({
    success: true,
    cache: stats
  });
});

// Clear cache endpoint (for admin/testing)
app.post('/cache/clear', (req, res) => {
  const { clearAllCaches } = require('./ai-cache');
  clearAllCaches();
  res.json({
    success: true,
    message: 'All AI caches cleared'
  });
});

// Test Strapi API key endpoint
app.get('/test-strapi-key', async (req, res) => {
  try {
    if (!STRAPI_API_KEY) {
      return res.json({ 
        success: false, 
        error: 'STRAPI_API_KEY not set',
        keyLength: 0
      });
    }

    // Try to access Strapi with the API key
    const response = await axios.get(
      `${STRAPI_URL}/api/search-logs`,
      {
        params: {
          'pagination[limit]': 1
        },
        headers: {
          'Authorization': `Bearer ${STRAPI_API_KEY}`
        },
        timeout: 5000
      }
    );

    res.json({
      success: true,
      message: 'API key is valid',
      keyLength: STRAPI_API_KEY.length,
      strapiUrl: STRAPI_URL,
      responseStatus: response.status
    });
  } catch (error) {
    if (error.response) {
      res.json({
        success: false,
        error: `Strapi returned ${error.response.status}`,
        message: error.response.status === 401 
          ? 'API key is invalid or expired. Please regenerate it in Strapi admin.'
          : error.response.statusText,
        keyLength: STRAPI_API_KEY.length,
        strapiUrl: STRAPI_URL,
        statusCode: error.response.status
      });
    } else if (error.code === 'ECONNREFUSED') {
      res.json({
        success: false,
        error: 'Cannot connect to Strapi',
        message: 'Make sure Strapi is running on ' + STRAPI_URL,
        strapiUrl: STRAPI_URL
      });
    } else {
      res.json({
        success: false,
        error: error.message,
        keyLength: STRAPI_API_KEY.length,
        strapiUrl: STRAPI_URL
      });
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] API server running on port ${PORT}`);
  console.log(`[Server] Elasticsearch: ${ELASTICSEARCH_URL}`);
  console.log(`[Server] Strapi: ${STRAPI_URL}`);
  console.log(`[Server] Groq API: ${process.env.GROQ_API_KEY ? 'Configured' : 'Not configured'}`);
});
