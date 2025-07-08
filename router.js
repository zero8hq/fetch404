/**
 * fetch404 Router
 * Routes GitHub Actions payload to appropriate scraper module
 */

const fs = require('fs-extra');
const axios = require('axios');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Import scrapers
const { searchTwitter } = require('./scrapers/twitter/tweet_search');
const { getUserTweets } = require('./scrapers/twitter/user_tweets');
// Will add more scrapers later as needed

/**
 * Process scrape job based on type
 * @param {Object} clientPayload - Payload from GitHub Actions dispatch
 * @returns {Promise<Object>} - Result of scraping operation
 */
async function processJob(clientPayload) {
  const { type, params, callback_url, indicator } = clientPayload;
  let result;

  // Suppressed logs
  // console.log(`Processing job of type: ${type}`);
  // console.log(`Parameters:`, JSON.stringify(params, null, 2));

  try {
    switch(type) {
      case 'search_tweets':
        result = await searchTwitter({
          ...params,
          type: 'tweets',
          callback_url,
          indicator
        });
        break;
      
      case 'search_users':
        result = await searchTwitter({
          ...params,
          type: 'users',
          callback_url,
          indicator
        });
        break;
        
      case 'user_tweets':
        result = await getUserTweets({
          ...params,
          callback_url,
          indicator
        });
        break;
      
      // Will add more types later (user_profile, etc.)
      
      default:
        throw new Error(`Unknown job type: ${type}`);
    }

    // Suppressed log
    // console.log('Job processed successfully');
    
    // Callback URL handling is now done directly in the scraper functions
    
    return result;
    
  } catch (error) {
    // Suppressed error log
    // console.error('Error processing job:', error.message);
    
    // Error handling with callback_url is now done directly in the scraper functions
    
    throw error;
  }
}

/**
 * Main function that runs when this script is executed directly
 */
async function main() {
  // Parse command line arguments
  const argv = yargs(hideBin(process.argv))
    .option('payload', {
      alias: 'p',
      type: 'string',
      description: 'JSON payload or path to JSON file'
    })
    .help()
    .argv;

  let clientPayload;

  try {
    // Check if payload is provided
    if (!argv.payload) {
      throw new Error('No payload provided. Use --payload or -p option.');
    }
    
    // Try to parse payload as JSON string first
    try {
      clientPayload = JSON.parse(argv.payload);
    } catch (e) {
      // If not valid JSON, try to read as file path
      if (await fs.pathExists(argv.payload)) {
        const payloadContent = await fs.readFile(argv.payload, 'utf8');
        clientPayload = JSON.parse(payloadContent);
      } else {
        throw new Error(`Invalid payload format and file doesn't exist: ${argv.payload}`);
      }
    }
    
    // Process the job
    await processJob(clientPayload);
    // Print only "done." at the end
    console.log("done.");
    process.exit(0);
    
  } catch (error) {
    // Suppressed error log
    // console.error('Error:', error.message);
    console.log("done.");  // Still print "done." even on error
    process.exit(1);
  }
}

// Run main if executed directly
if (require.main === module) {
  main();
}

// Export for testing and other uses
module.exports = {
  processJob
};