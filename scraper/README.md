# Scraper Service

Daily sitemap scraper for i2e Consulting website.

## Features

- Fetches robots.txt and parses sitemap URLs recursively
- Extracts metadata (title, description) from each URL
- Infers categories based on URL patterns
- Hash-based change detection
- Updates Strapi and reindexes Elasticsearch only when changes detected
- Runs daily via cron job

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
```
STRAPI_URL=http://localhost:1337
STRAPI_API_KEY=your_strapi_api_key
ELASTICSEARCH_URL=http://localhost:9200
ROBOTS_URL=https://i2econsulting.com/robots.txt
SCRAPE_INTERVAL=0 0 2 * * *  # Daily at 2 AM
```

## Usage

### Run once (for testing):
```bash
npm start
```

### Run with watch (development):
```bash
npm run dev
```

The scraper will:
1. Run immediately on start
2. Schedule daily runs based on `SCRAPE_INTERVAL` cron expression

## Category Inference

The scraper automatically categorizes URLs based on patterns:

- `blogs`: `/blog`, `/blogs`
- `case-studies`: `/case-studies`, `/case-study`, `/case`
- `whitepaper`: `/whitepaper`
- `webinar`: `/webinar`
- `news`: `/news`
- `events`: `/event`, `/events`
- `company`: `/our-partners`, `/careers`, `/jobs`, `/our-people`, `/about-us/india`, `/about-us`
- `landing-pages`: Any URL not matching above patterns

## Change Detection

The scraper uses SHA-256 hashing to detect changes. Only URLs with changed metadata are updated in Strapi and reindexed in Elasticsearch.

