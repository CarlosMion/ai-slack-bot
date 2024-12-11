import { OpenAI } from "openai"
import {
  AI_MODEL,
  GetAiResponseProps,
  GetSlackThreadByKeywordProps,
  GetSlackThreadByTSProps,
  MESSAGE_ROLE,
  MessageEmbeddingInput,
  SUMMARIZATION_DEFAULT_QUERY,
  TOOL_NAME,
} from "../types/openAi"
import { CUSTOM_TOOL_DEFAULT_MESSAGE, VIBRANIUM_SLACK_BOT } from "../constants"
import {
  CallCustomToolProps,
  SummarizeSlackThreadByKeywordArgs,
  SummarizeSlackThreadByTSArgs,
} from "../types/slack"
import { DEFAULT_AI_CONTEXT, SHOULD_ANSWER_CONTEXT } from "../utils/context"
import PineconeService from "./pinecone.service"
import { EmbeddingInfo } from "../types/pinecone"
import {
  getContextObjectFromMessage,
  getSummarizationPrompt,
} from "../utils/common"
import { ANSWER_QUERY_TOOL } from "../utils/tools"
import { MessageElement } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse"
import SlackService from "./slack.service"

class AiService {
  private openAi: OpenAI
  private pineconeService: PineconeService
  private slackService: SlackService

  constructor({
    pineconeService,
    openAi,
    slackService,
  }: {
    pineconeService: PineconeService
    openAi: OpenAI
    slackService: SlackService
  }) {
    this.openAi = openAi
    this.pineconeService = pineconeService
    this.slackService = slackService
  }

  private async getSlackThreadByKeyword({
    args,
    channel,
    client,
    query,
  }: GetSlackThreadByKeywordProps) {
    const threadMessages = await this.pineconeService.getSlackThreadByKeyword({
      channel,
      keyword: args.keywords,
      client,
    })

    if (threadMessages?.length) {
      return await this.getAiResponse({
        channel,
        client,
        userMessage: {
          content: SUMMARIZATION_DEFAULT_QUERY,
          channel,
          messageTs: "",
          parentMessageTs: "",
        },
        messageSenderId: "system",
        context: [
          DEFAULT_AI_CONTEXT,
          getContextObjectFromMessage(getSummarizationPrompt(threadMessages)),
        ],
      })
    }

    const aiResponse = await this.getAiResponse({
      channel,
      client,
      userMessage: {
        content: "come up with a nice error message for: " + query,
        channel,
        messageTs: "",
        parentMessageTs: "",
      },
      messageSenderId: MESSAGE_ROLE.SYSTEM,
      context: [DEFAULT_AI_CONTEXT],
    })

    return aiResponse
  }

  private async getSlackThreadByTS({
    args,
    channel,
    client,
    query,
  }: GetSlackThreadByTSProps) {
    const slackThread = await this.slackService.getThreadReplies({
      ts: args.ts,
      channel,
    })

    const messages = slackThread?.messages

    if (messages?.length) {
      return await this.getAiResponse({
        channel,
        client,
        includeLatestMessages: false,
        userMessage: {
          content: SUMMARIZATION_DEFAULT_QUERY,
          channel,
          messageTs: "",
          parentMessageTs: "",
        },
        messageSenderId: MESSAGE_ROLE.SYSTEM,
        context: [
          DEFAULT_AI_CONTEXT,
          getContextObjectFromMessage(
            getSummarizationPrompt(
              messages?.reduce((acc: string[], message) => {
                if (message && message.text) {
                  acc.push(message.text)
                }
                return acc
              }, []) || []
            )
          ),
        ],
      })
    }

    return CUSTOM_TOOL_DEFAULT_MESSAGE
  }

  private async callCustomTool({
    toolName,
    channel,
    args,
    client,
    query,
  }: CallCustomToolProps): Promise<string | null> {
    switch (toolName) {
      case TOOL_NAME.SUMMARIZE_SLACK_THREAD_BY_KEYWORD:
        return this.getSlackThreadByKeyword({
          args: args as unknown as SummarizeSlackThreadByKeywordArgs,
          client,
          channel,
          query,
        })
      case TOOL_NAME.SUMMARIZE_SLACK_THREAD_BY_TS:
        return this.getSlackThreadByTS({
          args: args as unknown as SummarizeSlackThreadByTSArgs,
          client,
          channel,
          query,
        })

      default:
        return CUSTOM_TOOL_DEFAULT_MESSAGE
    }
  }

