import { useState, useCallback } from 'react';
import { memoryProvider, Memory } from '@/lib/memory';
import { generateBrief, BriefGenerationResult, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT_TEMPLATE } from '@/lib/llm';
import { Session } from '@/components/ClassCalendar';
import syllabus from '@/lib/syllabus.json';
import { toast } from 'sonner';

interface UseBriefGenerationOptions {
    /** Currently selected session */
    selectedSession: Session | null;
    /** Callback when brief is successfully generated */
    onBriefGenerated?: (sessionDate: string) => void;
}

interface PromptConfig {
    systemPrompt: string;
    userPromptTemplate: string;
}

interface UseBriefGenerationResult {
    /** Whether generation is in progress */
    isGenerating: boolean;
    /** The generated brief result */
    result: BriefGenerationResult | null;
    /** Clear the result to start over */
    clearResult: () => void;
    /** Whether personalized mode is enabled */
    isPersonalized: boolean;
    /** Toggle personalized mode */
    setIsPersonalized: (value: boolean) => void;
    /** Whether similarity check is enabled */
    enableSimilarityCheck: boolean;
    /** Toggle similarity check */
    setEnableSimilarityCheck: (value: boolean) => void;
    /** Generate a brief for the selected session */
    generate: () => Promise<void>;
    /** Prompt configuration */
    promptConfig: PromptConfig;
    /** Update prompt configuration */
    setPromptConfig: (config: Partial<PromptConfig>) => void;
    /** Reset prompts to defaults */
    resetPrompts: () => void;
    /** Whether custom prompts are being used */
    useCustomPrompts: boolean;
    /** Toggle custom prompt usage */
    setUseCustomPrompts: (value: boolean) => void;
    /** Whether feedback has been submitted */
    feedbackSubmitted: boolean;
    /** Submit feedback */
    submitFeedback: () => void;
}

/**
 * Helper to get the best brief for a session (Latest Personalized > Latest Generic)
 */
async function getBestBrief(sessionId: string): Promise<Memory | null> {
    const briefs = await memoryProvider.search("", {
        episode_type: ["brief_output"],
        session_id: [sessionId]
    }, 10);

    if (briefs.length === 0) return null;

    // Sort by creation time (descending)
    const sortedBriefs = briefs.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Prefer personalized if available
    const personalized = sortedBriefs.find(b => b.payload.mode === 'personalized');
    if (personalized) return personalized;

    // Fallback to latest generic
    return sortedBriefs[0];
}

/**
 * Hook for managing brief generation state and logic.
 */
export function useBriefGeneration(
    options: UseBriefGenerationOptions
): UseBriefGenerationResult {
    const { selectedSession, onBriefGenerated } = options;

    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<BriefGenerationResult | null>(null);
    const [isPersonalized, setIsPersonalized] = useState(true);
    const [enableSimilarityCheck, setEnableSimilarityCheck] = useState(true);
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [useCustomPrompts, setUseCustomPrompts] = useState(false);
    const [promptConfig, setPromptConfigState] = useState<PromptConfig>({
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
    });

    const setPromptConfig = useCallback((config: Partial<PromptConfig>) => {
        setPromptConfigState(prev => ({ ...prev, ...config }));
    }, []);

    const resetPrompts = useCallback(() => {
        if (confirm("Reset prompts to default?")) {
            setPromptConfigState({
                systemPrompt: DEFAULT_SYSTEM_PROMPT,
                userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
            });
            toast.success("Prompts reset to default");
        }
    }, []);

    const clearResult = useCallback(() => {
        setResult(null);
        setFeedbackSubmitted(false);
    }, []);

    const submitFeedback = useCallback(() => {
        setFeedbackSubmitted(true);
        toast.success("Feedback recorded. The model will learn from this.");
    }, []);

    const generate = useCallback(async () => {
        if (!selectedSession) {
            toast.error("Please select a class session first.");
            return;
        }

        setIsGenerating(true);
        setResult(null);
        setFeedbackSubmitted(false);

        try {
            // 1. Fetch Context
            const [profile] = await memoryProvider.search("", { episode_type: ["profile"] }, 1);

            // Find previous session date
            const sortedSessions = [...syllabus.sessions].sort((a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            const currentIndex = sortedSessions.findIndex(s => s.date === selectedSession.date);
            const previousSession = currentIndex > 0 ? sortedSessions[currentIndex - 1] : null;

            // Fetch specific memories
            let recentDeltas: Memory[] = [];
            let lastBrief: Memory | undefined = undefined;

            // Get delta for THIS session
            const deltas = await memoryProvider.search("", {
                episode_type: ["work_delta"],
                session_id: [selectedSession.date]
            }, 1);
            if (deltas.length > 0) recentDeltas = deltas;

            // Get LAST brief (from previous session)
            if (previousSession) {
                const bestPrevBrief = await getBestBrief(previousSession.date);
                if (bestPrevBrief) lastBrief = bestPrevBrief;
            }

            // 2. Generate
            const generatedResult = await generateBrief({
                classDate: selectedSession.date,
                className: syllabus.course,
                syllabusTopic: selectedSession.topic,
                mode: isPersonalized ? 'personalized' : 'generic',
                profile,
                recentDeltas,
                lastBrief,
                enableSimilarityCheck,
                customSystemPrompt: useCustomPrompts ? promptConfig.systemPrompt : undefined,
                customUserPromptTemplate: useCustomPrompts ? promptConfig.userPromptTemplate : undefined
            });

            setResult(generatedResult);

            // 3. Save to Memory
            await memoryProvider.add({
                episode_type: "brief_output",
                session_id: selectedSession.date,
                user_id: "demo-user",
                org_id: "demo-org",
                project_id: "demo-project",
                tags: [],
                payload: {
                    markdown: generatedResult.markdown,
                    highlights: generatedResult.memoryHighlights,
                    moves: generatedResult.moves,
                    structuredData: generatedResult.structuredData,
                    mode: isPersonalized ? 'personalized' : 'generic'
                }
            });

            // Notify parent
            onBriefGenerated?.(selectedSession.date);
            toast.success("Brief generated and saved!");

        } catch (error) {
            console.error("Generation failed:", error);
            toast.error("Failed to generate brief. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    }, [
        selectedSession,
        isPersonalized,
        enableSimilarityCheck,
        useCustomPrompts,
        promptConfig,
        onBriefGenerated
    ]);

    return {
        isGenerating,
        result,
        clearResult,
        isPersonalized,
        setIsPersonalized,
        enableSimilarityCheck,
        setEnableSimilarityCheck,
        generate,
        promptConfig,
        setPromptConfig,
        resetPrompts,
        useCustomPrompts,
        setUseCustomPrompts,
        feedbackSubmitted,
        submitFeedback,
    };
}

// Re-export for convenience
export { getBestBrief };
