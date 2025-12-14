# Intelligent Search System for i2e Consulting

A full-featured AI-powered search system with intelligent query understanding, autocomplete suggestions, category filtering, and user history tracking. The system uses Strapi CMS as the data source and Elasticsearch for fast, relevant search results.

## 🎥 Demo Video

Watch the demo video to see the system in action: [Demo Video](https://www.youtube.com/watch?v=atnVZQAREjw)

## 🎯 For Hackathon Judges

**Important**: The Strapi database is **already populated with data** in a **shared Neon cloud database**. You will be provided with:
- **Neon Database Connection Details**: Host, Port, Database Name, Username, Password
- **Strapi API Key**: Add this to the `.env` file as `STRAPI_API_KEY`
- **Strapi Admin Credentials**: Username/Email and Password to access Strapi admin panel

**Setup is Simple:**
- ✅ **No local database setup needed** - Connect to shared Neon database
- ✅ **No database dumps/imports** - Data is already in Neon
- ✅ **Just update `.env` file** with provided Neon connection details
- ✅ **Start services** - Strapi will automatically connect to Neon

**Data Collection Method**: 
- To avoid load on the live website (www.i2econsulting.com), all content has been **previously scraped** from the website
- **AI-powered smart summaries** were generated during scraping using Groq AI
- All scraped content and AI summaries are stored in the **shared Neon database**
- The system is ready to use immediately - no live scraping required

**Skip any data entry instructions** - the database is ready to use. Simply follow the installation steps, update `.env` with Neon connection details, and use the provided credentials to access Strapi at http://localhost:1400/admin.

## 🏗️ Architecture

- **Backend**: Strapi CMS (Neon PostgreSQL) + Express.js API + Elasticsearch + Groq AI
- **Frontend**: Next.js 14 + React + TypeScript
- **Data Source**: Strapi CMS database (Neon cloud database)

---

## 🚀 Installation Guide

### Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v18.0.0 to v20.x.x)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version` (should show v18.x.x or v20.x.x)
   - Verify npm: `npm --version` (should show 6.0.0 or higher)

2. **PostgreSQL** - **NOT REQUIRED**
   - The project uses Neon cloud database (shared)
   - No local PostgreSQL installation needed

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

### Step 3: Configure Environment Variables

**⚠️ Important**: You need to create **TWO `.env` files**:

1. **Root `.env` file** (for API server and scraper)
2. **Backend `.env` file** (for Strapi - Groq and Strapi API keys)

**Step 3a: Upload Root `.env` File**

Upload the provided `.env` file from OneDrive to the **root directory** of the project.

If you need to create it manually, use the following template:

```env
# Database Configuration (Neon - Shared Cloud Database)
DATABASE_CLIENT=postgres
DATABASE_HOST=ep-xxxx-xxxx.us-east-2.aws.neon.tech
DATABASE_PORT=5432
DATABASE_NAME=neondb
DATABASE_USERNAME=your_neon_username
DATABASE_PASSWORD=your_neon_password
DATABASE_SSL=true

# Strapi Configuration
STRAPI_URL=http://localhost:1400
STRAPI_API_KEY=your_strapi_api_key_here

# Elasticsearch Configuration
ELASTICSEARCH_URL=http://localhost:9200

# Groq AI Configuration
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# API Server Configuration
API_PORT=3001

# Frontend Configuration (optional, defaults shown)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Step 3b: Upload Backend `.env` File**

**Important**: Strapi reads Groq and Strapi API keys from `backend/.env`. Upload the same `.env` file from OneDrive to the `backend` directory.

If you need to create it manually, use the following template:

```env
# Groq AI Configuration (Required for Strapi)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Strapi API Key (Required)
STRAPI_API_KEY=your_strapi_api_key_here
STRAPI_URL=http://localhost:1400

# Database Configuration (Same as root .env)
DATABASE_CLIENT=postgres
DATABASE_HOST=ep-xxxx-xxxx.us-east-2.aws.neon.tech
DATABASE_PORT=5432
DATABASE_NAME=neondb
DATABASE_USERNAME=your_neon_username
DATABASE_PASSWORD=your_neon_password
DATABASE_SSL=true
```

**Step 3c: Replace Placeholder Values**

In **both** `.env` files, replace the placeholder values:
- **Neon Connection Details**: Replace `DATABASE_HOST`, `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` with values provided
- **Strapi API Key**: Replace `your_strapi_api_key_here` with the API key provided (use same value in both files)
- **Groq API Key**: Replace `your_groq_api_key_here` with your Groq API key (use same value in both files)

**Note**: 
- Root `.env` is used by the API server and scraper
- Backend `.env` is used by Strapi (especially for Groq and Strapi API keys)
- You can copy the same values to both files, or create a symlink if preferred

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

### Step 5: Start All Services

**⚠️ Important**: Start services in this order for proper initialization:

**Terminal 1 - Elasticsearch (START THIS FIRST):**
- Make sure Elasticsearch is running: http://localhost:9200
- If not running, navigate to your Elasticsearch installation directory
- Run: `bin/elasticsearch` (Linux/macOS) or `bin\elasticsearch.bat` (Windows)
- Wait for "started" message in the console
- Verify: Open http://localhost:9200 in browser (should show JSON response)

**Terminal 2 - Strapi Backend:**
```bash
cd backend
npm run develop
```
- Wait for: "Server started" message
- Strapi admin: http://localhost:1400/admin
- **Login**: Use provided Strapi admin credentials
- API: http://localhost:1400/api

**Terminal 3 - Express API Server:**
```bash
cd backend
npm run api
```
- Wait for: "API server running on port 3001"
- **Important**: The API server will automatically:
  - Create Elasticsearch index if it doesn't exist
  - Sync data from Strapi to Elasticsearch
- Look for these messages in the console:
  ```
  [Elasticsearch] ✓ Connection successful
  [Elasticsearch] ✓ Index 'search_items' created successfully
  [Elasticsearch] ✓ Successfully indexed X items
  [Elasticsearch] ✓ Initialization complete
  ```
- API: http://localhost:3001
- Health check: http://localhost:3001/health (should return `{"status":"ok"}`)

**Terminal 4 - Frontend:**
```bash
cd frontend
npm run dev
```
- Wait for: "Ready on http://localhost:3000"
- Frontend: http://localhost:3000

### Step 6: Verify Installation

1. **Check All Services are Running:**
   - Strapi: http://localhost:1400/admin (login page)
   - Express API: http://localhost:3001/health (should return `{"status":"ok"}`)
   - Frontend: http://localhost:3000 (homepage with search bar)
   - Elasticsearch: http://localhost:9200 (JSON response)

2. **Check Elasticsearch Initialization:**
   - Look for initialization messages in the API server console
   - Should see: `[Elasticsearch] ✓ Initialization complete`
   - If you see errors, check that Strapi is running and Elasticsearch is accessible

3. **Test Search:**
   - Open http://localhost:3000
   - Type a search query in the search bar
   - Verify results appear

---

## ⚙️ Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_CLIENT` | Database type | Yes | `postgres` |
| `DATABASE_HOST` | Neon database host | Yes | - |
| `DATABASE_PORT` | Database port | Yes | `5432` |
| `DATABASE_NAME` | Database name | Yes | - |
| `DATABASE_USERNAME` | Database username | Yes | - |
| `DATABASE_PASSWORD` | Database password | Yes | - |
| `DATABASE_SSL` | Enable SSL | Yes | `true` |
| `STRAPI_URL` | Strapi CMS URL | Yes | `http://localhost:1400` |
| `STRAPI_API_KEY` | Strapi API token | Yes | - |
| `ELASTICSEARCH_URL` | Elasticsearch URL | Yes | `http://localhost:9200` |
| `GROQ_API_KEY` | Groq AI API key | Yes | - |
| `GROQ_MODEL` | Groq model name | No | `llama-3.3-70b-versatile` |
| `API_PORT` | Express API port | No | `3001` |
| `NEXT_PUBLIC_API_URL` | Frontend API URL | No | `http://localhost:3001` |

---

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
- **AI Response Caching**: AI responses cached to reduce API calls
- **Lazy Loading**: Components load on demand
- **Optimized Queries**: Efficient Elasticsearch queries

#### 14. **Anonymous User Tracking**
- **UUID-Based**: Each user gets a unique UUID stored in browser localStorage
- **No Personal Data**: No email, name, or personal information collected
- **Privacy-Focused**: Tracks only search queries and clicked URLs
- **Persistent**: User ID persists across sessions

---

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
│   │   └── history/      # History page
│   ├── components/       # React components
│   │   ├── SearchBar.tsx # Main search bar component
│   │   ├── Header.tsx    # Site header
│   │   └── Footer.tsx    # Site footer
│   ├── lib/              # Utility functions
│   │   ├── api.ts        # API client
│   │   ├── cache.ts      # Frontend caching
│   │   └── utils.ts      # Helper functions
│   └── package.json
├── scraper/              # Scraper (not used - data from Strapi)
├── .env                  # Environment variables (create this)
└── README.md             # This file
```

---

## 🚦 Running the Application

### Quick Start (After Initial Setup)

Once you've completed the installation steps, you can start all services:

**1. Start Elasticsearch** (if not already running):
```bash
# Navigate to your Elasticsearch installation directory
bin/elasticsearch  # Linux/macOS
bin\elasticsearch.bat  # Windows
```

**2. Start Strapi Backend:**
```bash
cd backend
npm run develop
```

**3. Start Express API Server:**
```bash
cd backend
npm run api
```

**4. Start Frontend:**
```bash
cd frontend
npm run dev
```

### Development Mode

**Terminal 1 - Elasticsearch:**
- Start Elasticsearch from installation directory
- Verify: http://localhost:9200

**Terminal 2 - Strapi:**
```bash
cd backend
npm run develop
```

**Terminal 3 - Express API:**
```bash
cd backend
npm run api
```

**Terminal 4 - Frontend:**
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

---

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Strapi (1400): Check if Strapi is already running
   - Express API (3001): Check if another process is using port 3001
   - Frontend (3000): Check if another Next.js app is running
   - Elasticsearch (9200): Check if Elasticsearch is already running

2. **Database Connection Error**
   - Verify Neon connection details in `.env` are correct
   - Check `DATABASE_SSL=true` is set
   - Verify Neon project is active and accessible
   - Check internet connection

3. **Elasticsearch Connection Error**
   - Verify Elasticsearch is running: http://localhost:9200
   - Check `ELASTICSEARCH_URL` in `.env`
   - For Elasticsearch 8+, check security settings in `config/elasticsearch.yml`
   - Ensure `bin/elasticsearch` (Linux/macOS) or `bin\elasticsearch.bat` (Windows) has started

4. **Elasticsearch Space/Disk Error**
   - **Error**: "No space left on device" or disk space warnings
   - **Solution**: Move Elasticsearch installation to a drive with more space (e.g., D drive on Windows)
   - **Steps**:
     1. Stop Elasticsearch if it's running
     2. Copy the entire Elasticsearch directory to `D:\elasticsearch` (or another drive with more space)
     3. Update any shortcuts or scripts to point to the new location
     4. Start Elasticsearch from the new location: `D:\elasticsearch\bin\elasticsearch.bat`
     5. Verify it's running: http://localhost:9200
   - **Alternative**: Free up space on the current drive or configure Elasticsearch to use a different data directory

5. **Strapi API Key Issues**
   - Verify API key is correct in `.env` file
   - Check API key in Strapi admin: **Settings** → **API Tokens**
   - Restart Express API server after updating API key

6. **Groq API Errors**
   - Verify API key is correct in `.env`
   - Check API key has credits/quota
   - Verify model name is correct

7. **No Search Results / Elasticsearch Indexing Issues**
   - **Index doesn't exist**: The API server automatically creates the index on startup
   - **Check initialization**: Look for `[Elasticsearch] ✓ Initialization complete` in API server logs
   - **If index creation fails**: 
     - Ensure Elasticsearch is running: http://localhost:9200
     - Ensure Strapi is running and accessible
     - Check that `STRAPI_API_KEY` is set correctly in `.env`
     - Restart the API server - it will retry initialization
   - **If data sync fails**:
     - Verify Strapi has content (search-items)
     - Check content is published in Strapi
     - Verify `STRAPI_API_KEY` is valid
     - Check API server logs for specific error messages
   - **Manual re-sync**: Restart the API server to trigger re-initialization

---

## 📝 Notes

- **No Scraping**: This system does NOT perform web scraping. All data comes from Strapi CMS (Neon database).
- **Data Management**: Add, edit, and delete content through Strapi admin panel.
- **Caching**: AI responses are cached to reduce API costs and improve performance.
- **Anonymous Tracking**: User tracking is anonymous (UUID-based), no personal data collected.
- **Neon Database**: Shared cloud database - no local PostgreSQL needed.

---

## 🤝 Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review server logs for error messages
3. Verify all services are running correctly
4. Check environment variables are set correctly in `.env` file
