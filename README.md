# fetch404

A utility for data collection.

## Basic Usage

### Trigger via Repository Dispatch API

```shell
curl -L \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_GITHUB_PAT" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/YOUR_USERNAME/fetch404/dispatches \
  -d '{
    "event_type": "start-scrape",
    "client_payload": {
      "type": "search_tweets",
      "params": {
        "query": "example",
        "limit": 20
      },
      "callback_url": "https://your-webhook-endpoint.com"
    }
  }'
```

## Available Types

- `search_tweets`: Search for content by keywords
- `search_users`: Search for users by keywords

## Local Development

1. Clone this repository
2. Run `npm install`
3. Test locally with `node router.js --payload '{"type":"search_tweets","params":{"query":"example"}}'`

## License

MIT