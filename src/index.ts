import OpenAI from "openai"
import SlackService from "./services/slack.service"
import AiService from "./services/ai.service"
import SlackBotApp from "./slackBotApp"
import PineconeService from "./services/pinecone.service"

async function main() {
  const openAi = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const slackService = new SlackService()
  const pineconeService = new PineconeService({ slackService, openAi })
  const aiService = new AiService({ openAi, pineconeService, slackService })

  /* Start the slack bot */
  new SlackBotApp({ aiService, pineconeService })
}

main()
