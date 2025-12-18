import OpenAI from 'openai';
import { Memory } from './memory';
import { checkNoRepeats, SimilarityReport } from './similarity';
import syllabus from './syllabus.json';

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
  enableSimilarityCheck?: boolean;
  customSystemPrompt?: string;
  customUserPromptTemplate?: string;
}

export interface BriefGenerationResult {
  markdown: string;
  memoryHighlights: string[];
  moves: string[];
  similarityReport?: SimilarityReport;
  usage: {
    usedProfile: boolean;
    usedLastBrief: boolean;
    deltaCount: number;
    retryCount: number;
  };
}

function extractMoves(markdown: string): string[] {
  const moves: string[] = [];
  const regex = /^\d+\)\s*Move:\s*(.+)$/gm;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    moves.push(match[1].trim());
  }
  return moves;
}

// Helper to find syllabus session details
function getSyllabusDetails(topic: string) {
  const session = syllabus.sessions.find(s => s.topic === topic);
  if (!session) return null;
  return {
    topic: session.topic,
    learning_objectives: session.learning_objectives,
    frameworks: session.frameworks,
    discussion_prompts: session.class_discussion_prompts,
    assignment_hook: session.assignment_hook
  };
}

// Formatter for LLM consumption
function formatSyllabusForLLM(s: ReturnType<typeof getSyllabusDetails>) {
  if (!s) return { syllabusStr: "No detailed syllabus found.", allowedFrameworkNamesStr: "", frameworkNames: [] };

  const frameworkNames = (s.frameworks ?? []).map(f => f.name).filter(Boolean);

  const syllabusStr =
`SYLLABUS CONTEXT (authoritative)

TOPIC: ${s.topic}

KEY FRAMEWORKS (use EXACT names only):
${frameworkNames.map(n => `- ${n}`).join("\n")}

LEARNING OBJECTIVES:
${(s.learning_objectives ?? []).map(o => `- ${o}`).join("\n")}

ASSIGNMENT HOOK:
- ${s.assignment_hook ?? "Assumption: no assignment hook provided"}`;

  const allowedFrameworkNamesStr =
`ALLOWED_FRAMEWORK_NAMES (must match exactly, choose one per Move):
${JSON.stringify(frameworkNames)}`;

  return { syllabusStr, allowedFrameworkNamesStr, frameworkNames };
}

export const DEFAULT_SYSTEM_PROMPT = `You are an executive-grade EMBA assistant. The user is time-poor and wants class learnings converted into immediate work leverage.

Non-negotiables:
- Output MUST be one page and follow the exact template provided.
- Produce exactly 3 "Moves that matter" that are specific to the user's org + goals.
- Avoid repeating last brief's moves unless something materially changed; if you reference a prior move, explicitly state what changed.
- Be constraint-aware: always factor in the user's top constraints.
- No generic AI hype. No filler. No long explanations.
- If information is missing, make a minimal assumption and label it "Assumption: …".

Hard rules:
- Framework names MUST be selected ONLY from the provided "KEY FRAMEWORKS" list in the syllabus context. Do not invent new framework names.
- Do not add any extra sections beyond the template.
- Do not output any duplicate sections (especially "Memory highlights").
- Use the provided class date exactly. Do not substitute "today".`;

