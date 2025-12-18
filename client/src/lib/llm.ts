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
  structuredData: {
    resolver?: {
      previously: string;
      now: string;
      update: string;
    };
    openThreads: string[];
    frameworkByMove: string[];
    nextAction?: string;
  };
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

function extractStructuredData(markdown: string) {
  // 1. Extract Resolver
  const resolverRegex = /Open Thread Update: Previously: (.+?) -> Now: (.+?) -> Update: (.+?)$/m;
  const resolverMatch = resolverRegex.exec(markdown);
  const resolver = resolverMatch ? {
    previously: resolverMatch[1].trim(),
    now: resolverMatch[2].trim(),
    update: resolverMatch[3].trim()
  } : undefined;

  // 2. Extract Open Threads (New ones created in this brief)
  // Assuming they are listed under "## Open Threads" or similar if we added that section, 
  // BUT currently the template doesn't explicitly ask for *new* open threads section, 
  // it asks to *resolve* old ones. 
  // However, the prompt template has "## 2 risks / failure modes" and "## 1 next action".
  // The user feedback implies we should capture what the model *saw* as open threads from the input,
  // OR what it *generated* as new open threads.
  // Given the "Open Thread Update" line is about *resolving*, let's stick to capturing that for now.
  // If we want to capture *new* open threads for the *next* brief, we might need to parse the "Risks" or "Next Action".
  // For now, let's capture the "Risks" as potential open threads for the future.
  const risks: string[] = [];
  const riskRegex = /- Risk \d+: (.+?) — Mitigation:/g;
  let riskMatch;
  while ((riskMatch = riskRegex.exec(markdown)) !== null) {
    risks.push(riskMatch[1].trim());
  }

  // 3. Extract Frameworks by Move
  const frameworks: string[] = [];
  const frameworkRegex = /^\d+\)\s*Move:.+?\(Framework:\s*(.+?)\)/gm;
  let fwMatch;
  while ((fwMatch = frameworkRegex.exec(markdown)) !== null) {
    frameworks.push(fwMatch[1].trim());
  }

  // 4. Extract Next Action
  const actionRegex = /## 1 next action[\s\S]*?- Action: (.+)/;
  const actionMatch = actionRegex.exec(markdown);
  const nextAction = actionMatch ? actionMatch[1].trim() : undefined;

  return {
    resolver,
    openThreads: risks, // Using Risks as a proxy for "Open Threads" for the next session
    frameworkByMove: frameworks,
    nextAction
  };
}

