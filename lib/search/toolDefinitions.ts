// lib/search/toolDefinitions.ts

// 도구 설명 및 매개변수 정의
export const toolDefinitions = {
  webSearch: {
    description: 'Search the web for information with multiple queries.',
    parameters: {
      queries: 'Array of search queries to look up on the web. Generate 3-5 specific queries.',
      maxResults: 'Array of maximum number of results to return per query. Use higher numbers (8-10) for broad topics.',
      topics: 'Array of topic types to search for. Use "news" for current events and recent developments.',
      searchDepth: 'Array of search depths to use. Use "advanced" for complex or technical topics.',
      exclude_domains: 'A list of domains to exclude from all search results.'
    },
    defaultExcludeDomains: ['pinterest.com', 'quora.com']
  },
  datetime: {
    description: 'Get the current date and time in the user\'s timezone'
  }
}; 