// Lazy-loaded RAG module — only imported when user enables RAG toggle.
// Prevents Transformers.js (~40 MB) from loading on initial page visit.

/* eslint-disable @typescript-eslint/no-explicit-any */

let embedder: any = null;
let voyIndex: any = null;
let isInitialized = false;

export async function initRAG(): Promise<void> {
  if (isInitialized) return;

  // Dynamic import — files fetched only when called
  const transformers = await import('@xenova/transformers');
  const { Voy } = await import('voy-search');

  embedder = await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  voyIndex = new Voy();
  isInitialized = true;
}

async function embed(text: string): Promise<number[]> {
  if (!embedder) throw new Error('RAG not initialized');
  const result = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data as Float32Array);
}

function chunkText(text: string, chunkSize = 400, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

export async function addDocumentToRAG(
  id: string,
  name: string,
  content: string,
  chunkSize = 400,
  chunkOverlap = 50
): Promise<void> {
  if (!voyIndex) throw new Error('RAG not initialized');
  const chunks = chunkText(content, chunkSize, chunkOverlap);
  for (let i = 0; i < chunks.length; i++) {
    const chunkId = `${id}:${i}`;
    const vector = await embed(chunks[i]);
    voyIndex.add({
      id: chunkId,
      title: `${name} — chunk ${i}`,
      url: chunkId,
      body: chunks[i],
      embeddings: vector,
    });
  }
}

export async function rebuildRAGIndex(
  docs: { id: string; name: string; content: string }[],
  chunkSize: number,
  chunkOverlap: number
): Promise<void> {
  if (!isInitialized) return;
  const { Voy } = await import('voy-search');
  voyIndex = new Voy(); // Re-create a clean index
  for (const doc of docs) {
    await addDocumentToRAG(doc.id, doc.name, doc.content, chunkSize, chunkOverlap);
  }
}

export async function retrieveContext(query: string, k = 3): Promise<string> {
  if (!voyIndex || !isInitialized) return '';
  try {
    const queryVec = await embed(query);
    const results = voyIndex.search(queryVec, k);
    const neighbors: any[] = results?.neighbors ?? [];
    return neighbors.map((r: any) => r.body ?? r.id ?? '').filter(Boolean).join('\n\n---\n\n');
  } catch {
    return '';
  }
}

export function isRAGReady(): boolean {
  return isInitialized;
}

export function resetRAG(): void {
  embedder = null;
  voyIndex = null;
  isInitialized = false;
}
