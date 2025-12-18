import { describe, it, expect } from 'vitest';

describe('LLM Integration (Vite)', () => {
  it('should have a valid VITE_OPENAI_API_KEY', async () => {
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe('');
  });
});
