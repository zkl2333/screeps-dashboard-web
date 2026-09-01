import { screepsRequest } from "./request";
import type {
  ProcessedConversation,
  ProcessedConversationMap,
  ProcessedConversationMessage,
  ScreepsResponse,
  ScreepsSession,
  SendMessageInput,
} from "./types";

type RawMessage = {
  _id?: unknown;
  date?: unknown;
  type?: unknown;
  text?: unknown;
  unread?: unknown;
};

type MessagesIndexPayload = {
  ok?: unknown;
  messages?: unknown;
  users?: unknown;
};

type MessagesUser = {
  username?: unknown;
  avatarUrl?: unknown;
  avatarURL?: unknown;
  avatar?: unknown;
  badge?: unknown;
};

const DEFAULT_PER_CONVERSATION_LIMIT = 200;
const DEFAULT_MAX_CONVERSATIONS = 200;
const MAX_PER_CONVERSATION_LIMIT = 1000;
const MAX_CONVERSATIONS_LIMIT = 500;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value === "true" || value === "1";
  return undefined;
}

function payloadError(payload: unknown): string | undefined {
  const record = asRecord(payload);
  const direct = asString(record?.error);
  if (direct) return direct;
  return undefined;
}

function payloadFeedback(payload: unknown): string | undefined {
  const stack: unknown[] = [payload];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      const text = current.trim();
      if (text && text !== "1" && text.toLowerCase() !== "ok") return text;
      continue;
    }
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    const record = asRecord(current);
    if (!record) continue;
    for (const key of ["message", "result", "status", "text"]) {
      const text = asString(record[key]);
      if (text && text !== "1" && text.toLowerCase() !== "ok") return text;
    }
    stack.push(...Object.values(record));
  }
  return undefined;
}

function requireSuccess(response: ScreepsResponse, label: string): unknown {
  if (!response.ok) throw new Error(`${label} request failed: HTTP ${response.status}`);
  const error = payloadError(response.data);
  if (error) throw new Error(error);
  return response.data;
}

async function fetchAuthProfile(session: ScreepsSession): Promise<{ id: string; username: string }> {
  const response = await screepsRequest({
    endpoint: "/api/auth/me",
    method: "GET",
  });
  const payload = asRecord(requireSuccess(response, "Auth profile"));
  const id = asString(payload?._id ?? payload?.id);
  const username = asString(payload?.username ?? payload?.name) ?? session.username;
  if (!id) throw new Error("Auth profile did not contain a user id.");
  return { id, username };
}

async function fetchMessagesIndex(limit: number): Promise<MessagesIndexPayload> {
  const response = await screepsRequest({
    endpoint: "/api/user/messages/index",
    method: "GET",
    query: { limit },
  });
  return asRecord(requireSuccess(response, "Messages index")) as MessagesIndexPayload;
}

async function fetchMessagesList(
  peerId: string,
  count: number
): Promise<RawMessage[]> {
  const response = await screepsRequest({
    endpoint: "/api/user/messages/list",
    method: "GET",
    query: { respondent: peerId, count, offset: 0 },
  });
  const payload = asRecord(requireSuccess(response, "Messages list"));
  return Array.isArray(payload?.messages) ? (payload.messages as RawMessage[]) : [];
}

function normalizeAssetUrl(baseUrl: string, candidate: unknown): string | undefined {
  const raw = asString(candidate);
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = baseUrl.replace(/\/+$/, "");
  return raw.startsWith("/") ? `${base}${raw}` : `${base}/${raw}`;
}

function userMap(payload: MessagesIndexPayload): Record<string, MessagesUser> {
  const users = asRecord(payload.users);
  return users ? (users as Record<string, MessagesUser>) : {};
}

function toConversationMessage(
  raw: RawMessage,
  selfId: string,
  selfUsername: string,
  peerId: string,
  peerUsername: string
): ProcessedConversationMessage | undefined {
  const id = asString(raw._id);
  if (!id) return undefined;
  const outbound = asString(raw.type)?.toLowerCase() === "out";
  const self = { id: selfId, username: selfUsername, isSelf: true };
  const peer = { id: peerId, username: peerUsername, isSelf: false };
  return {
    id,
    createdAt: asString(raw.date),
    text: asString(raw.text),
    sender: outbound ? self : peer,
    recipient: outbound ? peer : self,
    direction: outbound ? "outbound" : "inbound",
    unread: asBoolean(raw.unread),
  };
}

