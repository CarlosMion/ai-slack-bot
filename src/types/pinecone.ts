import { PineconeRecord, RecordMetadata } from "@pinecone-database/pinecone"

export interface CreatePineconeIndexProps {
  name: string
}

export interface EmbeddingInfo extends RecordMetadata {
  content: string[] | string
  user: string
  role: string
  messageTs: string
  parentMessageTs: string
  channel: string
}

export interface UpsertVectorsProps {
  indexName: string
  vectors: PineconeRecord<EmbeddingInfo>[]
}

export interface QueryVectorsProps {
  indexName: string
  entriesLimit?: number
}

export interface QueryEmbeddingsProps {
  question: string
  indexName: string
}
