import { OpenAI } from "openai"
import { WebClient } from "@slack/web-api"

export interface GetAiResponseProps {
  userMessage: MessageEmbeddingInput
  context?: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
  channel: string
  client: WebClient
  messageSenderId: string
}

export enum MESSAGE_ROLE {
  FUNCTION = "function",
  SYSTEM = "system",
  USER = "user",
  ASSISTANT = "assistant",
  TOOL = "tool",
}

export enum TOOL_NAME {
  SUMMARIZE_SLACK_THREAD_ = "summarizeSlackThread",
  ANSWER_QUERY = "answerUserQuery",
}

export interface MessageEmbeddingInput {
  content: string
  messageTs: string
  parentMessageTs: string
  channel: string
}
