/**
 * Twitter User Tweets Scraper for fetch404
 * Scrapes user tweets from Nitter instances with fallback support from utils file
 * making sure top level bot detection is bypassed including cloudflare protection
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { getFallbackNitterUrl } = require('../../utils/getFallbackNitterUrl');

// Add stealth plugin to bypass detection
puppeteer.use(StealthPlugin());

/**
 * Extract tweet data from HTML elements
 * @param {Object} page - Puppeteer page object
 * @param {Set<string>} seenTweetIds - Set of already seen tweet IDs to avoid duplicates
 * @returns {Promise<Array>} - Array of structured tweet data
 */
async function extractTweetData(page, seenTweetIds = new Set()) {
  return await page.evaluate((alreadySeenIds) => {
    const tweets = [];
    const tweetElements = document.querySelectorAll('.timeline-item');
    const seenIds = new Set(alreadySeenIds);
    
    tweetElements.forEach(tweetElem => {
      try {
        // Skip "Load more" elements that appear as timeline items
        if (tweetElem.querySelector('.show-more')) return;
        
        // Get tweet link and extract ID
        const tweetLinkElem = tweetElem.querySelector('.tweet-link');
        const tweetUrl = tweetLinkElem ? tweetLinkElem.getAttribute('href') : null;
        
        // Skip tweets without a valid URL
        if (!tweetUrl) return;
        
        const tweetId = tweetUrl ? tweetUrl.split('/status/')[1]?.split('#')[0] : null;
        
        // Skip tweets without a valid ID
        if (!tweetId) return;
        
        // Skip tweets we've already seen
        if (seenIds.has(tweetId)) return;
        
        // Mark this tweet as seen
        seenIds.add(tweetId);
        
        // Get author info
        const fullnameElem = tweetElem.querySelector('.fullname');
        const usernameElem = tweetElem.querySelector('.username');
        
        // Skip tweets without author info
        if (!fullnameElem || !usernameElem) return;
        
        // Get retweet info if present
        const retweetHeaderElem = tweetElem.querySelector('.retweet-header');
        const isRetweet = !!retweetHeaderElem;
        const retweetedBy = isRetweet ? 
          retweetHeaderElem.textContent.replace('retweeted', '').trim() : null;
          
        // Get tweet content
        const contentElem = tweetElem.querySelector('.tweet-content');
        const content = contentElem ? contentElem.textContent.trim() : null;
        
        // Get tweet date
        const dateElem = tweetElem.querySelector('.tweet-date a');
        const dateText = dateElem ? dateElem.textContent.trim() : null;
        const dateTitle = dateElem ? dateElem.getAttribute('title') : null;
        
        // Get tweet stats
        const commentElem = tweetElem.querySelector('.tweet-stat:nth-child(1)');
        const retweetElem = tweetElem.querySelector('.tweet-stat:nth-child(2)');
        const quoteElem = tweetElem.querySelector('.tweet-stat:nth-child(3)');
        const likeElem = tweetElem.querySelector('.tweet-stat:nth-child(4)');
        
        const commentCount = commentElem ? commentElem.textContent.trim() : '0';
        const retweetCount = retweetElem ? retweetElem.textContent.trim() : '0';
        const quoteCount = quoteElem ? quoteElem.textContent.trim() : '0';
        const likeCount = likeElem ? likeElem.textContent.trim() : '0';
        
        // Get media attachments
        const mediaElements = tweetElem.querySelectorAll('.attachments .attachment');
        const media = Array.from(mediaElements).map(mediaElem => {
          const isVideo = mediaElem.classList.contains('video-container');
          let url = null;
          
          if (isVideo) {
            const img = mediaElem.querySelector('img');
            url = img ? img.getAttribute('src') : null;
            return { type: 'video', url };
          } else {
            const img = mediaElem.querySelector('img');
            url = img ? img.getAttribute('src') : null;
            return { type: 'image', url };
          }
        });
        
        // Get quoted tweet if present
        let quotedTweet = null;
        const quotedElem = tweetElem.querySelector('.quote-big');
        
        if (quotedElem) {
          const quoteLink = quotedElem.querySelector('.quote-link');
          const quoteUrl = quoteLink ? quoteLink.getAttribute('href') : null;
          const quoteId = quoteUrl ? quoteUrl.split('/status/')[1]?.split('#')[0] : null;
          
          const quoteFullnameElem = quotedElem.querySelector('.fullname');
          const quoteUsernameElem = quotedElem.querySelector('.username');
          const quoteContentElem = quotedElem.querySelector('.quote-text');
          
          quotedTweet = {
            id: quoteId,
            url: quoteUrl ? `https://x.com${quoteUrl}` : null,
            username: quoteUsernameElem ? quoteUsernameElem.textContent.trim() : null,
            fullname: quoteFullnameElem ? quoteFullnameElem.textContent.trim() : null,
            content: quoteContentElem ? quoteContentElem.textContent.trim() : null,
          };
        }
        
        // Create tweet object with all extracted data
        const tweet = {
          id: tweetId,
          url: `https://x.com${tweetUrl}`,
          username: usernameElem ? usernameElem.textContent.trim() : null,
          fullname: fullnameElem ? fullnameElem.textContent.trim() : null,
          verified: !!fullnameElem?.querySelector('.verified-icon'),
          isRetweet,
          retweetedBy,
          content,
          date: {
            text: dateText,
            full: dateTitle
          },
          stats: {
            comments: commentCount,
            retweets: retweetCount,
            quotes: quoteCount,
            likes: likeCount
          },
          media: media.length > 0 ? media : null,
          quotedTweet: quotedTweet
        };
        
        tweets.push(tweet);
      } catch (err) {
        // Silently ignore errors
      }
    });
    
    return tweets;
  }, Array.from(seenTweetIds));
}

