import { OpenAI } from "openai"
import {
  GetAiResponseProps,
  MESSAGE_ROLE,
  MessageEmbeddingInput,
  TOOL_NAME,
} from "../types/openAi"
import {
  AI_MODEL,
  CUSTOM_TOOL_DEFAULT_MESSAGE,
  VIBRANIUM_SLACK_BOT,
} from "../constants"
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

  async callCustomTool({
    toolName,
    channel,
    args,
    client,
    query,
  }: CallCustomToolProps): Promise<string | null> {
    switch (toolName) {
      case TOOL_NAME.SUMMARIZE_SLACK_THREAD_BY_KEYWORD:
        const keywordToolArguments =
          args as unknown as SummarizeSlackThreadByKeywordArgs
        const threadMessages =
          await this.pineconeService.getSlackThreadByKeyword({
            channel,
            keyword: keywordToolArguments.keywords,
            client,
          })

        if (threadMessages?.length) {
          return await this.getAiResponse({
            channel,
            client,
            userMessage: {
              content:
                "Get me a summarization of the messages given as context",
              channel,
              messageTs: "",
              parentMessageTs: "",
            },
            messageSenderId: "system",
            context: [
              DEFAULT_AI_CONTEXT,
              getContextObjectFromMessage(
                getSummarizationPrompt(threadMessages)
              ),
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
          messageSenderId: "user",
          context: [DEFAULT_AI_CONTEXT],
        })

        return aiResponse
      case TOOL_NAME.SUMMARIZE_SLACK_THREAD_BY_TS:
        const tsToolArguments = args as unknown as SummarizeSlackThreadByTSArgs
        const slackThread = await this.slackService.getThreadReplies({
          ts: tsToolArguments.ts,
          channel,
        })

        console.log(">>>> slackThread", slackThread.messages)

        if (slackThread?.messages?.length) {
          return await this.getAiResponse({
            channel,
            client,
            userMessage: {
              content:
                "Get me a summarization of the messages given as context",
              channel,
              messageTs: "",
              parentMessageTs: "",
            },
            messageSenderId: "system",
            context: [
              DEFAULT_AI_CONTEXT,
              getContextObjectFromMessage(
                getSummarizationPrompt(
                  slackThread.messages?.reduce((acc: string[], message) => {
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

  async addMessageToHistory(info: EmbeddingInfo) {
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
  }: GetAiResponseProps): Promise<string | null> => {
    const message = {
      role: MESSAGE_ROLE.USER,
      content: userMessage.content,
    } as OpenAI.Chat.Completions.ChatCompletionMessageParam

    const latestMessages = await this.pineconeService.getLatestMessages({
      indexName: VIBRANIUM_SLACK_BOT,
      count: 3,
    })

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
