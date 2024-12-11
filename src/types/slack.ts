import { WebClient } from "@slack/web-api"
import { TOOL_NAME } from "./openAi"
import {
  ConversationsHistoryResponse,
  MessageElement,
} from "@slack/web-api/dist/types/response/ConversationsHistoryResponse"

export interface TextBlock {
  type: string
  block_id: string
  elements: any[] // not using this for now
}

export interface GetSlackThreadProps {
  client: WebClient
  channel: string
  keyword?: string
}

export interface CallCustomToolProps {
  toolName: TOOL_NAME
  channel: string
  args?: JSON
  client: WebClient
  query: string
}

export interface SummarizeSlackThreadByKeywordArgs {
  keywords: string
}
export interface SummarizeSlackThreadByTSArgs {
  ts: string
}

export interface GetHistoryProps {
  channel: string
  limit?: number
}

export interface ShouldAnswerQueryProps {
  message: MessageElement
  channel: string
  client: WebClient
}

export interface SlackChannelHistoryResponse {
  history: ConversationsHistoryResponse | undefined
  channel: string
}
