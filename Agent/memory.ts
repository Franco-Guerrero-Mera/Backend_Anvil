import { BaseMessage } from "@langchain/core/messages";

const memory = new Map<string, BaseMessage[]>();

export function getHistory(threadId: string): BaseMessage[] {
  return memory.get(threadId) || [];
}

export function saveToHistory(threadId: string, messages: BaseMessage[]) {
  const current = memory.get(threadId) || [];
  memory.set(threadId, current.concat(messages));
}