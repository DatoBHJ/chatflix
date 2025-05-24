// File type definition
export type File = {
  name: string;
  content: string;
  description?: string;
};

// Define a type for the annotations used in extractReasoningForMessage
export type Annotation = {
  type: string;
  data: any;
  // Add other potential fields if necessary, e.g., timestamp, id, etc.
};

// Helper function to extract reasoning data for a single message
export const extractReasoningForMessage = (message: any) => {
  if (!message) return { completeData: null, progressData: [] };

  const messageAnnotations = ((message.annotations || []) as Annotation[]);
  const toolResults = (message as any).tool_results;

  const reasoningAnnotations = messageAnnotations
    .filter(a => a?.type === 'agent_reasoning' || a?.type === 'agent_reasoning_progress');
    
  const toolResultsReasoningData = toolResults?.agentReasoning;
  const toolResultsSource = toolResultsReasoningData
    ? [{ type: 'agent_reasoning', data: toolResultsReasoningData } as Annotation] 
    : [];
    
  const reasoningDataSources = [...reasoningAnnotations, ...toolResultsSource];

  const completeAnnotation = reasoningDataSources.find(a => 
    a?.type === 'agent_reasoning' && (a?.data?.isComplete === true || typeof a?.data?.isComplete === 'undefined')
  );
  
  const progressAnnotations = reasoningDataSources
    .filter(a => a?.type === 'agent_reasoning_progress')
    .sort((a, b) => new Date(b?.data?.timestamp || 0).getTime() - new Date(a?.data?.timestamp || 0).getTime()); // Newest first
  
  const formatReasoningData = (sourceItem: Annotation, isExplicitlyProgress: boolean) => {
    const data = sourceItem.data;
    return {
      agentThoughts: data?.agentThoughts || data?.reasoning || '',
      plan: data?.plan || '',
      selectionReasoning: data?.selectionReasoning || '',
      needsWebSearch: Boolean(data?.needsWebSearch),
      needsCalculator: Boolean(data?.needsCalculator),
      needsLinkReader: Boolean(data?.needsLinkReader),
      needsImageGenerator: Boolean(data?.needsImageGenerator),
      needsAcademicSearch: Boolean(data?.needsAcademicSearch),
      // needsXSearch: Boolean(data?.needsXSearch), // Keep commented if not used
      needsYouTubeSearch: Boolean(data?.needsYouTubeSearch),
      needsYouTubeLinkAnalyzer: Boolean(data?.needsYouTubeLinkAnalyzer),
      needsDataProcessor: Boolean(data?.needsDataProcessor),
      timestamp: data?.timestamp,
      isComplete: isExplicitlyProgress ? false : (data?.isComplete ?? (sourceItem.type === 'agent_reasoning'))
    };
  };
  
  return {
    completeData: completeAnnotation ? formatReasoningData(completeAnnotation, false) : null,
    progressData: progressAnnotations.map(a => formatReasoningData(a, true))
  };
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