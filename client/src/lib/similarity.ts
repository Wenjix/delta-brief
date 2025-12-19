export type SimilarityReport = {
  pass: boolean;
  maxScore: number;
  pairs: Array<{
    newMove: string;
    prevMove: string;
    score: number;
    reason: "exact" | "high_similarity";
  }>;
};

const STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'for', 'and', 'in', 'on', 'with', 'by'
]);

function normalizeTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Replace non-alphanumerics with space
    .split(/\s+/)
    .filter(t => t.length > 0)
    .filter(t => !STOPWORDS.has(t))
    .map(t => {
      // Crude suffix stripping
      if (t.endsWith('ing')) return t.slice(0, -3);
      if (t.endsWith('ed')) return t.slice(0, -2);
      if (t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
      return t;
    });
}

function getBigrams(tokens: string[]): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.add(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return bigrams;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1.0; // Both empty = identical
  if (a.size === 0 || b.size === 0) return 0.0; // One empty = different

  let intersection = 0;
  // Fix iteration for older TS targets
  a.forEach(item => {
    if (b.has(item)) intersection++;
  });

  const union = a.size + b.size - intersection;
  return intersection / union;
}

/**
 * Check if new moves are too similar to previous moves.
 * Returns a report indicating whether moves passed the similarity check.
 * 
 * @param newMoves - The newly generated moves to validate
 * @param previousMoves - The previous brief's moves to compare against
 * @returns SimilarityReport with pass/fail status and similarity details
 */
export function checkForSimilarity(newMoves: string[], previousMoves: string[]): SimilarityReport {
  const report: SimilarityReport = {
    pass: true,
    maxScore: 0,
    pairs: []
  };

  for (const newMove of newMoves) {
    const normNew = normalizeTokens(newMove);
    const bigramsNew = getBigrams(normNew);
    const newStr = normNew.join(" ");

    for (const prevMove of previousMoves) {
      const normPrev = normalizeTokens(prevMove);
      const bigramsPrev = getBigrams(normPrev);
      const prevStr = normPrev.join(" ");

      let score = 0;
      let reason: "exact" | "high_similarity" | null = null;

      // Exact match check on normalized string
      if (newStr === prevStr) {
        score = 1.0;
        reason = "exact";
      } else {
        score = jaccard(bigramsNew, bigramsPrev);

        // Threshold rules
        const threshold = (normNew.length <= 6 || normPrev.length <= 6) ? 0.50 : 0.60;

        if (score >= threshold) {
          reason = "high_similarity";
        }
      }

      if (score > report.maxScore) {
        report.maxScore = score;
      }

      if (reason) {
        report.pass = false;
        report.pairs.push({
          newMove,
          prevMove,
          score,
          reason
        });
      }
    }
  }

  return report;
}
