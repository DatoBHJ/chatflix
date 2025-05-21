import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 });
    }

    const prompt = `Create a concise, catchy title for this chat conversation (max 4-6 words). Format as a short noun phrase, not a complete sentence. Focus on the core topic, similar to how ChatGPT generates conversation titles.

EXAMPLES:
- For a conversation about "I need an image of the Death Star destroying a planet with its superlaser beam": "Death Star Drawing Request"
- For "Can you explain how Bitcoin mining works?": "Bitcoin Mining Explanation"
- For "I'm visiting Korea next month, what should I do in Seoul?": "Seoul Travel Recommendations"
- For "Can you help me debug this JavaScript code?": "JavaScript Debugging Help"

Avoid generic titles like "Chat About Images" or "Coding Assistance". Be specific but extremely concise.

IMPORTANT: You MUST create the title in the SAME LANGUAGE as the user's message. If the conversation is in Korean, respond in Korean. If in English, respond in English. Always match the user's original language.

Conversation:
${message}

Title:`;
    console.log('Prompt:', prompt);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 48,
    });

    const summary = completion.choices[0].message.content?.trim() || '';
    if (!summary) {
      return NextResponse.json({ error: 'No summary generated' }, { status: 500 });
    }
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error summarizing message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 