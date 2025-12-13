# Intelligent Search System for i2e Consulting

A full-featured AI-powered search system with intelligent query understanding, autocomplete suggestions, category filtering, and user history tracking. The system uses Strapi CMS as the data source and Elasticsearch for fast, relevant search results.

## 🎯 For Hackathon Judges

**Important**: The Strapi database is **already populated with data**. You will be provided with:
- **Strapi API Key**: Add this to the `.env` file as `STRAPI_API_KEY`
- **Strapi Admin Credentials**: Username/Email and Password to access Strapi admin panel

**Data Collection Method**: 
- To avoid load on the live website (www.i2econsulting.com), all content has been **previously scraped** from the website
- **AI-powered smart summaries** were generated during scraping using Groq AI
- All scraped content and AI summaries are stored in the Strapi database
- The system is ready to use immediately - no live scraping required

**Skip any data entry instructions** - the database is ready to use. Simply follow the installation steps and use the provided credentials to access Strapi at http://localhost:1337/admin.

## 🏗️ Architecture

- **Backend**: Strapi CMS (PostgreSQL) + Express.js API + Elasticsearch + Groq AI
- **Frontend**: Next.js 14 + React + TypeScript
- **Data Source**: Strapi CMS database

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

1. **Node.js** (v18.0.0 to v20.x.x)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version` (should show v18.x.x or v20.x.x)
   - Verify npm: `npm --version` (should show 6.0.0 or higher)

2. **PostgreSQL** (v14 or higher)
   - Download from: https://www.postgresql.org/download/
   - Windows: Use the installer from the official website
   - macOS: `brew install postgresql@14`
   - Linux: `sudo apt-get install postgresql-14` (Ubuntu/Debian)
   - Verify installation: `psql --version`

3. **Elasticsearch** (v8.0 or higher)
   - Download from: https://www.elastic.co/downloads/elasticsearch
   - Extract to a folder (e.g., `C:\elasticsearch` on Windows or `/usr/local/elasticsearch` on Linux/macOS)
   - **Configure Security Settings** (Required for Elasticsearch 8+):
     - Navigate to Elasticsearch config directory: `config/elasticsearch.yml`
     - Open `elasticsearch.yml` in a text editor
     - Add or modify the following settings to disable security:
       ```yaml
       # Disable security features for local development
       xpack.security.enabled: false
       xpack.security.enrollment.enabled: false
       xpack.security.http.ssl.enabled: false
       xpack.security.transport.ssl.enabled: false
       ```
     - Save the file
   - Run: `bin/elasticsearch` (Linux/macOS) or `bin\elasticsearch.bat` (Windows)
   - Verify: Open http://localhost:9200 in browser (should show JSON response)

4. **Git** (optional, for cloning the repository)
   - Download from: https://git-scm.com/downloads

### Required API Keys

1. **Groq API Key** (for AI features)
   - Sign up at: https://console.groq.com/
   - Create an API key from the dashboard
   - Keep this key secure - you'll need it for configuration

2. **Strapi API Key** (for accessing Strapi CMS)
   - Generated after Strapi setup (see Backend Setup section)

## 🚀 Installation Guide

### Step 1: Clone or Download the Project

If you have Git installed:
```bash
git clone <repository-url>
cd "seach for i2e"
```

Or download and extract the project folder to your desired location.

### Step 2: Install Node.js Dependencies

Open a terminal/command prompt in the project root directory and run:

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd frontend
npm install
```

**Note for Windows Users**: If you encounter permission errors, run PowerShell or Command Prompt as Administrator.

### Step 3: Set Up PostgreSQL Database

1. **Start PostgreSQL Service**
   - Windows: Open Services, find "PostgreSQL", and start it
   - macOS/Linux: `sudo service postgresql start` or `brew services start postgresql`

2. **Create Database**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres
   
   # Create database
   CREATE DATABASE i2e_search;
   
   # Exit PostgreSQL
   \q
   ```

3. **Note Database Credentials**
   - Default username: `postgres`
   - Default password: (set during PostgreSQL installation)
   - Database name: `i2e_search`
   - Port: `5432` (default)

### Step 4: Set Up Elasticsearch

1. **Configure Security Settings** (Required for Elasticsearch 8+)
   
   Elasticsearch 8+ has security enabled by default. You need to disable it for local development:
   
   - Navigate to your Elasticsearch installation directory
   - Open the config folder: `config/elasticsearch.yml`
   - Open `elasticsearch.yml` in a text editor (Notepad, VS Code, etc.)
   - Add or modify the following settings at the end of the file:
   
     ```yaml
     # Disable security features for local development
     xpack.security.enabled: false
     xpack.security.enrollment.enabled: false
     xpack.security.http.ssl.enabled: false
     xpack.security.transport.ssl.enabled: false
     ```
   
   - **Save the file**
   - **Important**: Make sure there are no syntax errors (proper indentation, no tabs, use spaces)
   - If the file doesn't exist, create it in the `config` directory

2. **Start Elasticsearch**
   - Navigate to Elasticsearch directory
   - Run: `bin/elasticsearch` (Linux/macOS) or `bin\elasticsearch.bat` (Windows)
   - Wait for "started" message in the console
   - **Note**: If you see security-related errors, double-check the YAML file configuration

3. **Verify Elasticsearch is Running**
   - Open browser: http://localhost:9200
   - You should see a JSON response with cluster information
   - If you see authentication errors, the security settings weren't disabled correctly

### Step 5: Configure Environment Variables

Create a `.env` file in the **root directory** of the project with the following content:

```env
# Database Configuration
DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=i2e_search
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_postgres_password
DATABASE_SSL=false

