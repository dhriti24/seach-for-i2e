/**
 * AI Service Module using Groq API
 * Handles all AI-powered features: intent detection, query understanding, 
 * suggestions, overview generation, and ranking
 */

const Groq = require('groq-sdk');
const path = require('path');
const fs = require('fs');
const {
  getCachedUnderstanding,
  cacheUnderstanding,
  getCachedSuggestions,
  cacheSuggestions,
  getCachedOverview,
  cacheOverview,
  getCachedRanking,
  cacheRanking
} = require('./ai-cache');

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

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

if (!GROQ_API_KEY) {
  console.warn('[AI Service] WARNING: GROQ_API_KEY not found in environment variables. AI features will not work.');
}

const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

/**
 * Make a request to Groq API
 */
async function callGroq(messages, options = {}) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.max_tokens,
    response_format: options.response_format
  });

  return completion;
}

const PHARMA_CONTEXT = `
i2e Consulting is a pharmaceutical consulting company specializing in:
- Strategic Portfolio Management (SPM)
- Clinical Data Management (CDM)
- Clinical Research Organization (CRO) services
- Electronic Data Capture (EDC)
- Clinical Trial Management Systems (CTMS)
- Business Intelligence and Analytics
- Planisware (PPM) implementation
- Resource Management
- Project Management

Common abbreviations:
- SPM: Strategic Portfolio Management
- CDM: Clinical Data Management
- CRO: Clinical Research Organization
- EDC: Electronic Data Capture
- CTMS: Clinical Trial Management System
- PPM: Planisware Portfolio Management
- BI: Business Intelligence
- IT: Information Technology
- AI/ML: Artificial Intelligence/Machine Learning
- R&D: Research and Development
- PMO: Project Management Office
- HR: Human Resources

Common synonyms:
- Services = Offerings, Solutions, What we provide
- Careers = Jobs, Positions, Openings, Hiring
- Technologies = Tech, Tools, Platforms
- Partners = Partnerships, Alliances, Collaborations
- Solutions = Products, Services
- People = Our Experts, Team, Employees
- About Us = About, Company Information
`;

/**
 * Understand user query intent and extract information
 */
