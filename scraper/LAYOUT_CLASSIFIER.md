# Layout-Based Category Classifier (Layer 1 Template Matching)

## Overview

The scraper uses **strict Layer 1 HTML template matching** to classify pages into categories. Detection follows a priority order: Sitemap source → HTML markers → Breadcrumbs → Fallback.

## Classification Priority

1. **Sitemap Source** (Highest Priority): News & Events from sitemap names
2. **HTML Markers**: Blog, Case Studies, Webinars, Whitepapers
3. **Breadcrumbs**: Services, Solutions, Technologies, Company
4. **Fallback**: Landing pages

## Category Detection Rules

### 1. Blogs → `"blog"`
Detect based on presence of **ANY** of these HTML patterns:
- Text: "jump to section", "article by", "published on", "min read", "share this article"
- HTML markers: `.blog-author`, `.blog-share`, `.jump-section`, `.read-time`

### 2. Case Studies → `"case-studies"`
Detect based on **ANY** of these:
- Text: "Business Case", "Results", "Client", "Industry", "Duration"
- HTML markers: `.case-study`, `.case-outcome`, `.case-details`

### 3. Webinars → `"webinar"`
Detect based on **ANY** of these:
- Text: "Access webinar on demand", "Watch on demand", "Speakers", "Webinar Agenda"
- HTML markers: `.webinar-banner`, `.speaker-section`

### 4. Whitepapers → `"whitepaper"`
Detect based on **ANY** of these:
- Text: "Download Whitepaper", "Download Now", "Whitepaper"
- HTML markers: `.whitepaper-download`, `.resource-download`
- Presence of gated form (form with download/whitepaper context)

### 5. News & Events → `"news"` or `"event"`
**NO HTML detection required.** Uses sitemap source ONLY:
- If URL from `sitemap-news.xml` → `"news"`
- If URL from `sitemap-event.xml` → `"event"`
- **Takes priority over all HTML detection**

### 6. Services/Solutions/Technologies/Company → Breadcrumb Detection
Pages contain **breadcrumbs in hero banner**:
- Patterns: `<nav class="breadcrumb">`, `<div class="breadcrumb">`, `<div class="banner-breadcrumb">`
- Extract first breadcrumb term → map to:
  - "Services" → `"services"`
  - "Solutions" → `"solutions"`
  - "Technologies" → `"technologies"`
  - "Company" (About, Careers, People, Partners) → `"company"`
  - Anything else → `"landing-page"`

### 7. Fallback → `"landing-page"`
If no identifiable layout markers and no breadcrumb detected

## Update Logic

### Category Change Detection

The scraper tracks category changes and only updates Elasticsearch when:

1. **Content Changed**: Hash comparison detects content/metadata changes
2. **Category Changed**: Layout analysis detects a different category
3. **Missing Data**: Content or images are missing (migration case)

### Elasticsearch Updates

- **Does NOT recreate index**: Only updates individual documents
- **Updates on change**: Only when content or category changes
- **Efficient**: Skips updates when nothing changed

## Usage

The classifier runs automatically during scraping:

```javascript
// Scraping automatically detects category
const metadata = await scrapeMetadata(url);
// metadata.category contains detected category
```

## Benefits

1. **More Accurate**: Based on actual page structure, not URL patterns
2. **Rerunnable**: Only updates when categories change
3. **Efficient**: Doesn't recreate Elasticsearch index
4. **Flexible**: Can handle pages with non-standard URL structures

## Example Output

```
Category changed for https://example.com/blog/post-1: landing-pages -> blogs
Updated https://example.com/blog/post-1 in Elasticsearch (category: blogs)
Scraping complete. Processed: 150, Updated: 45, Category updates: 12
```

