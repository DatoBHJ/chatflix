AI SDK 4.1 is now available!

Read Announcement
AI SDK by Vercel
Foundations

Overview
Providers and Models
Prompts
Tools
Streaming
Agents
Getting Started

Navigating the Library
Next.js App Router
Next.js Pages Router
Svelte
Nuxt
Node.js
Expo
Guides

RAG Chatbot
Multi-Modal Chatbot
Get started with Llama 3.1
Get started with OpenAI o1
Get started with OpenAI o3-mini
Get started with DeepSeek R1
Get started with Computer Use
Natural Language Postgres
AI SDK Core

Overview
Generating Text
Generating Structured Data
Tool Calling
Prompt Engineering
Settings
Embeddings
Image Generation
Provider Management
Language Model Middleware
Error Handling
Testing
Telemetry
AI SDK UI

Overview
Chatbot
Chatbot Message Persistence
Chatbot Tool Usage
Generative User Interfaces
Completion
Object Generation
OpenAI Assistants
Streaming Custom Data
Error Handling
Stream Protocols
AI SDK RSC

Advanced

Reference

AI SDK Core

generateText
streamText
generateObject
streamObject
embed
embedMany
generateImage
tool
jsonSchema
zodSchema
CoreMessage
createProviderRegistry
customProvider
cosineSimilarity
wrapLanguageModel
LanguageModelV1Middleware
extractReasoningMiddleware
simulateReadableStream
smoothStream
generateId
createIdGenerator
AI SDK UI

useChat
useCompletion
useObject
useAssistant
AssistantResponse
convertToCoreMessages
appendResponseMessages
appendClientMessage
createDataStream
createDataStreamResponse
pipeDataStreamToResponse
StreamData
AI SDK RSC

Stream Helpers

AI SDK Errors

Migration Guides

Troubleshooting

AI SDK UI
RAG Chatbot
Chatbot
The useChat hook makes it effortless to create a conversational user interface for your chatbot application. It enables the streaming of chat messages from your AI provider, manages the chat state, and updates the UI automatically as new messages arrive.

To summarize, the useChat hook provides the following features:

Message Streaming: All the messages from the AI provider are streamed to the chat UI in real-time.
Managed States: The hook manages the states for input, messages, loading, error and more for you.
Seamless Integration: Easily integrate your chat AI into any design or layout with minimal effort.
In this guide, you will learn how to use the useChat hook to create a chatbot application with real-time message streaming. Check out our chatbot with tools guide to learn how to use tools in your chatbot. Let's start with the following example first.

Example
app/page.tsx

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
app/api/chat/route.ts

import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Allow streaming responses up to 30 seconds
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
The UI messages have a new parts property that contains the message parts. We recommend rendering the messages using the parts property instead of the content property. The parts property supports different message types, including text, tool invocation, and tool result, and allows for more flexible and complex chat UIs.

In the Page component, the useChat hook will request to your AI provider endpoint whenever the user submits a message. The messages are then streamed back in real-time and displayed in the chat UI.

This enables a seamless chat experience where the user can see the AI response as soon as it is available, without having to wait for the entire response to be received.

Customized UI
useChat also provides ways to manage the chat message and input states via code, show loading and error states, and update messages without being triggered by user interactions.

Loading State
The isLoading state returned by the useChat hook can be used for several purposes

To show a loading spinner while the chatbot is processing the user's message.
To show a "Stop" button to abort the current message.
To disable the submit button.
app/page.tsx

'use client';

import { useChat } from 'ai/react';

export default function Page() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } =
    useChat({});

  return (
    <>
      {messages.map(message => (
        <div key={message.id}>
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.content}
        </div>
      ))}

      {isLoading && (
        <div>
          <Spinner />
          <button type="button" onClick={() => stop()}>
            Stop
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          name="prompt"
          value={input}
          onChange={handleInputChange}
          disabled={isLoading}
        />
        <button type="submit">Submit</button>
      </form>
    </>
  );
}
Error State
Similarly, the error state reflects the error object thrown during the fetch request. It can be used to display an error message, disable the submit button, or show a retry button:

We recommend showing a generic error message to the user, such as "Something went wrong." This is a good practice to avoid leaking information from the server.


'use client';

import { useChat } from 'ai/react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, error, reload } =
    useChat({});

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          {m.role}: {m.content}
        </div>
      ))}

      {error && (
        <>
          <div>An error occurred.</div>
          <button type="button" onClick={() => reload()}>
            Retry
          </button>
        </>
      )}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          disabled={error != null}
        />
      </form>
    </div>
  );
}
Please also see the error handling guide for more information.

