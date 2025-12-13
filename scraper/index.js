// Load environment variables from root .env file
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const cheerio = require('cheerio');
const { chromium } = require('playwright');
const crypto = require('crypto');
const xml2js = require('xml2js');
const { promisify } = require('util');
const parseXML = promisify(xml2js.parseString);

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_KEY = process.env.STRAPI_API_KEY;
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const ROBOTS_URL = process.env.ROBOTS_URL || 'https://i2e-website-dev-nextjs.azurewebsites.net/robots.txt';
const PRODUCTION_DOMAIN = 'i2econsulting.com';
const DEV_DOMAIN = 'i2e-website-dev-nextjs.azurewebsites.net';

/**
 * Normalize URL from dev domain to production domain
 * Scrapes from dev but stores with production URLs
 */
function normalizeUrlToProduction(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  
  try {
    // Replace dev domain with production domain
    let normalizedUrl = url.replace(
      new RegExp(`https?://${DEV_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
      (match) => {
        // Preserve http/https protocol
        return match.replace(DEV_DOMAIN, PRODUCTION_DOMAIN);
      }
    );
    
    // Ensure www prefix for consistency (most production sites use www)
    // This matches what's likely in the database
    if (!normalizedUrl.includes('www.') && normalizedUrl.includes('://')) {
      normalizedUrl = normalizedUrl.replace('://', '://www.');
    }
    
    return normalizedUrl;
  } catch (error) {
    console.error(`Error normalizing URL ${url}:`, error.message);
    return url; // Return original if normalization fails
  }
}


/**
 * Fetch robots.txt and extract sitemap URLs
 */
async function fetchRobotsTxt() {
  try {
    const response = await axios.get(ROBOTS_URL);
    const lines = response.data.split('\n');
    const sitemapUrls = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('sitemap:')) {
        const url = trimmed.substring(8).trim();
        if (url) {
          sitemapUrls.push(url);
        }
      }
    }
    
    return sitemapUrls;
  } catch (error) {
    console.error('Error fetching robots.txt:', error.message);
    throw error;
  }
}

/**
 * Generate summary from page content using text extraction
 * Creates a concise, meaningful 3-line summary (~300 characters)
 */
async function generateSmartSummary(rawPageContent, pageTitle, pageUrl) {
  if (!rawPageContent || rawPageContent.trim().length === 0) {
    return '';
  }

  // Use fallback summary extraction (no AI/LLM)
  return generateFallbackSummary(rawPageContent);
}

/**
 * Summary generation using text extraction
 */
function generateFallbackSummary(fullContent) {
  if (!fullContent || fullContent.trim().length === 0) {
    return '';
  }

  // Extract sentences
  const sentenceRegex = /[^.!?]*[.!?]+(?:\s+|$)/g;
  const sentences = fullContent.match(sentenceRegex) || [];

  if (sentences.length === 0) {
    // No sentences found, return first 300 chars at word boundary
    if (fullContent.length <= 300) {
      return fullContent.trim();
    }
    const truncated = fullContent.substring(0, 300);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 250 
      ? truncated.substring(0, lastSpace).trim() + '...'
      : truncated.trim() + '...';
  }

  // Skip generic introductory sentences
  const meaningfulSentences = sentences.filter(s => {
    const lower = s.toLowerCase().trim();
    return s.length > 30 && 
           s.length < 200 &&
           !lower.startsWith('welcome') &&
           !lower.startsWith('click') &&
           !lower.startsWith('read more') &&
           !lower.match(/^(this|that|these|those)\s+(is|are|was|were)/);
  });

  // Take first 3 meaningful sentences, or first 3 sentences if none filtered
  const selectedSentences = meaningfulSentences.length >= 3 
    ? meaningfulSentences.slice(0, 3)
    : sentences.slice(0, 3);

  const summary = selectedSentences.join(' ').trim();
  
  // Limit to ~300 characters
  if (summary.length > 350) {
    const truncated = summary.substring(0, 350);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 300 
      ? truncated.substring(0, lastSpace).trim() + '...'
      : truncated.trim() + '...';
  }

  return summary;
}

/**
 * NEW Categorization Logic Based on Requirements
 */
function categorizePageNew($, html, url) {
  const urlLower = url.toLowerCase();
  const htmlLower = html.toLowerCase();
  const bodyText = $('body').text().toLowerCase();

  // Get breadcrumb text - handle React-rendered breadcrumbs with custom classes
  const breadcrumbSelectors = [
    'nav.breadcrumb',
    '.breadcrumb',
    '.breadcrumb.opensans-text', // Webinar breadcrumb pattern
    '.banner-breadcrumb',
    '.hero .breadcrumb',
    '.hero-banner .breadcrumb',
    '[class*="breadcrumb"]',
    '[class*="baneerCrumb"]', // Typo version: baneerCrumb
    '[class*="BaneerCrumb"]', // Capitalized typo
    'nav[aria-label*="breadcrumb"]',
    'ol.breadcrumb',
    'ul.breadcrumb',
    // React-rendered patterns: look for spans with crumb classes
    'span[class*="crumb"]',
    'span.baneerCrumb',
    // Look for divs containing breadcrumb structure
    'div:has(span[class*="crumb"])',
    'div:has(a[class*="crumb"])'
  ];

  let breadcrumbText = '';
  let foundSelector = '';
  
  // First, try to find parent container with all breadcrumb spans
  // Look for divs/containers that have multiple spans with baneerCrumb class
  const crumbSpans = $('span[class*="baneerCrumb"], span.baneerCrumb');
  if (crumbSpans.length > 0) {
    // Get the parent container that holds all breadcrumb spans
    const parentContainer = crumbSpans.first().parent();
    if (parentContainer.length > 0) {
      breadcrumbText = parentContainer.text().toLowerCase();
      foundSelector = 'parent of span.baneerCrumb';
    }
  }
  
  // If not found, try standard selectors
  if (!breadcrumbText || breadcrumbText.length === 0) {
    for (const selector of breadcrumbSelectors) {
      try {
        const breadcrumb = $(selector).first();
        if (breadcrumb.length > 0) {
          // Get all text content including nested elements
          breadcrumbText = breadcrumb.text().toLowerCase();
          if (breadcrumbText && breadcrumbText.trim().length > 0) {
            foundSelector = selector;
            break;
          }
        }
      } catch (e) {
        // Skip selectors that don't work (like :has() in older cheerio)
        continue;
      }
    }
  }
  
  // Also try to find breadcrumbs by looking for "Home" links followed by other links
  if (!breadcrumbText || breadcrumbText.length === 0) {
    // Look for links containing "Home" and get siblings
    const homeLinks = $('a').filter((i, el) => {
      const text = $(el).text().toLowerCase().trim();
      return text === 'home' || text.includes('home');
    });
    
    if (homeLinks.length > 0) {
      // Get parent container - try going up multiple levels to find the breadcrumb container
      let parent = homeLinks.first().parent();
      let level = 0;
      while (parent.length > 0 && level < 5) {
        const parentText = parent.text().toLowerCase();
        // Check if parent contains multiple breadcrumb items (Home + something else)
        const links = parent.find('a');
        if (links.length > 1) {
          breadcrumbText = parentText;
          break;
        }
        parent = parent.parent();
        level++;
      }
    }
  }

  // 1. URL-based categorization (highest priority)
  if (urlLower.includes('/event')) {
    return 'events';
  }
  if (urlLower.includes('/webinar')) {
    return 'webinar';
  }
  if (urlLower.includes('/whitepaper')) {
    return 'whitepaper';
  }
  if (urlLower.includes('/case-studies') || urlLower.includes('/case-study')) {
    return 'case-studies';
  }
  if (urlLower.includes('/blog')) {
    return 'blogs';
  }

  // 2. Breadcrumb-based categorization
  if (breadcrumbText) {
    // Check for webinar in breadcrumb (e.g., "Resource Center > Webinar")
    if (breadcrumbText.includes('webinar') || breadcrumbText.includes('resource center')) {
      return 'webinar';
    }
    if (breadcrumbText.includes('services')) {
      return 'services';
    }
    if (breadcrumbText.includes('technology') || breadcrumbText.includes('technologies')) {
      return 'technologies';
    }
    if (breadcrumbText.includes('solutions')) {
      return 'solutions';
    }
    if (breadcrumbText.includes('partners') || breadcrumbText.includes('partner')) {
      return 'partners';
    }
    if (breadcrumbText.includes('careers') || breadcrumbText.includes('jobs')) {
      return 'careers';
    }
    if (breadcrumbText.includes('about us') || breadcrumbText.includes('about-us') || breadcrumbText.includes('about')) {
      return 'about-us';
    }
    if (breadcrumbText.includes('our experts') || breadcrumbText.includes('expert')) {
      return 'people';
    }
    if (breadcrumbText.includes('whitepaper') || breadcrumbText.includes('white paper')) {
      return 'whitepaper';
    }
  }

  // 3. Content marker-based categorization

  // Blogs: Must have BOTH "jump to section" AND "article by"
  const hasJumpToSection = bodyText.includes('jump to section') || htmlLower.includes('jump to section');
  const hasArticleBy = bodyText.includes('article by') || htmlLower.includes('article by');
  if (hasJumpToSection && hasArticleBy) {
    return 'blogs';
  }

  // Case Studies: Must have ALL: client && industry && duration && business case
  const hasClient = bodyText.includes('client') || htmlLower.includes('client');
  const hasIndustry = bodyText.includes('industry') || htmlLower.includes('industry');
  const hasDuration = bodyText.includes('duration') || htmlLower.includes('duration');
  const hasBusinessCase = bodyText.includes('business case') || htmlLower.includes('business case');
  if (hasClient && hasIndustry && hasDuration && hasBusinessCase) {
    return 'case-studies';
  }

  // Whitepaper: Breadcrumb has whitepaper OR tag in banner is whitepaper
  const bannerSelectors = ['.hero', '.hero-banner', '.banner', '[class*="banner"]', '[class*="hero"]'];
  for (const selector of bannerSelectors) {
    const banner = $(selector).first();
    if (banner.length > 0) {
      const bannerText = banner.text().toLowerCase();
      if (bannerText.includes('whitepaper')) {
        return 'whitepaper';
      }
    }
  }

  // Webinar: Tag "completed webinar" in banner/content
  const hasCompletedWebinar = bodyText.includes('completed webinar') || htmlLower.includes('completed webinar');
  if (hasCompletedWebinar) {
    return 'webinar';
  }

  // Default fallback
  return 'landing-page';
}

/**
 * STEP 2: Extract category from breadcrumb
 * Returns second breadcrumb (first after "Home") or null if no breadcrumb found
 */
function getCategoryFromBreadcrumb($) {
  // Look for breadcrumbs in various locations - handle React-rendered breadcrumbs
  const breadcrumbSelectors = [
    'nav.breadcrumb',
    '.breadcrumb',
    '.breadcrumb.opensans-text', // Webinar breadcrumb pattern
    '.banner-breadcrumb',
    '.hero .breadcrumb',
    '.hero-banner .breadcrumb',
    '[class*="breadcrumb"]',
    '[class*="baneerCrumb"]', // Typo version: baneerCrumb
    '[class*="BaneerCrumb"]', // Capitalized typo
    'nav[aria-label*="breadcrumb"]',
    'ol.breadcrumb',
    'ul.breadcrumb',
    // React-rendered patterns: look for spans with crumb classes
    'span[class*="crumb"]',
    'span.baneerCrumb',
    // Look for containers with breadcrumb-like structure
    'div:has(span[class*="crumb"])',
    'div:has(a[class*="crumb"])'
  ];
  
  for (const selector of breadcrumbSelectors) {
    const breadcrumb = $(selector).first();
    if (breadcrumb.length > 0) {
      // First, try to get breadcrumb items from structured lists (<li> elements)
      const listItems = breadcrumb.find('li');
      if (listItems.length > 0) {
        // Find "Home" and get the next item
        for (let i = 0; i < listItems.length; i++) {
          const itemText = listItems.eq(i).text().trim().toLowerCase();
          if (itemText.includes('home') && i < listItems.length - 1) {
            // Get the next item after Home
            const nextItem = listItems.eq(i + 1);
            const nextItemText = nextItem.text().trim();
            // Remove any separators or icons
            const cleanText = nextItemText.replace(/[›>\|→\/\s]+/g, ' ').trim();
            if (cleanText.length > 0 && !cleanText.toLowerCase().includes('home')) {
              return cleanText;
            }
          }
        }
        // If Home not found but we have items, get the second item (assuming first is Home)
        if (listItems.length > 1) {
          const secondItem = listItems.eq(1);
          const secondItemText = secondItem.text().trim();
          const cleanText = secondItemText.replace(/[›>\|→\/\s]+/g, ' ').trim();
          if (cleanText.length > 0 && !cleanText.toLowerCase().includes('home')) {
            return cleanText;
          }
        }
      }
      
      // Also check for links/anchors (more reliable)
      const links = breadcrumb.find('a');
      if (links.length > 0) {
        // Find "Home" link and get the next link
        for (let i = 0; i < links.length; i++) {
          const linkText = links.eq(i).text().trim().toLowerCase();
          if (linkText.includes('home') && i < links.length - 1) {
            // Get the next link after Home
            const nextLink = links.eq(i + 1);
            const nextLinkText = nextLink.text().trim();
            if (nextLinkText.length > 0) {
              return nextLinkText;
            }
          }
        }
        // If Home not found but we have links, get the second link (assuming first is Home)
        if (links.length > 1) {
          const secondLink = links.eq(1);
          const secondLinkText = secondLink.text().trim();
          if (secondLinkText.length > 0 && !secondLinkText.toLowerCase().includes('home')) {
            return secondLinkText;
          }
        }
      }
      
      // Check for spans with crumb classes (React-rendered breadcrumbs)
      const crumbSpans = breadcrumb.find('span[class*="crumb"], span.baneerCrumb');
      if (crumbSpans.length > 0) {
        // Find spans containing links or text
        const crumbTexts = [];
        crumbSpans.each((i, el) => {
          const span = $(el);
          const link = span.find('a').first();
          if (link.length > 0) {
            const linkText = link.text().trim();
            if (linkText && linkText.toLowerCase() !== 'home') {
              crumbTexts.push(linkText);
            }
          } else {
            const spanText = span.text().trim();
            // Remove separators like ›
            const cleanSpanText = spanText.replace(/[›>\|→\/\s]+/g, ' ').trim();
            if (cleanSpanText && cleanSpanText.toLowerCase() !== 'home') {
              crumbTexts.push(cleanSpanText);
            }
          }
        });
        
        // Get the first non-Home breadcrumb
        for (const text of crumbTexts) {
          const cleanText = text.replace(/[›>\|→\/\s]+/g, ' ').trim();
          if (cleanText.length > 0 && !cleanText.toLowerCase().includes('home')) {
            return cleanText;
          }
        }
      }
      
      // Fallback: Get text content and parse
      const text = breadcrumb.text().trim();
      // Split by common separators: ›, >, /, |, →
      const parts = text.split(/[›>\|→\/]/).map(p => p.trim()).filter(p => p.length > 0 && !p.toLowerCase().includes('home'));
      
      // Get the second part (first after Home)
      if (parts.length > 0) {
        // If first part is Home, get second; otherwise get first
        const firstPart = parts[0].toLowerCase();
        if (firstPart.includes('home') && parts.length > 1) {
          return parts[1];
        } else if (!firstPart.includes('home')) {
          return parts[0];
        }
      }
    }
  }
  
  return null;
}

/**
 * Check if breadcrumb contains "webinar" anywhere
 */
function breadcrumbContainsWebinar($) {
  const breadcrumbSelectors = [
    'nav.breadcrumb',
    '.breadcrumb',
    '.breadcrumb.opensans-text', // Webinar breadcrumb pattern
    '.banner-breadcrumb',
    '.hero .breadcrumb',
    '.hero-banner .breadcrumb',
    '[class*="breadcrumb"]',
    '[class*="baneerCrumb"]', // Typo version
    'nav[aria-label*="breadcrumb"]',
    'ol.breadcrumb',
    'ul.breadcrumb',
    'span[class*="crumb"]',
    'span.baneerCrumb'
  ];
  
  for (const selector of breadcrumbSelectors) {
    try {
      const breadcrumb = $(selector).first();
      if (breadcrumb.length > 0) {
        const breadcrumbText = breadcrumb.text().toLowerCase();
        // Check if "webinar" or "resource center" appears anywhere in the breadcrumb
        if (breadcrumbText.includes('webinar') || breadcrumbText.includes('resource center')) {
          return true;
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  return false;
}

/**
 * Map breadcrumb term to category
 */
function mapBreadcrumbToCategory(breadcrumbTerm) {
  if (!breadcrumbTerm) return null;
  
  const term = breadcrumbTerm.toLowerCase();
  
  // Check for webinar first (highest priority)
  if (term.includes('webinar')) {
    return 'webinar';
  }
  
  if (term.includes('career')) {
    return 'careers';
  }
  if (term.includes('partner')) {
    return 'partners';
  }
  if (term.includes('expert')) {
    return 'our-experts';
  }
  if (term.includes('about')) {
    return 'about-us';
  }
  if (term.includes('technolog')) {
    return 'technologies';
  }
  if (term.includes('solution')) {
    return 'solutions';
  }
  if (term.includes('service')) {
    return 'services';
  }
  
  return null;
}

/**
 * STEP 3: Detect category from page layout
 * For pages without breadcrumbs (old blog, case study, webinar, whitepaper)
 */
function getCategoryFromLayout($, html) {
  const htmlLower = html.toLowerCase();
  const bodyText = $('body').text().toLowerCase();
  
  // PRIORITY 1: Check hero banner for "Completed Webinar" (exact match)
  const heroSelectors = [
    '.hero',
    '.hero-banner',
    '.banner',
    '[class*="hero"]',
    '[class*="banner"]',
    'header .hero',
    'header .banner',
    'section.hero',
    'section.banner',
    '.page-header',
    '.header-banner'
  ];
  
  for (const selector of heroSelectors) {
    const hero = $(selector).first();
    if (hero.length > 0) {
      const heroText = hero.text();
      // Check for exact phrase "Completed Webinar" (case-insensitive, word boundaries)
      if (heroText.match(/\bCompleted Webinar\b/i)) {
        return 'webinar';
      }
    }
  }
  
  // Also check HTML content directly for "Completed Webinar" in case hero selector doesn't match
  if (htmlLower.match(/\bcompleted webinar\b/i)) {
    return 'webinar';
  }
  
  // PRIORITY 2: Check for "related content" anywhere on page (exact match)
  // This indicates a blog page
  if (bodyText.match(/\brelated content\b/i) || htmlLower.match(/\brelated content\b/i)) {
    return 'blogs';
  }
  
  // Case Study: client & industry & duration & Business case & results
  const caseStudyMarkers = [
    bodyText.includes('client'),
    bodyText.includes('industry'),
    bodyText.includes('duration'),
    bodyText.includes('business case'),
    bodyText.includes('results')
  ];
  if (caseStudyMarkers.filter(Boolean).length >= 4) {
    return 'case-studies';
  }
  
  // Blog: article by & jump to section & share option (all three required)
  const hasArticleBy = bodyText.includes('article by');
  const hasJumpToSection = bodyText.includes('jump to section');
  const hasShareOption = (
    $('.share').length > 0 || 
    $('[class*="share"]').length > 0 || 
    $('a[href*="facebook"]').length > 0 || 
    $('a[href*="twitter"]').length > 0 ||
    $('a[href*="linkedin"]').length > 0 ||
    $('a[href*="share"]').length > 0 ||
    bodyText.includes('share this') ||
    bodyText.includes('share article')
  );
  
  if (hasArticleBy && hasJumpToSection && hasShareOption) {
    return 'blogs';
  }
  
  // Whitepaper: download now or download whitepaper
  const whitepaperMarkers = [
    bodyText.includes('download now'),
    bodyText.includes('download whitepaper')
  ];
  if (whitepaperMarkers.some(Boolean)) {
    return 'whitepaper';
  }
  
  // Webinar: gated form with button "watch now"
  const webinarMarkers = [
    $('form').length > 0,
    ($('button').text().toLowerCase().includes('watch now') ||
     $('input[type="submit"]').val()?.toLowerCase().includes('watch now') ||
     bodyText.includes('watch now'))
  ];
  if (webinarMarkers.every(Boolean)) {
    return 'webinar';
  }
  
  return null;
}

/**
 * Main categorization function with priority order:
 * STEP 1: Sitemap-based categorization
 * STEP 2: Breadcrumb-based categorization (for static pages)
 * STEP 3: Layout-based categorization (for pages without breadcrumbs)
 */
function categorizePage($, html, sitemapSource) {
  try {
    // STEP 1: Check sitemap source
    const sitemapCategory = getCategoryFromSitemap(sitemapSource);
    if (sitemapCategory && sitemapCategory !== 'static') {
      return sitemapCategory;
    }
    
    // STEP 2: For static pages or unknown sitemaps, check breadcrumbs
    // FIRST: Check if breadcrumb contains "webinar" anywhere (special case)
    if (breadcrumbContainsWebinar($)) {
      return 'webinar';
    }
    
    const breadcrumbTerm = getCategoryFromBreadcrumb($);
    if (breadcrumbTerm) {
      const breadcrumbCategory = mapBreadcrumbToCategory(breadcrumbTerm);
      if (breadcrumbCategory) {
        return breadcrumbCategory;
      }
    }
    
    // STEP 3: If no breadcrumb, check layout (old blog, case study, webinar, whitepaper)
    const layoutCategory = getCategoryFromLayout($, html);
    if (layoutCategory) {
      return layoutCategory;
    }
    
    // Fallback: landing-page
    return 'landing-page';
  } catch (error) {
    console.error(`Error categorizing page:`, error.message);
    return 'landing-page'; // Fallback on error
  }
}

/**
 * Parse sitemap XML recursively
 * Tracks sitemap source for category detection
 */
async function parseSitemap(sitemapUrl, visited = new Set(), parentSitemap = null) {
  if (visited.has(sitemapUrl)) {
    return [];
  }
  visited.add(sitemapUrl);
  
  // Use current sitemap URL as source, or inherit from parent
  const sitemapSource = sitemapUrl || parentSitemap;
  
  try {
    const response = await axios.get(sitemapUrl, {
      headers: {
        'User-Agent': 'i2e-scraper/1.0'
      }
    });
    
    const result = await parseXML(response.data);
    const urls = [];
    
    // Handle sitemap index (contains other sitemaps)
    if (result.sitemapindex && result.sitemapindex.sitemap) {
      const sitemaps = Array.isArray(result.sitemapindex.sitemap) 
        ? result.sitemapindex.sitemap 
        : [result.sitemapindex.sitemap];
      
      for (const sitemap of sitemaps) {
        const loc = sitemap.loc[0];
        // Pass current sitemap URL as parent for nested sitemaps
        const nestedUrls = await parseSitemap(loc, visited, sitemapUrl);
        urls.push(...nestedUrls);
      }
    }
    
    // Handle urlset (contains actual URLs)
    if (result.urlset && result.urlset.url) {
      const urlEntries = Array.isArray(result.urlset.url) 
        ? result.urlset.url 
        : [result.urlset.url];
      
      for (const entry of urlEntries) {
        const originalUrl = entry.loc[0];
        const normalizedUrl = normalizeUrlToProduction(originalUrl);
        const lastmod = entry.lastmod ? entry.lastmod[0] : null;
        // Include both original (for scraping) and normalized (for storage) URLs
        // Include sitemap source with each URL for category detection
        urls.push({ 
          url: originalUrl,           // Use original dev URL for scraping
          normalizedUrl: normalizedUrl, // Use normalized production URL for storage
          lastmod, 
          sitemapSource: sitemapSource 
        });
      }
    }
    
    return urls;
  } catch (error) {
    console.error(`Error parsing sitemap ${sitemapUrl}:`, error.message);
    return [];
  }
}

/**
 * Scrape metadata, full page content, and detect category from a URL using Playwright
 */
async function scrapeMetadata(url, sitemapSource) {
  let browser = null;
  try {
    // Launch browser
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
      userAgent: 'i2e-scraper/1.0'
    });
    const page = await context.newPage();

    // Navigate to page and wait for content to load
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Wait a bit for JavaScript to render content
    await page.waitForTimeout(2000);

    // Get page HTML after JavaScript execution
    const html = await page.content();
    const $ = cheerio.load(html);

    // Extract meta title
    const title = await page.evaluate(() => {
      return document.querySelector('meta[property="og:title"]')?.content ||
             document.querySelector('title')?.textContent?.trim() ||
             '';
    });

    // Extract meta description
    const description = await page.evaluate(() => {
      return document.querySelector('meta[name="description"]')?.content ||
             document.querySelector('meta[property="og:description"]')?.content ||
             '';
    });

    // Extract RAW page text content for summary (no markers, just pure text)
    const rawPageContent = await page.evaluate(() => {
      // Clone body to avoid modifying the original
      const bodyClone = document.body.cloneNode(true);
      
      // Remove unwanted elements (scripts, styles, navigation, footer, header)
      const unwantedSelectors = [
        'script', 'style', 'nav', 'footer', 'header', 
        'aside', '.sidebar', '.menu', '.navigation',
        '.cookie-banner', '.cookie-consent', '[class*="cookie"]',
        '[id*="cookie"]', '.skip-link', '.sr-only',
        'button', '[role="button"]', '.btn', '.button'
      ];
      
      unwantedSelectors.forEach(selector => {
        try {
          bodyClone.querySelectorAll(selector).forEach(el => el.remove());
        } catch (e) {
          // Ignore errors
        }
      });

      // Extract main content area first (most relevant)
      const mainContent = bodyClone.querySelector('main, article, .content, .main-content, #main-content, [role="main"]');
      let textContent = '';
      
      if (mainContent) {
        textContent = mainContent.textContent || '';
      } else {
        // Fallback to body if no main content area
        textContent = bodyClone.textContent || '';
      }
      
      // Clean up the text: remove extra whitespace, normalize newlines
      return textContent
        .replace(/\s+/g, ' ') // Replace all whitespace with single space
        .replace(/\n+/g, '\n') // Normalize newlines
        .trim();
    });

    // Extract FULL page content (all details) for page_description field (with structured markers)
    const pageDescription = await page.evaluate(() => {
      // Clone body to avoid modifying the original
      const bodyClone = document.body.cloneNode(true);
      
      // Remove unwanted elements (scripts, styles, navigation, footer, header)
      const unwantedSelectors = [
        'script', 'style', 'nav', 'footer', 'header', 
        'aside', '.sidebar', '.menu', '.navigation',
        '.cookie-banner', '.cookie-consent', '[class*="cookie"]',
        '[id*="cookie"]', '.skip-link', '.sr-only'
      ];
      
      unwantedSelectors.forEach(selector => {
        try {
          bodyClone.querySelectorAll(selector).forEach(el => el.remove());
        } catch (e) {
          // Ignore errors
        }
      });

      // Extract structured content from the page
      const contentParts = [];
      
      // Extract headings with hierarchy
      const headings = bodyClone.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach(heading => {
        const text = heading.textContent?.trim();
        if (text && text.length > 0) {
          const level = heading.tagName.match(/\d/)?.[0] || '1';
          contentParts.push(`[H${level}] ${text}`);
        }
      });
      
      // Extract paragraphs
      const paragraphs = bodyClone.querySelectorAll('p');
      paragraphs.forEach(p => {
        const text = p.textContent?.trim();
        if (text && text.length > 10) { // Only meaningful paragraphs
          contentParts.push(text);
        }
      });
      
      // Extract list items
      const listItems = bodyClone.querySelectorAll('li');
      listItems.forEach(li => {
        const text = li.textContent?.trim();
        if (text && text.length > 5) {
          contentParts.push(`• ${text}`);
        }
      });
      
      // Extract content from main content areas (if not already captured)
      const mainContent = bodyClone.querySelector('main, article, .content, .main-content, #main-content');
      if (mainContent) {
        const mainText = mainContent.textContent?.trim();
        if (mainText && mainText.length > 100) {
          // If we don't have much content yet, use main content
          if (contentParts.length < 5) {
            const mainParagraphs = mainText.split(/\n+/).filter(p => p.trim().length > 20);
            contentParts.push(...mainParagraphs);
          }
        }
      }
      
      // Fallback: if still not enough content, get all text from body
      if (contentParts.length < 3) {
        const allText = bodyClone.textContent?.trim();
        if (allText && allText.length > 100) {
          // Split into sentences/paragraphs
          const sentences = allText.split(/[.!?]+\s+/).filter(s => s.trim().length > 20);
          contentParts.push(...sentences.slice(0, 20)); // Limit to first 20 sentences
        }
      }
      
      // Join all content parts with newlines for readability
      return contentParts.join('\n\n').trim();
    });

    // Generate summary using RAW page content (not pageDescription)
    const content = await generateSmartSummary(rawPageContent, title, url);

    // Categorize page using new logic (use normalized URL for categorization if needed)
    // Note: We use the original scrape URL for categorization as content is from dev
    const category = categorizePageNew($, html, url);

    // Images removed - not storing images anymore

    await browser.close();

    return {
      title: title.substring(0, 500),
      description: description.substring(0, 1000),
      content: content,
      page_description: pageDescription, // Full page content with all details
      category: category || 'landing-page'
    };
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error(`Error scraping ${url}:`, error.message);
    return {
      title: '',
      description: '',
      content: '',
      page_description: '',
      category: 'landing-page'
    };
  }
}

/**
 * Generate hash for change detection
 */
function generateHash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

/**
 * Check if item exists in Strapi and compare hash
 * Checks both www and non-www versions, and handles trailing slash variations
 */
async function checkExistingItem(url) {
  try {
    // Normalize URL for comparison (remove trailing slash, handle www)
    const normalizeForCheck = (u) => {
      if (!u) return '';
      return u.replace(/\/$/, '').toLowerCase(); // Remove trailing slash and lowercase
    };
    
    const normalizedUrl = normalizeForCheck(url);
    
    // Try exact match first
    let response = await axios.get(`${STRAPI_URL}/api/search-items`, {
      params: {
        'filters[url][$eq]': url
      },
      headers: {
        'Authorization': `Bearer ${STRAPI_API_KEY}`
      }
    });
    
    if (response.data.data && response.data.data.length > 0) {
      return response.data.data[0];
    }
    
    // Try with www prefix if not present
    if (!url.includes('www.')) {
      const urlWithWww = url.replace('https://', 'https://www.').replace('http://', 'http://www.');
      response = await axios.get(`${STRAPI_URL}/api/search-items`, {
        params: {
          'filters[url][$eq]': urlWithWww
        },
        headers: {
          'Authorization': `Bearer ${STRAPI_API_KEY}`
        }
      });
      
      if (response.data.data && response.data.data.length > 0) {
        return response.data.data[0];
      }
    }
    
    // Try without www prefix if present
    if (url.includes('www.')) {
      const urlWithoutWww = url.replace('www.', '');
      response = await axios.get(`${STRAPI_URL}/api/search-items`, {
        params: {
          'filters[url][$eq]': urlWithoutWww
        },
        headers: {
          'Authorization': `Bearer ${STRAPI_API_KEY}`
        }
      });
      
      if (response.data.data && response.data.data.length > 0) {
        return response.data.data[0];
      }
    }
    
    // Try with/without trailing slash
    const urlWithSlash = url.endsWith('/') ? url : url + '/';
    const urlWithoutSlash = url.endsWith('/') ? url.slice(0, -1) : url;
    
    for (const testUrl of [urlWithSlash, urlWithoutSlash]) {
      if (testUrl === url) continue; // Already checked
      
      response = await axios.get(`${STRAPI_URL}/api/search-items`, {
        params: {
          'filters[url][$eq]': testUrl
        },
        headers: {
          'Authorization': `Bearer ${STRAPI_API_KEY}`
        }
      });
      
      if (response.data.data && response.data.data.length > 0) {
        return response.data.data[0];
      }
    }
    
    return null;
  } catch (error) {
    // 404 means endpoint doesn't exist (content type not published) or Strapi not running
    // Don't log as error, just return null
    if (error.response && error.response.status === 404) {
      return null;
    }
    console.error(`Error checking existing item for ${url}:`, error.response?.status || error.message);
    return null;
  }
}

/**
 * Create or update item in Strapi
 */
async function upsertStrapiItem(itemData, existingItem) {
  const hash = generateHash({
    url: itemData.url,
    title: itemData.title,
    description: itemData.description,
    content: itemData.content || '',
    page_description: itemData.page_description || '',
    last_modified: itemData.last_modified
  });
  
  const payload = {
    data: {
      url: itemData.url,
      title: itemData.title,
      description: itemData.description,
      content: itemData.content || '',
      page_description: itemData.page_description || '', // Full page content
      category: itemData.category || '',
      last_modified: itemData.last_modified || new Date().toISOString()
    }
  };
  
  try {
    if (existingItem) {
      // Check if hash changed
      const existingContent = existingItem.attributes.content || '';
      const existingPageDescription = existingItem.attributes.page_description || '';
      const existingCategory = existingItem.attributes.category || '';
      const hasContent = itemData.content && itemData.content.length > 0;
      const hasPageDescription = itemData.page_description && itemData.page_description.length > 0;
      const missingContent = !existingContent && hasContent;
      const missingPageDescription = !existingPageDescription && hasPageDescription;
      
      const existingHash = generateHash({
        url: existingItem.attributes.url,
        title: existingItem.attributes.title,
        description: existingItem.attributes.description,
        content: existingContent,
        page_description: existingPageDescription,
        last_modified: existingItem.attributes.last_modified
      });
      
      // Check if category changed
      const categoryChanged = existingCategory !== itemData.category;
      
      // Force update if page_description or content (summary) is missing
      // This ensures all items get the new fields populated with summaries
      const needsPageDescriptionUpdate = !existingPageDescription && hasPageDescription;
      const needsContentUpdate = !existingContent && hasContent;
      
      if (hash === existingHash && !missingContent && !missingPageDescription && !categoryChanged && !needsPageDescriptionUpdate && !needsContentUpdate) {
        return { updated: false, item: existingItem };
      }
      
      // If fields need updating, log it
      if ((needsPageDescriptionUpdate || needsContentUpdate) && hash === existingHash && !categoryChanged) {
        if (needsPageDescriptionUpdate) {
        }
        if (needsContentUpdate) {
        }
      }
      
      // Update existing item
      const response = await axios.put(
        `${STRAPI_URL}/api/search-items/${existingItem.id}`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${STRAPI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return { updated: true, item: response.data.data };
    } else {
      // Skip creation - only update existing items
      return { updated: false, item: null };
    }
  } catch (error) {
    // 405 means method not allowed - content type might not be published or API not configured
    // 404 means endpoint doesn't exist
    if (error.response) {
      if (error.response.status === 404 || error.response.status === 405) {
        console.error(`Error upserting item ${itemData.url}: Strapi API not available (${error.response.status}). Make sure Strapi is running and content types are published.`);
      } else {
        console.error(`Error upserting item ${itemData.url}: ${error.response.status} - ${error.response.statusText}`);
      }
    } else {
      console.error(`Error upserting item ${itemData.url}:`, error.message);
    }
    throw error;
  }
}

/**
 * Update full document in Elasticsearch (for description/content updates)
 */
async function updateElasticsearchFullDocument(item) {
  try {
    const doc = {
      url: item.attributes.url,
      title: item.attributes.title,
      description: item.attributes.description || '',
      content: item.attributes.content || '',
      page_description: item.attributes.page_description || '',
      category: item.attributes.category || '',
      last_modified: item.attributes.last_modified
    };
    
    await axios.put(
      `${ELASTICSEARCH_URL}/search_items/_doc/${item.id}`,
      doc,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
  } catch (error) {
    if (error.response && error.response.status === 404) {
      // Index might not exist
      try {
        await createElasticsearchIndex();
        // Retry creating document
        await updateElasticsearchFullDocument(item);
      } catch (createError) {
        console.error(`Error creating document for ${item.attributes.url}:`, createError.message);
      }
    } else {
      console.error(`Error updating document for ${item.attributes.url}:`, error.message);
    }
  }
}

/**
 * Update only category field in Elasticsearch (partial update)
 */
async function updateElasticsearchCategory(item) {
  try {
    // Use update API to only update the category field
    await axios.post(
      `${ELASTICSEARCH_URL}/search_items/_update/${item.id}`,
      {
        doc: {
          category: item.attributes.category || ''
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
  } catch (error) {
    if (error.response && error.response.status === 404) {
      // Document doesn't exist, create full document instead
      await updateElasticsearchFullDocument(item);
    } else {
      console.error(`Error updating category for ${item.attributes.url}:`, error.message);
    }
  }
}

/**
 * Create Elasticsearch index with mapping
 */
async function createElasticsearchIndex() {
  try {
    // First, test Elasticsearch connection
    try {
      await axios.get(ELASTICSEARCH_URL, { timeout: 5000 });
    } catch (connError) {
      console.error('Cannot connect to Elasticsearch at', ELASTICSEARCH_URL);
      console.error('Make sure Elasticsearch is running and accessible');
      if (connError.code === 'ECONNREFUSED') {
        console.error('Connection refused - Elasticsearch might not be running');
      } else if (connError.code === 'ENOTFOUND') {
        console.error('Host not found - check ELASTICSEARCH_URL in .env');
      } else if (connError.response && connError.response.status === 401) {
        console.error('Authentication required - check Elasticsearch security settings');
      }
      throw new Error('Elasticsearch connection failed');
    }
    
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
      }
    };
    
    const response = await axios.put(`${ELASTICSEARCH_URL}/search_items`, mapping, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      validateStatus: function (status) {
        return status < 500; // Don't throw for 4xx errors
      }
    });
    
    if (response.status === 200) {
    } else if (response.status === 400) {
      if (response.data && response.data.error) {
      }
    } else {
      console.warn(`⚠ Unexpected status ${response.status} when creating index`);
      if (response.data) {
        console.warn('  Response:', JSON.stringify(response.data, null, 2));
      }
    }
  } catch (error) {
    if (error.response) {
      console.error('✗ Error creating Elasticsearch index:', error.response.status, error.response.statusText);
      if (error.response.data) {
        console.error('  Details:', JSON.stringify(error.response.data, null, 2));
      }
    } else if (error.request) {
      console.error('✗ Error creating Elasticsearch index: No response from Elasticsearch');
      console.error('  Make sure Elasticsearch is running at', ELASTICSEARCH_URL);
    } else {
      console.error('✗ Error creating Elasticsearch index:', error.message);
    }
    // Don't throw - allow scraper to continue (index might already exist)
  }
}

/**
 * Main scraping function
 */
async function runScraper() {
  
  try {
    // Create Elasticsearch index if it doesn't exist
    await createElasticsearchIndex();
    
    // Fetch robots.txt and get sitemap URLs
    const sitemapUrls = await fetchRobotsTxt();
    
    if (sitemapUrls.length === 0) {
      return;
    }
    
    // Parse all sitemaps recursively
    const allUrls = [];
    for (const sitemapUrl of sitemapUrls) {
      const urls = await parseSitemap(sitemapUrl);
      allUrls.push(...urls);
    }
    
    
    // Process each URL
    let processed = 0;
    let updated = 0;
    let categoryUpdates = 0;
    
    for (const urlEntry of allUrls) {
      try {
        // Use normalized production URL for database operations
        const storageUrl = urlEntry.normalizedUrl || normalizeUrlToProduction(urlEntry.url);
        const scrapeUrl = urlEntry.url; // Use original dev URL for scraping
        
        // Debug: Log what we're checking
        
        // Check if item exists (using production URL)
        const existingItem = await checkExistingItem(storageUrl);
        
        if (existingItem) {
        } else {
        }
        
        // Scrape metadata and categorize using original dev URL
        const metadata = await scrapeMetadata(scrapeUrl, urlEntry.sitemapSource);
        
        const itemData = {
          url: storageUrl, // Store with production URL
          title: metadata.title,
          description: metadata.description,
          content: metadata.content || '',
          page_description: metadata.page_description || '', // Full page content
          category: metadata.category || 'landing-page',
          last_modified: urlEntry.lastmod || new Date().toISOString()
        };
        
        // Check if category changed
        const existingCategory = existingItem?.attributes?.category || '';
        const categoryChanged = existingItem && existingCategory !== itemData.category;
        
        
        // Special handling for webinar category from breadcrumb - update Elasticsearch directly
        if (itemData.category === 'webinar') {
          
          if (categoryChanged || !existingItem) {
            // Update Elasticsearch directly for webinar category
            if (existingItem) {
              // Update existing document in Elasticsearch
              const tempItem = {
                id: existingItem.id,
                attributes: {
                  ...existingItem.attributes,
                  category: 'webinar'
                }
              };
              await updateElasticsearchCategory(tempItem);
              categoryUpdates++;
            } else {
              // Skip - item doesn't exist (update-only mode)
            }
          } else {
          }
        } else {
          // For other categories, use normal flow
          // Upsert to Strapi (will update if category changed or content changed)
          const result = await upsertStrapiItem(itemData, existingItem);
          
          // Track if we need to update Elasticsearch category
          let shouldUpdateESCategory = false;
          
          // Always update Elasticsearch if category changed
          if (categoryChanged) {
            categoryUpdates++;
            shouldUpdateESCategory = true;
          }
          
          // Update Elasticsearch if category changed
          if (shouldUpdateESCategory) {
            // Update category in Elasticsearch (use result.item if available, otherwise existingItem)
            const itemToUpdate = result.item || existingItem;
            if (itemToUpdate) {
              // Ensure the item has the correct category before updating ES
              if (!itemToUpdate.attributes) {
                itemToUpdate.attributes = {};
              }
              itemToUpdate.attributes.category = itemData.category;
              await updateElasticsearchCategory(itemToUpdate);
            } else {
              console.warn(`⚠ Could not update Elasticsearch for ${storageUrl}: No item available`);
            }
          }
          
          // Track content updates
          if (result.updated) {
            updated++;
            // Update full Elasticsearch document if Strapi was updated
            if (result.item) {
              await updateElasticsearchFullDocument(result.item);
            }
          } else {
            // Check if page_description or content (summary) was missing and needs to be updated
            // This handles the case where hash matches but fields are missing
            const existingPageDesc = existingItem?.attributes?.page_description || '';
            const existingContent = existingItem?.attributes?.content || '';
            const newPageDesc = itemData.page_description || '';
            const newContent = itemData.content || '';
            
            const needsPageDescUpdate = !existingPageDesc && newPageDesc;
            const needsContentUpdate = !existingContent && newContent;
            
            if (needsPageDescUpdate || needsContentUpdate) {
              // Force update Strapi with missing fields
              const updatePayload = {
                data: {}
              };
              
              if (needsPageDescUpdate) {
                updatePayload.data.page_description = newPageDesc;
              }
              if (needsContentUpdate) {
                updatePayload.data.content = newContent;
              }
              
              try {
                const updateResponse = await axios.put(
                  `${STRAPI_URL}/api/search-items/${existingItem.id}`,
                  updatePayload,
                  {
                    headers: {
                      'Authorization': `Bearer ${STRAPI_API_KEY}`,
                      'Content-Type': 'application/json'
                    }
                  }
                );
                // Update Elasticsearch with the new fields
                if (updateResponse.data.data) {
                  await updateElasticsearchFullDocument(updateResponse.data.data);
                  updated++;
                }
              } catch (updateError) {
                console.error(`Error updating fields for ${storageUrl}:`, updateError.message);
              }
            }
          }
        }
        
        processed++;
        
        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (processed % 10 === 0) {
        }
      } catch (error) {
        console.error(`Error processing ${urlEntry.url}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('Scraper error:', error.message);
    throw error;
  }
}

// Run scraper immediately on start (for testing)
if (require.main === module) {
  runScraper().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Scraper failed:', error);
    process.exit(1);
  });
}

// Scraper runs manually only - no automatic scheduling
// To run the scraper, execute: node scraper/index.js
// Or use: npm start (if configured in package.json)

// Keep process alive
process.on('SIGINT', () => {
  process.exit(0);
});

