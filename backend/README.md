# Backend - Strapi + Express API

Backend service combining Strapi CMS with Express.js API for search functionality.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the backend directory:

```env
HOST=0.0.0.0
PORT=1337

DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=i2e_search
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_SSL=false

JWT_SECRET=your-jwt-secret-here
ADMIN_JWT_SECRET=your-admin-jwt-secret-here
API_TOKEN_SALT=your-api-token-salt-here
TRANSFER_TOKEN_SALT=your-transfer-token-salt-here
APP_KEYS=key1,key2,key3,key4

ELASTICSEARCH_URL=http://localhost:9200
STRAPI_URL=http://localhost:1337
STRAPI_API_KEY=your-strapi-api-key-here
API_PORT=3001
```

### 3. Database Setup

Ensure PostgreSQL is running and create the database:

```sql
CREATE DATABASE i2e_search;
```

### 4. Start Strapi

```bash
npm run develop
```

On first run, Strapi will:
1. Create an admin user (you'll be prompted)
2. Set up the database schema based on content types

### 5. Create API Token

1. Go to Settings > API Tokens in Strapi admin
2. Create a new API token with Full access
3. Copy the token and add it to `.env` as `STRAPI_API_KEY`

### 6. Start Express API Server

In a separate terminal:

```bash
npm run api
```

The API will run on port 3001 (or `API_PORT` from `.env`).

## API Endpoints

### GET /suggest?q=query
Get autocomplete suggestions (max 4 results)

### GET /search?q=query&category=category
Full search with optional category filter

### POST /log/search
Log a search query
```json
{
  "user_id": "uuid",
  "query": "search term"
}
```

### POST /log/click
Log a click and update last_visited
```json
{
  "user_id": "uuid",
  "url": "https://...",
  "title": "Page Title"
}
```

### GET /history?user_id=uuid
Get user's click history

### DELETE /history?user_id=uuid
Clear user's click history

## Content Types

### search-items
- url (string, unique)
- title (string)
- description (text)
- last_modified (datetime)
- category (string)

### search-logs
- user_id (string)
- url (string)
- title (string)
- clicked (boolean)
- last_visited (datetime)
- query (string)
- timestamp (datetime)

