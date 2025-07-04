/**
 * getFallbackNitterUrl.js
 * Provides round-robin fallback between Nitter instances
 */

const NITTER_INSTANCES = [
  'https://nitter.tiekoetter.com',
  'https://nitter.space',
  'https://lightbrd.com',
  'https://nitter.privacyredirect.com',
  'https://nitter.net',
  'https://xcancel.com'
];

let currentInstanceIndex = 0;

/**
 * Get next Nitter instance URL in rotation
 * @param {boolean} moveToNext - Whether to move to next instance (in case of failure)
 * @returns {string} Nitter instance base URL
 */
function getFallbackNitterUrl(moveToNext = false) {
  if (moveToNext) {
    currentInstanceIndex = (currentInstanceIndex + 1) % NITTER_INSTANCES.length;
  }
  
  return NITTER_INSTANCES[currentInstanceIndex];
}

/**
 * Reset the fallback rotation to the first instance
 */
function resetNitterFallback() {
  currentInstanceIndex = 0;
}

/**
 * Get all available Nitter instances
 * @returns {string[]} Array of all Nitter instance URLs
 */
function getAllNitterInstances() {
  return [...NITTER_INSTANCES];
}

module.exports = {
  getFallbackNitterUrl,
  resetNitterFallback,
  getAllNitterInstances
}; 