/**
 * Gets the content of a "Show more" button if available
 * @param {Object} page - Puppeteer page object
 * @returns {Promise<{exists: boolean, selector: string|null, isBottom: boolean}>} - Show more button information
 */
async function getShowMoreButton(page) {
  return await page.evaluate(() => {
    // First look for the show more button at the bottom
    const bottomShowMore = document.querySelector('.show-more:not(.timeline-item)');
    if (bottomShowMore) {
      return { exists: true, selector: '.show-more:not(.timeline-item)', isBottom: true };
    }
    
    // Alternative show more buttons (may exist in different Nitter instances)
    const timelineShowMore = document.querySelector('.timeline > .show-more');
    if (timelineShowMore) {
      return { exists: true, selector: '.timeline > .show-more', isBottom: true };
    }
    
    const moreResults = document.querySelector('.more-results');
    if (moreResults) {
      return { exists: true, selector: '.more-results', isBottom: true };
    }
    
    // No show more button found
    return { exists: false, selector: null, isBottom: false };
  });
}

/**
 * Click "Show more" button if available and wait for more content to load
 * @param {Object} page - Puppeteer page object
 * @returns {Promise<boolean>} - Whether a "Show more" button was found and clicked
 */
async function clickShowMoreButton(page) {
  try {
    // Wait for any potential "show more" button to appear
    await page.waitForTimeout(1000);
    
    // Check for show more button
    const showMoreInfo = await getShowMoreButton(page);
    
    if (showMoreInfo.exists && showMoreInfo.selector) {
      // Get the current number of tweets for comparison later
      const beforeCount = await page.evaluate(() => 
        document.querySelectorAll('.timeline-item:not(.show-more)').length
      );
      
      // Click the button using different methods to ensure it works
      try {
        // Method 1: Direct click
        await page.click(showMoreInfo.selector);
      } catch (e) {
        // Method 2: Evaluate click
        await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          if (element) element.click();
        }, showMoreInfo.selector);
      }
      
      // Wait for network activity to settle and DOM changes to occur
      await page.waitForTimeout(1000);
      await Promise.race([
        page.waitForNetworkIdle({ idleTime: 1000 }),
        page.waitForTimeout(3000)
      ]);
      
      // Wait a bit more for content to render
      await page.waitForTimeout(2000);
      
      // Check if we got more tweets
      const afterCount = await page.evaluate(() => 
        document.querySelectorAll('.timeline-item:not(.show-more)').length
      );
      
      // If we got new tweets, consider it a success
      return afterCount > beforeCount;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Scroll down the page to load more tweets and extract data incrementally
 * @param {Object} page - Puppeteer page object
 * @param {number} maxAttempts - Maximum number of attempts to load more tweets
 * @param {number} desiredTweetCount - Target number of tweets to collect
 * @returns {Promise<{tweetCount: number, tweets: Array}>} - Count of timeline items found and extracted tweets
 */
async function loadMoreTweetsAndExtract(page, maxAttempts = 10, desiredTweetCount = 100) {
  let currentItemCount = 0;
  let totalNewTweets = 0;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 3;
  let allExtractedTweets = [];
  let seenTweetIds = new Set();
  
  // First, get initial tweet count
  currentItemCount = await page.evaluate(() => 
    document.querySelectorAll('.timeline-item:not(.show-more)').length
  );
  
  // Extract initial tweets
  const initialTweets = await extractTweetData(page, seenTweetIds);
  initialTweets.forEach(tweet => {
    seenTweetIds.add(tweet.id);
    allExtractedTweets.push(tweet);
  });
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Try clicking "Show more" button first
    const clickSuccess = await clickShowMoreButton(page);
    
    // If button click didn't work or wasn't available, try scrolling
    if (!clickSuccess) {
      // Scroll to bottom
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Wait for potential new content to load
      await page.waitForTimeout(2000);
    }
    
    // Extract new tweets after loading more content
    const newTweets = await extractTweetData(page, seenTweetIds);
    
    // Add new tweets to our collection and update seen IDs
    newTweets.forEach(tweet => {
      seenTweetIds.add(tweet.id);
      allExtractedTweets.push(tweet);
    });
    
    // Check if we got more tweets after this attempt
    const newItemCount = await page.evaluate(() => 
      document.querySelectorAll('.timeline-item:not(.show-more)').length
    );
    
    const newTweetsThisAttempt = newItemCount - currentItemCount;
    
    if (newTweetsThisAttempt > 0 || newTweets.length > 0) {
      // Reset the failure counter if we got new tweets
      consecutiveFailures = 0;
      totalNewTweets += newTweetsThisAttempt;
      currentItemCount = newItemCount;
    } else {
      // Increment failure counter if we didn't get new tweets
      consecutiveFailures++;
      
      // If we've had several attempts with no new tweets, stop trying
      if (consecutiveFailures >= maxConsecutiveFailures) {
        break;
      }
    }
    
    // Break out if we've collected enough tweets
    if (allExtractedTweets.length >= desiredTweetCount) {
      break;
    }
    
    // Take a small break between attempts to avoid hitting rate limits
    await page.waitForTimeout(1000);
  }
  
  return {
    tweetCount: currentItemCount,
    tweets: allExtractedTweets
  };
}

