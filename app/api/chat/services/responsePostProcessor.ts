import { collectToolResults } from '../utils/toolUtils';
import {
  extractLanguagePreference,
  extractTextFromCompletion,
  generateFollowUpQuestions,
} from '../utils/messageUtils';

interface CompletionArtifactsParams {
  writer: any;
  assistantMessageId: string;
  userQuery: string;
  completion: any;
  userMemory: string | null;
  isAnonymousUser: boolean;
  allTools: Record<string, any>;
  selectedActiveTools: string[];
}

interface CompletionArtifactsResult {
  aiResponse: string;
  structuredResponse: {
    response: {
      followup_questions: string[];
    };
  };
  collectedToolResults: any;
}

/**
 * Build structured response artifacts (follow-ups, tool usage) and emit UI events.
 */
export async function processCompletionArtifacts({
  writer,
  assistantMessageId,
  userQuery,
  completion,
  userMemory,
  isAnonymousUser,
  allTools,
  selectedActiveTools,
}: CompletionArtifactsParams): Promise<CompletionArtifactsResult> {
  const aiResponse = extractTextFromCompletion(completion);
  const languagePreference =
    !isAnonymousUser && userMemory ? extractLanguagePreference(userMemory) : null;

  const followUpQuestions = await generateFollowUpQuestions(
    userQuery,
    aiResponse,
    languagePreference,
  );

  writer?.write({
    type: 'data-structured_response',
    id: `followup-${assistantMessageId}`,
    data: { response: { followup_questions: followUpQuestions } },
  });

  const collectedToolResults = collectToolResults(allTools, selectedActiveTools);
  const structuredResponse = {
    response: {
      followup_questions: followUpQuestions,
    },
  };

  collectedToolResults.structuredResponse = structuredResponse;
  collectedToolResults.token_usage = {
    totalUsage: completion.totalUsage || null,
  };

  return {
    aiResponse,
    structuredResponse,
    collectedToolResults,
  };
}


