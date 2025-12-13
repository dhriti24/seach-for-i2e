'use client';

import { useEffect, useState } from 'react';
import { getUserId, getHistory } from '@/lib/utils';
import { HistoryItem } from '@/lib/api';
import styles from './page.module.css';

export default function Home() {
  const [visitedUrls, setVisitedUrls] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const userId = getUserId();
    if (userId) {
      loadHistory(userId);
    }
  }, []);

  const loadHistory = async (userId: string) => {
    const { getHistory } = await import('@/lib/api');
    const historyData = await getHistory(userId);
    setHistory(historyData);
    const urls = new Set(historyData.map((item) => item.url));
    setVisitedUrls(urls);
  };

  // Highlighting features (main search capabilities)
  const highlightingFeatures = [
    {
      title: 'AI-Powered Search',
      description: 'Our search engine uses advanced AI to understand your intent and provide accurate results. It handles natural language queries, abbreviations, synonyms, and even spelling errors.',
      examples: [
        'who works at i2e',
        'what is SPM'
      ]
    },
    {
      title: 'AI Overview',
      description: 'Get instant AI-generated summaries at the top of your search results that explain what i2e Consulting offers related to your query. This helps you quickly understand the context before diving into specific results.',
      examples: [
        'SPM solutions',
        'clinical data management services'
      ]
    },
    {
      title: 'Smart Autocomplete',
      description: 'Get real-time suggestions as you type, powered by AI. The autocomplete learns from your search patterns and suggests relevant queries to help you find what you need faster.',
      examples: [
        'Type "SPM" to see suggestions',
        'Type "clinical" for related queries'
      ]
    },
    {
      title: 'Category Filtering',
      description: 'Filter search results by content type including blogs, case studies, whitepapers, webinars, services, technologies, and more. Find exactly the type of content you need.',
      examples: [
        'blogs related to PPM',
        'case studies about oncology'
      ]
    },
    {
      title: 'Intelligent Ranking',
      description: 'Search results are intelligently ranked by AI based on relevance to your query. The most relevant results appear first, saving you time.',
      examples: [
        'portfolio management solutions',
        'Planisware implementation'
      ]
    },
    {
      title: 'Pharma Domain Expertise',
      description: 'The search engine understands pharmaceutical industry terminology, abbreviations (SPM, CDM, CRO, EDC, CTMS), and related concepts to provide accurate results.',
      examples: [
        'SPM solutions',
        'CDM services'
      ]
    }
  ];

  // Helping features (supporting features)
  const helpingFeatures = [
    {
      title: 'Search History',
      description: 'Access your previously searched queries and visited pages. Your search history helps you quickly return to content you\'ve viewed before.',
      examples: [
        'Click search bar when empty',
        'Visit History page for full list'
      ]
    },
    {
      title: 'Trending Searches',
      description: 'Discover what others are searching for. Trending searches help you find popular topics and content that might be relevant to your interests.',
      examples: [
        'View trending when search bar is empty',
        'Click any trending search to explore'
      ]
    },
    {
      title: 'Did You Mean',
      description: 'If you make a spelling mistake or use an uncommon term, the AI suggests corrections to help you find what you\'re looking for.',
      examples: [
        'Type "clincal" → suggests "clinical"',
        'Type "portfolo" → suggests "portfolio"'
      ]
    }
  ];

  const features = [...highlightingFeatures, ...helpingFeatures];

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h2 className={styles.featuresTitle}>Features</h2>
        <div className={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div key={index} className={styles.featureCard}>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDescription}>{feature.description}</p>
              <div className={styles.howToUse}>
                <h4 className={styles.howToUseTitle}>Type:</h4>
                <ol className={styles.examplesList}>
                  {feature.examples.map((example, idx) => (
                    <li key={idx} className={styles.exampleItem}>{example}</li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
