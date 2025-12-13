import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Suggestion {
  id: string;
  url: string;
  title: string;
  description: string;
  category: string;
}

export interface SearchResult {
  id: string;
  url: string;
  title: string;
  description: string; // Keep for backward compatibility
  content: string; // Smart summary content from scraper
  page_description?: string; // Full page content for generating summaries
  category: string;
  last_modified: string;
  score?: number;
}

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  category?: string;
  last_visited: string;
  timestamp: string;
}

/**
 * Get autocomplete suggestions
 */
export async function getSuggestions(query: string): Promise<Suggestion[]> {
  if (!query || query.length < 1) {
    return [];
  }
  
  try {
    const response = await api.get('/suggest', {
      params: { q: query },
    });
    const suggestions = response.data.suggestions || [];
    return suggestions;
  } catch (error: any) {
    if (error.response?.status !== 401) {
      console.error('[Frontend] Error fetching suggestions:', error);
    }
    return [];
  }
}

/**
 * Search with query and optional category
 */
export async function search(
  query: string,
  category?: string,
  page: number = 1,
  pageSize: number = 10,
  userId?: string
): Promise<{ 
  results: SearchResult[]; 
  total: number; 
  categoryCounts?: Record<string, number>;
  page: number;
  totalPages: number;
  overview?: string | null;
  didYouMean?: string | null;
  intent?: string;
}> {
  // Allow empty query if category is specified (for category-only navigation)
  if (!query && !category) {
    return { results: [], total: 0, categoryCounts: {}, page: 1, totalPages: 0 };
  }
  
  try {
    const params: any = { q: query, category, page, pageSize };
    // Add user_id if provided (for search query logging)
    if (userId) {
      params.user_id = userId;
    }
    
    const response = await api.get('/search', { params });
    return {
      results: response.data.results || [],
      total: response.data.total || 0,
      categoryCounts: response.data.categoryCounts || {},
      page: response.data.page || 1,
      totalPages: response.data.totalPages || 0,
      overview: response.data.overview || null,
      didYouMean: response.data.didYouMean || null,
      intent: response.data.intent || 'search'
    };
  } catch (error) {
    console.error('Error searching:', error);
    return { results: [], total: 0, categoryCounts: {}, page: 1, totalPages: 0 };
  }
}

/**
 * Log click
 */
export async function logClick(
  userId: string,
  url: string,
  title: string
): Promise<void> {
  try {
    await api.post('/log/click', {
      user_id: userId,
      url,
      title,
    });
  } catch (error: any) {
    if (error.response?.status !== 401) {
      console.error('Error logging click:', error);
    }
  }
}

/**
 * Get user history
 */
export async function getHistory(userId: string): Promise<HistoryItem[]> {
  try {
    const response = await api.get('/history', {
      params: { user_id: userId },
    });
    return response.data.history || [];
  } catch (error: any) {
    // Silently handle 401 errors (API key missing)
    if (error.response?.status !== 401) {
      console.error('Error fetching history:', error);
    }
    return [];
  }
}

/**
 * Delete user history
 */
export async function deleteHistory(userId: string): Promise<void> {
  try {
    await api.delete('/history', {
      params: { user_id: userId },
    });
  } catch (error) {
    console.error('Error deleting history:', error);
  }
}

/**
 * Get trending searches (top 3 most searched queries globally)
 */
export interface TrendingItem {
  query: string;        // Formatted question/statement for display
  originalQuery?: string; // Original keyword query for search
  count: number;
}

export async function getTrending(): Promise<TrendingItem[]> {
  try {
    const response = await api.get('/trending');
    return response.data.trending || [];
  } catch (error: any) {
    // Silently handle 401 errors (API key missing)
    if (error.response?.status !== 401) {
      console.error('Error fetching trending searches:', error);
    }
    return [];
  }
}

