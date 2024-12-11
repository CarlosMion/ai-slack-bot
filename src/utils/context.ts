import { OpenAI } from "openai"

export const CONTEXT_ROLE = "system"

export const DEFAULT_AI_CONTEXT: OpenAI.Chat.Completions.ChatCompletionMessageParam =
  {
    role: CONTEXT_ROLE,
    content:
      "You are a Helpful Slack assistant. You give information about messages and threads in a Slack channel and help users find information. You can also accept questions and provide answers.",
  }

export const USER_INTENT_AI_CONTEXT: OpenAI.Chat.Completions.ChatCompletionMessageParam =
  {
    role: CONTEXT_ROLE,
    content:
      "Interpret the user's intent deterministically, the result should have as few words as possible, without losing the original meaning.",
  }

export const SHOULD_ANSWER_CONTEXT: OpenAI.Chat.Completions.ChatCompletionMessageParam =
  {
    role: CONTEXT_ROLE,
    content:
      "Interpret the user's message, is he requesting an answer or just chatting? The purpose of this context is to determine if the assistant should answer the user or not. If the query includes words such as 'talk to me', 'AI', or anything that could mean it's calling this assistant, it means that the answer should be yes, for other inputs, make a decision based on your best judgment. If a question is being made, except if it is directed at another user, you should probably answer. If it has 'channel' or 'thread' in the message the answer should probably be yes, but verify anyway.",
  }
