# AI SDK 4.1 Complete Documentation

## Overview

The AI SDK 4.1 provides comprehensive tools for building AI-powered applications. This documentation covers all essential components and features of the SDK.

## Chatbot Implementation

### Basic Setup
```typescript
'use client';

import { useChat } from 'ai/react';

export default function Page() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({});

  return (
    <>
      {messages.map(message => (
        <div key={message.id}>
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.content}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input name="prompt" value={input} onChange={handleInputChange} />
        <button type="submit">Submit</button>
      </form>
    </>
  );
}
```

### Backend Implementation
```typescript
// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4-turbo'),
    system: 'You are a helpful assistant.',
    messages,
  });

  return result.toDataStreamResponse();
}
```

### Loading State Management
```typescript
export default function Page() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat({});

  return (
    <>
      {isLoading && (
        <div>
          <Spinner />
          <button onClick={() => stop()}>Stop</button>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <input
          name="prompt"
          value={input}
          onChange={handleInputChange}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>Submit</button>
      </form>
    </>
  );
}
```

### Error Handling
```typescript
export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, error, reload } = useChat({});

  return (
    <div>
      {error && (
        <>
          <div>An error occurred.</div>
          <button onClick={() => reload()}>Retry</button>
        </>
      )}
    </div>
  );
}
```

### Message Modification
```typescript
const { messages, setMessages } = useChat();

const handleDelete = (id) => {
  setMessages(messages.filter(message => message.id !== id));
};

// Custom message manipulation
const appendCustomMessage = () => {
  setMessages([...messages, {
    id: generateId(),
    role: 'user',
    content: 'Custom message'
  }]);
};
```

## Request Configuration

### Custom Headers and Body
```typescript
const { messages } = useChat({
  api: '/api/custom-chat',
  headers: {
    Authorization: 'Bearer your_token',
    'Custom-Header': 'value'
  },
  body: {
    user_id: '123',
    additional_context: 'value'
  },
  credentials: 'same-origin'
});
```

### Per-Request Configuration
```typescript
<form onSubmit={event => {
  handleSubmit(event, {
    body: {
      customKey: 'customValue',
      timestamp: Date.now()
    }
  });
}}>
```

### Response Stream Control
```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  const result = streamText({
    model: openai('gpt-4o'),
    messages
  });

  return result.toDataStreamResponse({
    getErrorMessage: error => {
      if (error instanceof Error) return error.message;
      return 'Unknown error occurred';
    },
    sendUsage: true,
    sendReasoning: true
  });
}
```

## Stream Management

### Text Stream Protocol
```typescript
// Frontend
const { completion } = useCompletion({
  streamProtocol: 'text'
});

// Backend
const result = streamText({
  model: openai('gpt-4o'),
  prompt
});

return result.toTextStreamResponse();
```

### Data Stream Protocol
Complete specification for all message types:

1. Text Part
```
0:"example text"\n
```

2. Reasoning Part
```
g:"I will approach this systematically."\n
```

3. Data Part
```
2:[{"key":"value"},{"data":"content"}]\n
```

4. Tool Calls
```
b:{"toolCallId":"123","toolName":"calculator"}\n
c:{"toolCallId":"123","argsTextDelta":"1+1"}\n
9:{"toolCallId":"123","toolName":"calculator","args":{"expression":"1+1"}}\n
a:{"toolCallId":"123","result":"2"}\n
```

5. Step Control
```
f:{"id":"step_1"}\n
e:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":20},"isContinued":false}\n
```

### Throttling Updates
```typescript
const { messages } = useChat({
  experimental_throttle: 50  // 50ms throttle
});
```

## Custom Provider

### Provider Configuration
```typescript
import { customProvider } from 'ai';

export const myProvider = customProvider({
  languageModels: {
    'custom-gpt4': openai('gpt-4', { 
      structuredOutputs: true,
      temperature: 0.7
    })
  },
  textEmbeddingModels: {
    'custom-embedding': myEmbeddingModel
  },
  imageModels: {
    'custom-image': myImageModel
  },
  fallbackProvider: openai
});
```

## Anthropic Integration

### Setup and Configuration
```typescript
import { anthropic } from '@ai-sdk/anthropic';

const model = anthropic('claude-3-5-sonnet-20241022');

// Custom configuration
const customAnthropicInstance = createAnthropic({
  baseURL: 'https://custom-endpoint.com/v1',
  apiKey: process.env.ANTHROPIC_API_KEY,
  headers: {
    'Custom-Header': 'value'
  }
});
```

### Cache Control
```typescript
const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  messages: [
    {
      role: 'user',
      content: [
        { 
          type: 'text', 
          text: 'Process this data',
          providerOptions: {
            anthropic: { 
              cacheControl: { 
                type: 'ephemeral' 
              } 
            }
          }
        }
      ]
    }
  ]
});

console.log(result.experimental_providerMetadata?.anthropic);
```

### Computer Use Tools
```typescript
const bashTool = anthropic.tools.bash_20241022({
  execute: async ({ command, restart }) => {
    // Implementation
    return { output: 'command result' };
  }
});

const textEditorTool = anthropic.tools.textEditor_20241022({
  execute: async ({ command, path, file_text, insert_line, new_str, old_str, view_range }) => {
    // Implementation
    return { success: true };
  }
});

const computerTool = anthropic.tools.computer_20241022({
  displayWidthPx: 1920,
  displayHeightPx: 1080,
  execute: async ({ action, coordinate, text }) => {
    // Implementation
    return { status: 'success' };
  }
});
```

### PDF Support
```typescript
const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Analyze this PDF'
        },
        {
          type: 'file',
          data: fs.readFileSync('./document.pdf'),
          mimeType: 'application/pdf'
        }
      ]
    }
  ]
});
```

## Advanced Features

### Event Callbacks
```typescript
const chat = useChat({
  onFinish: (message, { usage, finishReason }) => {
    console.log('Message completed:', message);
    console.log('Token usage:', usage);
  },
  onError: (error) => {
    console.error('Error occurred:', error);
  },
  onResponse: (response) => {
    console.log('Server response:', response);
  }
});
```

### Experimental Features

#### Attachments
```typescript
const chat = useChat({
  experimental_attachments: {
    files: fileList,
    urls: [
      {
        name: 'image.png',
        url: 'https://example.com/image.png',
        contentType: 'image/png'
      }
    ]
  }
});
```

## Model Capabilities Matrix

| Model | Image Input | Object Generation | Tool Usage | Computer Use |
|-------|-------------|-------------------|------------|--------------|
| claude-3-5-sonnet-20241022 | ✓ | ✓ | ✓ | ✓ |
| claude-3-5-sonnet-20240620 | ✓ | ✓ | ✓ | ✓ |
| claude-3-5-haiku-20241022 | ✓ | ✓ | ✓ | ✓ |
| claude-3-opus-20240229 | ✓ | ✓ | ✓ | ✘ |
| claude-3-sonnet-20240229 | ✓ | ✓ | ✓ | ✘ |
| claude-3-haiku-20240307 | ✓ | ✓ | ✓ | ✘ |