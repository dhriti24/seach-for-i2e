'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { getSuggestions, Suggestion, getHistory, HistoryItem, getTrending, TrendingItem } from '@/lib/api';
import { getUserId, formatTimeAgo } from '@/lib/utils';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  initialQuery?: string;
  onSuggestionSelect?: (suggestion: Suggestion) => void;
  visitedUrls?: Set<string>;
  isHeader?: boolean;
}

export default function SearchBar({
  initialQuery = '',
  onSuggestionSelect,
  visitedUrls = new Set(),
  isHeader = false,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autocompleteText, setAutocompleteText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clearTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUserTypingRef = useRef(false); // Track if user is manually typing

  // Sync query with URL params when navigating to search page, and clear after results load
  useEffect(() => {
    if (pathname === '/search') {
      // Get query from URL
      const urlQuery = searchParams.get('query') || '';
      
      // Only sync with URL when first arriving at search page (not on every query change)
      // This allows the search to complete before we clear the bar
      if (urlQuery && urlQuery !== query && !isUserTypingRef.current) {
        setQuery(urlQuery);
      }
      
      // Hide suggestions
      setShowSuggestions(false);
      setAutocompleteText('');
      setSuggestions([]);
      setIsFocused(false);
      
      // Clear the search bar AFTER results are shown (delay to allow search to complete)
      // Clear any existing timer first
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
      
      // Only set up auto-clear if user is not typing and URL has a query
      if (!isUserTypingRef.current && urlQuery) {
        const currentQuery = urlQuery; // Use URL query for clearing
        clearTimerRef.current = setTimeout(() => {
          // Only clear if we're still on the search page and user is not typing
          if (pathname === '/search' && !isUserTypingRef.current) {
            setQuery('');
            isUserTypingRef.current = false; // Reset flag after clearing
          }
        }, 2000); // Clear after 2 seconds to ensure search completes and results are shown
      }
      
      return () => {
        if (clearTimerRef.current) {
          clearTimeout(clearTimerRef.current);
        }
      };
    } else {
      // Not on search page - clear any pending timers and reset typing flag
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      isUserTypingRef.current = false;
    }
  }, [pathname, searchParams]); // Only depend on pathname and searchParams, not query

  // Load history and trending searches when component mounts and when focused
  useEffect(() => {
    const loadHistory = async () => {
      const userId = getUserId();
      if (userId) {
        try {
          const historyData = await getHistory(userId);
          // Sort by last_visited (most recent first) and take top items
          const sortedHistory = historyData
            .sort((a, b) => new Date(b.last_visited).getTime() - new Date(a.last_visited).getTime())
            .slice(0, 10); // Keep more for filtering
          setHistory(sortedHistory);
        } catch (error: any) {
          // Only log non-401 errors
          if (error.response?.status !== 401) {
            console.error('[SearchBar] Error loading history:', error);
          }
        }
      }
    };

    const loadTrending = async () => {
      try {
        const trendingData = await getTrending();
        setTrending(trendingData);
      } catch (error: any) {
        // Only log non-401 errors
        if (error.response?.status !== 401) {
          console.error('[SearchBar] Error loading trending searches:', error);
        }
      }
    };

    // Load history and trending when focused (always, regardless of page)
    if (isFocused) {
      loadHistory();
      loadTrending();
    }
  }, [isFocused]);

  useEffect(() => {
    // Don't show suggestions if input is not focused
    if (!isFocused) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
      setAutocompleteText('');
      return;
    }

    // When search bar is focused and empty, show history or trending
    if (isFocused && query.length === 0) {
      // Show history if available, otherwise show trending
      if (history.length > 0) {
        setShowSuggestions(true);
        setSuggestions([]);
      } else if (trending.length > 0) {
        setShowSuggestions(true);
        setSuggestions([]);
      } else {
        setShowSuggestions(false);
        setSuggestions([]);
      }
      setAutocompleteText('');
      return;
    }

    // When user starts typing (from first character), switch to regular autocomplete flow
    if (query.length >= 1 && isFocused) {
      // Clear trending display and show regular suggestions
      setIsLoading(true);
      const timeoutId = setTimeout(async () => {
        // Double-check that input is still focused before showing suggestions
        if (!isFocused || !inputRef.current || document.activeElement !== inputRef.current) {
          setIsLoading(false);
          return;
        }

        try {
          // Get new suggestions
          const results = await getSuggestions(query);
          
          // Check again if still focused before updating state
          if (!isFocused || !inputRef.current || document.activeElement !== inputRef.current) {
            setIsLoading(false);
            return;
          }
          
          setSuggestions(results);
          setIsLoading(false);
          
          // Limit to 4 suggestions total
          const matchingHistory = history
            .filter(item => 
              item.title.toLowerCase().includes(query.toLowerCase()) ||
              item.url.toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, 3);
          
          // Limit suggestions to 4 total (history + new suggestions)
          const limitedSuggestions = results.slice(0, 4 - matchingHistory.length);
          
          if (matchingHistory.length > 0 || limitedSuggestions.length > 0) {
            setShowSuggestions(true);
            setSuggestions(limitedSuggestions);
          } else {
            setShowSuggestions(false);
            setSuggestions([]);
          }
          setSelectedIndex(-1);
          
          // Set autocomplete text from first suggestion
          if (limitedSuggestions.length > 0 && limitedSuggestions[0].title.toLowerCase().startsWith(query.toLowerCase())) {
            const remaining = limitedSuggestions[0].title.substring(query.length);
            setAutocompleteText(query + remaining);
          } else {
            setAutocompleteText('');
          }
        } catch (error) {
          console.error('[SearchBar] Error fetching suggestions:', error);
          setIsLoading(false);
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [query, isFocused, history, trending, pathname]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    // Mark that user is manually typing
    isUserTypingRef.current = true;
    // Reset flag after a delay (user stopped typing)
    setTimeout(() => {
      isUserTypingRef.current = false;
    }, 1000);
  };

  const getAllSuggestions = () => {
    const historyCount = query.length > 0 
      ? history.filter(item => 
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.url.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 3).length
      : (query.length === 0 ? history.slice(0, 3).length : 0);
    const trendingCount = (query.length === 0 && history.length === 0) ? trending.length : 0;
    return historyCount + trendingCount + suggestions.length;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const totalItems = getAllSuggestions();
    const historyCount = query.length > 0 
      ? history.filter(item => 
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.url.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 3).length
      : (query.length === 0 ? history.slice(0, 3).length : 0);
    const trendingCount = (query.length === 0 && history.length === 0) ? trending.length : 0;

    // Handle Enter key - always trigger search if there's a query
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // If a suggestion is selected, use that
      if (selectedIndex >= 0 && selectedIndex < totalItems) {
        if (selectedIndex < historyCount) {
          // History item
          const historyItems = query.length > 0
            ? history.filter(item => 
                item.title.toLowerCase().includes(query.toLowerCase()) ||
                item.url.toLowerCase().includes(query.toLowerCase())
              ).slice(0, 3)
            : history.slice(0, 3);
          const item = historyItems[selectedIndex];
          if (item) {
            // Navigate to search page instead of opening URL directly
            setQuery(item.title);
            setShowSuggestions(false);
            setAutocompleteText('');
            setIsFocused(false);
            router.push(`/search?query=${encodeURIComponent(item.title.trim())}`);
          }
        } else if (selectedIndex < historyCount + trendingCount) {
          // Trending item
          const trendingIndex = selectedIndex - historyCount;
          const trendingItem = trending[trendingIndex];
          if (trendingItem) {
            const searchQuery = trendingItem.originalQuery || trendingItem.query;
            setQuery(searchQuery);
            setShowSuggestions(false);
            setAutocompleteText('');
            setIsFocused(false);
            router.push(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
          }
        } else {
          // New suggestion
          const suggestionIndex = selectedIndex - historyCount - trendingCount;
          if (suggestionIndex >= 0 && suggestionIndex < suggestions.length) {
            handleSuggestionClick(suggestions[suggestionIndex]);
          }
        }
      } else if (query.trim()) {
        // No suggestion selected but there's a query - trigger search
        handleSearch();
        setShowSuggestions(false);
        setAutocompleteText('');
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < totalItems - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Tab':
        e.preventDefault();
        if (autocompleteText && autocompleteText.length > query.length) {
          setQuery(autocompleteText);
          setAutocompleteText('');
        } else if (selectedIndex >= 0 && selectedIndex < totalItems) {
          if (selectedIndex < historyCount) {
            const historyItems = query.length > 0
              ? history.filter(item => 
                  item.title.toLowerCase().includes(query.toLowerCase()) ||
                  item.url.toLowerCase().includes(query.toLowerCase())
                ).slice(0, 3)
              : history.slice(0, 3);
            const item = historyItems[selectedIndex];
            if (item) {
              // Navigate to search page instead of opening URL directly
              setQuery(item.title);
              setShowSuggestions(false);
              setAutocompleteText('');
              setIsFocused(false);
              router.push(`/search?query=${encodeURIComponent(item.title.trim())}`);
            }
          } else if (selectedIndex < historyCount + trendingCount) {
            const trendingIndex = selectedIndex - historyCount;
            const trendingItem = trending[trendingIndex];
            if (trendingItem) {
              const searchQuery = trendingItem.originalQuery || trendingItem.query;
              setQuery(searchQuery);
              setShowSuggestions(false);
              setAutocompleteText('');
              setIsFocused(false);
              router.push(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
            }
          } else {
            const suggestionIndex = selectedIndex - historyCount - trendingCount;
            if (suggestionIndex >= 0 && suggestionIndex < suggestions.length) {
              handleSuggestionClick(suggestions[suggestionIndex]);
            }
          }
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSuggestionClick = async (suggestion: Suggestion, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Update query with suggestion title and navigate to search page
    // No direct redirection - let user click on results page for final navigation
    const searchQuery = suggestion.title || suggestion.url;
    setQuery(searchQuery);
    setShowSuggestions(false);
    setAutocompleteText('');
    setIsFocused(false);
    setSuggestions([]);
    
    // Navigate to search page with the selected query
    router.push(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
    
    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion);
    }
  };
  
  const handleMoreResultsClick = () => {
    setShowSuggestions(false);
    router.push(`/search?query=${encodeURIComponent(query.trim())}`);
  };

  const handleSearch = () => {
    if (query.trim()) {
      setShowSuggestions(false);
      setAutocompleteText('');
      setIsFocused(false);
      setSuggestions([]);
      router.push(`/search?query=${encodeURIComponent(query.trim())}`);
    }
  };


  return (
    <div className={`${styles.searchContainer} ${isHeader ? styles.headerMode : ''}`}>
      <div className={`${styles.searchBar} ${isHeader ? styles.headerSearchBar : ''}`}>
        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsFocused(true);
            }}
            onBlur={(e) => {
              // Don't hide if clicking on suggestions
              const relatedTarget = e.relatedTarget as HTMLElement;
              if (relatedTarget && suggestionsRef.current?.contains(relatedTarget)) {
                return;
              }
              setIsFocused(false);
              // Hide suggestions immediately on blur
              setShowSuggestions(false);
              setAutocompleteText('');
              setSuggestions([]);
            }}
            placeholder={isHeader ? "Search" : "Search..."}
            className={styles.input}
          />
          {autocompleteText && autocompleteText.length > query.length && isFocused && (
            <span className={styles.autocompleteSuggestion}>
              {query}
              <span style={{ color: '#ccc' }}>{autocompleteText.substring(query.length)}</span>
            </span>
          )}
        </div>
        {isHeader ? (
          <button
            onClick={handleSearch}
            className={styles.headerSearchButton}
            aria-label="Search"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 14L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSearch}
            className={styles.searchButton}
            aria-label="Search"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 19L14.65 14.65"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {showSuggestions && (
        <div ref={suggestionsRef} className={styles.suggestions}>
          {/* Trending searches (when query is empty and no history) */}
          {query.length === 0 && history.length === 0 && trending.length > 0 && (
            <>
              {trending.slice(0, 3).map((item, index) => {
                return (
                  <div
                    key={`trending-${index}`}
                    className={`${styles.suggestionItem} ${styles.trendingItem} ${
                      index === selectedIndex ? styles.selected : ''
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Use originalQuery if available (for actual search), otherwise use formatted query
                      const searchQuery = item.originalQuery || item.query;
                      setQuery(searchQuery);
                      setShowSuggestions(false);
                      router.push(`/search?query=${encodeURIComponent(searchQuery)}`);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className={styles.suggestionContent}>
                      <div className={styles.trendingIcon}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M8 2L10.5 6.5L15.5 7.5L12 11L12.5 16L8 13.5L3.5 16L4 11L0.5 7.5L5.5 6.5L8 2Z" fill="currentColor" stroke="currentColor" strokeWidth="0.5"/>
                        </svg>
                      </div>
                      <span className={styles.suggestionTitleOnly}>{item.query}</span>
                      <span className={styles.trendingLabel}>🔥 Trending</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* History items (when query is empty or matches history) */}
          {query.length === 0 && history.length > 0 && (
            <>
              {history.slice(0, 3).map((item, index) => {
                const isVisited = visitedUrls.has(item.url) || history.some(h => h.url === item.url);
                return (
                  <div
                    key={`history-${item.id}`}
                    className={`${styles.suggestionItem} ${styles.historyItem} ${
                      index === selectedIndex ? styles.selected : ''
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Navigate to search page instead of opening URL directly
                      setQuery(item.title);
                      setShowSuggestions(false);
                      setAutocompleteText('');
                      setIsFocused(false);
                      router.push(`/search?query=${encodeURIComponent(item.title.trim())}`);
                      if (onSuggestionSelect) {
                        onSuggestionSelect({
                          id: item.id,
                          url: item.url,
                          title: item.title,
                          description: '',
                          category: item.category || ''
                        });
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className={styles.suggestionContent}>
                      {isVisited ? (
                        <>
                          <div className={styles.timeIcon}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                              <path d="M8 4V8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <span className={styles.suggestionTitleOnly}>{item.title}</span>
                          <span className={styles.historyTime}>
                            Visited {formatTimeAgo(item.last_visited)}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className={styles.suggestionIcon}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M3 2C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V5L10 1H3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M10 1V5H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <span className={styles.suggestionTitleOnly}>{item.title}</span>
                          <span className={styles.readNow}>Read now</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Matching history items when typing - Show exactly 3 visited URLs */}
          {query.length > 0 && history
            .filter(item => {
              // Only show items that are actually visited (in history)
              const matchesQuery = item.title.toLowerCase().includes(query.toLowerCase()) ||
                item.url.toLowerCase().includes(query.toLowerCase());
              return matchesQuery;
            })
            .slice(0, 3)
            .map((item, index) => {
              const isVisited = visitedUrls.has(item.url) || history.some(h => h.url === item.url);
              return (
                <div
                  key={`history-${item.id}`}
                  className={`${styles.suggestionItem} ${styles.historyItem} ${
                    index === selectedIndex ? styles.selected : ''
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Navigate to search page instead of opening URL directly
                    setQuery(item.title);
                    setShowSuggestions(false);
                    setAutocompleteText('');
                    setIsFocused(false);
                    router.push(`/search?query=${encodeURIComponent(item.title.trim())}`);
                    if (onSuggestionSelect) {
                      onSuggestionSelect({
                        id: item.id,
                        url: item.url,
                        title: item.title,
                        description: '',
                        category: item.category || ''
                      });
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className={styles.suggestionContent}>
                    {isVisited ? (
                      <>
                        <div className={styles.timeIcon}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M8 4V8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <span className={styles.suggestionTitleOnly}>
                          {item.title}
                        </span>
                        <span className={styles.historyTime}>
                          Visited {formatTimeAgo(item.last_visited)}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className={styles.suggestionIcon}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M3 2C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V5L10 1H3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M10 1V5H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <span className={styles.suggestionTitleOnly}>
                          {item.title}
                        </span>
                        <span className={styles.readNow}>Read now</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

          {/* New suggestions - Show up to 4 total (including history) */}
          {suggestions
            .filter(suggestion => {
              // Exclude suggestions that are already in visited history
              return !history.some(h => h.url === suggestion.url);
            })
            .slice(0, 4)
            .map((suggestion, index) => {
            const historyCount = query.length > 0 
              ? history.filter(item => 
                  item.title.toLowerCase().includes(query.toLowerCase()) ||
                  item.url.toLowerCase().includes(query.toLowerCase())
                ).slice(0, 3).length
              : 0;
            const actualIndex = historyCount + index;
            const isVisited = visitedUrls.has(suggestion.url);

            return (
              <div
                key={suggestion.id}
                className={`${styles.suggestionItem} ${
                  actualIndex === selectedIndex ? styles.selected : ''
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSuggestionClick(suggestion, e);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onMouseEnter={() => setSelectedIndex(actualIndex)}
              >
                <div className={styles.suggestionContent}>
                  {isVisited ? (
                    <>
                      <div className={styles.timeIcon}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M8 4V8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <span className={styles.suggestionTitleOnly}>
                        {suggestion.title}
                      </span>
                      <span className={styles.historyTime}>
                        {history.find(h => h.url === suggestion.url) 
                          ? `Visited ${formatTimeAgo(history.find(h => h.url === suggestion.url)!.last_visited)}`
                          : 'Visited'}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className={styles.suggestionIcon}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 2C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V5L10 1H3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M10 1V5H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span className={styles.suggestionTitleOnly}>
                        {suggestion.title}
                      </span>
                      <span className={styles.readNow}>Read now</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* "View more results" link */}
          {query.trim().length > 0 && (
            <div 
              className={styles.moreResults}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleMoreResultsClick();
              }}
              onMouseDown={(e) => {
                // Prevent input blur when clicking
                e.preventDefault();
              }}
              onMouseEnter={() => setSelectedIndex(-1)}
            >
              <span className={styles.moreResultsText}>
                View more results for &quot;{query}&quot;
              </span>
              <span className={styles.moreResultsArrow}>→</span>
            </div>
          )}
        </div>
      )}

      {isLoading && showSuggestions && (
        <div className={styles.loading}>Loading...</div>
      )}
    </div>
  );
}