# Strapi Configuration
STRAPI_URL=http://localhost:1337
STRAPI_API_KEY=your_strapi_api_key_here

# Elasticsearch Configuration
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=

# Groq AI Configuration
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# API Server Configuration
API_PORT=3001

# Frontend Configuration (optional, defaults shown)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Important**: Replace the placeholder values:
- `your_postgres_password`: Your PostgreSQL password
- `your_strapi_api_key_here`: Your Strapi CMS API key
- `your_groq_api_key_here`: Your Groq API key from console.groq.com

### Step 6: Set Up Strapi Backend

**Note**: The Strapi database is already populated with data. You just need to access it using the provided credentials.

1. **Navigate to Backend Directory**
   ```bash
   cd backend
   ```

2. **Start Strapi**
   ```bash
   npm run develop
   ```

3. **Access Strapi Admin Panel**
   - Strapi will open in your browser at http://localhost:1337/admin
   - **Login using the credentials provided:**
     - Email/Username: (as provided)
     - Password: (as provided)

4. **Verify API Key**
   - The Strapi API key has been provided
   - Ensure it's correctly set in your `.env` file as `STRAPI_API_KEY`
   - You can verify the API key in Strapi admin: **Settings** → **API Tokens**

5. **Verify Content**
   - Go to **Content Manager** → **Search Item** in Strapi admin
   - You should see existing search items already populated
   - **No need to add data** - the database is already configured with content

6. **Verify Permissions** (if needed)
   - Go to **Settings** → **Users & Permissions Plugin** → **Roles** → **Public**
   - Ensure permissions are enabled for:
     - `search-item`: `find`, `findOne`
     - `search-log`: `create`, `find`, `findOne`, `update`, `delete`

### Step 7: Start All Services

You'll need **three separate terminal windows**:

**Terminal 1 - Strapi Backend:**
```bash
cd backend
npm run develop
```
- Wait for: "Server started" message
- Strapi admin: http://localhost:1337/admin
- API: http://localhost:1337/api

