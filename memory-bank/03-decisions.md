# Key Decisions

## Architecture Decisions
- Use Supabase for database and memory storage
- Implement context window with token management
- Categorize memory into distinct types for better organization

## Implementation Approach
- Follow Cursor Agent style memory management pattern
- Store memory in both database and file system for flexibility
- Use structured format for memory bank entries
- Implement automatic memory updates based on conversation content

## Technical Choices
- Token estimation for context window optimization
- Session-based state tracking for continuous conversations
- Separate tools and memory categories for better modularity