export const DEFAULT_USER_PROMPT_TEMPLATE = `Generate a “Pre-Class Delta Brief” for the next class session.

Syllabus / next topic:
{{syllabusTopic}}

Detailed Syllabus Context (includes KEY FRAMEWORKS, LEARNING OBJECTIVES, assignment hook):
{{syllabusStr}}

{{allowedFrameworkNamesStr}}

Profile memory (stable facts about the student + org):
{{profileStr}}

Most recent weekly check-in / deltas (sorted by impact, highest first):
{{deltasStr}}

Last brief output (to avoid repeats & resolve open threads):
{{lastBriefStr}}

CRITICAL INSTRUCTION (must follow):
1) Identify the single highest-impact delta from the check-in.
2) Identify any Open Thread(s) from the last brief that this delta affects.
3) You MUST dedicate at least one Move to explicitly resolving the affected Open Thread.
   - The resolution MUST appear as a sub-bullet under that Move using this exact format:
     - Open Thread Update: Previously: [Old Plan] -> Now: [New Reality] -> Update: [New Plan]

FRAMEWORK CONSTRAINT:
- For EACH Move, the framework name MUST exactly match one item from the KEY FRAMEWORKS list in {{syllabusStr}}.

Write the brief using this EXACT structure (markdown). Follow formatting precisely:

# Pre-Class Delta Brief — {{className}} — {{classDate}}

## This week’s lens (tie to syllabus topic)
- (1–2 bullets; each bullet must reference a learning objective or framework from the syllabus)

## 3 moves that matter since last class (ranked)
For each move, include exactly these sub-bullets:
1) Move: <7–12 words> (Framework: <ONE framework from KEY FRAMEWORKS>)
   - What changed (specific, from deltas; mention impact)
   - Why it matters for my org (tie to profile + constraints)
   - Capstone implication (tie to capstone topic/milestone)
   - “In-class line” (one sentence I can say in class)
   - Open Thread Update: Previously: [Old Plan] -> Now: [New Reality] -> Update: [New Plan]
     (Include this line ONLY for the Move that resolves an Open Thread. Do not include it on other moves.)

## 2 risks / failure modes (constraint-aware)
- Risk 1: <one sentence> — Mitigation: <one sentence>
- Risk 2: <one sentence> — Mitigation: <one sentence>

## 1 next action I can complete this week (smallest step)
- Action: <one sentence>
- Output artifact: <one concrete deliverable produced by the Action> (Must satisfy: {{assignmentHook}})

## Class discussion ammo
- Contrarian point A: <one sentence>
- Contrarian point B: <one sentence>
- Question to ask (prof/guest): <one sentence>
- My org story (30 seconds): <3–5 sentences, concrete, using the highest-impact delta>

## Memory highlights used (for transparency)
- (4–7 short chips/phrases; ONLY items truly used; do NOT repeat this section in any other form)

Hard constraints:
- Do NOT include anything outside the template.
- Do NOT exceed ~350–450 words total.
- Do NOT invent facts about the user’s org; only use provided memories/deltas. If needed, use “Assumption: …”.`;

export async function generateBrief(params: BriefGenerationParams): Promise<BriefGenerationResult> {
  const { 
    classDate, 
    className, 
    syllabusTopic, 
    mode, 
    profile, 
    recentDeltas = [], 
    lastBrief,
    enableSimilarityCheck = false,
    customSystemPrompt,
    customUserPromptTemplate
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

  // Get Syllabus Context & Format
  const syllabusDetails = getSyllabusDetails(syllabusTopic);
  const { syllabusStr, allowedFrameworkNamesStr, frameworkNames } = formatSyllabusForLLM(syllabusDetails);

  // 2. Build Prompts
  const systemPrompt = customSystemPrompt || DEFAULT_SYSTEM_PROMPT;
  
  let userPrompt = customUserPromptTemplate || DEFAULT_USER_PROMPT_TEMPLATE;
  
  // Interpolate variables
  userPrompt = userPrompt
    .replace('{{syllabusTopic}}', syllabusTopic)
    .replace('{{syllabusStr}}', syllabusStr)
    .replace('{{allowedFrameworkNamesStr}}', allowedFrameworkNamesStr)
    .replace('{{profileStr}}', profileStr)
    .replace('{{deltasStr}}', deltasStr)
    .replace('{{lastBriefStr}}', lastBriefStr)
    .replace('{{className}}', className)
    .replace('{{classDate}}', classDate)
    .replace('{{assignmentHook}}', syllabusDetails?.assignment_hook || "<one sentence deliverable>");

  // 3. Initial Generation Loop
  try {
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

    // 4. Framework Validation Logic
    if (frameworkNames.length > 0) {
      const frameworkRegex = /\(Framework:\s*([^)]+)\)/g;
      let match;
      let invalidFrameworks: string[] = [];
      
      while ((match = frameworkRegex.exec(markdown)) !== null) {
        const usedFramework = match[1].trim();
        if (!frameworkNames.includes(usedFramework)) {
          invalidFrameworks.push(usedFramework);
        }
      }

      if (invalidFrameworks.length > 0) {
        console.log("Framework validation failed. Retrying...", invalidFrameworks);
        retryCount++;

        const retryInstruction = `
FRAMEWORK ERROR DETECTED:
You used these invalid framework names: ${JSON.stringify(invalidFrameworks)}

You MUST use EXACT names from this list only:
${JSON.stringify(frameworkNames)}

Please regenerate the brief with corrected framework names. Copy/paste exactly.
`;
        messages.push({ role: 'assistant', content: markdown });
        messages.push({ role: 'user', content: retryInstruction });

        completion = await openai.chat.completions.create({
          model: MODEL_ID,
          messages,
          temperature: 0.5, // Lower temp for strict compliance
        });

        markdown = completion.choices[0]?.message?.content || "Error generating brief.";
        moves = extractMoves(markdown);
      }
    }

    // 5. Similarity Check & Retry Logic (only if framework check passed or after retry)
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

    // 6. Extract Memory Highlights
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
