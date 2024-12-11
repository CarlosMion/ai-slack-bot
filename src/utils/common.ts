import { ScoredPineconeRecord } from "@pinecone-database/pinecone"
import { EmbeddingInfo } from "../types/pinecone"
import { MessageElement } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse"
import { OpenAI } from "openai"
import { CONTEXT_ROLE } from "./context"

export function isMessageRelated({
  match,
  message,
}: {
  match: ScoredPineconeRecord<EmbeddingInfo>
  message: MessageElement
}): boolean {
  return (
    (!!message.ts && match.metadata?.messageTs === message.ts) ||
    (!!message.thread_ts &&
      match.metadata?.parentMessageTs === message.thread_ts)
  )
}

export function getMatchedMessages({
  match,
  messages,
}: {
  match: ScoredPineconeRecord<EmbeddingInfo>
  messages: MessageElement[]
}): MessageElement[] {
  return messages.filter((message) => isMessageRelated({ match, message }))
}

export function getContextObjectFromMessage(
  message: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  return {
    role: CONTEXT_ROLE,
    content: message,
  }
}

export function getSummarizationPrompt(messages: string[]): string {
  return `
Summarize the following messages: 

${messages.map((msg, index) => `${index + 1}. ${msg}`).join("\n")}.

Also include information that is present in the messages that you consider worth mentioning.
`
}

export function isBotTaggedInMessage({
  message,
  botId,
}: {
  botId?: string
  message: MessageElement
}): boolean {
  return !!message.text?.includes(`<@${botId}>`)
}
