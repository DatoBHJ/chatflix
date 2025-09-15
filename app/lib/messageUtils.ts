// File type definition
export type File = {
  name: string;
  content: string;
  description?: string;
};

// Annotation type definition
export type Annotation = {
  type: string;
  data?: any;
};

// Helper function to get structured response main content
export function getStructuredResponseMainContent(message: any) {
  // 1. Check annotations first
  const structuredResponseAnnotation = message.annotations?.find(
    (annotation: any) => annotation.type === 'structured_response'
  );
  
  if (structuredResponseAnnotation?.data?.response?.main_response) {
    return structuredResponseAnnotation.data.response.main_response;
  }
  
  // 2. Check tool_results
  if (message.tool_results?.structuredResponse?.response?.main_response) {
    return message.tool_results.structuredResponse.response.main_response;
  }
  
  // 3. Check in-progress responses (latest one)
  const progressAnnotations = message.annotations?.filter(
    (annotation: any) => annotation.type === 'structured_response_progress'
  );
  
  if (progressAnnotations?.length > 0) {
    const latestProgress = progressAnnotations[progressAnnotations.length - 1];
    if (latestProgress.data?.response?.main_response) {
      return latestProgress.data.response.main_response;
    }
  }
  
  return null;
}

// Helper function to get structured response description
export function getStructuredResponseDescription(message: any) {
  // 1. Check annotations first
  const structuredResponseAnnotation = message.annotations?.find(
    (annotation: any) => annotation.type === 'structured_response'
  );
  
  if (structuredResponseAnnotation?.data?.response?.description) {
    return structuredResponseAnnotation.data.response.description;
  }
  
  // 2. Check tool_results
  if (message.tool_results?.structuredResponse?.response?.description) {
    return message.tool_results.structuredResponse.response.description;
  }
  
  // 3. Check in-progress responses (latest one)
  const progressAnnotations = message.annotations?.filter(
    (annotation: any) => annotation.type === 'structured_response_progress'
  );
  
  if (progressAnnotations?.length > 0) {
    const latestProgress = progressAnnotations[progressAnnotations.length - 1];
    if (latestProgress.data?.response?.description) {
      return latestProgress.data.response.description;
    }
  }
  
  return null;
}

// Helper function to get structured response title
export function getStructuredResponseTitle(message: any) {
  // 🚀 1. Check for separate title data first (new fast title system)
  const titlePart = message.parts?.find(
    (part: any) => part.type === 'data-structured_response' && part.id?.startsWith('title-')
  );
  
  if (titlePart?.data?.response?.title) {
    return titlePart.data.response.title;
  }
  
  // 2. Check annotations first (existing system)
  const structuredResponseAnnotation = message.annotations?.find(
    (annotation: any) => annotation.type === 'structured_response'
  );
  
  if (structuredResponseAnnotation?.data?.response?.title) {
    return structuredResponseAnnotation.data.response.title;
  }
  
  // 3. Check parts array for data-structured_response (AI SDK v5 format)
  const structuredResponsePart = message.parts?.find(
    (part: any) => part.type === 'data-structured_response'
  );
  
  if (structuredResponsePart?.data?.response?.title) {
    return structuredResponsePart.data.response.title;
  }
  
  // 4. Check tool_results
  if (message.tool_results?.structuredResponse?.response?.title) {
    return message.tool_results.structuredResponse.response.title;
  }
  
  // 5. Check in-progress responses (latest one)
  const progressAnnotations = message.annotations?.filter(
    (annotation: any) => annotation.type === 'structured_response_progress'
  );
  
  if (progressAnnotations?.length > 0) {
    const latestProgress = progressAnnotations[progressAnnotations.length - 1];
    if (latestProgress.data?.response?.title) {
      return latestProgress.data.response.title;
    }
  }
  
  return null;
}

// Helper function to get follow-up questions
export function getFollowUpQuestions(message: any): string[] | null {
  // 🚀 1. Check for separate follow-up data first (new fast system)
  const followUpPart = message.parts?.find(
    (part: any) => part.type === 'data-structured_response' && part.id?.startsWith('followup-')
  );
  
  if (followUpPart?.data?.response?.followup_questions) {
    return followUpPart.data.response.followup_questions;
  }
  
  // 2. Check annotations first (existing system)
  const structuredResponseAnnotation = message.annotations?.find(
    (annotation: any) => annotation.type === 'structured_response'
  );
  
  if (structuredResponseAnnotation?.data?.response?.followup_questions) {
    return structuredResponseAnnotation.data.response.followup_questions;
  }
  
  // 3. Check parts array for data-structured_response (AI SDK v5 format)
  const structuredResponsePart = message.parts?.find(
    (part: any) => part.type === 'data-structured_response'
  );
  
  if (structuredResponsePart?.data?.response?.followup_questions) {
    return structuredResponsePart.data.response.followup_questions;
  }
  
  // 4. Check tool_results
  if (message.tool_results?.structuredResponse?.response?.followup_questions) {
    return message.tool_results.structuredResponse.response.followup_questions;
  }
  
  // 5. Check in-progress responses (latest one)
  const progressAnnotations = message.annotations?.filter(
    (annotation: any) => annotation.type === 'structured_response_progress'
  );
  
  if (progressAnnotations?.length > 0) {
    const latestProgress = progressAnnotations[progressAnnotations.length - 1];
    if (latestProgress.data?.response?.followup_questions) {
      return latestProgress.data.response.followup_questions;
    }
  }
  
  return null;
}

// Helper function to get structured response files
export function getStructuredResponseFiles(message: any): File[] | null {
  if (!message) return null;
  // 1. Check annotations first
  const structuredResponseAnnotation = message.annotations?.find(
    (annotation: any) => annotation.type === 'structured_response'
  );
  
  if (structuredResponseAnnotation?.data?.response?.files && 
      Array.isArray(structuredResponseAnnotation.data.response.files) && 
      structuredResponseAnnotation.data.response.files.length > 0) {
    return structuredResponseAnnotation.data.response.files;
  }
  
  // 2. Check tool_results
  if (message.tool_results?.structuredResponse?.response?.files && 
      Array.isArray(message.tool_results.structuredResponse.response.files) && 
      message.tool_results.structuredResponse.response.files.length > 0) {
    return message.tool_results.structuredResponse.response.files;
  }
  
  // 3. Check in-progress responses (latest one)
  const progressAnnotations = message.annotations?.filter(
    (annotation: any) => annotation.type === 'structured_response_progress'
  );
  
  if (progressAnnotations?.length > 0) {
    const latestProgress = progressAnnotations[progressAnnotations.length - 1];
    if (latestProgress.data?.response?.files && 
        Array.isArray(latestProgress.data.response.files) && 
        latestProgress.data.response.files.length > 0) {
      return latestProgress.data.response.files;
    }
  }
  
  return null;
}

// Helper function to check if a structured response is still in progress
export function isStructuredResponseInProgress(message: any): boolean {
  if (!message) return false;
  // Check for in-progress responses
  const progressAnnotations = message.annotations?.filter(
    (annotation: any) => annotation.type === 'structured_response_progress'
  );
  
  if (progressAnnotations?.length > 0) {
    const latestProgress = progressAnnotations[progressAnnotations.length - 1];
    return latestProgress.data?.response?.isProgress === true;
  }
  
  return false;
} 