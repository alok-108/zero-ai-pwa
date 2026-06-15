import { get, set, del, keys } from 'idb-keyval';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  modelId: string;
  temperature: number;
  maxTokens: number;
  ragEnabled: boolean;
  theme: 'dark' | 'light';
  systemPrompt: string;
  hfToken?: string;
  imgGenEngine: 'cloud' | 'local';
  detectModel: 'owlvit' | 'detr';
  ragChunkSize: number;
  ragChunkOverlap: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  temperature: 0.7,
  maxTokens: 512,
  ragEnabled: false,
  theme: 'dark',
  systemPrompt: 'You are a helpful, harmless, and honest AI assistant. Be concise and clear.',
  hfToken: '',
  imgGenEngine: 'cloud',
  detectModel: 'detr',
  ragChunkSize: 400,
  ragChunkOverlap: 50,
};

// ──────────────────────────────────────────────
// Conversation CRUD
// ──────────────────────────────────────────────

const CONV_PREFIX = 'conv:';
const SETTINGS_KEY = 'app:settings';

export async function saveConversation(conv: Conversation): Promise<void> {
  await set(`${CONV_PREFIX}${conv.id}`, conv);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  return get<Conversation>(`${CONV_PREFIX}${id}`);
}

export async function deleteConversation(id: string): Promise<void> {
  await del(`${CONV_PREFIX}${id}`);
}

export async function getAllConversations(): Promise<Conversation[]> {
  const allKeys = await keys();
  const convKeys = allKeys.filter((k) => String(k).startsWith(CONV_PREFIX));
  const convs = await Promise.all(convKeys.map((k) => get<Conversation>(k as string)));
  return (convs.filter(Boolean) as Conversation[]).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createConversation(firstMessage?: string): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: firstMessage ? firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '…' : '') : 'New Chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ──────────────────────────────────────────────
// Settings
// ──────────────────────────────────────────────

export async function loadSettings(): Promise<AppSettings> {
  const saved = await get<AppSettings>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await set(SETTINGS_KEY, settings);
}

// ──────────────────────────────────────────────
// RAG Documents
// ──────────────────────────────────────────────

export interface RagDocument {
  id: string;
  name: string;
  content: string;
  addedAt: number;
}

const RAG_PREFIX = 'rag:';

export async function saveRagDocument(doc: RagDocument): Promise<void> {
  await set(`${RAG_PREFIX}${doc.id}`, doc);
}

export async function getAllRagDocuments(): Promise<RagDocument[]> {
  const allKeys = await keys();
  const ragKeys = allKeys.filter((k) => String(k).startsWith(RAG_PREFIX));
  const docs = await Promise.all(ragKeys.map((k) => get<RagDocument>(k as string)));
  return (docs.filter(Boolean) as RagDocument[]).sort((a, b) => b.addedAt - a.addedAt);
}

export async function deleteRagDocument(id: string): Promise<void> {
  await del(`${RAG_PREFIX}${id}`);
}