/**
 * Extract user profile information
 * @param {Object} page - Puppeteer page object
 * @returns {Promise<Object>} - User profile data
 */
async function extractUserProfile(page) {
  return await page.evaluate(() => {
    try {
      const profile = {};
      
      // Get avatar
      const avatarElem = document.querySelector('.profile-card-avatar');
      profile.avatar = avatarElem ? avatarElem.getAttribute('src') : null;
      
      // Get display name and username
      const nameElem = document.querySelector('.profile-card-fullname');
      const usernameElem = document.querySelector('.profile-card-username');
      
      profile.name = nameElem ? nameElem.textContent.trim() : null;
      profile.username = usernameElem ? usernameElem.textContent.trim().replace('@', '') : null;
      
      // Check for verified status
      profile.verified = !!nameElem?.querySelector('.verified-icon');
      
      // Get verification type if verified
      if (profile.verified) {
        const verifiedIcon = nameElem.querySelector('.verified-icon');
        if (verifiedIcon.classList.contains('government')) {
          profile.verifiedType = 'government';
        } else if (verifiedIcon.classList.contains('business')) {
          profile.verifiedType = 'business';
        } else {
          profile.verifiedType = 'standard';
        }
      }
      
      // Get bio
      const bioElem = document.querySelector('.profile-bio');
      profile.bio = bioElem ? bioElem.textContent.trim() : null;
      
      // Get location, website, and join date
      const locationElem = document.querySelector('.profile-location');
      const websiteElem = document.querySelector('.profile-website a');
      const joinDateElem = document.querySelector('.profile-joindate');
      
      profile.location = locationElem ? locationElem.textContent.trim() : null;
      profile.website = websiteElem ? websiteElem.getAttribute('href') : null;
      
      // Clean up join date
      if (joinDateElem) {
        const joinDateText = joinDateElem.textContent.trim();
        profile.joinDate = joinDateText.replace('Joined', '').trim();
      } else {
        profile.joinDate = null;
      }
      
      // Get following/followers/tweets counts
      // Using more specific selectors to get the exact stat numbers
      const followingElem = document.querySelector('.profile-statlist .following .profile-stat-num');
      const followersElem = document.querySelector('.profile-statlist .followers .profile-stat-num');
      const tweetsElem = document.querySelector('.profile-statlist .posts .profile-stat-num');
      const likesElem = document.querySelector('.profile-statlist .likes .profile-stat-num');
      
      profile.following = followingElem ? followingElem.textContent.trim() : '0';
      profile.followers = followersElem ? followersElem.textContent.trim() : '0';
      profile.tweets = tweetsElem ? tweetsElem.textContent.trim() : '0';
      profile.likes = likesElem ? likesElem.textContent.trim() : '0';
      
      // Get banner image if available
      const bannerElem = document.querySelector('.profile-banner img');
      profile.banner = bannerElem ? bannerElem.getAttribute('src') : null;
      
      // Get photo/media count if available
      const photoRailHeader = document.querySelector('.photo-rail-header');
      if (photoRailHeader) {
        const photoCountText = photoRailHeader.textContent.trim();
        const photoCountMatch = photoCountText.match(/(\d+,?\d*)/);
        profile.mediaCount = photoCountMatch ? photoCountMatch[0] : '0';
      } else {
        profile.mediaCount = '0';
      }
      
      return profile;
    } catch (err) {
      // Return partial profile if error occurs
      return {
        error: err.message,
        partial: true
      };
    }
  });
}