async function understandQuery(query) {
  if (!query || query.trim().length === 0) {
    return {
      intent: 'search',
      category: null,
      keywords: [],
      correctedQuery: null,
      expandedTerms: [],
      synonyms: []
    };
  }

  // Check cache first
  const cached = getCachedUnderstanding(query);
  if (cached) {
    return cached;
  }

  try {
    const completion = await callGroq([
      {
        role: 'system',
        content: `You are an intelligent search assistant for i2e Consulting, a pharmaceutical consulting company.

${PHARMA_CONTEXT}

Your task is to understand user search queries and extract:
1. Intent (search, category-keyword, question, category-only)
2. Category ONLY if explicitly mentioned by the user (e.g., "blogs about PPM", "case studies", "services related to SPM")
   - If the user just searches for a keyword without mentioning a category, set category to null
   - Only detect category when user explicitly uses words like "blogs", "case studies", "services", "technologies", etc.
3. Keywords (main search terms)
4. Corrected query if there are spelling errors
5. Expanded abbreviations
6. Synonyms used

Return a JSON object with this structure:
{
  "intent": "search|category-keyword|question|category-only",
  "category": "category-name or null",
  "keywords": ["keyword1", "keyword2"],
  "correctedQuery": "corrected query or null",
  "expandedTerms": ["full term for abbreviation"],
  "synonyms": ["synonym1", "synonym2"],
  "didYouMean": "suggested correction or null"
}

IMPORTANT RULES:
- Set category to null unless the user EXPLICITLY mentions a category word (blogs, case studies, services, technologies, etc.)
- If user searches for just "PPM" or "SPM" without mentioning a category, category should be null
- Only set category when intent is "category-keyword" or "category-only"
- For general searches, intent should be "search" and category should be null
- Handling spelling errors (e.g., "clincal" -> "clinical")
- Expanding abbreviations (e.g., "SPM" -> "Strategic Portfolio Management")
- Understanding synonyms (e.g., "jobs" -> "careers")
- Understanding pharma terminology and related concepts`
      },
      {
        role: 'user',
        content: `Analyze this search query: "${query}"`
      }
    ], {
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch (parseError) {
      parsed = {};
    }

    const result = {
      intent: parsed.intent || 'search',
      category: parsed.category || null,
      keywords: parsed.keywords || [],
      correctedQuery: parsed.correctedQuery || null,
      expandedTerms: parsed.expandedTerms || [],
      synonyms: parsed.synonyms || [],
      didYouMean: parsed.didYouMean || null
    };
    
    // Cache the result
    cacheUnderstanding(query, result);
    
    return result;
  } catch (error) {
    // Fallback to basic parsing
    return {
      intent: 'search',
      category: null,
      keywords: query.split(/\s+/).filter(w => w.length > 0),
      correctedQuery: null,
      expandedTerms: [],
      synonyms: [],
      didYouMean: null
    };
  }
}

/**
 * Generate autocomplete suggestions based on query
 */
async function generateSuggestions(query, existingResults = []) {
  if (!query || query.trim().length < 1) {
    return [];
  }

  // Check cache first
  const cached = getCachedSuggestions(query);
  if (cached) {
    return cached;
  }

  try {
    const completion = await callGroq([
      {
        role: 'system',
        content: `You are an autocomplete suggestion generator for i2e Consulting search.

${PHARMA_CONTEXT}

Generate 4-6 relevant autocomplete suggestions based on the partial query.
Suggestions should:
- Complete the user's thought
- Be relevant to pharmaceutical consulting, clinical data, portfolio management
- Include common abbreviations and their expansions
- Be concise (2-5 words)
- Help users find what they're looking for

Return a JSON object with a "suggestions" array:
{"suggestions": ["suggestion1", "suggestion2", "suggestion3"]}`
      },
      {
        role: 'user',
        content: `Generate autocomplete suggestions for: "${query}"

${existingResults.length > 0 ? `Existing results context:\n${existingResults.slice(0, 5).map(r => `- ${r.title}`).join('\n')}` : ''}`
      }
    ], {
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch (parseError) {
      parsed = {};
    }
    const suggestions = parsed.suggestions || parsed.array || [];
    
    // Cache the result
    cacheSuggestions(query, suggestions);
    
    return suggestions;
  } catch (error) {
    console.error('[AI Service] Error generating suggestions:', error.message);
    return [];
  }
}

/**
 * Generate AI Overview for search results
 */
async function generateOverview(query, topResults, intent) {
  if (!query || !topResults || topResults.length === 0) {
    return null;
  }

  // Check cache first
  const cached = getCachedOverview(query, topResults);
  if (cached !== null) {
    return cached;
  }

  try {
    // Prepare context from top results
    const resultsContext = topResults.slice(0, 5).map((result, index) => 
      `${index + 1}. ${result.title}\n   ${result.description || result.content?.substring(0, 200) || ''}`
    ).join('\n\n');

    const completion = await callGroq([
      {
        role: 'system',
        content: `You are an AI assistant providing search overviews for i2e Consulting.

${PHARMA_CONTEXT}

Generate a concise, informative overview (2-3 sentences) that:
- Understands the user's intent
- Summarizes what i2e Consulting offers related to the query
- Provides helpful context
- Uses natural, engaging language
- Is accurate and relevant

Keep it concise and informative.`
      },
      {
        role: 'user',
        content: `User query: "${query}"
Intent: ${intent}

Top search results:
${resultsContext}

Generate an AI overview for this search.`
      }
    ], {
      temperature: 0.4,
      max_tokens: 200
    });

    const overview = completion.choices[0]?.message?.content?.trim() || null;
    
    // Cache the result (even if null, to avoid repeated calls)
    cacheOverview(query, topResults, overview);
    
    return overview;
  } catch (error) {
    return null;
  }
}

/**
 * Rank and reorder search results based on relevance
 */
async function rankResults(query, results, intent) {
  if (!results || results.length === 0) {
    return results;
  }

  // Check cache first
  const cached = getCachedRanking(query, results);
  if (cached) {
    return cached;
  }

  try {
    // For small result sets, use AI ranking
    if (results.length <= 20) {
      const resultsList = results.map((r, i) => 
        `${i + 1}. Title: ${r.title}\n   URL: ${r.url}\n   Description: ${(r.description || r.content || '').substring(0, 150)}`
      ).join('\n\n');

      const completion = await callGroq([
        {
          role: 'system',
          content: `You are a search result ranking assistant for i2e Consulting.

${PHARMA_CONTEXT}

Rank search results by relevance to the query. Return a JSON object with ranked indices (0-based) in order of relevance:
{"rankedIndices": [0, 2, 1, 3, ...]}

Consider:
- Query intent and keywords
- Title relevance
- Content relevance
- Category match
- User intent`
        },
        {
          role: 'user',
          content: `Query: "${query}"
Intent: ${intent}

Results:
${resultsList}

Rank these results by relevance.`
        }
      ], {
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0]?.message?.content || '{}';
      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch (parseError) {
        parsed = {};
      }
      const rankedIndices = parsed.rankedIndices || [];

      if (rankedIndices.length === results.length) {
        const ranked = rankedIndices.map(idx => results[idx]).filter(Boolean);
        
        // Cache the result
        cacheRanking(query, results, ranked);
        
        return ranked;
      }
    }

    // Fallback: return original order
    const originalResults = results;
    
    // Cache original order too (to avoid repeated calls)
    cacheRanking(query, results, originalResults);
    
    return originalResults;
  } catch (error) {
    console.error('[AI Service] Error ranking results:', error.message);
    return results;
  }
}

/**
 * Build Elasticsearch query based on AI understanding
 */
function buildElasticsearchQuery(understanding, categoryFilter = null) {
  const { intent, category, keywords, expandedTerms, synonyms } = understanding;
  
  // Determine which category to use (filter takes precedence)
  const targetCategory = categoryFilter || category;
  
  const shouldClauses = [];
  const mustClauses = [];

  // Add category filter if specified
  if (targetCategory && targetCategory.trim() !== '') {
    mustClauses.push({
      term: { category: targetCategory }
    });
  }

  // Combine keywords, expanded terms, and synonyms
  const allTerms = [...keywords, ...expandedTerms, ...synonyms].filter(Boolean);
  const searchTerms = allTerms.length > 0 ? allTerms : keywords;

  // Build query clauses for each search term
  searchTerms.forEach(term => {
    if (term && term.trim().length > 0) {
      // Exact phrase match (highest priority)
      shouldClauses.push(
        {
          match_phrase: {
            title: { query: term, boost: 10 }
          }
        },
        {
          match_phrase: {
            content: { query: term, boost: 8 }
          }
        },
        {
          match_phrase: {
            description: { query: term, boost: 6 }
          }
        },
        {
          match_phrase: {
            page_description: { query: term, boost: 7 }
          }
        }
      );

      // Match query (all words must appear)
      shouldClauses.push(
        {
          match: {
            title: { query: term, boost: 5, operator: 'and' }
          }
        },
        {
          match: {
            content: { query: term, boost: 3, operator: 'and' }
          }
        },
        {
          match: {
            description: { query: term, boost: 2, operator: 'and' }
          }
        },
        {
          match: {
            page_description: { query: term, boost: 4, operator: 'and' }
          }
        }
      );

      // Prefix matching for longer queries
      if (term.length >= 3) {
        shouldClauses.push(
          {
            match_phrase_prefix: {
              title: { query: term, boost: 4, max_expansions: 50 }
            }
          },
          {
            prefix: {
              title: { value: term.toLowerCase(), boost: 3 }
            }
          }
        );
      }

      // URL matching
      shouldClauses.push({
        wildcard: {
          url: {
            value: `*${term.replace(/\s+/g, '*')}*`,
            boost: 7,
            case_insensitive: true
          }
        }
      });
    }
  });

  // Build final query
  const query = {
    bool: {
      must: mustClauses.length > 0 ? mustClauses : undefined,
      should: shouldClauses.length > 0 ? shouldClauses : [{ match_all: {} }],
      minimum_should_match: shouldClauses.length > 0 ? 1 : 0
    }
  };

  return query;
}

module.exports = {
  understandQuery,
  generateSuggestions,
  generateOverview,
  rankResults,
  buildElasticsearchQuery
};

