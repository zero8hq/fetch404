# 🧠 fetch404 — Twitter Scraper-as-a-Function Using GitHub Actions

## 📌 Concept Summary

fetch404 is a headless, serverless backend scraping engine designed specifically to scrape Twitter data from Nitter-based mirror frontends using GitHub Actions. It works entirely as a Node.js backend project that executes Puppeteer-based scraping logic in GitHub runners — no frontend is included.

⚠️ Note: This is not a general-purpose web scraper. This version is purpose-built for scraping Twitter content (via Nitter frontends).

---

## 🎯 What It Does

- Accepts scraping jobs triggered by a fullstack web app (built separately)
- Dispatches each job to GitHub Actions using `repository_dispatch`
- Scrapes data from Nitter instances (Twitter frontends)
- Supports multiple types of scraping (e.g., user tweets, search results)
- Includes fallback logic (round-robin) to switch between Nitter mirrors if one fails
- Sends results back to a callback URL via POST

---

## 💡 Use Case

The system supports scraping:

- A Twitter user's recent tweets
- A particular user's profile metadata
- Tweet search results using keywords or phrases

These are achieved by navigating different Nitter mirror sites with consistent paths:

- `https://<nitter_instance>/<username>` → user tweets/profile
- `https://<nitter_instance>/search?f=tweets&q=query+terms` → tweet search
- `https://<nitter_instance>/search?f=users&q=query+terms` → user search

The scraping is initiated externally (from the frontend web app) and routed through GitHub Actions via your Node.js backend.

---

## 🔁 Mirror Site Fallback Strategy

Because Nitter mirrors are often rate-limited or go offline, fetch404 uses a fallback strategy with round-robin priority. These instances are checked in order:

1. https://nitter.tiekoetter.com/
2. https://nitter.space/
3. https://lightbrd.com/
4. https://nitter.privacyredirect.com/
5. https://nitter.net/
6. https://xcancel.com/

If one instance fails (e.g., page doesn't load, rate-limited, or captcha), the next one is tried automatically. This ensures maximum uptime scraping.

---

## 🧠 System Architecture

### Flow:

1. User submits a scrape request (via a separate frontend web app)
2. That web app sends a call to GitHub’s repository_dispatch API:

```json
POST https://api.github.com/repos/YOUR_USERNAME/fetch404/dispatches

{
  "event_type": "start-scrape",
  "client_payload": {
    "type": "user_tweets", // or 'search_tweets', 'user_profile'
    "params": {
      "username": "elonmusk",
      "limit": 5
    },
    "callback_url": "https://yourdomain.com/webhook"
  }
}
````

3. The GitHub Action runs and executes `router.js`
4. `router.js` routes the job to the right module inside `scrapers/`
5. The scraper performs Puppeteer-based scraping from the current Nitter mirror
6. If failure, router tries the next Nitter instance (up to the last)
7. Once data is scraped, it’s POSTed to the given `callback_url`

---

## 🗂️ Project Structure

fetch404/
├── .github/workflows/scrape.yml     # GitHub Actions runner definition
├── router.js                        # Routes job types to scraper logic
├── scrapers/
│   └── twitter/
│       ├── tweet_search.js          # Scraper for search terms
├── utils/
│   └── getFallbackNitterUrl.js      # Round-robin Nitter URL resolver
├── package.json
├── README.md
└── docs/
    └── idea.md                       # This file

---

## ⚙️ GitHub Actions (scrape.yml)

* Triggered via `repository_dispatch`
* Runs `node router.js <payload>`
* Caches `node_modules` and Puppeteer binaries to speed up runs

---

## 🔐 Auth & Security

* GitHub PAT (Personal Access Token) is used to trigger GitHub Actions securel
* Each scraper type validates incoming params before running

---

## 📈 Scaling Notes

* Supports 20 concurrent jobs (free tier)
* Excess jobs are queued, not dropped
* Caching node\_modules & Puppeteer speeds up executions

---

NOTE: nitter instances are highly bot protected including cloudflair protection — so need to bypass bot protection completely