/**
 * Scrapes user tweets from a Twitter profile using Nitter instances
 * @param {Object} params - Scraping parameters
 * @param {string} params.username - Twitter username to scrape (without @)
 * @param {number} params.limit - Maximum number of tweets to fetch (optional)
 * @param {string} params.callback_url - URL to send results to (optional)
 * @param {string} params.indicator - Indicator to be included in callback (optional)
 * @returns {Promise<Object>} - User profile and tweets data
 */
async function getUserTweets(params) {
  const { username, limit = 20, callback_url, indicator } = params;
  
  if (!username) {
    throw new Error('Username is required');
  }
  
  // Determine maximum attempts based on desired limit
  const maxAttempts = Math.min(Math.max(Math.ceil(limit / 5), 5), 20);
  
  let browser = null;
  let attempts = 0;
  const maxNitterAttempts = 6; // Number of Nitter instances
  let success = false;
  let tweets = [];
  let profile = {};
  let currentError = null;
  let metadata = {};
  
  // Create timestamp for metadata
  const timestamp = Date.now();
  
  while (attempts < maxNitterAttempts && !success) {
    const nitterBaseUrl = getFallbackNitterUrl(attempts > 0);
    const profileUrl = `${nitterBaseUrl}/${username}`;
    
    try {
      // Launch browser with stealth mode and advanced options
      browser = await puppeteer.launch({
        headless: "new",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
        ]
      });

      const page = await browser.newPage();
      
      // Set extra headers to look more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      });
      
      // Randomize viewport size slightly to avoid fingerprinting
      const width = 1280 + Math.floor(Math.random() * 100);
      const height = 800 + Math.floor(Math.random() * 100);
      await page.setViewport({ width, height });

      // Set cookies to appear more like a regular user
      await page.setCookie({
        name: 'nitter_prefs',
        value: 'minimal=0&infinite=1',
        domain: new URL(nitterBaseUrl).hostname
      });
      
      // Enable request interception for debugging
      await page.setRequestInterception(true);
      page.on('request', request => {
        request.continue();
      });
      
      // Suppress console messages
      page.on('console', () => {});
      
      // Set a generous timeout to deal with Cloudflare delays
      await page.setDefaultNavigationTimeout(30000);
      
      // Navigate with a wait strategy that ensures the content is loaded
      await page.goto(profileUrl, {
        waitUntil: ['domcontentloaded', 'networkidle2'],
      });

      // Wait for profile and tweets to load
      await page.waitForSelector('.profile-card, .error-panel', { timeout: 15000 })
        .catch(() => { throw new Error('Profile selector not found'); });
      
      // Check if we hit an error page
      const errorElement = await page.$('.error-panel');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        throw new Error(`Nitter error: ${errorText.trim()}`);
      }
      
      // Extract user profile information
      profile = await extractUserProfile(page);
      
      // Wait for timeline items to appear
      await page.waitForSelector('.timeline-item, .timeline-header, .error-panel', { timeout: 15000 })
        .catch(() => { throw new Error('Timeline selector not found'); });
      
      // Load more tweets with pagination attempts, extracting incrementally
      const result = await loadMoreTweetsAndExtract(page, maxAttempts, limit);
      
      tweets = result.tweets;
      
      // Limit the number of tweets if necessary
      if (limit > 0 && tweets.length > limit) {
        tweets = tweets.slice(0, limit);
      }
      
      if (profile && tweets && tweets.length > 0) {
        // Create metadata for user profile results
        metadata = {
          username,
          timestamp,
          nitterInstance: nitterBaseUrl,
          tweetsCount: tweets.length,
          limit,
          totalFound: result.tweetCount,
          paginationAttempts: maxAttempts
        };
        
        // Create structured result data
        const resultData = {
          metadata,
          profile,
          tweets
        };
        
        // If callback_url is provided, send the results
        if (callback_url) {
          await axios.post(callback_url, {
            success: true,
            type: 'user_tweets',
            indicator, // Include the indicator in the callback payload
            params,
            result: resultData
          }).catch((error) => {
            // Log error but don't fail the scraping process
            console.error(`Failed to send results to callback URL: ${error.message}`);
          });
        }
        
        // Success! We have the data
        success = true;
      } else {
        throw new Error('No valid profile or tweets found');
      }
      
    } catch (error) {
      currentError = error;
      attempts++;
      
      // If this is the last attempt and we have a callback_url, send the error
      if (attempts >= maxNitterAttempts && callback_url) {
        await axios.post(callback_url, {
          success: false,
          type: 'user_tweets',
          indicator, // Include the indicator in the callback payload
          params,
          error: {
            message: error.message,
            stack: error.stack
          }
        }).catch(() => {
          // Silently ignore callback errors to prevent cascading failures
        });
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
  
  if (!success) {
    throw new Error(`Failed to scrape after ${maxNitterAttempts} attempts. Last error: ${currentError?.message || 'Unknown error'}`);
  }
  
  return { metadata, profile, tweets };
}

module.exports = { getUserTweets }; 