function compareMessages(left: ProcessedConversationMessage, right: ProcessedConversationMessage): number {
  const leftDate = left.createdAt ?? "";
  const rightDate = right.createdAt ?? "";
  return leftDate === rightDate ? left.id.localeCompare(right.id) : leftDate.localeCompare(rightDate);
}

function conversationHeads(
  payload: MessagesIndexPayload,
  baseUrl: string,
  maxConversations: number
): Array<{ peerId: string; peerUsername: string; peerAvatarUrl?: string; peerHasBadge: boolean; latest: RawMessage }> {
  const messages = Array.isArray(payload.messages) ? (payload.messages as Array<Record<string, unknown>>) : [];
  const users = userMap(payload);
  const heads = new Map<string, { peerId: string; peerUsername: string; peerAvatarUrl?: string; peerHasBadge: boolean; latest: RawMessage }>();
  for (const item of messages) {
    const peerId = asString(item._id ?? item.peerId ?? item.peer_id);
    const latest = asRecord(item.message) as RawMessage | undefined;
    if (!peerId || !latest) continue;
    const user = users[peerId] ?? {};
    const head = {
      peerId,
      peerUsername: asString(user.username) ?? peerId,
      peerAvatarUrl: normalizeAssetUrl(baseUrl, user.avatarUrl ?? user.avatarURL ?? user.avatar),
      peerHasBadge: user.badge !== undefined && user.badge !== null,
      latest,
    };
    const current = heads.get(peerId);
    if (!current || (asString(current.latest.date) ?? "") < (asString(latest.date) ?? "")) heads.set(peerId, head);
  }
  return [...heads.values()]
    .sort((left, right) => {
      const dateOrder = (asString(right.latest.date) ?? "").localeCompare(asString(left.latest.date) ?? "");
      return dateOrder || left.peerId.localeCompare(right.peerId);
    })
    .slice(0, maxConversations);
}

export async function fetchProcessedMessages(
  session: ScreepsSession,
  options?: { maxConversations?: number }
): Promise<ProcessedConversationMap> {
  const maxConversations = Math.max(1, Math.min(MAX_CONVERSATIONS_LIMIT, Math.floor(options?.maxConversations ?? DEFAULT_MAX_CONVERSATIONS)));
  const profile = await fetchAuthProfile(session);
  const payload = await fetchMessagesIndex(maxConversations);
  const output: ProcessedConversationMap = {};
  for (const head of conversationHeads(payload, session.baseUrl, maxConversations)) {
    const message = toConversationMessage(head.latest, profile.id, profile.username, head.peerId, head.peerUsername);
    output[head.peerId] = {
      peerId: head.peerId,
      peerUsername: head.peerUsername,
      peerAvatarUrl: head.peerAvatarUrl,
      peerHasBadge: head.peerHasBadge,
      messages: message ? [message] : [],
    };
  }
  return output;
}

export async function fetchConversationThread(
  session: ScreepsSession,
  input: { peerId: string; peerUsername?: string; peerAvatarUrl?: string; peerHasBadge?: boolean; limit?: number }
): Promise<ProcessedConversation> {
  const peerId = input.peerId.trim();
  if (!peerId) throw new Error("Peer id is required.");
  const limit = Math.max(1, Math.min(MAX_PER_CONVERSATION_LIMIT, Math.floor(input.limit ?? DEFAULT_PER_CONVERSATION_LIMIT)));
  const profile = await fetchAuthProfile(session);
  const messages = await fetchMessagesList(peerId, limit);
  const peerUsername = input.peerUsername?.trim() || peerId;
  const seen = new Set<string>();
  const output = messages
    .map((raw) => toConversationMessage(raw, profile.id, profile.username, peerId, peerUsername))
    .filter((message): message is ProcessedConversationMessage => Boolean(message && !seen.has(message.id) && seen.add(message.id)))
    .sort(compareMessages)
    .slice(-limit);
  return {
    peerId,
    peerUsername,
    peerAvatarUrl: input.peerAvatarUrl?.trim() || undefined,
    peerHasBadge: input.peerHasBadge ?? false,
    messages: output,
  };
}

export async function sendMessage(_session: ScreepsSession, input: SendMessageInput): Promise<string | undefined> {
  const respondent = input.to.trim();
  const subject = (input.subject ?? "").trim();
  const text = input.text.trim();
  if (!respondent) throw new Error("Message recipient is required.");
  if (!text) throw new Error("Message body cannot be empty.");
  const response = await screepsRequest({
    endpoint: "/api/user/messages/send",
    method: "POST",
    body: { respondent, subject, text },
  });
  requireSuccess(response, "Messages send");
  return payloadFeedback(response.data);
}
