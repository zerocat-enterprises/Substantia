// @ts-nocheck
// Preventing TS checks with files presented in the video for a better presentation.
import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { getModel } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, hasModel } from '~/utils/constants';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
  model?: string;
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

function extractModelFromMessage(message: Message): { model: string; content: string } {
  const modelRegex = /^\[Model: (.*?)Provider: (.*?)\]\n\n/;
  const match = message.content.match(modelRegex);

  if (!match) {
    return { model: DEFAULT_MODEL, content: message.content,provider: DEFAULT_PROVIDER };
  }
  const [_,model,provider] = match;
  const content = message.content.replace(modelRegex, '');
  return { model, content ,provider};
  // Default model if not specified

}

export function streamText(messages: Messages, env: Env, options?: StreamingOptions) {
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER;
  const lastMessage = messages.findLast((message) => message.role === 'user');
  if (lastMessage) {
    const { model, provider } = extractModelFromMessage(lastMessage);
    if (hasModel(model, provider)) {
      currentModel = model;
      currentProvider = provider;
    }
  }
  const processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { content } = extractModelFromMessage(message);
      return { ...message, content };
    }
    return message;
  });

  const coreMessages = convertToCoreMessages(processedMessages);
  return _streamText({
    model: getModel(currentProvider, currentModel, env),
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    // headers: {
    //   'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
    // },
    messages: coreMessages,
    ...options,
  });
}
