import { OpenAI } from "openai"
import { ChatPostMessageResponse, WebClient } from "@slack/web-api"
import { SayArguments } from "@slack/bolt"
import {
  SummarizeSlackThreadByKeywordArgs,
  SummarizeSlackThreadByTSArgs,
} from "./slack"

export interface GetAiResponseProps {
  userMessage: MessageEmbeddingInput
  context?: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
  channel: string
  client: WebClient
  messageSenderId: string
  includeLatestMessages?: boolean
}

export const SUMMARIZATION_DEFAULT_QUERY =
  "Please provide a concise and comprehensive summary of the following messages, highlighting the key points and any important details."

export enum MESSAGE_ROLE {
  FUNCTION = "function",
  SYSTEM = "system",
  USER = "user",
  ASSISTANT = "assistant",
  TOOL = "tool",
}

export enum TOOL_NAME {
  SUMMARIZE_SLACK_THREAD_BY_KEYWORD = "getSlackThreadByKeyword",
  ANSWER_QUERY = "answerUserQuery",
  SUMMARIZE_SLACK_THREAD_BY_TS = "getSlackThreadByTs",
}

export interface MessageEmbeddingInput {
  content: string
  messageTs: string
  parentMessageTs?: string
  channel: string
}

export interface AnswerProps {
  content: string
  channel: string
  messageSenderId: string
  threadTs?: string
  say: (message: string | SayArguments) => Promise<ChatPostMessageResponse>
}

export interface GetSlackThreadByKeywordProps {
  args: SummarizeSlackThreadByKeywordArgs
  channel: string
  client: WebClient
  query: string
}
export interface GetSlackThreadByTSProps {
  args: SummarizeSlackThreadByTSArgs
  channel: string
  client: WebClient
  query: string
}
