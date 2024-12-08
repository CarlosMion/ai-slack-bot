import { ChatCompletionTool } from "openai/resources"
import { TOOL_NAME } from "../types/openAi"

export const SUMMARIZE_SLACK_THREAD_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: TOOL_NAME.SUMMARIZE_SLACK_THREAD_,
    description:
      "fetch a single message or the replies from a thread on a given slack channel using keyword(s). Only call this if the word thread is present in the query",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "string",
          description:
            "The phrase that will be used to search for the thread in the channel",
        },
      },
      required: ["keywords"],
    },
  },
}

export const ANSWER_QUERY_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: TOOL_NAME.ANSWER_QUERY,
    description:
      "Decide if a user query should be answered or not. Only call this if the AI assistant gets called directly",
  },
}