  async deleteMessageFromHistory(info: EmbeddingInfo) {
    const pineconeObject =
      await this.pineconeService.generatePineconeUpsertObject({ ...info })

    this.pineconeService.upsertVectors({
      indexName: VIBRANIUM_SLACK_BOT,
      vectors: [pineconeObject],
    })
  }

  private async addMessageToHistory(info: EmbeddingInfo) {
    const pineconeObject =
      await this.pineconeService.generatePineconeUpsertObject({ ...info })

    this.pineconeService.upsertVectors({
      indexName: VIBRANIUM_SLACK_BOT,
      vectors: [pineconeObject],
    })
  }

  addAssistantMessageToHistory(message: MessageEmbeddingInput, user: string) {
    this.addMessageToHistory({
      role: MESSAGE_ROLE.ASSISTANT,
      user,
      parentMessageTs: message.parentMessageTs || "",
      ...message,
    })
  }

  addUserMessagesToHistory(messages: MessageEmbeddingInput[], user: string) {
    messages.map((message) =>
      this.addMessageToHistory({
        role: MESSAGE_ROLE.USER,
        user,
        parentMessageTs: message.parentMessageTs || "",
        ...message,
      })
    )
  }

  addToolMessagesToHistory(messages: MessageEmbeddingInput[], user: string) {
    messages.map((message) =>
      this.addMessageToHistory({
        role: MESSAGE_ROLE.TOOL,
        user,
        parentMessageTs: message.parentMessageTs || "",
        ...message,
      })
    )
  }

  async shouldAnswerQuery(message: MessageElement) {
    try {
      if (message.subtype || !message.text) {
        return false
      }
      const response = await this.openAi.chat.completions.create({
        model: AI_MODEL,
        tools: [ANSWER_QUERY_TOOL],

        tool_choice: "auto",
        messages: [
          DEFAULT_AI_CONTEXT,
          SHOULD_ANSWER_CONTEXT,
          {
            role: MESSAGE_ROLE.USER,
            content: message.text,
          },
        ],
      })
      const shouldInvokeTool =
        response.choices[0].finish_reason === "tool_calls"

      return shouldInvokeTool
    } catch (error) {
      console.error("Error checking if should answer query:", error)
      throw error
    }
  }

  getAiResponse = async ({
    context = [DEFAULT_AI_CONTEXT],
    userMessage,
    tools,
    channel,
    client,
    messageSenderId,
    includeLatestMessages = true,
  }: GetAiResponseProps): Promise<string | null> => {
    const message = {
      role: MESSAGE_ROLE.USER,
      content: userMessage.content,
    } as OpenAI.Chat.Completions.ChatCompletionMessageParam

    const latestMessages = includeLatestMessages
      ? await this.pineconeService.getLatestMessages({
          indexName: VIBRANIUM_SLACK_BOT,
          count: 3,
        })
      : []

    const hasTools = !!tools?.length
    const response = await this.openAi.chat.completions.create({
      model: AI_MODEL,
      tools,
      ...(hasTools ? { tool_choice: "auto" } : {}),
      messages: [
        ...context,
        ...latestMessages.map(getContextObjectFromMessage),
        message,
      ],
    })

    /** adding verification to speed up answers that don't have tools */
    if (hasTools) {
      /** Check if the response should use a tool instead of directly answering */
      const shouldInvokeTool =
        response.choices[0].finish_reason === "tool_calls"
      const toolName = response.choices[0].message.tool_calls?.[0].function
        .name as TOOL_NAME

      if (shouldInvokeTool && toolName) {
        const toolArguments =
          response.choices[0].message.tool_calls?.[0].function.arguments
        const args = JSON.parse(toolArguments || "")
        const toolResponse = await this.callCustomTool({
          args: { ...args, ts: userMessage.parentMessageTs },
          toolName,
          client,
          channel,
          query: (message.content || "") as string,
        })
        this.addToolMessagesToHistory(
          [
            {
              content: toolResponse || "",
              messageTs: "",
              parentMessageTs: "",
              channel,
            },
          ],
          messageSenderId
        )
        return toolResponse
      }
    }
    const answer = response.choices[0].message.content

    return answer
  }
}

export default AiService
