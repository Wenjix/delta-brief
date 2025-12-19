import { describe, it, expect } from 'vitest';
import { checkForSimilarity } from './similarity';

describe('Similarity Checker', () => {
  it('should fail on exact repeats', () => {
    const prev = ["Legal gating: model risk assessment required"];
    const curr = ["Legal gating: model risk assessment required"];
    const report = checkForSimilarity(curr, prev);

    expect(report.pass).toBe(false);
    expect(report.pairs[0].reason).toBe("exact");
    expect(report.pairs[0].score).toBe(1.0);
  });

  it('should fail on close paraphrases', () => {
    const prev = ["Legal gating: model risk assessment required"];
    const curr = ["Legal requires model risk review before pilot"];
    const report = checkForSimilarity(curr, prev);

    expect(report.pass).toBe(false);
    expect(report.pairs[0].reason).toBe("high_similarity");
    expect(report.maxScore).toBeGreaterThanOrEqual(0.5); // Threshold for short strings
  });

  it('should pass on different angles', () => {
    const prev = ["Legal gating: model risk assessment required"];
    const curr = ["Pilot timeline forces narrower MVP scope"];
    const report = checkForSimilarity(curr, prev);

    expect(report.pass).toBe(true);
    expect(report.pairs).toHaveLength(0);
  });

  it('should handle stopwords and normalization', () => {
    const prev = ["The quick brown fox jumps"];
    const curr = ["Quick brown fox jumping"]; // "jumping" -> "jump"
    const report = checkForSimilarity(curr, prev);

    // "quick brown fox jump" vs "quick brown fox jump" -> exact match after normalization
    expect(report.pass).toBe(false);
    expect(report.pairs[0].reason).toBe("exact");
  });
});

