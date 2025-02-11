[AI SDK](https://sdk.vercel.ai/)

Search…
`⌘ K`

Feedback [GitHub](https://github.com/vercel/ai)

Sign in with Vercel

Sign in with Vercel

Menu

[AI SDK by Vercel](https://sdk.vercel.ai/docs/introduction)

[Foundations](https://sdk.vercel.ai/docs/foundations)

[Overview](https://sdk.vercel.ai/docs/foundations/overview)

[Providers and Models](https://sdk.vercel.ai/docs/foundations/providers-and-models)

[Prompts](https://sdk.vercel.ai/docs/foundations/prompts)

[Tools](https://sdk.vercel.ai/docs/foundations/tools)

[Streaming](https://sdk.vercel.ai/docs/foundations/streaming)

[Agents](https://sdk.vercel.ai/docs/foundations/agents)

[Getting Started](https://sdk.vercel.ai/docs/getting-started)

[Navigating the Library](https://sdk.vercel.ai/docs/getting-started/navigating-the-library)

[Next.js App Router](https://sdk.vercel.ai/docs/getting-started/nextjs-app-router)

[Next.js Pages Router](https://sdk.vercel.ai/docs/getting-started/nextjs-pages-router)

[Svelte](https://sdk.vercel.ai/docs/getting-started/svelte)

[Nuxt](https://sdk.vercel.ai/docs/getting-started/nuxt)

[Node.js](https://sdk.vercel.ai/docs/getting-started/nodejs)

[Expo](https://sdk.vercel.ai/docs/getting-started/expo)

[Guides](https://sdk.vercel.ai/docs/guides)

[RAG Chatbot](https://sdk.vercel.ai/docs/guides/rag-chatbot)

[Multi-Modal Chatbot](https://sdk.vercel.ai/docs/guides/multi-modal-chatbot)

[Get started with Llama 3.1](https://sdk.vercel.ai/docs/guides/llama-3_1)

[Get started with OpenAI o1](https://sdk.vercel.ai/docs/guides/o1)

[Get started with OpenAI o3-mini](https://sdk.vercel.ai/docs/guides/o3)

[Get started with DeepSeek R1](https://sdk.vercel.ai/docs/guides/r1)

[Get started with Computer Use](https://sdk.vercel.ai/docs/guides/computer-use)

[Natural Language Postgres](https://sdk.vercel.ai/docs/guides/natural-language-postgres)

[AI SDK Core](https://sdk.vercel.ai/docs/ai-sdk-core)

[Overview](https://sdk.vercel.ai/docs/ai-sdk-core/overview)

[Generating Text](https://sdk.vercel.ai/docs/ai-sdk-core/generating-text)

[Generating Structured Data](https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data)

[Tool Calling](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)

[Prompt Engineering](https://sdk.vercel.ai/docs/ai-sdk-core/prompt-engineering)

[Settings](https://sdk.vercel.ai/docs/ai-sdk-core/settings)

[Embeddings](https://sdk.vercel.ai/docs/ai-sdk-core/embeddings)

[Image Generation](https://sdk.vercel.ai/docs/ai-sdk-core/image-generation)

[Provider Management](https://sdk.vercel.ai/docs/ai-sdk-core/provider-management)

[Language Model Middleware](https://sdk.vercel.ai/docs/ai-sdk-core/middleware)

[Error Handling](https://sdk.vercel.ai/docs/ai-sdk-core/error-handling)

[Testing](https://sdk.vercel.ai/docs/ai-sdk-core/testing)

[Telemetry](https://sdk.vercel.ai/docs/ai-sdk-core/telemetry)

[AI SDK UI](https://sdk.vercel.ai/docs/ai-sdk-ui)

[Overview](https://sdk.vercel.ai/docs/ai-sdk-ui/overview)

[Chatbot](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot)

[Chatbot Message Persistence](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot-message-persistence)

[Chatbot Tool Usage](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot-tool-usage)

[Generative User Interfaces](https://sdk.vercel.ai/docs/ai-sdk-ui/generative-user-interfaces)

[Completion](https://sdk.vercel.ai/docs/ai-sdk-ui/completion)

[Object Generation](https://sdk.vercel.ai/docs/ai-sdk-ui/object-generation)

[OpenAI Assistants](https://sdk.vercel.ai/docs/ai-sdk-ui/openai-assistants)

[Streaming Custom Data](https://sdk.vercel.ai/docs/ai-sdk-ui/streaming-data)

[Error Handling](https://sdk.vercel.ai/docs/ai-sdk-ui/error-handling)

[Stream Protocols](https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol)

[AI SDK RSC](https://sdk.vercel.ai/docs/ai-sdk-rsc)

[Advanced](https://sdk.vercel.ai/docs/advanced)

[Reference](https://sdk.vercel.ai/docs/reference)

[AI SDK Core](https://sdk.vercel.ai/docs/reference/ai-sdk-core)

[AI SDK UI](https://sdk.vercel.ai/docs/reference/ai-sdk-ui)

[AI SDK RSC](https://sdk.vercel.ai/docs/reference/ai-sdk-rsc)

[Stream Helpers](https://sdk.vercel.ai/docs/reference/stream-helpers)

[AI SDK Errors](https://sdk.vercel.ai/docs/reference/ai-sdk-errors)

[Migration Guides](https://sdk.vercel.ai/docs/migration-guides)

[Troubleshooting](https://sdk.vercel.ai/docs/troubleshooting)

# [Chatbot](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#chatbot)

The `useChat` hook makes it effortless to create a conversational user interface for your chatbot application. It enables the streaming of chat messages from your AI provider, manages the chat state, and updates the UI automatically as new messages arrive.

To summarize, the `useChat` hook provides the following features:

- **Message Streaming**: All the messages from the AI provider are streamed to the chat UI in real-time.
- **Managed States**: The hook manages the states for input, messages, loading, error and more for you.
- **Seamless Integration**: Easily integrate your chat AI into any design or layout with minimal effort.

In this guide, you will learn how to use the `useChat` hook to create a chatbot application with real-time message streaming.
Check out our [chatbot with tools guide](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot-with-tool-calling) to learn how to use tools in your chatbot.
Let's start with the following example first.

## [Example](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#example)

app/page.tsx

```code-block_code__NPwDy

'use client';

import { useChat } from '@ai-sdk/react';

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

app/api/chat/route.ts

```code-block_code__NPwDy

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
```

The UI messages have a new `parts` property that contains the message parts.
We recommend rendering the messages using the `parts` property instead of the
`content` property. The parts property supports different message types,
including text, tool invocation, and tool result, and allows for more flexible
and complex chat UIs.

In the `Page` component, the `useChat` hook will request to your AI provider endpoint whenever the user submits a message.
The messages are then streamed back in real-time and displayed in the chat UI.

This enables a seamless chat experience where the user can see the AI response as soon as it is available,
without having to wait for the entire response to be received.

## [Customized UI](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#customized-ui)

`useChat` also provides ways to manage the chat message and input states via code, show loading and error states, and update messages without being triggered by user interactions.

### [Loading State](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#loading-state)

The `isLoading` state returned by the `useChat` hook can be used for several
purposes

- To show a loading spinner while the chatbot is processing the user's message.
- To show a "Stop" button to abort the current message.
- To disable the submit button.

app/page.tsx

```code-block_code__NPwDy

'use client';

import { useChat } from '@ai-sdk/react';

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
```

### [Error State](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#error-state)

Similarly, the `error` state reflects the error object thrown during the fetch request.
It can be used to display an error message, disable the submit button, or show a retry button:

We recommend showing a generic error message to the user, such as "Something
went wrong." This is a good practice to avoid leaking information from the
server.

```code-block_code__NPwDy

'use client';

import { useChat } from '@ai-sdk/react';

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
```

Please also see the [error handling](https://sdk.vercel.ai/docs/ai-sdk-ui/error-handling) guide for more information.

### [Modify messages](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#modify-messages)

Sometimes, you may want to directly modify some existing messages. For example, a delete button can be added to each message to allow users to remove them from the chat history.

The `setMessages` function can help you achieve these tasks:

```code-block_code__NPwDy

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
```

You can think of `messages` and `setMessages` as a pair of `state` and `setState` in React.

### [Controlled input](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#controlled-input)

In the initial example, we have `handleSubmit` and `handleInputChange` callbacks that manage the input changes and form submissions. These are handy for common use cases, but you can also use uncontrolled APIs for more advanced scenarios such as form validation or customized components.

The following example demonstrates how to use more granular APIs like `setInput` and `append` with your custom input and submit button components:

```code-block_code__NPwDy

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
```

### [Cancelation and regeneration](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#cancelation-and-regeneration)

It's also a common use case to abort the response message while it's still streaming back from the AI provider. You can do this by calling the `stop` function returned by the `useChat` hook.

```code-block_code__NPwDy

const { stop, isLoading, ... } = useChat()

return <>

  <button onClick={stop} disabled={!isLoading}>Stop</button>

  ...
```

When the user clicks the "Stop" button, the fetch request will be aborted. This avoids consuming unnecessary resources and improves the UX of your chatbot application.

Similarly, you can also request the AI provider to reprocess the last message by calling the `reload` function returned by the `useChat` hook:

```code-block_code__NPwDy

const { reload, isLoading, ... } = useChat()

return <>

  <button onClick={reload} disabled={isLoading}>Regenerate</button>

  ...

</>
```

When the user clicks the "Regenerate" button, the AI provider will regenerate the last message and replace the current one correspondingly.

### [Throttling UI Updates](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#throttling-ui-updates)

This feature is currently only available for React.

By default, the `useChat` hook will trigger a render every time a new chunk is received.
You can throttle the UI updates with the `experimental_throttle` option.

page.tsx

```code-block_code__NPwDy

const { messages, ... } = useChat({

  // Throttle the messages and data updates to 50ms:

  experimental_throttle: 50

})
```

## [Event Callbacks](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#event-callbacks)

`useChat` provides optional event callbacks that you can use to handle different stages of the chatbot lifecycle:

- `onFinish`: Called when the assistant message is completed
- `onError`: Called when an error occurs during the fetch request.
- `onResponse`: Called when the response from the API is received.

These callbacks can be used to trigger additional actions, such as logging, analytics, or custom UI updates.

```code-block_code__NPwDy

import { Message } from '@ai-sdk/react';

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
```

It's worth noting that you can abort the processing by throwing an error in the `onResponse` callback. This will trigger the `onError` callback and stop the message from being appended to the chat UI. This can be useful for handling unexpected responses from the AI provider.

## [Request Configuration](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#request-configuration)

### [Custom headers, body, and credentials](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#custom-headers-body-and-credentials)

By default, the `useChat` hook sends a HTTP POST request to the `/api/chat` endpoint with the message list as the request body. You can customize the request by passing additional options to the `useChat` hook:

```code-block_code__NPwDy

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
```

In this example, the `useChat` hook sends a POST request to the `/api/custom-chat` endpoint with the specified headers, additional body fields, and credentials for that fetch request. On your server side, you can handle the request with these additional information.

### [Setting custom body fields per request](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#setting-custom-body-fields-per-request)

You can configure custom `body` fields on a per-request basis using the `body` option of the `handleSubmit` function.
This is useful if you want to pass in additional information to your backend that is not part of the message list.

app/page.tsx

```code-block_code__NPwDy

'use client';

import { useChat } from '@ai-sdk/react';

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
```

You can retrieve these custom fields on your server side by destructuring the request body:

app/api/chat/route.ts

```code-block_code__NPwDy

export async function POST(req: Request) {

  // Extract addition information ("customKey") from the body of the request:

  const { messages, customKey } = await req.json();

  //...

}
```

## [Controlling the response stream](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#controlling-the-response-stream)

With `streamText`, you can control how error messages and usage information are sent back to the client.

### [Error Messages](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#error-messages)

By default, the error message is masked for security reasons.
The default error message is "An error occurred."
You can forward error messages or send your own error message by providing a `getErrorMessage` function:

app/api/chat/route.ts

```code-block_code__NPwDy

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
```

### [Usage Information](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#usage-information)

By default, the usage information is sent back to the client. You can disable it by setting the `sendUsage` option to `false`:

app/api/chat/route.ts

```code-block_code__NPwDy

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
```

### [Text Streams](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#text-streams)

`useChat` can handle plain text streams by setting the `streamProtocol` option to `text`:

app/page.tsx

```code-block_code__NPwDy

'use client';

import { useChat } from '@ai-sdk/react';

export default function Chat() {

  const { messages } = useChat({

    streamProtocol: 'text',

  });

  return <>...</>;

}
```

This configuration also works with other backend servers that stream plain text.
Check out the [stream protocol guide](https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol) for more information.

When using `streamProtocol: 'text'`, tool calls, usage information and finish
reasons are not available.

## [Empty Submissions](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#empty-submissions)

You can configure the `useChat` hook to allow empty submissions by setting the `allowEmptySubmit` option to `true`.

app/page.tsx

```code-block_code__NPwDy

'use client';

import { useChat } from '@ai-sdk/react';

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
```

## [Reasoning](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#reasoning)

Some models such as as DeepSeek `deepseek-reasoner` support reasoning tokens.
These tokens are typically sent before the message content.
You can forward them to the client with the `sendReasoning` option:

app/api/chat/route.ts

```code-block_code__NPwDy

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
```

On the client side, you can access the reasoning parts of the message object:

app/page.tsx

```code-block_code__NPwDy

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
```

## [Attachments (Experimental)](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#attachments-experimental)

The `useChat` hook supports sending attachments along with a message as well as rendering them on the client. This can be useful for building applications that involve sending images, files, or other media content to the AI provider.

There are two ways to send attachments with a message, either by providing a `FileList` object or a list of URLs to the `handleSubmit` function:

### [FileList](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#filelist)

By using `FileList`, you can send multiple files as attachments along with a message using the file input element. The `useChat` hook will automatically convert them into data URLs and send them to the AI provider.

Currently, only `image/*` and `text/*` content types get automatically
converted into [multi-modal content\\
parts](https://sdk.vercel.ai/docs/foundations/prompts#multi-modal-messages).
You will need to handle other content types manually.

app/page.tsx

```code-block_code__NPwDy

'use client';

import { useChat } from '@ai-sdk/react';

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
```

### [URLs](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot\#urls)

You can also send URLs as attachments along with a message. This can be useful for sending links to external resources or media content.

> **Note:** The URL can also be a data URL, which is a base64-encoded string that represents the content of a file. Currently, only `image/*` content types get automatically converted into [multi-modal content parts](https://sdk.vercel.ai/docs/foundations/prompts#multi-modal-messages). You will need to handle other content types manually.

app/page.tsx

```code-block_code__NPwDy

'use client';

import { useChat } from '@ai-sdk/react';

import { useState } from 'react';

import { Attachment } from '@ai-sdk/ui-utils';

export default function Page() {

  const { messages, input, handleSubmit, handleInputChange, isLoading } =

    useChat();

  const [attachments] = useState<Attachment[]>([\
\
    {\
\
      name: 'earth.png',\
\
      contentType: 'image/png',\
\
      url: 'https://example.com/earth.png',\
\
    },\
\
    {\
\
      name: 'moon.png',\
\
      contentType: 'image/png',\
\
      url: 'data:image/png;base64,iVBORw0KGgo...',\
\
    },\
\
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
```

On this page

[Chatbot](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#chatbot)

[Example](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#example)

[Customized UI](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#customized-ui)

[Loading State](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#loading-state)

[Error State](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#error-state)

[Modify messages](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#modify-messages)

[Controlled input](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#controlled-input)

[Cancelation and regeneration](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#cancelation-and-regeneration)

[Throttling UI Updates](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#throttling-ui-updates)

[Event Callbacks](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#event-callbacks)

[Request Configuration](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#request-configuration)

[Custom headers, body, and credentials](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#custom-headers-body-and-credentials)

[Setting custom body fields per request](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#setting-custom-body-fields-per-request)

[Controlling the response stream](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#controlling-the-response-stream)

[Error Messages](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#error-messages)

[Usage Information](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#usage-information)

[Text Streams](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#text-streams)

[Empty Submissions](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#empty-submissions)

[Reasoning](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#reasoning)

[Attachments (Experimental)](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#attachments-experimental)

[FileList](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#filelist)

[URLs](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#urls)

Elevate your AI applications with Vercel.

Trusted by OpenAI, Replicate, Suno, Pinecone, and more.

Vercel provides tools and infrastructure to deploy AI apps and features at scale.

[Talk to an expert](https://vercel.com/contact/sales?utm_source=ai_sdk&utm_medium=web&utm_campaign=contact_sales_cta&utm_content=talk_to_an_expert_sdk_docs)