**Terminal 2 - Express API Server:**
```bash
cd backend
npm run api
```
- Wait for: "API server running on port 3001"
- API: http://localhost:3001

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```
- Wait for: "Ready on http://localhost:3000"
- Frontend: http://localhost:3000

### Step 8: Verify Installation

1. **Check All Services are Running:**
   - Strapi: http://localhost:1337/admin (login page)
   - Express API: http://localhost:3001/health (should return `{"status":"ok"}`)
   - Frontend: http://localhost:3000 (homepage with search bar)
   - Elasticsearch: http://localhost:9200 (JSON response)

2. **Test Search:**
   - Open http://localhost:3000
   - Type a search query in the search bar
   - Verify results appear

## 📊 Data Source

**Important**: This system uses **Strapi CMS as the data source**. All search content comes from the Strapi database. 

### How Data Was Collected

To avoid load on the live website (www.i2econsulting.com), **all content has been previously scraped** from the website and stored in the Strapi database. The scraping process:

1. **Web Scraping**: Content was scraped from www.i2econsulting.com using Playwright and Cheerio
2. **AI-Powered Summarization**: During scraping, AI (Groq) was used to generate smart, meaningful summaries for each page
3. **Data Storage**: All scraped content and AI-generated summaries are stored in Strapi CMS
4. **Ready to Use**: The database is already populated with all content - no live scraping or data entry is required

**The database is already populated with data** - no data entry or web scraping is required. The system is ready to use immediately.

### Accessing Strapi Admin Panel

**For Hackathon Judges**: The Strapi database is pre-populated with all search content. Use the provided credentials to access and view the data.

1. **Login to Strapi Admin**
   - URL: http://localhost:1337/admin
   - **Username/Email**: (as provided)
   - **Password**: (as provided)

2. **View Existing Content**
   - Navigate to **Content Manager** → **Search Item**
   - You'll see all search items already populated in the database
   - **No need to add data** - everything is ready to use

3. **API Key Configuration**
   - The Strapi API key is provided by hackathon organizers
   - Add it to your `.env` file as `STRAPI_API_KEY`
   - This allows the Express API to access Strapi data
   - You can verify/view the API key in Strapi admin: **Settings** → **API Tokens**

### Note

- **Data is pre-populated**: All search content is already in the database
- **Ready to use**: You can start searching immediately after setup
- **No data entry needed**: Skip any instructions about adding content to Strapi

## ✨ Features

### 🔍 Core Search Features

#### 1. **AI-Powered Search**
- **Natural Language Understanding**: Understands queries like "who works at i2e" or "what is SPM"
- **Intent Detection**: Recognizes search intent and extracts keywords
- **Abbreviation Expansion**: Automatically expands pharma abbreviations (SPM → Strategic Portfolio Management)
- **Synonym Recognition**: Understands synonyms (jobs → careers, services → offerings)
- **Spelling Correction**: Suggests corrections for misspelled queries

#### 2. **AI Overview**
- **Smart Summaries**: AI-generated overviews appear at the top of search results
- **Context-Aware**: Understands user intent and provides relevant context
- **Quick Understanding**: Helps users quickly understand what i2e offers related to their query
- **Thought bubble display**: Eye-catching thought bubble draws user attention

#### 3. **Smart Autocomplete**
- **Real-Time Suggestions**: Appears as you type (from first character)
- **AI-Powered**: Suggestions are generated using AI for relevance
- **Limited Display**: Shows maximum 4 suggestions for clean UI
- **Keyboard Navigation**: Use arrow keys (↑↓) to navigate, Enter to select, Tab to autocomplete
- **History Integration**: Shows your search history in suggestions
- **Trending Integration**: Displays trending searches when search bar is empty

#### 4. **Category Filtering**
- **Multiple Categories**: Filter by Services, Technologies, Solutions, Partners, About Us, Careers, People, Blogs, Case Studies, Whitepapers, Webinars, News, Events, Landing Pages
- **Dynamic Counts**: See how many results exist in each category
- **Category Detection**: AI detects category from query (e.g., "blogs about PPM")
- **Smart Filtering**: Only filters specific category when it is explicitly mentioned

#### 5. **Intelligent Ranking**
- **AI-Based Ranking**: Results ranked by AI for relevance to your query
- **Relevance Scoring**: Considers title, content, category match, and user intent
- **Best Results First**: Most relevant results appear at the top

#### 6. **Search Result Features**
- **Rich Result Cards**: Each result shows title, URL, description, and category
- **Visited Badges**: See "Visited X time ago" for pages you've clicked before
- **Click Tracking**: Automatically tracks which results you click
- **Pagination**: Navigate through multiple pages of results
- **Caching**: Smooth pagination without loading delays (results cached)
- **Result Count**: See total number of results found

### 🎯 User Experience Features

#### 7. **Search Bar Tooltips & Hints**
- **Placeholder Text**: "Search..." placeholder guides users
- **Empty State**: When search bar is empty and focused, shows history or trending
- **Visual Feedback**: Search bar highlights when focused

#### 8. **Search History**
- **Automatic Tracking**: Tracks all pages you visit through search
- **History Page**: Dedicated `/history` page to view all visited pages
- **Sort Options**: 
  - **Newest First**: Most recently visited pages first (default)
  - **Oldest First**: Oldest visited pages first
- **Pagination**: Navigate through history with pagination (10 items per page)
- **Time Display**: Shows "X minutes/hours/days ago" for each visit
- **Category Tags**: See category for each history item
- **Quick Access**: Click any history item to open the page
- **Persistent**: History persists across browser sessions

#### 9. **Trending Searches**
- **Global Trends**: See what others are searching for
- **Top 3 Queries**: Displays top 3 most searched queries
- **Auto-Display**: Shows when search bar is empty and you have no history
- **Click to Search**: Click any trending search to perform that search

#### 10. **Did You Mean Suggestions**
- **Spelling Corrections**: Suggests corrections for misspelled queries
- **Smart Detection**: AI detects when you might have meant something else
- **One-Click Fix**: Click suggestion to search with corrected query

#### 11. **Keyboard Shortcuts**
- **Enter**: Submit search or select suggestion
- **Arrow Up/Down**: Navigate through suggestions
- **Tab**: Accept autocomplete suggestion
- **Escape**: Close suggestions dropdown

#### 12. **Responsive Design**
- **Mobile Friendly**: Works on all screen sizes
- **Fixed Header**: Header stays fixed at top when scrolling
- **Modern UI**: Clean, professional design with smooth animations

### 🔧 Technical Features

#### 13. **Performance Optimizations**
- **Result Caching**: Search results cached for 5 minutes (smooth pagination)
- **AI Response Caching**: AI responses cached to reduce API calls:
- **Lazy Loading**: Components load on demand
- **Optimized Queries**: Efficient Elasticsearch queries

#### 14. **Anonymous User Tracking**
- **UUID-Based**: Each user gets a unique UUID stored in browser localStorage
- **No Personal Data**: No email, name, or personal information collected
- **Privacy-Focused**: Tracks only search queries and clicked URLs
- **Persistent**: User ID persists across sessions

## 🗂️ Project Structure

```
.
├── backend/              # Strapi CMS + Express API
│   ├── api/              # Express API server
│   │   ├── server.js     # Main API server
│   │   ├── ai-service.js # AI service (Groq integration)
│   │   └── ai-cache.js   # AI response caching
│   ├── src/              # Strapi source files
│   │   └── api/          # Strapi content types
│   ├── config/           # Strapi configuration
│   └── package.json
├── frontend/             # Next.js frontend
│   ├── app/              # Next.js app directory
│   │   ├── page.tsx      # Homepage
│   │   ├── search/       # Search results page
│   │   └── history/     # History page
│   ├── components/       # React components
│   │   ├── SearchBar.tsx # Main search bar component
│   │   ├── Header.tsx   # Site header
│   │   └── Footer.tsx   # Site footer
│   ├── lib/              # Utility functions
│   │   ├── api.ts        # API client
│   │   ├── cache.ts      # Frontend caching
│   │   └── utils.ts     # Helper functions
│   └── package.json
├── scraper/              # Scraper (not used - data from Strapi)
├── .env                  # Environment variables (create this)
└── README.md             # This file
```

## ⚙️ Configuration

### Environment Variables Reference

All configuration is done through the root `.env` file:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_CLIENT` | Database type | Yes | `postgres` |
| `DATABASE_HOST` | PostgreSQL host | Yes | `localhost` |
| `DATABASE_PORT` | PostgreSQL port | Yes | `5432` |
| `DATABASE_NAME` | Database name | Yes | - |
| `DATABASE_USERNAME` | PostgreSQL username | Yes | `postgres` |
| `DATABASE_PASSWORD` | PostgreSQL password | Yes | - |
| `STRAPI_URL` | Strapi CMS URL | Yes | `http://localhost:1337` |
| `STRAPI_API_KEY` | Strapi API token | Yes | - |
| `ELASTICSEARCH_URL` | Elasticsearch URL | Yes | `http://localhost:9200` |
| `GROQ_API_KEY` | Groq AI API key | Yes | - |
| `GROQ_MODEL` | Groq model name | No | `llama-3.3-70b-versatile` |
| `API_PORT` | Express API port | No | `3001` |
| `NEXT_PUBLIC_API_URL` | Frontend API URL | No | `http://localhost:3001` |

