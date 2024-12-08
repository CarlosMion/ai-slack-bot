import {
  Pinecone,
  PineconeRecord,
  RecordMetadata,
} from "@pinecone-database/pinecone"
import SlackService from "./slack.service"
import { MessageElement } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse"
import {
  CreatePineconeIndexProps,
  EmbeddingInfo,
  QueryEmbeddingsProps,
  QueryVectorsProps,
  UpsertVectorsProps,
} from "../types/pinecone"
import {
  AWS_REGION,
  CLOUD,
  EMBEDDING_DIMENSIONS,
  VIBRANIUM_SLACK_BOT,
  ZERO_VECTOR,
} from "../constants"
import { v4 as uuidv4 } from "uuid"
import { OpenAI } from "openai"
import { MESSAGE_ROLE } from "../types/openAi"
import { GetSlackThreadProps } from "../types/slack"

class PineconeService {
  private pinecone: Pinecone
  private slackService: SlackService
  private openAi: OpenAI
  constructor({
    slackService,
    openAi,
  }: {
    slackService: SlackService
    openAi: OpenAI
  }) {
    this.pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || "" })
    this.slackService = slackService
    this.openAi = openAi
    this.initializeIndex(VIBRANIUM_SLACK_BOT)
  }

  async getSlackThread({
    channel,
    keyword,
  }: GetSlackThreadProps): Promise<string[] | undefined> {
    const queryResult = await this.queryEmbeddings({
      indexName: VIBRANIUM_SLACK_BOT,
      question: keyword || "",
    })

    const threadMessages = queryResult.reduce((acc: string[], match) => {
      if (match.metadata?.content) {
        return Array.isArray(match.metadata?.content)
          ? [...acc, ...match.metadata?.content]
          : [...acc, match.metadata?.content]
      }
      return acc
    }, [])
    return threadMessages
  }

  async isIndexInitialized() {
    const indexes = await this.listPineconeIndexes()
    return !!indexes?.length
  }

  async populatePineconeIndex() {
    try {
      const slackChannels = await this.slackService.getSlackChannels()

      const botChannels =
        slackChannels?.filter((channel) => channel.is_member) || []

      const allBotChannelsHistory = await Promise.all(
        botChannels.map(
          async (channel) =>
            await this.slackService.getSlackChannelHistory({
              channel: channel.id || "",
              limit: 500,
            })
        )
      )

      await allBotChannelsHistory.forEach(async (item) =>
        item?.history?.messages?.map(async (message) => {
          const upsertObject = await this.generatePineconeUpsertObject({
            content: message.text || "",
            user: message.user || "",
            role: MESSAGE_ROLE.USER,
            messageTs: message.ts || "",
            parentMessageTs: message.thread_ts || "",
            channel: item.channel || "",
          })
          this.upsertVectors({
            indexName: VIBRANIUM_SLACK_BOT,
            vectors: [upsertObject],
          })
        })
      )
    } catch (error) {
      console.error("Error populating index:", error)
    }
  }

  async initializeIndex(name: string) {
    const isPineconeIndexInitialized = await this.isIndexInitialized()
    if (!isPineconeIndexInitialized) {
      await this.createPineconeIndex({ name })

      this.populatePineconeIndex()
    }
  }

  async generateEmbeddings(input: string | string[]) {
    const response = await this.openAi.embeddings.create({
      input: input,
      model: "text-embedding-3-small",
    })
    return response.data.map((item) => item.embedding).flat()
  }

  async generatePineconeUpsertObject({
    content,
    user,
    role,
    messageTs,
    parentMessageTs,
    channel,
  }: EmbeddingInfo): Promise<PineconeRecord<EmbeddingInfo>> {
    const embedding = await this.generateEmbeddings(content)

    return {
      id: uuidv4(),
      values: embedding,
      metadata: {
        content,
        channel,
        user,
        role,
        messageTs,
        parentMessageTs,
      },
    }
  }

  async getLatestMessages({
    indexName,
    count,
  }: {
    indexName: string
    count: number
  }): Promise<string[]> {
    const index = await this.getIndex<EmbeddingInfo>(indexName)

    const queryResult = await index.query({
      vector: ZERO_VECTOR,
      topK: count,
      includeMetadata: true,
      includeValues: true,
    })
    return queryResult.matches.reduce((acc: string[], match) => {
      const content = match.metadata?.content
      if (content) {
        return [...acc, ...(Array.isArray(content) ? content : [content])]
      }
      return acc
    }, [])
  }

  async queryEmbeddings({ question, indexName }: QueryEmbeddingsProps) {
    const questionEmbedding = await this.generateEmbeddings(question)

    const index = await this.getIndex<EmbeddingInfo>(indexName)
    const queryResult = await index.query({
      vector: questionEmbedding,
      topK: 100,
      includeMetadata: true,
      includeValues: true,
    })
    return queryResult.matches.filter((result) => (result.score || 0) > 0.5)
  }

  async upsertVectors({ indexName, vectors }: UpsertVectorsProps) {
    const dbIndex = this.getIndex<EmbeddingInfo>(indexName)

    await dbIndex.upsert(vectors)
  }

  getIndex<T extends RecordMetadata>(indexName: string) {
    return this.pinecone.index<T>(indexName)
  }

  async listPineconeIndexes() {
    const { indexes } = await this.pinecone.listIndexes()
    return indexes
  }

  async createPineconeIndex({ name }: CreatePineconeIndexProps) {
    await this.pinecone.createIndex({
      name,
      dimension: EMBEDDING_DIMENSIONS,
      spec: {
        serverless: {
          cloud: CLOUD,
          region: AWS_REGION,
        },
      },
    })
  }
}

export default PineconeService
