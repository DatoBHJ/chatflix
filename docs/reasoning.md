# AI SDK 4.1 Complete Documentation - reasoning

## Reasoning Features

### Understanding Reasoning in AI SDK
The AI SDK provides comprehensive support for handling model reasoning through multiple approaches:

1. Reasoning Middleware
2. Stream Protocol Support
3. Provider-specific Implementation (e.g., DeepSeek)
4. Explicit Reasoning Extraction

### Reasoning Middleware

```typescript
import { wrapLanguageModel, extractReasoningMiddleware } from 'ai';

const model = wrapLanguageModel({
  model: yourModel,
  middleware: extractReasoningMiddleware({ 
    tagName: 'think' // or any other custom tag name
  }),
});
```

The reasoning middleware can extract reasoning information from special tags in the generated text. This is particularly useful when working with models that expose their thought process through specific markup.

### Stream Protocol Support for Reasoning

The AI SDK supports reasoning through its data stream protocol using dedicated reasoning parts:

```typescript
// Reasoning part format
g:"I will approach this systematically."\n
```

In your frontend code, you can access these reasoning parts:

```typescript
const { messages } = useChat();

return (
  <div>
    {messages.map(message => (
      <div key={message.id}>
        {message.parts.map((part, index) => {
          if (part.type === 'reasoning') {
            return (
              <pre key={index} className="reasoning">
                Reasoning: {part.reasoning}
              </pre>
            );
          }
          if (part.type === 'text') {
            return <div key={index}>{part.text}</div>;
          }
          return null;
        })}
      </div>
    ))}
  </div>
);
```

### Provider-Specific Reasoning (DeepSeek Example)

For providers that support reasoning tokens (like DeepSeek), you can enable reasoning in your API route:

```typescript
// app/api/chat/route.ts
import { deepseek } from '@ai-sdk/deepseek';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: deepseek('deepseek-reasoner'),
    messages,
  });

  return result.toDataStreamResponse({
    sendReasoning: true // Enable reasoning transmission
  });
}
```

### Manual Reasoning Extraction

You can also manually extract reasoning using the extractReasoningMiddleware with custom tags:

```typescript
const modelWithReasoning = wrapLanguageModel({
  model: baseModel,
  middleware: [
    extractReasoningMiddleware({ 
      tagName: 'reasoning',
      removeFromOutput: true // Remove tags from final output
    })
  ]
});

const result = await generateText({
  model: modelWithReasoning,
  prompt: "Solve this problem..."
});

console.log(result.reasoning); // Access extracted reasoning
console.log(result.text); // Access clean output
```

### Reasoning in Message Parts

When using the chat interface, reasoning becomes available as specific message parts:

```typescript
interface ReasoningPart {
  type: 'reasoning';
  reasoning: string;
}

interface MessageParts {
  type: 'text' | 'reasoning' | 'tool-call' | 'tool-result';
  // ... other properties based on type
}
```

### Best Practices for Reasoning

1. **Explicit Enablement**: Always explicitly enable reasoning when using providers that support it:
```typescript
const result = streamText({
  model: yourModel,
  messages,
  experimental_enableReasoning: true // Enable reasoning features
});
```

2. **Error Handling**: Include reasoning-specific error handling:
```typescript
try {
  const result = await generateText({
    model: modelWithReasoning,
    prompt: "..."
  });
} catch (error) {
  if (error.code === 'REASONING_EXTRACTION_FAILED') {
    // Handle reasoning extraction failure
  }
  throw error;
}
```

3. **UI Considerations**: When displaying reasoning, consider using appropriate styling:
```typescript
const ReasoningDisplay = ({ reasoning }) => (
  <div className="reasoning-block">
    <h4>Model Reasoning Process:</h4>
    <pre className="reasoning-content">
      {reasoning}
    </pre>
  </div>
);
```

### Reasoning with Different Model Types

Different AI models handle reasoning in various ways:

1. **Chain-of-Thought Models**: These models naturally include reasoning in their output and work well with the extractReasoningMiddleware.

2. **Structured Output Models**: These may require special handling to extract reasoning from their structured responses.

3. **Multi-Modal Models**: These models might include reasoning about visual elements or other modalities.

Example configuration for different model types:

```typescript
// Chain-of-Thought Model
const cotModel = wrapLanguageModel({
  model: baseModel,
  middleware: [extractReasoningMiddleware({ tagName: 'think' })]
});

// Structured Output Model
const structuredModel = wrapLanguageModel({
  model: baseModel,
  middleware: [
    extractReasoningMiddleware({ 
      tagName: 'reasoning',
      structuredOutput: true
    })
  ]
});

// Multi-Modal Model
const multiModalModel = wrapLanguageModel({
  model: baseModel,
  middleware: [
    extractReasoningMiddleware({ 
      tagName: 'reasoning',
      multiModal: true
    })
  ]
});
```
