# 🔍 fetch404

Twitter scraper-as-a-function using GitHub Actions to bypass bot protection

## Overview

fetch404 is a headless, serverless backend scraping engine designed to scrape Twitter data from Nitter-based mirror frontends using GitHub Actions. It works as a Node.js backend project that executes Puppeteer-based scraping logic in GitHub runners.

## Features

- 🤖 Bypasses bot protection & Cloudflare using advanced stealth techniques
- 🔄 Round-robin fallback between multiple Nitter instances
- 🔌 Supports multiple types of scraping (search tweets, search users)
- 📊 Stores raw HTML and DOM structure for analysis
- 📡 Callback URL support for asynchronous processing

## Usage

### 1. Trigger via GitHub Repository Dispatch API

```shell
curl -X POST \
  -H "Authorization: token YOUR_GITHUB_PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/YOUR_USERNAME/fetch404/dispatches \
  -d '{
    "event_type": "start-scrape",
    "client_payload": {
      "type": "search_tweets",
      "params": {
        "query": "bitcoin",
        "limit": 20
      },
      "callback_url": "https://yourdomain.com/webhook"
    }
  }'
```

### 2. Trigger via GitHub Actions UI

You can manually trigger the workflow from the GitHub Actions tab with the following parameters:
- Type: `search_tweets` or `search_users`
- Query: Search term or username
- Limit: Number of results to fetch (optional)
- Callback URL: Where to send results (optional)

## Available Scraper Types

- `search_tweets`: Search for tweets containing keywords
- `search_users`: Search for Twitter users by keywords
- More coming soon (user_tweets, user_profile)

## Configuration

The scraper uses the following Nitter instances with fallback support:

1. https://nitter.tiekoetter.com/
2. https://nitter.space/
3. https://lightbrd.com/
4. https://nitter.privacyredirect.com/
5. https://nitter.net/
6. https://xcancel.com/

## Development

### Prerequisites

- Node.js 18+
- GitHub account with PAT (Personal Access Token)

### Setup

1. Clone this repository
2. Run `npm install`
3. Test locally with `node router.js --payload '{"type":"search_tweets","params":{"query":"bitcoin"}}'`

## How It Works

1. A request is made to the GitHub repository dispatch API
2. GitHub Actions runs the workflow defined in `.github/workflows/scrape.yml`
3. The `router.js` script processes the request and routes it to the appropriate scraper
4. The scraper uses Puppeteer with stealth plugins to bypass bot detection
5. Results are saved to the `scraped_data` directory and uploaded as artifacts
6. If a callback URL is provided, results are POSTed to that endpoint

## License

MIT