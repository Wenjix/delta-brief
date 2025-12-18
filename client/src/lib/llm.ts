import OpenAI from 'openai';
import { Memory } from './memory';

// Initialize OpenAI client
// DANGER: Exposing API key on client side is only for demo purposes as requested.
// In production, this MUST be moved to a backend proxy.
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true 
});

// Use gpt-4o-mini as the reliable "mini" model for now
const MODEL_ID = 'gpt-4o-mini'; 

export interface BriefGenerationParams {
  classDate: string;
  className: string;
  syllabusTopic: string;
  mode: 'generic' | 'personalized';
  profile?: Memory;
  recentDeltas?: Memory[];
  lastBrief?: Memory;
}

export interface BriefGenerationResult {
  markdown: string;
  memoryHighlights: string[];
  usage: {
    usedProfile: boolean;
    usedLastBrief: boolean;
    deltaCount: number;
  };
}

export async function generateBrief(params: BriefGenerationParams): Promise<BriefGenerationResult> {
  const { 
    classDate, 
    className, 
    syllabusTopic, 
    mode, 
    profile, 
    recentDeltas = [], 
    lastBrief 
  } = params;

  // 1. Construct Context Strings
  const isPersonalized = mode === 'personalized';
  
  const profileStr = isPersonalized && profile 
    ? JSON.stringify(profile.payload, null, 2) 
    : "NOT AVAILABLE (Generic Mode)";

  const deltasStr = recentDeltas.length > 0 
    ? recentDeltas.map(d => JSON.stringify(d.payload)).join('\n---\n')
    : "No recent updates recorded.";

  const lastBriefStr = isPersonalized && lastBrief
    ? JSON.stringify(lastBrief.payload, null, 2)
    : "NOT AVAILABLE (First session or Generic Mode)";

  // 2. Build Prompt
  const systemPrompt = `You are an executive-grade EMBA assistant. The user is time-poor and wants class learnings converted into immediate work leverage.

Non-negotiables:
- Output MUST be one page in length and follow the exact template provided.
- Produce exactly 3 “Moves that matter” that are specific to the user’s org + goals.
- Avoid repeating last brief’s moves unless something materially changed; if you reference a prior move, explicitly state what changed.
- Be constraint-aware: always factor in the user’s top constraints.
- No generic AI hype. No filler. No long explanations.
- If information is missing, make a minimal assumption and label it “Assumption: …”.`;

  const userPrompt = `Generate a “Pre-Class Delta Brief” for the next class session.

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

  // 3. Call LLM
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_ID,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
    });

    const markdown = completion.choices[0]?.message?.content || "Error generating brief.";

    // 4. Extract Memory Highlights (Naive parsing from the markdown output)
    // We look for the "Memory highlights used" section
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
      usage: {
        usedProfile: isPersonalized && !!profile,
        usedLastBrief: isPersonalized && !!lastBrief,
        deltaCount: recentDeltas.length
      }
    };

  } catch (error) {
    console.error("LLM Generation Error:", error);
    throw new Error("Failed to generate brief. Please check your API key.");
  }
}
