import { MessageElement } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse"
import { GetHistoryProps, SlackChannelHistoryResponse } from "../types/slack"
import { ConversationsRepliesResponse, WebClient } from "@slack/web-api"
import { Channel } from "@slack/web-api/dist/types/response/ConversationsListResponse"

class SlackService {
  private slackClient: WebClient
  constructor() {
    this.slackClient = new WebClient(process.env.SLACK_BOT_OAUTH_TOKEN)
  }

  async getSlackChannels(): Promise<Channel[] | undefined> {
    const channels = await this.slackClient.conversations.list()
    return channels.channels
  }

  async getSlackChannelHistory({
    channel,
    limit = 1000,
  }: GetHistoryProps): Promise<SlackChannelHistoryResponse> {
    const history = await this.slackClient.conversations.history({
      channel,
      limit,
    })
    return { history, channel }
  }

  async getThreadReplies({
    channel,
    ts,
  }: {
    channel: string
    ts: string
  }): Promise<ConversationsRepliesResponse> {
    try {
      return this.slackClient.conversations.replies({
        channel,
        ts,
      })
    } catch (error) {
      console.error("Error fetching thread replies:", error)
      return { messages: [] as MessageElement[], ok: false }
    }
  }
}

export default SlackService
