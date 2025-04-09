/**
 * 메모리 뱅크 업데이트 함수 (클라이언트에서 사용)
 */
export async function updateMemory(category: string, content: string): Promise<any> {
  try {
    const response = await fetch('/api/memory/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ category, content }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update memory');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error updating memory:', error);
    throw error;
  }
}

/**
 * 사용 예시
 */
async function updateProjectArchitecture() {
  try {
    const result = await updateMemory('01-architecture', `# Architecture

## Backend
- Next.js with API Routes
- Supabase for database and authentication
- Memory bank system for context management

## Frontend
- React with Next.js App Router
- Tailwind CSS for styling
- Context window optimization

## Memory System
- Categorized memory bank
- Project status tracking
- Workflow state management
- Token-aware context window`);
    
    console.log('Memory updated:', result);
  } catch (error) {
    console.error('Failed to update memory:', error);
  }
}

/**
 * 프로젝트 진행 상황 업데이트 예시
 */
async function updateProjectProgress() {
  try {
    const result = await updateMemory('02-progress', `# Progress

## Current Phase
- Memory bank implementation
- Context window optimization

## Completed
- Project structure setup
- Database schema creation
- Memory bank utility functions
- Status tracking system

## Next Steps
- Complete API route integration
- Add UI for memory management
- Test with real conversations`);
    
    console.log('Progress updated:', result);
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
} 