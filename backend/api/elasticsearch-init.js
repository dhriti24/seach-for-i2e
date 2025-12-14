const axios = require('axios');
const { Client } = require('@elastic/elasticsearch');

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1400';
const STRAPI_API_KEY = (process.env.STRAPI_API_KEY || '').trim().replace(/^["']|["']$/g, '').trim();

const INDEX_NAME = 'search_items';

// Elasticsearch client configuration
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

/**
 * Test Elasticsearch connection
 */
async function testElasticsearchConnection() {
  try {
    await axios.get(ELASTICSEARCH_URL, { timeout: 5000 });
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Elasticsearch is not running. Please start Elasticsearch first.');
    }
    throw new Error(`Elasticsearch connection failed: ${error.message}`);
  }
}

/**
 * Check if index exists
 */
async function indexExists() {
  try {
    const exists = await esClient.indices.exists({ index: INDEX_NAME });
    return exists;
  } catch (error) {
    return false;
  }
}

/**
 * Create Elasticsearch index with proper mapping
 */
async function createIndex() {
  try {
    const mapping = {
      mappings: {
        properties: {
          url: { type: 'keyword' },
          title: { 
            type: 'text',
            analyzer: 'standard',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          description: { 
            type: 'text',
            analyzer: 'standard'
          },
          content: {
            type: 'text',
            analyzer: 'standard'
          },
          page_description: {
            type: 'text',
            analyzer: 'standard'
          },
          category: { 
            type: 'keyword',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          last_modified: { type: 'date' }
        }
      },
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0
      }
    };
    
    await esClient.indices.create({
      index: INDEX_NAME,
      body: mapping
    });
    
    console.log(`[Elasticsearch] ✓ Index '${INDEX_NAME}' created successfully`);
    return true;
  } catch (error) {
    if (error.meta && error.meta.body && error.meta.body.error) {
      const errorType = error.meta.body.error.type;
      if (errorType === 'resource_already_exists_exception') {
        console.log(`[Elasticsearch] Index '${INDEX_NAME}' already exists`);
        return true;
      }
      console.error(`[Elasticsearch] ✗ Error creating index:`, error.meta.body.error);
    } else {
      console.error(`[Elasticsearch] ✗ Error creating index:`, error.message);
    }
    throw error;
  }
}

/**
 * Sync all data from Strapi to Elasticsearch
 */
async function syncStrapiToElasticsearch() {
  if (!STRAPI_API_KEY) {
    console.warn('[Elasticsearch] ⚠ STRAPI_API_KEY not set. Skipping data sync.');
    return { synced: 0, errors: 0 };
  }

  try {
    console.log('[Elasticsearch] Syncing data from Strapi...');
    
    // Fetch all search items from Strapi
    let allItems = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await axios.get(
          `${STRAPI_URL}/api/search-items`,
          {
            params: {
              'pagination[page]': page,
              'pagination[pageSize]': pageSize,
              'pagination[withCount]': true
            },
            headers: {
              'Authorization': `Bearer ${STRAPI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        const items = response.data.data || [];
        allItems = allItems.concat(items);
        
        const pagination = response.data.meta?.pagination || {};
        hasMore = page < pagination.pageCount;
        page++;
        
        if (allItems.length % 100 === 0) {
          console.log(`[Elasticsearch] Fetched ${allItems.length} items from Strapi...`);
        }
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.warn('[Elasticsearch] ⚠ Strapi API key invalid. Skipping data sync.');
          return { synced: 0, errors: 0 };
        }
        if (error.code === 'ECONNREFUSED') {
          console.warn('[Elasticsearch] ⚠ Strapi is not running yet. Data sync will be skipped.');
          return { synced: 0, errors: 0 };
        }
        throw error;
      }
    }

    if (allItems.length === 0) {
      console.log('[Elasticsearch] No items found in Strapi. Index is ready but empty.');
      return { synced: 0, errors: 0 };
    }

    // Prepare bulk operations
    const body = [];
    for (const item of allItems) {
      const source = item.attributes || {};
      
      body.push({
        index: {
          _index: INDEX_NAME,
          _id: item.id?.toString() || source.url
        }
      });
      
      body.push({
        url: source.url || '',
        title: source.title || '',
        description: source.description || '',
        content: source.content || '',
        page_description: source.page_description || '',
        category: source.category || '',
        last_modified: source.last_modified || source.updatedAt || new Date().toISOString()
      });
    }

    // Perform bulk index
    if (body.length > 0) {
      const bulkResponse = await esClient.bulk({ refresh: true, body });
      
      if (bulkResponse.errors) {
        const errors = bulkResponse.items.filter(item => item.index?.error);
        console.error(`[Elasticsearch] ✗ ${errors.length} errors during bulk index`);
        console.log(`[Elasticsearch] ✓ Successfully indexed ${allItems.length - errors.length} items`);
        return { synced: allItems.length - errors.length, errors: errors.length };
      } else {
        console.log(`[Elasticsearch] ✓ Successfully indexed ${allItems.length} items`);
        return { synced: allItems.length, errors: 0 };
      }
    }

    return { synced: 0, errors: 0 };
  } catch (error) {
    if (error.response) {
      console.error(`[Elasticsearch] ✗ Error syncing data: ${error.response.status} ${error.response.statusText}`);
    } else {
      console.error(`[Elasticsearch] ✗ Error syncing data:`, error.message);
    }
    throw error;
  }
}

/**
 * Initialize Elasticsearch: create index and sync data
 */
async function initializeElasticsearch() {
  try {
    console.log('[Elasticsearch] Initializing Elasticsearch...');
    
    // Test connection
    await testElasticsearchConnection();
    console.log('[Elasticsearch] ✓ Connection successful');
    
    // Check if index exists
    const exists = await indexExists();
    
    if (!exists) {
      // Create index
      await createIndex();
      
      // Sync data from Strapi
      await syncStrapiToElasticsearch();
    } else {
      console.log(`[Elasticsearch] ✓ Index '${INDEX_NAME}' exists`);
      
      // Check if index has data
      try {
        const countResponse = await esClient.count({ index: INDEX_NAME });
        const count = countResponse.count || countResponse.body?.count || 0;
        
        if (count === 0) {
          console.log('[Elasticsearch] Index is empty. Syncing data from Strapi...');
          await syncStrapiToElasticsearch();
        } else {
          console.log(`[Elasticsearch] ✓ Index has ${count} documents`);
        }
      } catch (countError) {
        console.warn('[Elasticsearch] ⚠ Could not check index count. Index may be empty.');
      }
    }
    
    console.log('[Elasticsearch] ✓ Initialization complete');
    return true;
  } catch (error) {
    console.error('[Elasticsearch] ✗ Initialization failed:', error.message);
    throw error;
  }
}

module.exports = {
  initializeElasticsearch,
  syncStrapiToElasticsearch,
  createIndex,
  indexExists,
  testElasticsearchConnection
};

