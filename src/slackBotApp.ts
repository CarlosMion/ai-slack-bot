import { App } from "@slack/bolt"
import AiService from "./services/ai.service"
import {
  SUMMARIZE_SLACK_THREAD_TOOL,
  TAGGED_SUMMARIZE_TOOL,
} from "./utils/tools"
import { MessageElement } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse"
import { DEFAULT_AI_CONTEXT } from "./utils/context"
import { isBotTaggedInMessage, isDeletingMessage } from "./utils/common"
import { VIBRANIUM_SLACK_BOT } from "./constants"
import PineconeService from "./services/pinecone.service"
import { AnswerProps } from "./types/openAi"

class SlackBotApp {
  private slackClient: App
  private aiService: AiService
  private pineconeService: PineconeService

  constructor({
    aiService,
    pineconeService,
  }: {
    aiService: AiService
    pineconeService: PineconeService
  }) {
    this.aiService = aiService
    this.pineconeService = pineconeService
    this.slackClient = new App({
      token: process.env.SLACK_BOT_OAUTH_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
    })

    this.startSlackBot()
    this.listenToMessages()
    this.listenToMentions()
  }

  async startSlackBot() {
    try {
      await this.slackClient.start(process.env.PORT || 3000)
      console.log("⚡️ Slack bot is running in port:", process.env.PORT || 3000)
    } catch (error) {
      console.error("Failed to start Slack bot:", error)
      process.exit(1)
    }
  }

  private async answer({
    content,
    channel,
    messageSenderId,
    threadTs,
    say,
  }: AnswerProps): Promise<void> {
    this.aiService.addAssistantMessageToHistory(
      {
        content,
        messageTs: new Date().toISOString(),
        parentMessageTs: "",
        channel,
      },
      messageSenderId
    )
    if (threadTs) {
      say({ text: content, thread_ts: threadTs })
      return
    }
    say(content)
  }

  private listenToMentions() {
    this.slackClient.event(
      "app_mention",
      async ({ event, say, body, client }) => {
        const { text, thread_ts, ts, channel, user } = event

        /** if not mentioning in a thread, continue to normal flow */
        // if (!thread_ts) {
        const answer = await this.aiService.getAiResponse({
          userMessage: {
            content: text,
            messageTs: ts,
            parentMessageTs: thread_ts,
            channel,
          },

          context: [DEFAULT_AI_CONTEXT],
          tools: [...(thread_ts ? [TAGGED_SUMMARIZE_TOOL] : [])],
          client,
          channel: channel,
          messageSenderId: user || "",
        })

        if (answer) {
          this.answer({
            channel,
            content: answer,
            messageSenderId: user || "",
            threadTs: thread_ts,
            say,
          })
        } else {
          say("Sorry, I could not understand or process that.")
        }
      }
      // }
    )
  }

  private listenToMessages() {
    try {
      this.slackClient.message(async ({ message, say, client, body }) => {
        try {
          const messageElement = message as MessageElement
          if (
            isBotTaggedInMessage({
              message: messageElement,
              botId: body.authorizations?.[0].user_id,
            })
          ) {
            // skip if bot is tagged in the message
            return
          }

          console.log("Message received:", message)

          if (
            isDeletingMessage({
              message: messageElement,
            })
          ) {
            // also skip answering if a message is being deleted
            return this.pineconeService.deleteVectors({
              indexName: VIBRANIUM_SLACK_BOT,
              messageTs: messageElement.ts,
              messageText: messageElement.previous_message?.text || "",
            })
          }

          const shouldAnswerUser = await this.aiService.shouldAnswerQuery(
            messageElement
          )
          if (!shouldAnswerUser || !messageElement.text) {
            // skip if the message is is not targeted at the bot or is not relevant
            return
          }
          say("Processing your request, please wait a moment...")
          const messageSenderId = messageElement.user || ""
          const answer = await this.aiService.getAiResponse({
            userMessage: {
              content: messageElement.text,
              messageTs: messageElement.ts || "",
              parentMessageTs: messageElement.thread_ts || "",
              channel: message.channel,
            },

            context: [DEFAULT_AI_CONTEXT],
            tools: [SUMMARIZE_SLACK_THREAD_TOOL],
            client,
            channel: message.channel,
            messageSenderId,
          })

          this.aiService.addUserMessagesToHistory(
            [
              {
                content: messageElement.text || "",
                channel: message.channel,
                messageTs: messageElement.ts || "",
                parentMessageTs: messageElement.thread_ts || "",
              },
            ],
            messageSenderId
          )
          if (answer) {
            return this.answer({
              channel: message.channel,
              content: answer,
              messageSenderId,
              say,
            })
          }
          /** Let the user know if it was suppose to answer but couldn't find one*/
          say("Sorry, I could not understand or process that.")
        } catch (error) {
          say(
            "Sorry, There was an internal error while processing your request.\n error: " +
              error
          )
        }
      })
    } catch (error) {
      console.error("Error listening to messages:", error)
    }
  }
}

export default SlackBotApp
