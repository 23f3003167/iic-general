export interface ChatbotTopic {
  name: string;
  source_id: string;
  rows: number;
}

export interface ChatbotKnowledgeRow {
  id: string;
  source_id: string;
  question: string;
  alternative_questions: string;
  keywords: string;
  section_heading: string;
  content: string;
  source_url: string | null;
  status: string;
  updated_at: string;
}

const apiBaseUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8000';

async function callChatbotBackend<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  if (!response.ok) throw new Error(`Apps Script returned HTTP ${response.status}.`);
  return response.json();
}

export async function getChatbotTopics(): Promise<ChatbotTopic[]> {
  const data = await callChatbotBackend<{ topics: ChatbotTopic[] }>('/api/topics');
  return data.topics || [];
}

export async function getChatbotKnowledgeRows(): Promise<ChatbotKnowledgeRow[]> {
  const data = await callChatbotBackend<{ rows: ChatbotKnowledgeRow[] }>('/api/admin/knowledge');
  return data.rows || [];
}

export async function saveChatbotKnowledgeRow(topic: string, row: Partial<ChatbotKnowledgeRow>) {
  const data = await callChatbotBackend<{ row: ChatbotKnowledgeRow }>('/api/admin/knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, row }),
  });
  return data.row;
}