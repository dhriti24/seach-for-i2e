'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getHistory, HistoryItem, logClick } from '@/lib/api';
import { getUserId, formatTimeAgo } from '@/lib/utils';
import styles from './page.module.css';

const ITEMS_PER_PAGE = 10;

export default function HistoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageParam = parseInt(searchParams.get('page') || '1');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visitedUrls, setVisitedUrls] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(pageParam);
  const [totalPages, setTotalPages] = useState(0);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const userId = getUserId();

  const loadHistory = async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const historyData = await getHistory(userId);
      // Sort by last_visited descending (most recent first)
      const sortedHistory = [...historyData].sort((a, b) => 
        new Date(b.last_visited).getTime() - new Date(a.last_visited).getTime()
      );
      setHistory(sortedHistory);
      const urls = new Set(sortedHistory.map((item) => item.url));
      setVisitedUrls(urls);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [userId]);

  useEffect(() => {
    const page = parseInt(searchParams.get('page') || '1');
    setCurrentPage(page);
    const order = (searchParams.get('sort') || 'newest') as 'newest' | 'oldest';
    setSortOrder(order);
  }, [searchParams]);

  useEffect(() => {
    const total = history.length;
    const pages = Math.ceil(total / ITEMS_PER_PAGE);
    setTotalPages(pages);
  }, [history]);

  const getSortedHistory = () => {
    const sorted = [...history];
    if (sortOrder === 'oldest') {
      return sorted.sort((a, b) => 
        new Date(a.last_visited).getTime() - new Date(b.last_visited).getTime()
      );
    } else {
      return sorted.sort((a, b) => 
        new Date(b.last_visited).getTime() - new Date(a.last_visited).getTime()
      );
    }
  };

  const handleHistoryItemClick = async (item: HistoryItem) => {
    const now = new Date().toISOString();
    
    // Update local state immediately (optimistic update)
    setHistory((prev) => 
      prev.map((h) => 
        h.url === item.url 
          ? { ...h, last_visited: now }
          : h
      ).sort((a, b) => 
        new Date(b.last_visited).getTime() - new Date(a.last_visited).getTime()
      )
    );

    // Log click to update backend timestamp
    if (userId) {
      try {
        await logClick(userId, item.url, item.title);
        // Reload history to ensure we have the latest data
        await loadHistory();
      } catch (error) {
        console.error('Error logging click:', error);
      }
    }

    // Open URL in new tab
    window.open(item.url, '_blank');
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/history?${params.toString()}`);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSort = e.target.value as 'newest' | 'oldest';
    setSortOrder(newSort);
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', newSort);
    params.set('page', '1'); // Reset to first page when sorting changes
    router.push(`/history?${params.toString()}`);
  };

  const getPaginatedHistory = () => {
    const sorted = getSortedHistory();
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sorted.slice(startIndex, endIndex);
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Search History</h1>
            <p className={styles.pageDescription}>
              View all pages you've visited through search
            </p>
          </div>
          {!isLoading && history.length > 0 && (
            <div className={styles.topControls}>
              <div className={styles.sortFilter}>
                <select
                  value={sortOrder}
                  onChange={handleSortChange}
                  className={styles.sortSelect}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
              {totalPages > 1 && (
                <div className={styles.paginationTop}>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={styles.paginationButton}
                  >
                    Previous
                  </button>
                  <span className={styles.paginationInfo}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={styles.paginationButton}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor"/>
                <path d="M12.5 7H11V13L16.25 15.15L17 13.92L12.5 12.25V7Z" fill="currentColor"/>
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>No search history yet</h2>
            <p className={styles.emptyDescription}>
              Your visited pages will appear here once you start searching and clicking on results.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.historyList}>
              {getPaginatedHistory().map((item) => (
                <div
                  key={item.id}
                  className={styles.historyItem}
                  onClick={() => handleHistoryItemClick(item)}
                >
                  <div className={styles.historyItemContent}>
                    <h3 className={styles.historyItemTitle}>{item.title}</h3>
                    <p className={styles.historyItemUrl}>{item.url}</p>
                  </div>
                  <div className={styles.historyItemMeta}>
                    {item.category && (
                      <span className={styles.historyItemCategory}>{item.category}</span>
                    )}
                    <div className={styles.historyItemDateWrapper}>
                      <span className={styles.historyItemDate}>
                        {formatTimeAgo(item.last_visited)}
                      </span>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.historyItemArrow}>
                        <path d="M8 4L9.41 5.41L6.83 8H16V10H6.83L9.41 12.59L8 14L3 9L8 4Z" fill="currentColor"/>
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

