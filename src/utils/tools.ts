import { ChatCompletionTool } from "openai/resources"
import { TOOL_NAME } from "../types/openAi"

export const SUMMARIZE_SLACK_THREAD_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: TOOL_NAME.SUMMARIZE_SLACK_THREAD_BY_KEYWORD,
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

export const TAGGED_SUMMARIZE_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: TOOL_NAME.SUMMARIZE_SLACK_THREAD_BY_TS,
    description:
      "Decide if a user query is asking for a thread summarization or not. Only call this tool if the user is asking for the summarization/sum up of a thread",
  },
}