// Helper to find syllabus session details
function getSyllabusDetails(topic: string) {
  const session = syllabus.sessions.find(s => s.topic === topic);
  if (!session) return null;
  return {
    course: syllabus.course,
    date: session.date,
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
COURSE: ${s.course}
CLASS DATE: ${s.date}
TOPIC: ${s.topic}

KEY FRAMEWORKS (use EXACT names only):
${frameworkNames.map(n => `- ${n}`).join("\n")}

LEARNING OBJECTIVES:
${(s.learning_objectives ?? []).map(o => `- ${o}`).join("\n")}

DISCUSSION PROMPTS:
${(s.discussion_prompts ?? []).map(p => `- ${p}`).join("\n")}

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
   - IMPORTANT: Include this line ONLY ONCE in the entire document.

FRAMEWORK CONSTRAINT:
- For EACH Move, the framework name MUST exactly match one item from the KEY FRAMEWORKS list in {{syllabusStr}}.
- Framework must be EXACTLY one of the strings in ALLOWED_FRAMEWORK_NAMES. Copy/paste only.

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
    .replace('{{assignmentHook}}', syllabusDetails?.assignment_hook || "Assumption: no assignment hook provided");

  // 3. Call LLM with Retry Logic
  let markdown = "";
  let memoryHighlights: string[] = [];
  let moves: string[] = [];
  let structuredData: BriefGenerationResult['structuredData'] = { openThreads: [], frameworkByMove: [] };
  let similarityReport: SimilarityReport | undefined;

  const MAX_RETRIES = 2; // Allow up to 2 retries for strict validation

  while (retryCount <= MAX_RETRIES) {
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL_ID,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
      });

      markdown = completion.choices[0].message.content || "";

      // Extract Moves
      moves = extractMoves(markdown);

      // Extract Structured Data
      structuredData = extractStructuredData(markdown);

      // Extract Memory Highlights
      const highlightsRegex = /## Memory highlights used[\s\S]*?((?:- .+\n?)+)/;
      const highlightsMatch = highlightsRegex.exec(markdown);
      if (highlightsMatch) {
        memoryHighlights = highlightsMatch[1]
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.replace(/^-\s*/, '').trim());
      }

      // --- VALIDATION GATES ---
      const validationErrors: string[] = [];

      // Gate 1: Move Count
      if (moves.length !== 3) {
        validationErrors.push(`Expected exactly 3 moves, but found ${moves.length}. Please regenerate with exactly 3 moves.`);
      }

      // Gate 2: Framework Validity
      if (frameworkNames.length > 0) {
        const invalidFrameworks = structuredData.frameworkByMove.filter(f => !frameworkNames.includes(f));
        if (invalidFrameworks.length > 0) {
          validationErrors.push(`Found invalid framework names: ${invalidFrameworks.join(", ")}. You MUST use only names from the provided list: ${frameworkNames.join(", ")}.`);
        }
      }

      // Gate 3: Open Thread Update Line (Single Occurrence)
      const updateLineCount = (markdown.match(/Open Thread Update: Previously:/g) || []).length;
      if (lastBrief && updateLineCount !== 1) {
         // Only strict if we have a last brief (implying potential open threads)
         // But actually, maybe we only enforce it if we *know* there was an open thread.
         // For now, let's just warn if it's > 1 (duplicate).
         if (updateLineCount > 1) {
            validationErrors.push(`Found ${updateLineCount} "Open Thread Update" lines. Please include this line ONLY ONCE for the single most relevant move.`);
         }
      }

      // Gate 4: Duplicate Sections
      const highlightSectionCount = (markdown.match(/## Memory highlights used/g) || []).length;
      if (highlightSectionCount > 1) {
        validationErrors.push(`Found duplicate "Memory highlights used" sections. Please ensure the section appears only once at the end.`);
      }

      // Gate 5: Fact Check against Seed Data (Simple Keyword Check)
      // If we have deltas, ensure at least one keyword from the top delta appears in the text
      if (recentDeltas.length > 0) {
        const topDelta = JSON.stringify(recentDeltas[0].payload).toLowerCase();
        // Extract some keywords (simple heuristic: words > 5 chars)
        const keywords = topDelta.match(/\b\w{6,}\b/g) || [];
        const markdownLower = markdown.toLowerCase();
        const hasKeyword = keywords.some(k => markdownLower.includes(k));
        
        if (!hasKeyword && keywords.length > 0) {
           // This is a soft check, maybe don't fail, but prompt to be more specific?
           // Let's skip failing for now to avoid over-constraining, but log it.
           console.warn("Validation Warning: Brief might not reference top delta keywords.");
        }
      }

      // Gate 6: Similarity Check (if enabled)
      if (enableSimilarityCheck && lastBrief && lastBrief.payload.moves) {
        const report = await checkNoRepeats(moves, lastBrief.payload.moves);
        similarityReport = report;
        if (!report.pass) {
          const feedback = report.pairs.map(p => `"${p.newMove}" is too similar to "${p.prevMove}"`).join("; ");
          validationErrors.push(`Similarity check failed: ${feedback}. Please rewrite the moves to be distinct from the previous brief.`);
        }
      }

      // If any errors, throw to trigger retry
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed:\n- ${validationErrors.join('\n- ')}`);
      }

      // If we get here, success!
      break;

    } catch (error: any) {
      console.warn(`Attempt ${retryCount + 1} failed:`, error.message);
      retryCount++;
      
      if (retryCount > MAX_RETRIES) {
        console.error("Max retries exceeded. Returning best effort result.");
        // Fallback: Return what we have, but maybe append a warning in the markdown?
        // For now, just return it to avoid crashing the UI, but the user might see the issues.
        break; 
      }

      // Add feedback to the user prompt for the next attempt
      userPrompt += `\n\nPREVIOUS ATTEMPT FAILED VALIDATION. PLEASE FIX THESE ISSUES:\n${error.message}`;
    }
  }

  return {
    markdown,
    memoryHighlights,
    moves,
    structuredData,
    similarityReport,
    usage: {
      usedProfile: !!profile,
      usedLastBrief: !!lastBrief,
      deltaCount: recentDeltas.length,
      retryCount
    }
  };
}
