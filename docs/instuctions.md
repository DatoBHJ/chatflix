Gaol: building a simple chatbot that user can choose between these 4 options:
1. DeepSeek r1 / DeepSeek v3 - powered by DeepSeek
2. DeepSeek r1 / DeepSeek v3 - powered by Together AI
3. DeepSeek r1 distilled llama 70b - powered by groq
4. Claude sonnet 3.5 - powered by Anthropic

we will be using Next.js, shadcn/ui, tailwindcss, and supabase.

the chatbot should be able to handle the following:
1. the chatbot can track the user's conversation history and use it to generate responses
2. the chatbot can handle the conversation history even though the model or the host is changed

Frontend:
1. absolutely super minimalistic Kanye West Yeezy.com website style

Backend:
using supabase as our database for both auth and chat history. 

API keys:
GROQ_API_KEY, DEEPSEEK_API_KEY, TOGETHER_API_KEY, CLAUDE_API_KEY.
Already provided in .env.local

important note: 
make sure to create as minimum file as possible, and use the most basic and simple code as possible.
all models are openai compatible, so you can use the same format for all models. 

some notes on deepseek r1 model:
1. deepseek r1 has some unique features: it's a reasoning model, and it answers in a format like this: 
<think> 
(reasoning)
</think>
(answer)

2. each host may have different name & approach for the same model. check the documentation for more details. 