Modify messages
Sometimes, you may want to directly modify some existing messages. For example, a delete button can be added to each message to allow users to remove them from the chat history.

The setMessages function can help you achieve these tasks:


const { messages, setMessages, ... } = useChat()

const handleDelete = (id) => {
  setMessages(messages.filter(message => message.id !== id))
}

return <>
  {messages.map(message => (
    <div key={message.id}>
      {message.role === 'user' ? 'User: ' : 'AI: '}
      {message.content}
      <button onClick={() => handleDelete(message.id)}>Delete</button>
    </div>
  ))}
  ...
You can think of messages and setMessages as a pair of state and setState in React.

Controlled input
In the initial example, we have handleSubmit and handleInputChange callbacks that manage the input changes and form submissions. These are handy for common use cases, but you can also use uncontrolled APIs for more advanced scenarios such as form validation or customized components.

The following example demonstrates how to use more granular APIs like setInput and append with your custom input and submit button components:


const { input, setInput, append } = useChat()

return <>
  <MyCustomInput value={input} onChange={value => setInput(value)} />
  <MySubmitButton onClick={() => {
    // Send a new message to the AI provider
    append({
      role: 'user',
      content: input,
    })
  }}/>
  ...
Cancelation and regeneration
It's also a common use case to abort the response message while it's still streaming back from the AI provider. You can do this by calling the stop function returned by the useChat hook.


const { stop, isLoading, ... } = useChat()

return <>
  <button onClick={stop} disabled={!isLoading}>Stop</button>
  ...
When the user clicks the "Stop" button, the fetch request will be aborted. This avoids consuming unnecessary resources and improves the UX of your chatbot application.

Similarly, you can also request the AI provider to reprocess the last message by calling the reload function returned by the useChat hook:


const { reload, isLoading, ... } = useChat()

return <>
  <button onClick={reload} disabled={isLoading}>Regenerate</button>
  ...
</>
When the user clicks the "Regenerate" button, the AI provider will regenerate the last message and replace the current one correspondingly.

Throttling UI Updates
This feature is currently only available for React.
By default, the useChat hook will trigger a render every time a new chunk is received. You can throttle the UI updates with the experimental_throttle option.

page.tsx

const { messages, ... } = useChat({
  // Throttle the messages and data updates to 50ms:
  experimental_throttle: 50
})
Event Callbacks
useChat provides optional event callbacks that you can use to handle different stages of the chatbot lifecycle:

onFinish: Called when the assistant message is completed
onError: Called when an error occurs during the fetch request.
onResponse: Called when the response from the API is received.
These callbacks can be used to trigger additional actions, such as logging, analytics, or custom UI updates.


import { Message } from 'ai/react';

const {
  /* ... */
} = useChat({
  onFinish: (message, { usage, finishReason }) => {
    console.log('Finished streaming message:', message);
    console.log('Token usage:', usage);
    console.log('Finish reason:', finishReason);
  },
  onError: error => {
    console.error('An error occurred:', error);
  },
  onResponse: response => {
    console.log('Received HTTP response from server:', response);
  },
});
It's worth noting that you can abort the processing by throwing an error in the onResponse callback. This will trigger the onError callback and stop the message from being appended to the chat UI. This can be useful for handling unexpected responses from the AI provider.

Request Configuration
Custom headers, body, and credentials
By default, the useChat hook sends a HTTP POST request to the /api/chat endpoint with the message list as the request body. You can customize the request by passing additional options to the useChat hook:


const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: '/api/custom-chat',
  headers: {
    Authorization: 'your_token',
  },
  body: {
    user_id: '123',
  },
  credentials: 'same-origin',
});
In this example, the useChat hook sends a POST request to the /api/custom-chat endpoint with the specified headers, additional body fields, and credentials for that fetch request. On your server side, you can handle the request with these additional information.

Setting custom body fields per request
You can configure custom body fields on a per-request basis using the body option of the handleSubmit function. This is useful if you want to pass in additional information to your backend that is not part of the message list.

app/page.tsx

'use client';

import { useChat } from 'ai/react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          {m.role}: {m.content}
        </div>
      ))}

      <form
        onSubmit={event => {
          handleSubmit(event, {
            body: {
              customKey: 'customValue',
            },
          });
        }}
      >
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
You can retrieve these custom fields on your server side by destructuring the request body:

