# Frontend - Next.js Search Interface

Modern React frontend for the i2e search system.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Features

### Landing Page (`/`)
- Centered search bar
- Clean, modern design
- Autocomplete suggestions

### Search Results Page (`/search?query=...`)
- Search bar at top
- Category filter dropdown
- Result cards with:
  - Title with highlighting
  - Description snippet
  - Category tag
  - Visited badge (if clicked before)
  - URL
- Click tracking
- Keyboard navigation support

### Anonymous User Tracking
- UUID stored in localStorage (`i2e_search_uid`)
- Tracks clicked URLs
- Shows "Visited X time ago" badges
- History persists across sessions

## Components

### SearchBar
- Autocomplete with suggestions
- Keyboard navigation (↑↓, Tab, Esc)
- Highlights matches
- Shows visited tags

### Search Results
- Grid layout
- Category filtering
- Click tracking
- Time ago formatting

## Styling

Uses CSS Modules with design system:
- Colors: #000, #FFF, #272727, #008BFF, #04014D, #99D1FF, #EFF7FD
- Fonts: Montserrat (headings), Open Sans (body)
- Shadows: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.20))

## Build for Production

```bash
npm run build
npm start
```

