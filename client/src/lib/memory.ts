import { nanoid } from 'nanoid';

// --- Types ---

export type EpisodeType = 'profile' | 'work_delta' | 'brief_output' | 'feedback';

export interface Memory {
  id: string;
  kind: 'patched.memory';
  v: number;
  user_id: string;
  org_id: string;
  project_id: string;
  session_id: string;
  episode_type: EpisodeType;
  created_at: string;
  tags: string[];
  payload: any;
}

export interface MemoryFilter {
  episode_type?: EpisodeType[];
  session_id?: string[];
}

export interface MemoryProvider {
  add(content: Omit<Memory, 'id' | 'created_at' | 'kind' | 'v'>): Promise<string>;
  search(query: string, filters?: MemoryFilter, top_k?: number): Promise<Memory[]>;
  list(filters?: MemoryFilter): Promise<Memory[]>;
  clear(): Promise<void>; // For demo reset
}

// --- Local Storage Implementation ---

const STORAGE_KEY = 'patched_memories_v1';

export class LocalMemoryProvider implements MemoryProvider {
  private getMemories(): Memory[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to parse memories', e);
      return [];
    }
  }

  private saveMemories(memories: Memory[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  }

  async add(content: Omit<Memory, 'id' | 'created_at' | 'kind' | 'v'>): Promise<string> {
    const memories = this.getMemories();
    const newMemory: Memory = {
      ...content,
      id: nanoid(),
      kind: 'patched.memory',
      v: 1,
      created_at: new Date().toISOString(),
    };
    
    // Prepend to keep newest first
    memories.unshift(newMemory);
    this.saveMemories(memories);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return newMemory.id;
  }

  async search(query: string, filters?: MemoryFilter, top_k: number = 5): Promise<Memory[]> {
    let memories = this.getMemories();

    // 1. Filter
    if (filters) {
      if (filters.episode_type && filters.episode_type.length > 0) {
        memories = memories.filter(m => filters.episode_type!.includes(m.episode_type));
      }
      if (filters.session_id && filters.session_id.length > 0) {
        memories = memories.filter(m => filters.session_id!.includes(m.session_id));
      }
    }

    // 2. "Search" (Simple keyword matching for demo)
    // In a real app, this would be vector search or full-text search
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      const terms = lowerQuery.split(/\s+/);
      
      memories = memories.map(m => {
        const text = JSON.stringify(m.payload).toLowerCase();
        let score = 0;
        terms.forEach(term => {
          if (text.includes(term)) score += 1;
        });
        return { memory: m, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score) // Sort by score desc
      .map(item => item.memory);
    }

    // 3. Top K
    return memories.slice(0, top_k);
  }

  async list(filters?: MemoryFilter): Promise<Memory[]> {
    let memories = this.getMemories();

    if (filters) {
      if (filters.episode_type && filters.episode_type.length > 0) {
        memories = memories.filter(m => filters.episode_type!.includes(m.episode_type));
      }
      if (filters.session_id && filters.session_id.length > 0) {
        memories = memories.filter(m => filters.session_id!.includes(m.session_id));
      }
    }

    return memories;
  }

  async clear(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Singleton instance
export const memoryProvider = new LocalMemoryProvider();
