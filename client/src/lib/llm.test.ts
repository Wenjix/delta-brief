import { describe, it, expect } from 'vitest';

describe('LLM Integration', () => {
  it('should have a valid OpenAI API key', async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe('');
  });
});
