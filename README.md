chatflix.app - the Netflix of chatbots

- super minimal fye ui/ux lol
- customizable prompt shortcuts
- vision 
- file uplaod
- works with both reasoning & non-reasoning models
- switch models mid-convo
- supports the bests models itw (sonnet, openai, deepseek, google, meta ..etc) 
- trending search terms
- web search capabilities

todo: web search / deep search mode. 

https://www.chatflix.app

# Chatflix Web Search Feature

This document describes the implementation of web search functionality in the Chatflix chatbot application using AI-SDK's multi-step approach.

## Features

- Toggle to enable/disable web search in the chat interface
- Multi-step AI processing for web search results and response generation
- Visual display of search results using the MultiSearch component
- Persistence of web search preference in the database

## Implementation Details

### UI Components

- Added a web search toggle button to the ChatInput component
- Search results are displayed above the AI response using the MultiSearch component
- The toggle state is preserved between sessions

### Multi-Step Processing

The web search feature uses AI-SDK's multi-step processing approach:

1. **Step 1**: The first model call uses a tool to search the web and retrieve relevant results
   - The model generates multiple search queries based on the user's question
   - Search results are retrieved (currently using mock data)
   - Results are streamed to the UI through message annotations

2. **Step 2**: The second model call generates the AI response using the search results
   - The model incorporates information from the search results
   - The response is streamed to the UI
   - The two steps appear as a single assistant response to the user

### Data Flow

1. User enables web search toggle and sends a message
2. The API route detects the web search flag and initiates multi-step processing
3. Search results are displayed in the UI using the MultiSearch component
4. The AI response follows, incorporating information from the search results

## Usage

To use the web search feature:

1. Click the globe icon in the chat input to toggle web search mode
2. Type your query and send
3. The system will search the web and provide relevant results
4. The AI will respond using information from the search results

## Technical Notes

- The web search preference is stored in both the chat_sessions and messages tables
- Search results are passed through toolInvocation objects in the message structure
- The MultiSearch component renders search results from the toolInvocation data

# Trending Search Terms Feature

This section describes the implementation of the Google Trends trending search terms feature in Chatflix.

## Features

- Displays the top 10 trending Google search terms in a horizontal scrollable bar
- Updates every 4 hours to stay current
- Available on both the home page and in chat sessions
- Clicking a trending term starts a new chat with that query

## Implementation Details

### API Integration

- Uses the SearchAPI.io Google Trends Trending Now API
- Server-side caching with a 4-hour TTL to minimize API calls
- Fallback to cached data if the API request fails

### UI Components

- Horizontal scrollable bar for trending terms
- Clean, minimal pill-style buttons for each trending term
- Hidden scrollbar for a cleaner UI

### Data Flow

1. Server-side API endpoint fetches and caches trending data
2. Client fetches data from the server endpoint on page load
3. Client refreshes data every 4 hours for long sessions
4. Client-side local storage provides additional caching

## Technical Notes

- Requires a SearchAPI.io API key set in the SEARCH_API_KEY environment variable
- Includes intelligent caching mechanisms on both server and client sides
- Automatically adapts to rate limits to protect API usage