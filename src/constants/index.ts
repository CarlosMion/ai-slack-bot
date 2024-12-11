export const CUSTOM_TOOL_DEFAULT_MESSAGE =
  "I'm sorry, I'm not able to get this information right now."

export const SEARCH_KEYWORDS = ["search", "find", "look", "get"]
export const THREAD_KEYWORDS = ["replies", "thread", "reply", "threads"]

export const MAX_REQUEST_TOKENS = 700
export const EMBEDDING_DIMENSIONS = 1536

export const AWS_REGION = "us-east-1"
export const CLOUD = "aws"

export const VIBRANIUM_SLACK_BOT = "vibranium-slack-bot"

export const ZERO_VECTOR = new Array(EMBEDDING_DIMENSIONS).fill(0)

export enum MESSAGE_SUBTYPE {
  MESSAGE_DELETED = "message_deleted",
}