## 🚦 Running the Application

### Development Mode

**Terminal 1 - Strapi:**
```bash
cd backend
npm run develop
```

**Terminal 2 - Express API:**
```bash
cd backend
npm run api
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

### Production Mode

**Build Frontend:**
```bash
cd frontend
npm run build
npm start
```

**Start Strapi:**
```bash
cd backend
npm run build
npm start
```

**Start Express API:**
```bash
cd backend
npm run api
```

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Strapi (1337): Check if Strapi is already running
   - Express API (3001): Check if another process is using port 3001
   - Frontend (3000): Check if another Next.js app is running
   - Elasticsearch (9200): Check if Elasticsearch is already running

2. **Database Connection Error**
   - Verify PostgreSQL is running: `psql -U postgres`
   - Check database credentials in `.env`
   - Ensure database exists: `CREATE DATABASE i2e_search;`

3. **Elasticsearch Connection Error**
   - Verify Elasticsearch is running: http://localhost:9200
   - Check `ELASTICSEARCH_URL` in `.env`
   - For Elasticsearch 8+, check security settings
   - Ensure `bin/elasticsearch` (Linux/macOS) or `bin\elasticsearch.bat` (Windows) has started

4. **Strapi API Key Issues**
   - Regenerate API key in Strapi admin panel
   - Update `.env` file with new key
   - Restart Express API server

5. **Groq API Errors**
   - Verify API key is correct in `.env`
   - Check API key has credits/quota
   - Verify model name is correct

6. **No Search Results**
   - Ensure Strapi has content (search-items)
   - Check content is published in Strapi
   - Verify Elasticsearch has indexed content
   - Check API server logs for errors

## 📝 Notes

- **No Scraping**: This system does NOT perform web scraping. All data comes from Strapi CMS.
- **Data Management**: Add, edit, and delete content through Strapi admin panel.
- **Caching**: AI responses are cached to reduce API costs and improve performance.
- **Anonymous Tracking**: User tracking is anonymous (UUID-based), no personal data collected.

## 🤝 Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review server logs for error messages
3. Verify all services are running correctly
4. Check environment variables are set correctly
