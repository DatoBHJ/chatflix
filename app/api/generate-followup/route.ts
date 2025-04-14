import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getModelById } from '@/lib/models/config';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

export const maxDuration = 30; // Set max duration to 30 seconds for this API route

// Define the schema for follow-up questions
const FollowUpQuestionsSchema = z.object({
  questions: z.array(z.string())
    .length(3)
    .describe('Three follow-up questions based on the conversation context')
});

export async function POST(req: Request) {
  try {
    const { messages, chatId, userId } = await req.json();
    
    if (!messages || !Array.isArray(messages) || !chatId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Verify user auth
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (!user || userError || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the current model from the chat session
    const { data: sessionData } = await supabase
      .from('chat_sessions')
      .select('current_model')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();
    
    if (!sessionData) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }
    
    // Use the model configuration - not needed for XAI integration
    const modelConfig = getModelById(sessionData.current_model);
    
    if (!modelConfig) {
      return NextResponse.json(
        { error: 'Invalid model configuration' },
        { status: 400 }
      );
    }

    // Create XAI client
    const xai = new OpenAI({
      apiKey: process.env.XAI_API_KEY || '',
      baseURL: 'https://api.x.ai/v1'
    });
    
    // Generate follow-up questions
    const recentMessagesContext = messages
      .map((msg: any) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
      
    // Extract the last user message to determine language
    const userMessages = messages.filter(msg => msg.role === 'user');
    const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
      
    const systemPrompt = `You are a helpful assistant that generates follow-up questions based on conversation context.
Generate exactly three helpful, concise, and diverse follow-up questions the user might want to ask next.
IMPORTANT: Always match the language of the user's messages. If the user is writing in a non-English language, 
generate questions in that same language, matching their style and terminology.`;

    // Use structured outputs with the Zod schema
    try {
      const completion = await xai.beta.chat.completions.parse({
        model: 'grok-3-mini-beta',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is the recent conversation:\n\n${recentMessagesContext}\n\nBased on this conversation, generate three follow-up questions the user might want to ask next. Make sure to use the same language as the user (e.g., if they're writing in Korean, generate questions in Korean; if in English, use English, etc.).` }
        ],
        response_format: zodResponseFormat(FollowUpQuestionsSchema, 'followUpQuestions')
      });

      // Extract parsed questions from the structured output
      const parsed = completion.choices[0].message.parsed;
      
      // Ensure we have valid questions
      const questions = parsed?.questions || [
        "Can you explain more about that?",
        "What other aspects would you like to discuss?",
        "How would you like to proceed with this conversation?"
      ];

      // Update the database with the new questions
      await supabase
        .from('chat_sessions')
        .update({
          followupQuestion: {
            questions,
            messageCount: messages.length,
            updatedAt: new Date().toISOString()
          }
        })
        .eq('id', chatId);

      return NextResponse.json({ questions });
    } catch (structuredOutputError) {
      console.error('Error with structured output:', structuredOutputError);
      
      // Fallback to regular completion if structured output fails
      const completion = await xai.chat.completions.create({
        model: 'grok-3-mini-beta',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is the recent conversation:\n\n${recentMessagesContext}\n\nBased on this conversation, generate exactly three follow-up questions the user might want to ask next. Match the language of the user (${lastUserMessage.substring(0, 50)}...). Format your response as a JSON array of strings.` }
        ],
        temperature: 0.7,
        max_tokens: 250,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content || '';
      
      let questions: string[] = [];
      try {
        // Parse the JSON response
        const parsedResponse = JSON.parse(content);
        if (Array.isArray(parsedResponse.questions)) {
          questions = parsedResponse.questions.slice(0, 3);
        } else if (Array.isArray(parsedResponse)) {
          questions = parsedResponse.slice(0, 3);
        } else {
          // Try to extract an array from any property in the response
          for (const key in parsedResponse) {
            if (Array.isArray(parsedResponse[key])) {
              questions = parsedResponse[key].map(q => String(q)).slice(0, 3);
              break;
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing follow-up questions:', parseError);
        // Fallback to simple questions if parsing fails
        questions = [
          "Can you explain more about that?",
          "What other aspects would you like to discuss?",
          "How would you like to proceed with this conversation?"
        ];
      }

      // Ensure we have exactly 3 questions
      while (questions.length < 3) {
        questions.push(`Tell me more about ${messages[messages.length - 1].content.split(' ').slice(0, 3).join(' ')}...`);
      }

      // Update the database with the new questions
      await supabase
        .from('chat_sessions')
        .update({
          followupQuestion: {
            questions,
            messageCount: messages.length,
            updatedAt: new Date().toISOString()
          }
        })
        .eq('id', chatId);

      return NextResponse.json({ questions });
    }
  } catch (error) {
    console.error('Error generating follow-up questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate follow-up questions' },
      { status: 500 }
    );
  }
} 