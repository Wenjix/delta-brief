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

// --- MemMachine Provider (Full Implementation) ---

interface MemMachineConfig {
  baseUrl: string;
  orgId: string;
  projectId: string;
}

interface MemMachineMessage {
  content: string;
  producer: string;
  produced_for: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  metadata: Record<string, string>;
  types: ('episodic' | 'semantic')[];
}

interface MemMachineMemory {
  uid?: string;           // MemMachine list() uses uid
  episodic_id?: string;   // MemMachine search() uses episodic_id
  semantic_id?: string;
  content: string;
  metadata: Record<string, string>;
  timestamp?: string;     // Search response
  created_at?: string;    // List response
  producer: string;
  produced_for: string;
}

export class MemMachineProvider implements MemoryProvider {
  private config: MemMachineConfig;
  private projectEnsured: boolean = false;

  constructor(config: MemMachineConfig) {
    this.config = config;
    console.log(`[MemMachine] Initialized: org=${config.orgId}, project=${config.projectId}`);
  }

  // --- Project Management ---

  private async ensureProjectExists(): Promise<void> {
    if (this.projectEnsured) return;

    try {
      // Check if project exists
      const listRes = await fetch(`${this.config.baseUrl}/api/v2/projects/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: this.config.orgId }),
      });

      if (!listRes.ok) {
        console.warn('[MemMachine] Could not list projects, attempting create');
      } else {
        const projects = await listRes.json();
        const found = projects?.projects?.some(
          (p: any) => p.project_id === this.config.projectId
        );
        if (found) {
          this.projectEnsured = true;
          console.log('[MemMachine] Project exists');
          return;
        }
      }

      // Create project
      const createRes = await fetch(`${this.config.baseUrl}/api/v2/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: this.config.orgId,
          project_id: this.config.projectId,
        }),
      });

      if (createRes.ok) {
        console.log('[MemMachine] Project created');
      } else {
        const err = await createRes.text();
        // Project may already exist (409), that's okay
        if (createRes.status !== 409) {
          console.warn('[MemMachine] Project creation response:', err);
        }
      }

      this.projectEnsured = true;
    } catch (err) {
      console.error('[MemMachine] ensureProjectExists failed:', err);
      throw err;
    }
  }

  // --- Core Provider Methods ---

  async add(content: Omit<Memory, 'id' | 'created_at' | 'kind' | 'v'>): Promise<string> {
    await this.ensureProjectExists();

    const memType: 'episodic' | 'semantic' = content.episode_type === 'profile' ? 'semantic' : 'episodic';

    const message: MemMachineMessage = {
      content: JSON.stringify(content.payload),
      producer: 'patched-app',
      produced_for: content.user_id,
      timestamp: new Date().toISOString(),
      role: 'user',
      metadata: {
        user_id: content.user_id,
        org_id: content.org_id,
        project_id: content.project_id,
        session_id: content.session_id,
        episode_type: content.episode_type,
        tags: content.tags.join(','),
      },
      types: [memType],
    };

    const res = await fetch(`${this.config.baseUrl}/api/v2/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: this.config.orgId,
        project_id: this.config.projectId,
        messages: [message],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[MemMachine] add() failed:', err);
      throw new Error(`MemMachine add failed: ${res.status}`);
    }

    const result = await res.json();
    // Return the first created ID
    const id = result?.episodic_ids?.[0] || result?.semantic_ids?.[0] || nanoid();
    console.log('[MemMachine] Memory added:', id);
    return id;
  }

  async search(query: string, filters?: MemoryFilter, top_k: number = 5): Promise<Memory[]> {
    await this.ensureProjectExists();

    // Build filter string - MemMachine requires SINGLE quotes for values
    const filterParts: string[] = [];
    if (filters?.episode_type && filters.episode_type.length > 0) {
      // MemMachine filter syntax: metadata.episode_type='value'
      filterParts.push(`metadata.episode_type='${filters.episode_type[0]}'`);
    }
    if (filters?.session_id && filters.session_id.length > 0) {
      filterParts.push(`metadata.session_id='${filters.session_id[0]}'`);
    }

    const body: any = {
      org_id: this.config.orgId,
      project_id: this.config.projectId,
      query: query || '',
      top_k,
      types: ['episodic', 'semantic'],
    };

    if (filterParts.length > 0) {
      body.filter = filterParts.join(' AND ');
    }

    console.log('[MemMachine] search() filter:', body.filter);

    const res = await fetch(`${this.config.baseUrl}/api/v2/memories/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[MemMachine] search() failed:', err);
      return [];
    }

    const result = await res.json();
    // MemMachine search() returns { content: { episodic_memory: { long_term_memory: { episodes: [...] }, short_term_memory: { ... } } } }
    const longTermEpisodes = result?.content?.episodic_memory?.long_term_memory?.episodes || [];
    const shortTermEpisodes = result?.content?.episodic_memory?.short_term_memory?.episodes || [];
    const allEpisodes = [...longTermEpisodes, ...shortTermEpisodes];
    console.log('[MemMachine] search() found', allEpisodes.length, 'episodes');
    return this.mapMemories(allEpisodes);
  }

  async list(filters?: MemoryFilter): Promise<Memory[]> {
    await this.ensureProjectExists();

    // Build filter string - MemMachine requires SINGLE quotes for values
    const filterParts: string[] = [`metadata.user_id='u_demo'`];
    if (filters?.episode_type && filters.episode_type.length > 0) {
      filterParts.push(`metadata.episode_type='${filters.episode_type[0]}'`);
    }
    if (filters?.session_id && filters.session_id.length > 0) {
      filterParts.push(`metadata.session_id='${filters.session_id[0]}'`);
    }

    const body = {
      org_id: this.config.orgId,
      project_id: this.config.projectId,
      filter: filterParts.join(' AND '),
      type: 'episodic', // List episodic by default
    };

    const res = await fetch(`${this.config.baseUrl}/api/v2/memories/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[MemMachine] list() failed:', err);
      return [];
    }

    const result = await res.json();
    // MemMachine list() returns { content: { episodic_memory: [...], semantic_memory: [...] } }
    const episodes = result?.content?.episodic_memory || [];
    console.log('[MemMachine] list() found', episodes.length, 'episodes');
    return this.mapMemories(episodes);
  }

  async clear(): Promise<void> {
    await this.ensureProjectExists();

    try {
      // 1. List and delete episodic memories
      const episodicBody = {
        org_id: this.config.orgId,
        project_id: this.config.projectId,
        filter: "metadata.user_id='u_demo'",  // Must use single quotes
        type: 'episodic',
      };

      const episodicRes = await fetch(`${this.config.baseUrl}/api/v2/memories/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(episodicBody),
      });

      if (episodicRes.ok) {
        const episodicResult = await episodicRes.json();
        // MemMachine list() returns { content: { episodic_memory: [...] } }
        const episodes = episodicResult?.content?.episodic_memory || [];
        // MemMachine uses 'uid' for episode IDs
        const episodicIds = episodes
          .map((m: MemMachineMemory) => m.uid)
          .filter(Boolean);

        if (episodicIds.length > 0) {
          await fetch(`${this.config.baseUrl}/api/v2/memories/episodic/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              org_id: this.config.orgId,
              project_id: this.config.projectId,
              episodic_ids: episodicIds,
            }),
          });
          console.log(`[MemMachine] Deleted ${episodicIds.length} episodic memories`);
        } else {
          console.log('[MemMachine] No episodic memories to delete');
        }
      }

      // 2. List and delete semantic memories (one by one)
      const semanticBody = {
        org_id: this.config.orgId,
        project_id: this.config.projectId,
        filter: "metadata.user_id='u_demo'",  // Must use single quotes
        type: 'semantic',
      };

      const semanticRes = await fetch(`${this.config.baseUrl}/api/v2/memories/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(semanticBody),
      });

      if (semanticRes.ok) {
        const semanticResult = await semanticRes.json();
        // MemMachine list() returns { content: { semantic_memory: [...] } }
        const semanticMemories = semanticResult?.content?.semantic_memory || [];
        const semanticIds = semanticMemories
          .map((m: MemMachineMemory) => m.uid || m.semantic_id)
          .filter(Boolean);

        for (const semanticId of semanticIds) {
          await fetch(`${this.config.baseUrl}/api/v2/memories/semantic/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              org_id: this.config.orgId,
              project_id: this.config.projectId,
              semantic_id: semanticId,
            }),
          });
        }
        console.log(`[MemMachine] Deleted ${semanticIds.length} semantic memories`);
      }

      console.log('[MemMachine] Memory cleared');
    } catch (err) {
      console.error('[MemMachine] clear() failed:', err);
      throw err;
    }
  }

  // --- Helpers ---

  private mapMemories(mmMemories: MemMachineMemory[]): Memory[] {
    return mmMemories
      .map((mm) => {
        try {
          // Validate required fields - MemMachine uses 'uid' for ID and 'created_at' for timestamp
          if (!mm.metadata?.session_id || !mm.metadata?.episode_type) {
            console.warn('[MemMachine] Skipping malformed memory (missing session_id or episode_type):', mm.uid || mm.episodic_id);
            return null;
          }

          let payload: any;
          try {
            payload = JSON.parse(mm.content);
          } catch {
            payload = { raw: mm.content };
          }

          return {
            id: mm.uid || mm.episodic_id || mm.semantic_id || nanoid(),
            kind: 'patched.memory' as const,
            v: 1,
            user_id: mm.metadata.user_id || 'u_demo',
            org_id: mm.metadata.org_id || this.config.orgId,
            project_id: mm.metadata.project_id || this.config.projectId,
            session_id: mm.metadata.session_id,
            episode_type: mm.metadata.episode_type as EpisodeType,
            created_at: mm.created_at || mm.timestamp || new Date().toISOString(),
            tags: mm.metadata.tags ? mm.metadata.tags.split(',') : [],
            payload,
          };
        } catch (err) {
          console.error('[MemMachine] Failed to map memory:', err, mm);
          return null;
        }
      })
      .filter((m): m is Memory => m !== null);
  }
}

// --- Factory Function ---

/**
 * Creates the appropriate MemoryProvider based on environment configuration.
 * 
 * Set VITE_MEMORY_PROVIDER='memmachine' to use MemMachine.
 * Defaults to LocalMemoryProvider (localStorage-based) for demo.
 */
export function createMemoryProvider(): MemoryProvider {
  const provider = import.meta.env.VITE_MEMORY_PROVIDER;

  if (provider === 'memmachine') {
    const baseUrl = import.meta.env.VITE_MEMMACHINE_BASE_URL || '/memmachine';
    const orgId = import.meta.env.VITE_MEMMACHINE_ORG_ID || 'patched';
    const projectId = import.meta.env.VITE_MEMMACHINE_PROJECT_ID || 'delta-brief-demo';

    console.log('[Memory] Using MemMachine provider');
    return new MemMachineProvider({ baseUrl, orgId, projectId });
  }

  console.log('[Memory] Using LocalStorage provider');
  return new LocalMemoryProvider();
}

// Singleton instance (created via factory)
export const memoryProvider = createMemoryProvider();
