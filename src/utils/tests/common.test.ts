import { ScoredPineconeRecord } from "@pinecone-database/pinecone"
import { MessageElement } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse"
import {
  isMessageRelated,
  getMatchedMessages,
  getContextObjectFromMessage,
  getSummarizationPrompt,
} from "../common"
import { CONTEXT_ROLE } from "../context"

describe("Utils -> common", () => {
  describe("isMessageRelated", () => {
    it("should return true if messageTs matches", () => {
      const match: ScoredPineconeRecord<any> = {
        metadata: { messageTs: "12345" },
      } as any
      const message: MessageElement = { ts: "12345" } as any
      expect(isMessageRelated({ match, message })).toBe(true)
    })

    it("should return true if parentMessageTs matches thread_ts", () => {
      const match: ScoredPineconeRecord<any> = {
        metadata: { parentMessageTs: "67890" },
      } as any
      const message: MessageElement = { thread_ts: "67890" } as any
      expect(isMessageRelated({ match, message })).toBe(true)
    })

    it("should return false if neither matches", () => {
      const match: ScoredPineconeRecord<any> = {
        metadata: { messageTs: "12345", parentMessageTs: "67890" },
      } as any
      const message: MessageElement = { ts: "54321", thread_ts: "09876" } as any
      expect(isMessageRelated({ match, message })).toBe(false)
    })
  })

  describe("getMatchedMessages", () => {
    it("should return matched messages even with missing information", () => {
      const match: ScoredPineconeRecord<any> = {
        metadata: { messageTs: "12345" },
      } as any
      const messages: MessageElement[] = [
        { ts: "12345" } as any,
        { ts: "54321" } as any,
      ]
      const result = getMatchedMessages({ match, messages })
      expect(result).toEqual([{ ts: "12345" }])
    })

    it("should return an empty array if no messages match", () => {
      const match: ScoredPineconeRecord<any> = {
        metadata: { messageTs: "12345" },
      } as any
      const messages: MessageElement[] = [
        { ts: "54321" } as any,
        { ts: "67890" } as any,
      ]
      const result = getMatchedMessages({ match, messages })
      expect(result).toEqual([])
    })

    it("should return matched messages based on parentMessageTs", () => {
      const match: ScoredPineconeRecord<any> = {
        metadata: { parentMessageTs: "67890" },
      } as any
      const messages: MessageElement[] = [
        { thread_ts: "67890" } as any,
        { thread_ts: "54321" } as any,
      ]
      const result = getMatchedMessages({ match, messages })
      expect(result).toEqual([{ thread_ts: "67890" }])
    })

    it("should handle messages with missing ts and thread_ts properties", () => {
      const match: ScoredPineconeRecord<any> = {
        metadata: { messageTs: "12345", parentMessageTs: "67890" },
      } as any
      const messages: MessageElement[] = [
        { text: "Message without ts" } as any,
        { text: "Another message without ts" } as any,
      ]
      const result = getMatchedMessages({ match, messages })
      expect(result).toEqual([])
    })

    it("should handle matches with missing metadata", () => {
      const match: ScoredPineconeRecord<any> = {} as any
      const messages: MessageElement[] = [
        { ts: "12345" } as any,
        { ts: "54321" } as any,
      ]
      const result = getMatchedMessages({ match, messages })
      expect(result).toEqual([])
    })

    it("should return multiple matched messages", () => {
      const match: ScoredPineconeRecord<any> = {
        metadata: { messageTs: "12345", parentMessageTs: "67890" },
      } as any
      const messages: MessageElement[] = [
        { ts: "12345" } as any,
        { thread_ts: "67890" } as any,
        { ts: "54321" } as any,
      ]
      const result = getMatchedMessages({ match, messages })
      expect(result).toEqual([{ ts: "12345" }, { thread_ts: "67890" }])
    })

    it("should handle an empty messages array", () => {
      const match: ScoredPineconeRecord<any> = {
        metadata: { messageTs: "12345" },
      } as any
      const messages: MessageElement[] = []
      const result = getMatchedMessages({ match, messages })
      expect(result).toEqual([])
    })
  })

  describe("getContextObjectFromMessage", () => {
    it("should return context object from message", () => {
      const message = "This is a test message"
      const result = getContextObjectFromMessage(message)
      expect(result).toEqual({
        role: CONTEXT_ROLE,
        content: message,
      })
    })
  })

  describe("getSummarizationPrompt", () => {
    it("should return a summarization prompt", () => {
      const messages = ["Message 1", "Message 2"]
      const result = getSummarizationPrompt(messages)
      expect(result).toContain("1. Message 1")
      expect(result).toContain("2. Message 2")
      expect(result).toContain("Summarize the following messages:")
    })
  })
})
