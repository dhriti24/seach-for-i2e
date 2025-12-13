'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  search,
  logClick,
  getHistory,
  SearchResult,
  HistoryItem,
} from '@/lib/api';
import { getUserId, formatTimeAgo, generateTwoLineSummary } from '@/lib/utils';
import { getCachedResults, cacheResults, clearCacheForQuery } from '@/lib/cache';
import styles from './page.module.css';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'services', label: 'Services' },
  { value: 'technologies', label: 'Technologies' },
  { value: 'solutions', label: 'Solutions' },
  { value: 'partners', label: 'Partners' },
  { value: 'about-us', label: 'About Us' },
  { value: 'people', label: 'Our Experts' },
  { value: 'careers', label: 'Careers' },
  { value: 'blogs', label: 'Blogs' },
  { value: 'case-studies', label: 'Case Studies' },
  { value: 'whitepaper', label: 'Whitepapers' },
  { value: 'webinar', label: 'Webinars' },
  { value: 'news', label: 'News' },
  { value: 'events', label: 'Events' },
  { value: 'landing-page', label: 'Landing Pages' },
];

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('query') || '';
  const categoryParam = searchParams.get('category') || '';
  const categoriesParam = searchParams.get('categories') || ''; // For multiple categories
  const pageParam = parseInt(searchParams.get('page') || '1');

  // Determine which category to use (single category takes precedence)
  const activeCategoryParam = categoryParam || (categoriesParam ? categoriesParam.split(',')[0] : '');
  
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(activeCategoryParam);
  const [multipleCategories, setMultipleCategories] = useState<string[]>(
    categoriesParam ? categoriesParam.split(',') : []
  );
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(pageParam);
  const [totalPages, setTotalPages] = useState(0);
  const [visitedUrls, setVisitedUrls] = useState<Set<string>>(new Set());
  const [visitedDates, setVisitedDates] = useState<Map<string, string>>(
    new Map()
  );
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>(''); // Track last search query for category counts
  const [overview, setOverview] = useState<string | null>(null);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track if this is the first load
  const [showOverview, setShowOverview] = useState(false); // For animation
  const prevSearchRef = useRef<{ query: string; category: string }>({ query: '', category: '' });
  const userId = getUserId();

  useEffect(() => {
    if (userId) {
      loadHistory();
    }
  }, [userId]);

  useEffect(() => {
    // Update current page when URL param changes
    const page = parseInt(searchParams.get('page') || '1');
    setCurrentPage(page);
  }, [searchParams]);

  useEffect(() => {
    // Check if query or category changed (new search) vs just page changed (pagination)
    const prevQuery = prevSearchRef.current.query;
    const prevCategory = prevSearchRef.current.category;
    const currentQuery = query.trim();
    const currentCategory = selectedCategory || '';
    const queryChanged = currentQuery !== prevQuery;
    const categoryChanged = currentCategory !== prevCategory;
    const isNewSearch = queryChanged || categoryChanged;
    
    // If query or category changed, clear cache for old query
    if (isNewSearch && prevQuery) {
      clearCacheForQuery(prevQuery);
      setIsInitialLoad(true);
    }
    
    // Update refs
    prevSearchRef.current = { query: currentQuery, category: currentCategory };
    if (queryChanged) {
      setLastSearchQuery(currentQuery);
    }
    
    // Search if query exists OR if category is selected (for category-only navigation)
    if (query && query.trim().length > 0) {
      performSearch(query, selectedCategory, currentPage, isNewSearch);
    } else if (selectedCategory || multipleCategories.length > 0) {
      // If no query but category is selected, search with empty query to show all items in category
      performSearch('', selectedCategory || multipleCategories[0], currentPage, isNewSearch);
    } else {
      setResults([]);
      setTotal(0);
      setTotalPages(0);
      setIsInitialLoad(false);
    }
  }, [query, selectedCategory, multipleCategories, currentPage]);

  const loadHistory = async () => {
    if (!userId) return;
    
    try {
      const historyData = await getHistory(userId);
      // Sort by last_visited (most recent first)
      const sortedHistory = historyData.sort((a, b) => 
        new Date(b.last_visited).getTime() - new Date(a.last_visited).getTime()
      );
      const urls = new Set(sortedHistory.map((item) => item.url));
      const dates = new Map(
        sortedHistory.map((item) => [item.url, item.last_visited])
      );
      setVisitedUrls(urls);
      setVisitedDates(dates);
      setHistory(sortedHistory);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };


  const performSearch = async (
    searchQuery: string, 
    category: string, 
    page: number = 1,
    isNewSearch: boolean = false
  ) => {
    // Allow empty query if category is specified (for category-only navigation)
    if (!searchQuery.trim() && !category && multipleCategories.length === 0) {
      setResults([]);
      setTotal(0);
      setTotalPages(0);
      setIsInitialLoad(false);
      return;
    }

    // Check cache first (only for pagination, not new searches)
    if (!isNewSearch && !isInitialLoad) {
      const cached = getCachedResults(searchQuery, category, page);
      if (cached) {
        // Filter results by multiple categories if specified
        let filteredResults = cached.results;
        if (multipleCategories.length > 0 && !category) {
          filteredResults = cached.results.filter(result => 
            multipleCategories.includes(result.category)
          );
        }
        
        setResults(filteredResults);
        setTotal(cached.total);
        setTotalPages(cached.totalPages);
        setCategoryCounts(cached.categoryCounts || {});
        
        // Set overview and didYouMean only on first page
        if (page === 1) {
          setOverview(cached.overview || null);
          setDidYouMean(cached.didYouMean || null);
        } else {
          setOverview(null);
          setDidYouMean(null);
        }
        
        setIsInitialLoad(false);
        return; // Return early - no API call needed
      }
    }

    // Show loading only for new searches or when cache miss
    if (isNewSearch || isInitialLoad) {
      setIsLoading(true);
    }
    
    try {
      // Determine which category to use for API call
      let categoryToUse = category;
      if (!categoryToUse && multipleCategories.length > 0) {
        categoryToUse = multipleCategories[0];
      }
      
      // Fetch search results from API (API handles pagination)
      // Pass userId for search query logging
      // For empty query with category, pass empty string (backend handles it)
      const { 
        results: searchResults, 
        total: totalResults, 
        categoryCounts: counts, 
        totalPages: pages,
        overview: aiOverview,
        didYouMean: correction,
        intent
      } = await search(
        searchQuery.trim() || '',
        categoryToUse || undefined,
        page,
        10, // pageSize
        userId || undefined // Pass userId for logging
      );
      
      // Filter results by multiple categories if specified
      let filteredResults = searchResults;
      if (multipleCategories.length > 0 && !category) {
        filteredResults = searchResults.filter(result => 
          multipleCategories.includes(result.category)
        );
      }
      
      // Get ALL matching history items for this query (without category filter)
      // This is used for counting and for "All Categories"
      // If query is empty, get all history items
      const allMatchingHistory = searchQuery.trim() 
        ? history.filter(item => 
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.url.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : history; // If no query, get all history items
      
      // Get matching history items with category filter applied (for display on current page)
      const matchingHistory = allMatchingHistory.filter(item => {
        // Apply category filter if selected
        if (multipleCategories.length > 0) {
          // Filter by multiple categories
          return multipleCategories.includes(item.category || '');
        } else if (category && item.category !== category) {
          return false;
        }
        return true;
      });
      
      // Create a map of visited URLs for quick lookup
      const visitedUrlSet = new Set(allMatchingHistory.map(h => h.url));
      
      // Create a map of Elasticsearch results by URL for quick lookup
      const esResultsByUrl = new Map<string, SearchResult>();
      filteredResults.forEach(result => {
        esResultsByUrl.set(result.url, result);
      });
      
      // Calculate Elasticsearch total first
      const elasticsearchTotal = typeof totalResults === 'object' && totalResults !== null && 'value' in totalResults
        ? (totalResults as { value: number }).value
        : typeof totalResults === 'number'
        ? totalResults
        : 0;
      
      // Get history items that don't appear in Elasticsearch results
      // These are used for counting but NOT added to paginated results
      // (Adding them would break pagination since API already paginated Elasticsearch results)
      const historyOnlyItems: SearchResult[] = matchingHistory
        .filter(item => !esResultsByUrl.has(item.url))
        .map(item => ({
          id: item.id,
          url: item.url,
          title: item.title,
          description: '', // History items don't have description
          content: '', // History items don't have content
          category: item.category || '',
          last_modified: item.last_visited,
          score: 0, // No Elasticsearch score
        }));
      
      // Use Elasticsearch results directly (API handles pagination)
      // History items are counted but not displayed to avoid pagination issues
      const combinedResults = searchResults;
      
      // Category counts should be calculated ONCE for the entire search (not per page)
      // Only recalculate if search query changed
      let updatedCategoryCounts = categoryCounts;
      if (searchQuery !== lastSearchQuery) {
        // New search query - recalculate category counts from API aggregation
        updatedCategoryCounts = { ...(counts || {}) };
        
        // Count ALL history items by category (for accurate category counts across all pages)
        allMatchingHistory.forEach(item => {
          const cat = item.category || '';
          if (!updatedCategoryCounts[cat]) {
            updatedCategoryCounts[cat] = 0;
          }
          updatedCategoryCounts[cat] += 1;
        });
        
        // Calculate total: Elasticsearch total + all unique history items
        // This represents the total across ALL pages, not just current page
        const combinedTotal = elasticsearchTotal + allMatchingHistory.length;
        
        // Set "All Categories" count to combined total
        updatedCategoryCounts[''] = combinedTotal;
        
        setLastSearchQuery(searchQuery);
      }
      
      // Calculate total for display (with category filter if applied)
      // Always use the category count from updatedCategoryCounts to ensure consistency
      // This ensures the "results found" count matches the category filter count
      let combinedTotal: number;
      if (category) {
        // When filtering by category, use the category count (which includes ES + history)
        // Map frontend category to backend category if needed
        const backendCategory = category === 'landing-pages' ? 'landing-page' : category;
        const categoryCount = updatedCategoryCounts[backendCategory] ?? updatedCategoryCounts[category] ?? 0;
        combinedTotal = categoryCount;
      } else {
        // No filter: use "All Categories" count from aggregation (which includes ES + history)
        // This ensures consistency with the category filter dropdown
        combinedTotal = updatedCategoryCounts[''] ?? (elasticsearchTotal + allMatchingHistory.length);
      }
      
      // Calculate total pages based on combined total
      const calculatedTotalPages = Math.ceil(combinedTotal / 10);
      
      // Cache the results
      cacheResults(searchQuery, category, page, {
        results: combinedResults,
        total: combinedTotal,
        categoryCounts: updatedCategoryCounts,
        totalPages: calculatedTotalPages,
        overview: page === 1 ? (aiOverview || null) : null,
        didYouMean: page === 1 ? (correction || null) : null,
        intent: intent || 'search'
      });
      
      // Set results first to prevent flickering/refreshing
      setResults(combinedResults);
      setTotal(combinedTotal);
      setTotalPages(calculatedTotalPages);
      // Category counts remain stable across pages (only recalculate when search query changes)
      // The counts object contains totals for each category, and '' for "All Categories"
      setCategoryCounts(updatedCategoryCounts);
      
      setIsInitialLoad(false);
      setIsLoading(false);
      
      // Set AI overview and corrections AFTER all results are set (only on first page)
      // This prevents the page from refreshing when overview is ready
      if (page === 1) {
        // Use requestAnimationFrame to ensure DOM is updated before showing overview
        requestAnimationFrame(() => {
          setOverview(aiOverview || null);
          setDidYouMean(correction || null);
          setTimeout(() => setShowOverview(true), 50);
        });
      } else {
        // Clear overview on subsequent pages
        setOverview(null);
        setDidYouMean(null);
        setShowOverview(false);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setTotal(0);
      setTotalPages(0);
      setIsInitialLoad(false);
      setIsLoading(false);
      setOverview(null);
      setDidYouMean(null);
      setShowOverview(false);
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategory = e.target.value;
    setSelectedCategory(newCategory);
    const params = new URLSearchParams(searchParams.toString());
    if (newCategory) {
      params.set('category', newCategory);
    } else {
      params.delete('category');
    }
    // Reset to page 1 when category changes
    params.set('page', '1');
    router.push(`/search?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/search?${params.toString()}`);
  };

  const handleResultClick = async (result: SearchResult, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
    }
    
    const now = new Date().toISOString();
    
    // Update local state immediately (optimistic update)
    setVisitedUrls((prev) => new Set(prev).add(result.url));
    setVisitedDates((prev) => {
      const newMap = new Map(prev);
      newMap.set(result.url, now);
      return newMap;
    });

    // Log click with category and keyword for related suggestions
    if (userId) {
      await logClick(
        userId, 
        result.url, 
        result.title
      );
      // Reload history to ensure we have the latest timestamp
      await loadHistory();
    }

    // Open URL in new tab
    window.open(result.url, '_blank');
  };


  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerActions}>
          {query && query.trim().length > 0 && (
            <span className={styles.resultsFor}>
              Showing results for <span>&quot;{query}&quot;</span>
            </span>
          )}
          <div className={styles.headerButtons}>
            <button
              onClick={() => router.push('/history')}
              className={styles.historyButton}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 2C5.58 2 2 5.58 2 10C2 14.42 5.58 18 10 18C14.42 18 18 14.42 18 10C18 5.58 14.42 2 10 2ZM10 16C6.69 16 4 13.31 4 10C4 6.69 6.69 4 10 4C13.31 4 16 6.69 16 10C16 13.31 13.31 16 10 16Z" fill="currentColor"/>
                <path d="M10.5 6H9V11L13.25 13.15L14 11.92L10.5 10.25V6Z" fill="currentColor"/>
              </svg>
              View Search History
            </button>
            <div className={styles.filters}>
              <div className={styles.categoryDropdown}>
                <select
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  className={styles.categorySelect}
                >
                  {CATEGORIES.map((cat) => {
                    // Map frontend category values to backend category values
                    // Backend uses 'landing-page' (singular), frontend uses 'landing-page' now
                    const backendKey = cat.value === 'landing-pages' ? 'landing-page' : cat.value;
                    const count = categoryCounts[backendKey] ?? categoryCounts[cat.value] ?? 0;
                    return (
                      <option key={cat.value} value={cat.value}>
                        {cat.label} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loading}>Searching...</div>
        ) : query && query.trim().length > 0 ? (
          <>
            <div className={styles.resultsHeader}>
              <p className={styles.resultsCount}>
                {total} result{total !== 1 ? 's' : ''} found
                {totalPages > 1 && (
                  <span className={styles.pageInfo}>
                    {' '}(Page {currentPage} of {totalPages})
                  </span>
                )}
              </p>
            </div>
            
            {/* AI Overview */}
            {overview && currentPage === 1 && (
              <div className={`${styles.aiOverview} ${showOverview ? styles.aiOverviewVisible : ''}`}>
                <div className={styles.aiOverviewHeader}>
                  <span className={styles.aiOverviewIcon}>✨</span>
                  <span className={styles.aiOverviewTitle}>AI Overview</span>
                </div>
                <p className={styles.aiOverviewText}>{overview}</p>
              </div>
            )}
            
            {/* Did You Mean */}
            {didYouMean && didYouMean !== query && currentPage === 1 && (
              <div className={styles.didYouMean}>
                <span className={styles.didYouMeanText}>
                  Did you mean:{' '}
                  <button
                    className={styles.didYouMeanLink}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set('query', didYouMean);
                      params.set('page', '1');
                      router.push(`/search?${params.toString()}`);
                    }}
                  >
                    {didYouMean}
                  </button>
                </span>
              </div>
            )}
            
            {results.length > 0 ? (
              <>
                <div className={styles.results}>
                {results.map((result) => {
                  const isVisited = visitedUrls.has(result.url);
                  const visitedDate = visitedDates.get(result.url);
                  return (
                    <div
                      key={result.id}
                      className={styles.resultCard}
                      onClick={(e) => handleResultClick(result, e)}
                    >
                      <div className={styles.resultHeader}>
                        <div className={styles.resultContent}>
                          <h3 className={styles.resultTitle}>
                            {result.title}
                          </h3>
                          <span className={styles.resultUrl}>{result.url}</span>
                          <p className={styles.resultDescription}>
                            {generateTwoLineSummary(result.content || result.description, result.page_description)}
                          </p>
                        </div>
                        <span className={styles.resultCategory}>
                          {result.category}
                        </span>
                      </div>
                      <div className={styles.resultFooter}>
                        {isVisited && visitedDate && (
                          <span className={styles.visitedBadge}>
                            Visited {formatTimeAgo(visitedDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={styles.paginationButton}
                    >
                      ← Previous
                    </button>
                    
                    <div className={styles.paginationNumbers}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                        // Show first page, last page, current page, and pages around current
                        if (
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`${styles.paginationNumber} ${
                                pageNum === currentPage ? styles.paginationNumberActive : ''
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (
                          pageNum === currentPage - 2 ||
                          pageNum === currentPage + 2
                        ) {
                          return (
                            <span key={pageNum} className={styles.paginationEllipsis}>
                              ...
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={styles.paginationButton}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.noResults}>
                {selectedCategory ? (
                  <>
                    <p className={styles.noResultsTitle}>
                      No {CATEGORIES.find(c => c.value === selectedCategory)?.label.toLowerCase() || selectedCategory} found for &quot;{query}&quot;
                    </p>
                    <p className={styles.noResultsHint}>
                      Try selecting a different category or modify your search query
                    </p>
                  </>
                ) : (
                  <>
                    <p className={styles.noResultsTitle}>
                      No results found for &quot;{query}&quot;
                    </p>
                    <p className={styles.noResultsHint}>
                      Try different keywords or check your spelling
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>
            <p>Enter a search query to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

