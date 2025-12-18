import OpenAI from 'openai';
import { Memory } from './memory';
import { checkNoRepeats, SimilarityReport } from './similarity';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true 
});

const MODEL_ID = 'gpt-4o-mini'; 

export interface BriefGenerationParams {
  classDate: string;
  className: string;
  syllabusTopic: string;
  mode: 'generic' | 'personalized';
  profile?: Memory;
  recentDeltas?: Memory[];
  lastBrief?: Memory;
  enableSimilarityCheck?: boolean; // New toggle
}

export interface BriefGenerationResult {
  markdown: string;
  memoryHighlights: string[];
  moves: string[]; // Extracted moves
  similarityReport?: SimilarityReport; // Report if check was run
  usage: {
    usedProfile: boolean;
    usedLastBrief: boolean;
    deltaCount: number;
    retryCount: number; // Track retries
  };
}

// Helper to extract moves from markdown using regex
function extractMoves(markdown: string): string[] {
  const moves: string[] = [];
  const regex = /^\d+\)\s*Move:\s*(.+)$/gm;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    moves.push(match[1].trim());
  }
  return moves;
}

export async function generateBrief(params: BriefGenerationParams): Promise<BriefGenerationResult> {
  const { 
    classDate, 
    className, 
    syllabusTopic, 
    mode, 
    profile, 
    recentDeltas = [], 
    lastBrief,
    enableSimilarityCheck = false
  } = params;

  const isPersonalized = mode === 'personalized';
  let retryCount = 0;

  // 1. Construct Context Strings
  const profileStr = isPersonalized && profile 
    ? JSON.stringify(profile.payload, null, 2) 
    : "NOT AVAILABLE (Generic Mode)";

  const deltasStr = recentDeltas.length > 0 
    ? recentDeltas.map(d => JSON.stringify(d.payload)).join('\n---\n')
    : "No recent updates recorded.";

  const lastBriefStr = isPersonalized && lastBrief
    ? JSON.stringify(lastBrief.payload, null, 2)
    : "NOT AVAILABLE (First session or Generic Mode)";

  // 2. Build Base Prompt
  const systemPrompt = `You are an executive-grade EMBA assistant. The user is time-poor and wants class learnings converted into immediate work leverage.

Non-negotiables:
- Output MUST be one page in length and follow the exact template provided.
- Produce exactly 3 “Moves that matter” that are specific to the user’s org + goals.
- Avoid repeating last brief’s moves unless something materially changed; if you reference a prior move, explicitly state what changed.
- Be constraint-aware: always factor in the user’s top constraints.
- No generic AI hype. No filler. No long explanations.
- If information is missing, make a minimal assumption and label it “Assumption: …”.`;

  let userPrompt = `Generate a “Pre-Class Delta Brief” for the next class session.

Syllabus / next topic:
${syllabusTopic}

Profile memory (stable facts about the student + org):
${profileStr}

Most recent weekly check-in / deltas:
${deltasStr}

Last brief output (to avoid repeats):
${lastBriefStr}

Write the brief using this EXACT structure (markdown):

# Pre-Class Delta Brief — ${className} — ${classDate}

## This week’s lens (tie to syllabus topic)
- (1–2 bullets)

## 3 moves that matter since last class (ranked)
For each move, include exactly these sub-bullets:
1) Move: <7–12 words>
   - What changed (specific, from deltas)
   - Why it matters for my org (tie to profile + constraints)
   - Capstone implication (tie to capstone topic/milestone)
   - “In-class line” (one sentence I can say in class)

## 2 risks / failure modes (constraint-aware)
- Risk 1: <one sentence> — Mitigation: <one sentence>
- Risk 2: <one sentence> — Mitigation: <one sentence>

## 1 next action I can complete this week (smallest step)
- Action: <one sentence>
- Output artifact: <one sentence deliverable>

## Class discussion ammo
- Contrarian point A: <one sentence>
- Contrarian point B: <one sentence>
- Question to ask (prof/guest): <one sentence>
- My org story (30 seconds): <3–5 sentences, concrete>

## Memory highlights used (for transparency)
- (4–7 short chips/phrases; only items truly used)

Hard constraints:
- Do NOT include anything outside the template.
- Do NOT exceed ~350–450 words total.
- Do NOT invent facts about the user’s org; only use provided memories/deltas. If needed, use “Assumption: …”.`;

  // 3. Initial Generation Loop
  try {
    // Define message type compatible with OpenAI SDK
    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    let completion = await openai.chat.completions.create({
      model: MODEL_ID,
      messages,
      temperature: 0.7,
    });

    let markdown = completion.choices[0]?.message?.content || "Error generating brief.";
    let moves = extractMoves(markdown);
    let similarityReport: SimilarityReport | undefined;

    // 4. Similarity Check & Retry Logic
    if (enableSimilarityCheck && isPersonalized && lastBrief && lastBrief.payload.moves) {
      const prevMoves = lastBrief.payload.moves as string[];
      
      // First check
      similarityReport = checkNoRepeats(prevMoves, moves);

      if (!similarityReport.pass) {
        console.log("Similarity check failed. Retrying...", similarityReport);
        retryCount++;

        // Construct retry prompt
        const retryInstruction = `
Repeat-avoidance constraint:
Do NOT reuse or closely paraphrase these previous Move titles:
${prevMoves.map(m => `- ${m}`).join('\n')}

Your new 3 Move titles must be materially different in topic and wording.
If you reference an earlier theme, change the angle and explicitly state “what changed” as the novelty.
`;
        
        // Append retry instruction to conversation history
        messages.push({ role: 'assistant', content: markdown });
        messages.push({ role: 'user', content: retryInstruction });

        // Retry generation
        completion = await openai.chat.completions.create({
          model: MODEL_ID,
          messages,
          temperature: 0.8, // Slightly higher temp for variety
        });

        markdown = completion.choices[0]?.message?.content || "Error generating brief.";
        moves = extractMoves(markdown);
        
        // Re-check (but don't retry again, just report)
        similarityReport = checkNoRepeats(prevMoves, moves);
      }
    }

    // 5. Extract Memory Highlights
    let highlights: string[] = [];
    const highlightSection = markdown.split('## Memory highlights used')[1];
    if (highlightSection) {
      highlights = highlightSection
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-/, '').trim());
    }

    return {
      markdown,
      memoryHighlights: highlights,
      moves,
      similarityReport,
      usage: {
        usedProfile: isPersonalized && !!profile,
        usedLastBrief: isPersonalized && !!lastBrief,
        deltaCount: recentDeltas.length,
        retryCount
      }
    };

  } catch (error) {
    console.error("LLM Generation Error:", error);
    throw new Error("Failed to generate brief. Please check your API key.");
  }
}