app/api/chat/route.ts

export async function POST(req: Request) {
  // Extract addition information ("customKey") from the body of the request:
  const { messages, customKey } = await req.json();
  //...
}
Controlling the response stream
With streamText, you can control how error messages and usage information are sent back to the client.

Error Messages
By default, the error message is masked for security reasons. The default error message is "An error occurred." You can forward error messages or send your own error message by providing a getErrorMessage function:

app/api/chat/route.ts

import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  });

  return result.toDataStreamResponse({
    getErrorMessage: error => {
      if (error == null) {
        return 'unknown error';
      }

      if (typeof error === 'string') {
        return error;
      }

      if (error instanceof Error) {
        return error.message;
      }

      return JSON.stringify(error);
    },
  });
}
Usage Information
By default, the usage information is sent back to the client. You can disable it by setting the sendUsage option to false:

app/api/chat/route.ts

import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  });

  return result.toDataStreamResponse({
    sendUsage: false,
  });
}
Text Streams
useChat can handle plain text streams by setting the streamProtocol option to text:

app/page.tsx

'use client';

import { useChat } from 'ai/react';

export default function Chat() {
  const { messages } = useChat({
    streamProtocol: 'text',
  });

  return <>...</>;
}
This configuration also works with other backend servers that stream plain text. Check out the stream protocol guide for more information.

When using streamProtocol: 'text', tool calls, usage information and finish reasons are not available.

Empty Submissions
You can configure the useChat hook to allow empty submissions by setting the allowEmptySubmit option to true.

app/page.tsx

'use client';

import { useChat } from 'ai/react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          {m.role}: {m.content}
        </div>
      ))}

      <form
        onSubmit={event => {
          handleSubmit(event, {
            allowEmptySubmit: true,
          });
        }}
      >
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
Reasoning
Some models such as as DeepSeek deepseek-reasoner support reasoning tokens. These tokens are typically sent before the message content. You can forward them to the client with the sendReasoning option:

app/api/chat/route.ts

import { deepseek } from '@ai-sdk/deepseek';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: deepseek('deepseek-reasoner'),
    messages,
  });

  return result.toDataStreamResponse({
    sendReasoning: true,
  });
}
On the client side, you can access the reasoning parts of the message object:

app/page.tsx

messages.map(message => (
  <div key={message.id} className="whitespace-pre-wrap">
    {message.role === 'user' ? 'User: ' : 'AI: '}
    {message.parts.map((part, index) => {
      // text parts:
      if (part.type === 'text') {
        return <div key={index}>{part.text}</div>;
      }

      // reasoning parts:
      if (part.type === 'reasoning') {
        return <pre key={index}>{part.reasoning}</pre>;
      }
    })}
  </div>
));
Attachments (Experimental)
The useChat hook supports sending attachments along with a message as well as rendering them on the client. This can be useful for building applications that involve sending images, files, or other media content to the AI provider.

There are two ways to send attachments with a message, either by providing a FileList object or a list of URLs to the handleSubmit function:

FileList
By using FileList, you can send multiple files as attachments along with a message using the file input element. The useChat hook will automatically convert them into data URLs and send them to the AI provider.

