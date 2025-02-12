[Blog](https://vercel.com/blog)/ **[Engineering](https://vercel.com/blog/category/engineering)**

# AI SDK 4.1

## Authors

[![Avatar for lgrammel](https://vercel.com/api/www/avatar?u=lgrammel&s=48)](https://twitter.com/lgrammel) [![Avatar for jared](https://vercel.com/api/www/avatar?u=jared&s=48)](https://twitter.com/jaredpalmer) [![Avatar for nicoalbanese](https://vercel.com/api/www/avatar?u=nicoalbanese&s=48)](https://twitter.com/nicoalbanese10) [![Avatar for shaper](https://vercel.com/api/www/avatar?u=shaper&s=48)](https://twitter.com/shaper)

7 min read

Jan 20, 2025

Introducing image generation, non-blocking data streaming, improved tool calling, and more.

The [AI SDK](https://sdk.vercel.ai/) is an open-source toolkit for building AI applications with JavaScript and TypeScript. Its unified provider API allows you to use any language model and enables powerful UI integrations into leading web frameworks such as [Next.js](https://nextjs.org/) and [Svelte](https://svelte.dev/).

Since our 4.0 release, we've seen some incredible products powered by the AI SDK:

- [Languine](https://languine.ai/en) is an open-source CLI tool that automates application localization, detecting translation changes and maintaining consistent tone across all major i18n libraries.

- [Scira](https://scira.app/) is a minimalist AI-powered search engine, using the AI SDK to power search-grounded LLM responses and powerful generative UI interactions.

- [Fullmoon](https://fullmoon.app/) enables cross-platform chat with private local LLMs, bringing secure AI conversations to everyone.


![](https://vercel.com/_next/image?url=https%3A%2F%2Fassets.vercel.com%2Fimage%2Fupload%2Fcontentful%2Fimage%2Fe5382hct74si%2F3lFwDQpCGmzaCVy7Mnculp%2Fd163bd1d290f35d0ffcc0791009a5bc0%2Flanguine.png&w=1920&q=75)

Check out [Languine](https://languine.ai/), an AI-powered CLI and pipeline designed to automate translations for developers

Each of these projects is open-source ( [Languine](https://github.com/midday-ai/languine), [Scira](https://github.com/zaidmukaddam/scira), [Fullmoon](https://github.com/mainframecomputer/fullmoon-web)), giving you the opportunity to explore how these AI-powered applications are built.

Today, we're announcing the release of AI SDK 4.1, which introduces [image generation capabilities](https://vercel.com/blog/ai-sdk-4-1#image-generation). This update allows developers to generate images through a unified API that works seamlessly across providers like [Replicate](https://replicate.com/), [OpenAI](https://openai.com/), [Google Vertex](https://cloud.google.com/vertex-ai), and [Fireworks](https://fireworks.ai/).

Along with image generation, this release includes:

- [Stream transformation & smoothing](https://vercel.com/blog/ai-sdk-4-1#stream-transformation-&-smoothing)

- [Simplified persistence with useChat](https://vercel.com/blog/ai-sdk-4-1#simplified-persistence-with-usechat)

- [Non-blocking data streaming](https://vercel.com/blog/ai-sdk-4-1#non-blocking-data-streaming)

- [Tool-calling improvements](https://vercel.com/blog/ai-sdk-4-1#tool-calling-improvements)

- [Structured output improvements](https://vercel.com/blog/ai-sdk-4-1#structured-output-improvements)

- [New and updated providers](https://vercel.com/blog/ai-sdk-4-1#new-and-updated-providers)


Let's explore these new features and improvements.

## [Image generation](https://vercel.com/blog/ai-sdk-4-1\#image-generation)

Generating images from text prompts is a novel generative AI capability that enables new types of applications and workflows. The ecosystem is growing rapidly, with providers such as Replicate supporting hundreds of different image generation models, adding more and more every day.

With AI SDK 4.1, we're taking our first step towards enabling multi-modal outputs by introducing support for image generation through the new experimental [`generateImage`](https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-image#generateimage) function.

```code-block_code__isn_V

import { experimental_generateImage as generateImage } from 'ai';

import { replicate } from '@ai-sdk/replicate';

const { image } = await generateImage({

  model: replicate.image('black-forest-labs/flux-1.1-pro-ultra'),

  prompt: 'A futuristic cityscape at sunset',

});
```

![](https://vercel.com/_next/image?url=https%3A%2F%2Fassets.vercel.com%2Fimage%2Fupload%2Fcontentful%2Fimage%2Fe5382hct74si%2F4iSi90keMWB4NNDKPfPr3b%2F67791d0dd5b5a847836a94b4b7435279%2Fimage-1736860667012.png&w=1920&q=75)

Image generated with Replicate's [black-forest-labs/flux-1.1-pro-ultra](https://replicate.com/black-forest-labs/flux-1.1-pro-ultra) model

Switching between AI providers is as simple as changing 2 lines of code - your prompt and settings remain unchanged:

```code-block_code__isn_V

import { experimental_generateImage as generateImage } from 'ai';

import { fireworks } from '@ai-sdk/fireworks';

const { image } = await generateImage({

  model: fireworks.image('accounts/fireworks/models/SSD-1B'),

  prompt: 'A futuristic cityscape at sunset',

});
```

![](https://vercel.com/_next/image?url=https%3A%2F%2Fassets.vercel.com%2Fimage%2Fupload%2Fcontentful%2Fimage%2Fe5382hct74si%2F3xqYSkFgh7avLp6ZgwDYIp%2Fc29db6eaa7d78629c56c7f21106b8405%2Fimage-1737028481453-1.png&w=1920&q=75)

Image generated with Fireworks' [SSD-1B](https://fireworks.ai/models/fireworks/SSD-1B) model

With the `generateImage` function, you have full control of parameters like:

- Control image dimensions with `size` or `aspectRatio`

- Generate multiple images in parallel with `n`

- Access images in both base64 and uint8Array formats

- Control randomness with `seed`


Provider-specific options are also supported through the `providerOptions` parameter:

```code-block_code__isn_V

const { image } = await generateImage({

  model: replicate.image('black-forest-labs/flux-1.1-pro-ultra'),

  prompt: 'A futuristic cityscape at sunset',

  size: "16:9",

  n: 3,

  seed: 0,

  providerOptions: {

    replicate: { style: 'realistic_image' },

  },

});
```

The AI SDK supports image generation across multiple providers including [Replicate](https://sdk.vercel.ai/providers/ai-sdk-providers/replicate#image-models), [OpenAI](https://sdk.vercel.ai/providers/ai-sdk-providers/openai#image-models), [Google Vertex AI](https://sdk.vercel.ai/providers/ai-sdk-providers/google-vertex#image-models), and [Fireworks](https://sdk.vercel.ai/providers/ai-sdk-providers/fireworks#image-models).

Check out our [image generation demo](https://ai-sdk-image-generator.vercel.app/) to see how different providers handle the same prompts and explore the capabilities of each model.

## [Stream transformation & smoothing](https://vercel.com/blog/ai-sdk-4-1\#stream-transformation-&-smoothing)

AI SDK 4.1 introduces new capabilities for transforming stream output on the server. This enables powerful use cases such as:

- Creating smoother streaming experiences with the built-in [`smoothStream`](https://sdk.vercel.ai/docs/reference/ai-sdk-core/smooth-stream) transform (with custom chunking options such as by character, word, line)

- Filtering content and applying safety guardrails

- Any custom transformation (eg. [uppercase](https://sdk.vercel.ai/docs/ai-sdk-core/generating-text#custom-transformations))


For example, the built-in `smoothStream` function helps create more natural text streaming by smoothing chunky or inconsistent provider responses into a smoother flow:

```code-block_code__isn_V

import { smoothStream, streamText } from 'ai';

const result = streamText({

  model,

  prompt,

  experimental_transform: smoothStream(),

});
```

00:01

00:11

00:00

00:11

Multiple transformations can be applied by passing them as an array:

```code-block_code__isn_V

const result = streamText({

  model,

  prompt,

  experimental_transform: [firstTransform, secondTransform],

});
```

Check out our [stream transformation documentation](https://sdk.vercel.ai/docs/ai-sdk-core/generating-text#stream-transformation) to learn more about configuring chunking patterns, implementing content filtering, and creating your own transformations.

## [Simplified persistence with `useChat`](https://vercel.com/blog/ai-sdk-4-1\#simplified-persistence-with-usechat)

We heard your feedback that adding persistence to `useChat` is too complicated. To address this, we've added three key improvements:

- Chat ID can be forwarded from the client to the server

- Response message IDs can be forwarded from the server to the client

- The new `appendResponseMessages` utility unifies messages for simple saving


Check out our [chat persistence guide](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot-message-persistence) to learn more, or start with our [minimal example](https://github.com/vercel/ai/blob/main/examples/next-openai/app/api/use-chat-persistence/route.ts) if you prefer to dive straight into code.

## [Non-blocking data streaming](https://vercel.com/blog/ai-sdk-4-1\#non-blocking-data-streaming)

AI SDK 4.1 introduces powerful new streaming functionality with the [`createDataStreamResponse`](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/create-data-stream-response#createdatastreamresponse) function enabling powerful use cases like streaming retrieval-augmented generation (RAG) context and search results to the client before the LLM’s response begins. Previously, streaming was limited to returning the result of a single LLM call (eg. `streamText().toDataStreamResponse()`). Now, you can create non-blocking data streams that:

- Return immediately and allows you to stream data on-demand

- Provide full control over when and what data is streamed

- Support adding annotations and metadata to messages


Here's an example of using `createDataStreamResponse` to stream custom data alongside LLM output:

```code-block_code__isn_V

import { openai } from "@ai-sdk/openai";

import { createDataStreamResponse, Message, streamText } from "ai";

import { getRelevantContent } from "./get-relevant-content"; // user-defined

export async function POST(req: Request) {

  const { messages }: { messages: Message[] } = await req.json();

  const lastMessage = messages.pop();

  return createDataStreamResponse({

    execute: async (dataStream) => {

      const relevantContent = await getRelevantContent(lastMessage.content);

      for (const content of relevantContent) {

        dataStream.writeData({

          type: "source",

          url: content.url,

          title: content.title,

        });

      }

      lastMessage.content =

        lastMessage.content +

        "\n\nUse the following information to answer the question: " +

        relevantContent.join("\n");

      const result = streamText({

        model: openai("gpt-4o"),

        messages: [...messages, lastMessage],

        onFinish: async ({}) => {

          dataStream.writeMessageAnnotation({ sources: relevantContent });

        },

      });

      result.mergeIntoDataStream(dataStream);

    },

  });

}
```

The streamed data is automatically handled by the [`useChat`](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat) hook on the client, making it simple to access both the message content and any additional streamed data:

```code-block_code__isn_V

"use client";

import { useChat } from "ai/react";

export default function Chat() {

  const { messages, data } = useChat();



  // Access streamed data

  console.log(data);



  // Access message annotations

  messages.forEach(m => console.log(m.annotations));

  return (/* ... */);

}
```

To learn more, check out the [streaming custom data documentation](https://sdk.vercel.ai/docs/ai-sdk-ui/streaming-data).

## [Tool-calling improvements](https://vercel.com/blog/ai-sdk-4-1\#tool-calling-improvements)

Tools are a core building block of production AI applications - they enable language models to interact with real-world systems and data. However, getting tools to work reliably can be challenging. With AI SDK 4.1, we've invested significantly in making tool calling more robust:

### [Improved context within tool calls](https://vercel.com/blog/ai-sdk-4-1\#improved-context-within-tool-calls)

When executing a tool call, the `execute` function now has access to helpful context accessible through a second parameter:

- `toolCallId` for tracking specific executions and adding tool-related annotations

- `messages` array containing full conversation history, including previous tool calls and results

- `abortSignal` for canceling long-running operations and forwarding to fetch calls


Here's an example using these context options:

```code-block_code__isn_V

const result = await generateText({

  model,

  abortSignal,

  tools: {

    weather: tool({

      parameters: z.object({ location: z.string() }),

      execute: async ({ location }, { toolCallId, messages, abortSignal }) => {

        // Use toolCallId for tracking

        data.appendMessageAnnotation({

          type: 'tool-status',

          toolCallId,

          status: 'in-progress',

        });

        // Forward abort signal

        const response = await fetch(

          `https://api.weatherapi.com/v1/current.json?q=${location}`,

          { signal: abortSignal },

        );

        return response.json();

      },

    }),

  },

});
```

To learn more, check out the [tool-calling documentation](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling#tool-execution-options).

### [Tool call repair](https://vercel.com/blog/ai-sdk-4-1\#tool-call-repair)

When tool calls fail, you can now use the [`experimental_toToolCallRepair`](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling#tool-call-repair) function to attempt repairs to:

- Use a model with structured outputs to generate the arguments.

- Send the messages, system prompt, and tool schema to a stronger model to generate the arguments.

- Provide more specific repair instructions based on which tool was called.


```code-block_code__isn_V

import { openai } from '@ai-sdk/openai';

import { generateObject, generateText, NoSuchToolError, tool } from 'ai';

const result = await generateText({

  model,

  tools,

  prompt,

  // example approach: use a model with structured outputs for repair.

  // (you can use other strategies as well)

  experimental_repairToolCall: async ({

    toolCall,

    tools,

    parameterSchema,

    error,

  }) => {

    if (NoSuchToolError.isInstance(error)) {

      return null; // do not attempt to fix invalid tool names

    }

    const tool = tools[toolCall.toolName as keyof typeof tools];

    const { object: repairedArgs } = await generateObject({

      model: openai('gpt-4o', { structuredOutputs: true }),

      schema: tool.parameters,

      prompt: [\
\
        `The model tried to call the tool "${toolCall.toolName}"` +\
\
          ` with the following arguments:`,\
\
        JSON.stringify(toolCall.args),\
\
        `The tool accepts the following schema:`,\
\
        JSON.stringify(parameterSchema(toolCall)),\
\
        'Please fix the arguments.',\
\
      ].join('\\n'),

    });

    return { ...toolCall, args: JSON.stringify(repairedArgs) };

  },

});
```

### [Granular error handling](https://vercel.com/blog/ai-sdk-4-1\#granular-error-handling)

To help ship more resilient tool calls, the AI SDK now provides granular error types that make debugging and error handling more precise. Each error type exposes detailed information about what went wrong and includes contextual data to help diagnose and fix issues:

- `NoSuchToolError`: Handles cases where the model attempts to call an undefined tool.

- `InvalidToolArgumentsError`: Catches schema validation failures when tool arguments don't match the expected parameters.

- `ToolExecutionError`: Identifies runtime issues during tool execution.

- `ToolCallRepairError`: Tracks failures during automatic tool call repair attempts.


These specific error types allow you to implement targeted error handling strategies and provide better feedback to users when tool execution fails. To learn more, check out the [error handling documentation](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling#handling-errors).

## [Structured output improvements](https://vercel.com/blog/ai-sdk-4-1\#structured-output-improvements)

We've expanded structured output capabilities to enable more dynamic and resilient AI applications:

### [Structured outputs with tools](https://vercel.com/blog/ai-sdk-4-1\#structured-outputs-with-tools)

One of our most requested features is now available: the ability to combine structured outputs with tool usage. With the new `experimental_output` option in both `generateText` and `streamText`, you can build sophisticated large-language model (LLM) calls that can both interact with external systems and return predictably structured data.

Here's an example showing how structured outputs and tools work together:

```code-block_code__isn_V

import { openai } from '@ai-sdk/openai';

import { generateText, tool, Output } from 'ai';

import { z } from 'zod';

const result = await generateText({

  model: openai('gpt-4o', { structuredOutputs: true }),

  prompt: "What's the weather like in London and New York?",

  maxSteps: 5,

  tools: {

    getWeather: tool({

      parameters: z.object({

        city: z.string(),

        units: z.enum(['celsius', 'fahrenheit']),

      }),

      execute: async ({ city, units }) => {

        // Fetch weather data

      },

    }),

  },

  experimental_output: Output.object({

    schema: z.object({

      cities: z.array(

        z.object({

          name: z.string(),

          temperature: z.number(),

          conditions: z.string(),

        }),

      ),

    }),

  }),

});
```

Instead of making separate calls to determine which cities to check and then calling weather tools for each one, the model can handle the entire workflow in a single function. This results in more efficient and maintainable code, especially for complex scenarios with unpredictable inputs or multiple potential tool paths. To learn more, check out the [structured outputs with `generateText` and `streamText` documentation](https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data#structured-outputs-with-generatetext-and-streamtext).

Currently, structured outputs with tools is only available with OpenAI models.

### [Enhanced error handling](https://vercel.com/blog/ai-sdk-4-1\#enhanced-error-handling)

Error handling for structured outputs has been significantly improved in 4.1. Previously, when structure parsing or validation failed, you only received an error – with no access to the underlying response. This meant your only option was to retry the request. With the new [`NoObjectGeneratedError`](https://sdk.vercel.ai/docs/reference/ai-sdk-errors/ai-no-object-generated-error), you now have access to:

- Raw model output for debugging or salvaging partial responses

- Complete request context (response ID, timestamp, model)

- Token usage and cost analytics


Here's how to implement the enhanced error handling:

```code-block_code__isn_V

try {

  const result = await generateObject({

    model,

    schema,

    prompt,

  });

} catch (error) {

  if (error instanceof NoObjectGeneratedError) {

    console.log('Generated text:', error.text);

    console.log('Response metadata:', error.response);

    console.log('Token usage:', error.usage);

    console.log('Error cause:', error.cause);

  }

}
```

This granular error information makes it easier to diagnose and fix issues with structured output generation, whether they occur during parsing, validation, or model generation phases.

Check out the [structured output error handling documentation](https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data#error-handling) to learn more about implementing these patterns.

## [New and updated providers](https://vercel.com/blog/ai-sdk-4-1\#new-and-updated-providers)

The AI SDK provider ecosystem continues to grow with new and improved providers:

- [Google Vertex](https://sdk.vercel.ai/providers/ai-sdk-providers/google-vertex) AI 2.0: A complete refresh of the Vertex AI integration that introduces enhanced performance, improved error handling, and search-grounding support.

- [OpenAI](https://sdk.vercel.ai/providers/ai-sdk-providers/openai): Fully revamped support for latest reasoning models.

- [OpenAI Compatible](https://sdk.vercel.ai/providers/openai-compatible-providers): A new dedicated provider for OpenAI-compatible APIs.

- [Replicate](https://sdk.vercel.ai/providers/ai-sdk-providers/replicate): Adds first-party provider for Replicate (image models).

- [Fireworks](https://sdk.vercel.ai/providers/openai-compatible-providers/fireworks): Adds first-party provider for Fireworks (language and image models).

- [Cohere](https://sdk.vercel.ai/providers/ai-sdk-providers/cohere): Adds first-party provider for Cohere (language and embedding models).

- [Together AI](https://sdk.vercel.ai/providers/openai-compatible-providers/togetherai): Adds first-party provider for Together AI (language models).

- [DeepInfra](https://sdk.vercel.ai/providers/ai-sdk-providers/deepinfra): Adds first-party provider for DeepInfra (language models).

- [DeepSeek](https://sdk.vercel.ai/providers/ai-sdk-providers/deepseek): Adds first-party provider for DeepSeek (language models).

- [Cerebras](https://sdk.vercel.ai/providers/ai-sdk-providers/cerebras): Adds first-party provider for Cerebras (language models).


## [**Getting started**](https://vercel.com/blog/ai-sdk-4-1\#getting-started)

With powerful new features like image generation, non-blocking data streaming, and improved tool calling, there's never been a better time to start building AI applications with the AI SDK.

- **Start a new AI project**: Ready to build something new? Check out our [**latest guides**](https://sdk.vercel.ai/cookbook)

- **Explore our templates**: Visit our [**Template Gallery**](https://sdk.vercel.ai/docs/introduction#templates) to see the AI SDK in action

- **Join the community**: Share what you're building in our [**GitHub Discussions**](https://github.com/vercel/ai/discussions)


## [Contributors](https://vercel.com/blog/ai-sdk-4-1\#contributors)

AI SDK 4.1 is the result of the combined work of our core team at Vercel ( [Lars](https://x.com/lgrammel), [Jeremy](https://x.com/jrmyphlmn), [Walter](https://x.com/shaper), and [Nico](https://x.com/nicoalbanese10)) and many community contributors. Special thanks for contributing merged pull requests:

[patelvivekdev](https://github.com/patelvivekdev), [zeke](https://github.com/zeke), [daviddkkim](https://github.com/daviddkkim), [klren0312](https://github.com/klren0312), [viktorlarsson](https://github.com/viktorlarsson), [richhuth](https://github.com/richhuth), [dragos-cojocaru](https://github.com/dragos-cojocaru), [olyaiy](https://github.com/olyaiy), [minpeter](https://github.com/minpeter), [nathanwijaya](https://github.com/nathanwijaya), [timconnorz](https://github.com/timconnorz), [palmm](https://github.com/palmm), [Ojansen](https://github.com/Ojansen), [ggallon](https://github.com/ggallon), [williamlmao](https://github.com/williamlmao), [nasjp](https://github.com/nasjp), [ManuLpz4](https://github.com/ManuLpz4), [aaronccasanova](https://github.com/aaronccasanova), [marcklingen](https://github.com/marcklingen), [aaishikasb](https://github.com/aaishikasb), [michael-hhai](https://github.com/michael-hhai), [jeremypress](https://github.com/jeremypress), [yoshinorisano](https://github.com/yoshinorisano).

Your feedback and contributions are invaluable as we continue to evolve the AI SDK.

**Ready to deploy?** Start building with a free account. Speak to an expert for your _Pro_ or Enterprise needs.

[Start Deploying](https://vercel.com/new) [Contact Sales](https://vercel.com/contact/sales)

**Explore Vercel Enterprise** with an interactive product tour, trial, or a personalized demo.

[Explore Enterprise](https://vercel.com/try-enterprise)