Currently, only image/* and text/* content types get automatically converted into multi-modal content parts. You will need to handle other content types manually.

app/page.tsx

'use client';

import { useChat } from 'ai/react';
import { useRef, useState } from 'react';

export default function Page() {
  const { messages, input, handleSubmit, handleInputChange, isLoading } =
    useChat();

  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div>
        {messages.map(message => (
          <div key={message.id}>
            <div>{`${message.role}: `}</div>

            <div>
              {message.content}

              <div>
                {message.experimental_attachments
                  ?.filter(attachment =>
                    attachment.contentType.startsWith('image/'),
                  )
                  .map((attachment, index) => (
                    <img
                      key={`${message.id}-${index}`}
                      src={attachment.url}
                      alt={attachment.name}
                    />
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={event => {
          handleSubmit(event, {
            experimental_attachments: files,
          });

          setFiles(undefined);

          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
      >
        <input
          type="file"
          onChange={event => {
            if (event.target.files) {
              setFiles(event.target.files);
            }
          }}
          multiple
          ref={fileInputRef}
        />
        <input
          value={input}
          placeholder="Send message..."
          onChange={handleInputChange}
          disabled={isLoading}
        />
      </form>
    </div>
  );
}
URLs
You can also send URLs as attachments along with a message. This can be useful for sending links to external resources or media content.

Note: The URL can also be a data URL, which is a base64-encoded string that represents the content of a file. Currently, only image/* content types get automatically converted into multi-modal content parts. You will need to handle other content types manually.

app/page.tsx

'use client';

import { useChat } from 'ai/react';
import { useState } from 'react';
import { Attachment } from '@ai-sdk/ui-utils';

export default function Page() {
  const { messages, input, handleSubmit, handleInputChange, isLoading } =
    useChat();

  const [attachments] = useState<Attachment[]>([
    {
      name: 'earth.png',
      contentType: 'image/png',
      url: 'https://example.com/earth.png',
    },
    {
      name: 'moon.png',
      contentType: 'image/png',
      url: 'data:image/png;base64,iVBORw0KGgo...',
    },
  ]);

  return (
    <div>
      <div>
        {messages.map(message => (
          <div key={message.id}>
            <div>{`${message.role}: `}</div>

            <div>
              {message.content}

              <div>
                {message.experimental_attachments
                  ?.filter(attachment =>
                    attachment.contentType?.startsWith('image/'),
                  )
                  .map((attachment, index) => (
                    <img
                      key={`${message.id}-${index}`}
                      src={attachment.url}
                      alt={attachment.name}
                    />
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={event => {
          handleSubmit(event, {
            experimental_attachments: attachments,
          });
        }}
      >
        <input
          value={input}
          placeholder="Send message..."
          onChange={handleInputChange}
          disabled={isLoading}
        />
      </form>
    </div>
  );
}
Previous
Overview
Next
Chatbot Message Persistence
On this page
Chatbot
Example
Customized UI
Loading State
Error State
Modify messages
Controlled input
Cancelation and regeneration
Throttling UI Updates
Event Callbacks
Request Configuration
Custom headers, body, and credentials
Setting custom body fields per request
Controlling the response stream
Error Messages
Usage Information
Text Streams
Empty Submissions
Reasoning
Attachments (Experimental)
FileList
URLs
Elevate your AI applications with Vercel.
Trusted by OpenAI, Replicate, Suno, Pinecone, and more.
Vercel provides tools and infrastructure to deploy AI apps and features at scale.
Resources
Docs
Cookbook
Providers
Showcase
GitHub
Discussions
More
Playground
Contact Sales
About Vercel
Next.js + Vercel
Open Source Software
GitHub
X
Legal
Privacy Policy
© 2025 Vercel, Inc.




AI SDK UI: Chatbot

---

AI SDK Core
customProvider
customProvider()
With a custom provider, you can map ids to any model. This allows you to set up custom model configurations, alias names, and more. The custom provider also supports a fallback provider, which is useful for wrapping existing providers and adding additional functionality.

Example: custom model settings
You can create a custom provider using customProvider.


import { openai } from '@ai-sdk/openai';
import { customProvider } from 'ai';

// custom provider with different model settings:
export const myOpenAI = customProvider({
  languageModels: {
    // replacement model with custom settings:
    'gpt-4': openai('gpt-4', { structuredOutputs: true }),
    // alias model with custom settings:
    'gpt-4o-structured': openai('gpt-4o', { structuredOutputs: true }),
  },
  fallbackProvider: openai,
});
Import
import {  customProvider } from "ai"
API Signature
Parameters
languageModels?:
Record<string, LanguageModel>
A record of language models, where keys are model IDs and values are LanguageModel instances.
textEmbeddingModels?:
Record<string, EmbeddingModelV1<string>>
A record of text embedding models, where keys are model IDs and values are EmbeddingModel<string> instances.
imageModels?:
Record<string, ImageModelV1>
A record of image models, where keys are model IDs and values are ImageModelV1 instances.
fallbackProvider?:
Provider
An optional fallback provider to use when a requested model is not found in the custom provider.
Returns
The customProvider function returns a Provider instance. It has the following methods:

languageModel:
(id: string) => LanguageModel
A function that returns a language model by its id (format: providerId:modelId)
textEmbeddingModel:
(id: string) => EmbeddingModel<string>
A function that returns a text embedding model by its id (format: providerId:modelId)
imageModel:
(id: string) => ImageModel
A function that returns an image model by its id (format: providerId:modelId)
Previous
createProviderRegistry

---

Streaming
Streaming conversational text UIs (like ChatGPT) have gained massive popularity over the past few months. This section explores the benefits and drawbacks of streaming and blocking interfaces.

Large language models (LLMs) are extremely powerful. However, when generating long outputs, they can be very slow compared to the latency you're likely used to. If you try to build a traditional blocking UI, your users might easily find themselves staring at loading spinners for 5, 10, even up to 40s waiting for the entire LLM response to be generated. This can lead to a poor user experience, especially in conversational applications like chatbots. Streaming UIs can help mitigate this issue by displaying parts of the response as they become available.

Blocking UI

Blocking responses wait until the full response is available before displaying it.

Streaming UI

Streaming responses can transmit parts of the response as they become available.

Real-world Examples
Here are 2 examples that illustrate how streaming UIs can improve user experiences in a real-world setting – the first uses a blocking UI, while the second uses a streaming UI.

Blocking UI
Come up with the first 200 characters of the first book in the Harry Potter series.
Generate
...
Streaming UI
Come up with the first 200 characters of the first book in the Harry Potter series.
Generate
...
As you can see, the streaming UI is able to start displaying the response much faster than the blocking UI. This is because the blocking UI has to wait for the entire response to be generated before it can display anything, while the streaming UI can display parts of the response as they become available.

While streaming interfaces can greatly enhance user experiences, especially with larger language models, they aren't always necessary or beneficial. If you can achieve your desired functionality using a smaller, faster model without resorting to streaming, this route can often lead to simpler and more manageable development processes.

However, regardless of the speed of your model, the AI SDK is designed to make implementing streaming UIs as simple as possible. In the example below, we stream text generation from OpenAI's gpt-4-turbo in under 10 lines of code using the SDK's streamText function:


import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

const { textStream } = streamText({
  model: openai('gpt-4-turbo'),
  prompt: 'Write a poem about embedding models.',
});

for await (const textPart of textStream) {
  console.log(textPart);
}
For an introduction to streaming

---

Stream Protocols
AI SDK UI functions such as useChat and useCompletion support both text streams and data streams. The stream protocol defines how the data is streamed to the frontend on top of the HTTP protocol.

This page describes both protocols and how to use them in the backend and frontend.

You can use this information to develop custom backends and frontends for your use case, e.g., to provide compatible API endpoints that are implemented in a different language such as Python.

For instance, here's an example using FastAPI as a backend.

Text Stream Protocol
A text stream contains chunks in plain text, that are streamed to the frontend. Each chunk is then appended together to form a full text response.

Text streams are supported by useChat, useCompletion, and useObject. When you use useChat or useCompletion, you need to enable text streaming by setting the streamProtocol options to text.

You can generate text streams with streamText in the backend. When you call toTextStreamResponse() on the result object, a streaming HTTP response is returned.

Text streams only support basic text data. If you need to stream other types of data such as tool calls, use data streams.

Text Stream Example
Here is a Next.js example that uses the text stream protocol:

app/page.tsx

'use client';

import { useCompletion } from 'ai/react';

export default function Page() {
  const { completion, input, handleInputChange, handleSubmit } = useCompletion({
    streamProtocol: 'text',
  });

  return (
    <form onSubmit={handleSubmit}>
      <input name="prompt" value={input} onChange={handleInputChange} />
      <button type="submit">Submit</button>
      <div>{completion}</div>
    </form>
  );
}
app/api/completion/route.ts

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    prompt,
  });

  return result.toTextStreamResponse();
}
Data Stream Protocol
A data stream follows a special protocol that the AI SDK provides to send information to the frontend.

Each stream part has the format TYPE_ID:CONTENT_JSON\n.


When you provide data streams from a custom backend, you need to set the x-vercel-ai-data-stream header to v1.

The following stream parts are currently supported:

Text Part
The text parts are appended to the message as they are received.

Format: 0:string\n

Example: 0:"example"\n


Reasoning Part
The reasoning parts are appended to the message as they are received. The reasoning part is available through reasoning.

Format: g:string\n

Example: g:"I will open the conversation with witty banter."\n

Data Part
The data parts are parsed as JSON and appended to the message as they are received. The data part is available through data.

Format: 2:Array<JSONValue>\n

Example: 2:[{"key":"object1"},{"anotherKey":"object2"}]\n


Message Annotation Part
The message annotation parts are appended to the message as they are received. The annotation part is available through annotations.

Format: 8:Array<JSONValue>\n

Example: 8:[{"id":"message-123","other":"annotation"}]\n

Error Part
The error parts are appended to the message as they are received.

Format: 3:string\n

Example: 3:"error message"\n


Tool Call Streaming Start Part
A part indicating the start of a streaming tool call. This part needs to be sent before any tool call delta for that tool call. Tool call streaming is optional, you can use tool call and tool result parts without it.

Format: b:{toolCallId:string; toolName:string}\n

Example: b:{"toolCallId":"call-456","toolName":"streaming-tool"}\n


Tool Call Delta Part
A part representing a delta update for a streaming tool call.

Format: c:{toolCallId:string; argsTextDelta:string}\n

Example: c:{"toolCallId":"call-456","argsTextDelta":"partial arg"}\n


Tool Call Part
A part representing a tool call. When there are streamed tool calls, the tool call part needs to come after the tool call streaming is finished.

Format: 9:{toolCallId:string; toolName:string; args:object}\n

Example: 9:{"toolCallId":"call-123","toolName":"my-tool","args":{"some":"argument"}}\n


Tool Result Part
A part representing a tool result. The result part needs to be sent after the tool call part for that tool call.

Format: a:{toolCallId:string; result:object}\n

Example: a:{"toolCallId":"call-123","result":"tool output"}\n


Start Step Part
A part indicating the start of a step.

It includes the following metadata:

messageId to indicate the id of the message that this step belongs to.
Format: f:{id:string}\n

Example: f:{"id":"step_123"}\n

Finish Step Part
A part indicating that a step (i.e., one LLM API call in the backend) has been completed.

This part is necessary to correctly process multiple stitched assistant calls, e.g. when calling tools in the backend, and using steps in useChat at the same time.

It includes the following metadata:

FinishReason
Usage for that step.
isContinued to indicate if the step text will be continued in the next step.
The finish step part needs to come at the end of a step.

Format: e:{finishReason:'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown';usage:{promptTokens:number; completionTokens:number;},isContinued:boolean}\n

Example: e:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":20},"isContinued":false}\n

Finish Message Part
A part indicating the completion of a message with additional metadata, such as FinishReason and Usage. This part needs to be the last part in the stream.

Format: d:{finishReason:'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown';usage:{promptTokens:number; completionTokens:number;}}\n

Example: d:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":20}}\n


The data stream protocol is supported by useChat and useCompletion on the frontend and used by default. useCompletion only supports the text and data stream parts.

On the backend, you can use toDataStreamResponse() from the streamText result object to return a streaming HTTP response.

Data Stream Example
Here is a Next.js example that uses the data stream protocol:

app/page.tsx

'use client';

import { useCompletion } from 'ai/react';

export default function Page() {
  const { completion, input, handleInputChange, handleSubmit } = useCompletion({
    streamProtocol: 'data', // optional, this is the default
  });

  return (
    <form onSubmit={handleSubmit}>
      <input name="prompt" value={input} onChange={handleInputChange} />
      <button type="submit">Submit</button>
      <div>{completion}</div>
    </form>
  );
}
app/api/completion/route.ts

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    prompt,
  });

  return result.toDataStreamResponse();
}


---

Extract Reasoning
Some providers and models expose reasoning information in the generated text using special tags, e.g. <think> and </think>.

The extractReasoningMiddleware function can be used to extract this reasoning information and expose it as a reasoning property on the result.


import { wrapLanguageModel, extractReasoningMiddleware } from 'ai';

const model = wrapLanguageModel({
  model: yourModel,
  middleware: extractReasoningMiddleware({ tagName: 'think' }),
});
You can then use that enhanced model in functions like generateText and streamText.


---

Reasoning
Some models such as as DeepSeek deepseek-reasoner support reasoning tokens. These tokens are typically sent before the message content. You can forward them to the client with the sendReasoning option:

app/api/chat/route.ts

import { deepseek } from '@ai-sdk/deepseek';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: deepseek('deepseek-reasoner'),
    messages,
  });

  return result.toDataStreamResponse({
    sendReasoning: true,
  });
}
On the client side, you can access the reasoning parts of the message object:

app/page.tsx

messages.map(message => (
  <div key={message.id} className="whitespace-pre-wrap">
    {message.role === 'user' ? 'User: ' : 'AI: '}
    {message.parts.map((part, index) => {
      // text parts:
      if (part.type === 'text') {
        return <div key={index}>{part.text}</div>;
      }

      // reasoning parts:
      if (part.type === 'reasoning') {
        return <pre key={index}>{part.reasoning}</pre>;
      }
    })}
  </div>
));


---

AI SDK 4.1 is now available!

Read Announcement
AI SDK Providers

OpenAI
Azure OpenAI
Anthropic
Amazon Bedrock
Google Generative AI
Google Vertex AI
Mistral AI
xAI Grok
Together.ai
Cohere
Fireworks
DeepInfra
DeepSeek
Cerebras
Groq
Replicate
Perplexity
Luma
Fal
OpenAI Compatible Providers

Writing a Custom Provider
LM Studio
NVIDIA NIM
Baseten
Community Providers

Writing a Custom Provider
Ollama
Chrome AI
FriendliAI
Portkey
Cloudflare Workers AI
OpenRouter
Crosshatch
Mixedbread
Voyage AI
Mem0
LLamaCpp
Anthropic Vertex
Spark
Adapters

LangChain
LlamaIndex
Observability Integrations

Braintrust
Laminar
Langfuse
LangSmith
LangWatch
Traceloop
AI SDK Providers
Anthropic
Anthropic Provider
The Anthropic provider contains language model support for the Anthropic Messages API.

Setup
The Anthropic provider is available in the @ai-sdk/anthropic module. You can install it with

pnpm
npm
yarn
pnpm add @ai-sdk/anthropic
Provider Instance
You can import the default provider instance anthropic from @ai-sdk/anthropic:


import { anthropic } from '@ai-sdk/anthropic';
If you need a customized setup, you can import createAnthropic from @ai-sdk/anthropic and create a provider instance with your settings:


import { createAnthropic } from '@ai-sdk/anthropic';

const anthropic = createAnthropic({
  // custom settings
});
You can use the following optional settings to customize the Anthropic provider instance:

baseURL string

Use a different URL prefix for API calls, e.g. to use proxy servers. The default prefix is https://api.anthropic.com/v1.

apiKey string

API key that is being sent using the x-api-key header. It defaults to the ANTHROPIC_API_KEY environment variable.

headers Record<string,string>

Custom headers to include in the requests.

fetch (input: RequestInfo, init?: RequestInit) => Promise<Response>

Custom fetch implementation. Defaults to the global fetch function. You can use it as a middleware to intercept requests, or to provide a custom fetch implementation for e.g. testing.

Language Models
You can create models that call the Anthropic Messages API using the provider instance. The first argument is the model id, e.g. claude-3-haiku-20240307. Some models have multi-modal capabilities.


const model = anthropic('claude-3-haiku-20240307');
You can use Anthropic language models to generate text with the generateText function:


import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const { text } = await generateText({
  model: anthropic('claude-3-haiku-20240307'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
Anthropic language models can also be used in the streamText, generateObject, and streamObject functions (see AI SDK Core and AI SDK RSC).

The Anthropic API returns streaming tool calls all at once after a delay. This causes the streamObject function to generate the object fully after a delay instead of streaming it incrementally.

Cache Control
Anthropic cache control was originally a beta feature and required passing an opt-in cacheControl setting when creating the model instance. It is now Generally Available and enabled by default. The cacheControl setting is no longer needed and will be removed in a future release.

In the messages and message parts, you can use the providerOptions property to set cache control breakpoints. You need to set the anthropic property in the providerOptions object to { cacheControl: { type: 'ephemeral' } } to set a cache control breakpoint.

The cache creation input tokens are then returned in the experimental_providerMetadata object for generateText and generateObject, again under the anthropic property. When you use streamText or streamObject, the response contains a promise that resolves to the metadata. Alternatively you can receive it in the onFinish callback.


import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const errorMessage = '... long error message ...';

const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20240620'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'You are a JavaScript expert.' },
        {
          type: 'text',
          text: `Error message: ${errorMessage}`,
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
        { type: 'text', text: 'Explain the error message.' },
      ],
    },
  ],
});

console.log(result.text);
console.log(result.experimental_providerMetadata?.anthropic);
// e.g. { cacheCreationInputTokens: 2118, cacheReadInputTokens: 0 }
You can also use cache control on system messages by providing multiple system messages at the head of your messages array:


const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20240620'),
  messages: [
    {
      role: 'system',
      content: 'Cached system message part',
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    },
    {
      role: 'system',
      content: 'Uncached system message part',
    },
    {
      role: 'user',
      content: 'User prompt',
    },
  ],
});
For more on prompt caching with Anthropic, see Anthropic's Cache Control documentation.

Computer Use
Anthropic provides three built-in tools that can be used to interact with external systems:

Bash Tool: Allows running bash commands.
Text Editor Tool: Provides functionality for viewing and editing text files.
Computer Tool: Enables control of keyboard and mouse actions on a computer.
They are available via the tools property of the provider instance.

Bash Tool
The Bash Tool allows running bash commands. Here's how to create and use it:


const bashTool = anthropic.tools.bash_20241022({
  execute: async ({ command, restart }) => {
    // Implement your bash command execution logic here
    // Return the result of the command execution
  },
});
Parameters:

command (string): The bash command to run. Required unless the tool is being restarted.
restart (boolean, optional): Specifying true will restart this tool.
Text Editor Tool
The Text Editor Tool provides functionality for viewing and editing text files:


const textEditorTool = anthropic.tools.textEditor_20241022({
  execute: async ({
    command,
    path,
    file_text,
    insert_line,
    new_str,
    old_str,
    view_range,
  }) => {
    // Implement your text editing logic here
    // Return the result of the text editing operation
  },
});
Parameters:

command ('view' | 'create' | 'str_replace' | 'insert' | 'undo_edit'): The command to run.
path (string): Absolute path to file or directory, e.g. /repo/file.py or /repo.
file_text (string, optional): Required for create command, with the content of the file to be created.
insert_line (number, optional): Required for insert command. The line number after which to insert the new string.
new_str (string, optional): New string for str_replace or insert commands.
old_str (string, optional): Required for str_replace command, containing the string to replace.
view_range (number[], optional): Optional for view command to specify line range to show.
Computer Tool
The Computer Tool enables control of keyboard and mouse actions on a computer:


const computerTool = anthropic.tools.computer_20241022({
  displayWidthPx: 1920,
  displayHeightPx: 1080,
  displayNumber: 0, // Optional, for X11 environments

  execute: async ({ action, coordinate, text }) => {
    // Implement your computer control logic here
    // Return the result of the action

    // Example code:
    switch (action) {
      case 'screenshot': {
        // multipart result:
        return {
          type: 'image',
          data: fs
            .readFileSync('./data/screenshot-editor.png')
            .toString('base64'),
        };
      }
      default: {
        console.log('Action:', action);
        console.log('Coordinate:', coordinate);
        console.log('Text:', text);
        return `executed ${action}`;
      }
    }
  },

  // map to tool result content for LLM consumption:
  experimental_toToolResultContent(result) {
    return typeof result === 'string'
      ? [{ type: 'text', text: result }]
      : [{ type: 'image', data: result.data, mimeType: 'image/png' }];
  },
});
Parameters:

action ('key' | 'type' | 'mouse_move' | 'left_click' | 'left_click_drag' | 'right_click' | 'middle_click' | 'double_click' | 'screenshot' | 'cursor_position'): The action to perform.
coordinate (number[], optional): Required for mouse_move and left_click_drag actions. Specifies the (x, y) coordinates.
text (string, optional): Required for type and key actions.
These tools can be used in conjunction with the sonnet-3-5-sonnet-20240620 model to enable more complex interactions and tasks.

PDF support
Anthropic Sonnet claude-3-5-sonnet-20241022 supports reading PDF files. You can pass PDF files as part of the message content using the file type:


const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'What is an embedding model according to this document?',
        },
        {
          type: 'file',
          data: fs.readFileSync('./data/ai.pdf'),
          mimeType: 'application/pdf',
        },
      ],
    },
  ],
});
The model will have access to the contents of the PDF file and respond to questions about it. The PDF file should be passed using the data field, and the mimeType should be set to 'application/pdf'.

Model Capabilities
Model	Image Input	Object Generation	Tool Usage	Computer Use
claude-3-5-sonnet-20241022				
claude-3-5-sonnet-20240620				
claude-3-5-haiku-20241022				
claude-3-opus-20240229				
claude-3-sonnet-20240229				
claude-3-haiku-20240307				
The table above lists popular models. Please see the Anthropic docs for a full list of available models. The table above lists popular models. You can also pass any available provider model ID as a string if needed.

On this page
Anthropic Provider
Setup
Provider Instance
Language Models
Cache Control
Computer Use
Bash Tool
Text Editor Tool
Computer Tool
PDF support
Model Capabilities
Elevate your AI applications with Vercel.
Trusted by OpenAI, Replicate, Suno, Pinecone, and more.
Vercel provides tools and infrastructure to deploy AI apps and features at scale.
Resources
Docs
Cookbook
Providers
Showcase
GitHub
Discussions
More
Playground
Contact Sales
About Vercel
Next.js + Vercel
Open Source Software
GitHub
X
Legal
Privacy Policy
© 2025 Vercel, Inc.




AI SDK Providers: Anthropic