import { useState, useCallback } from 'react';
import { Memory, memoryProvider } from '@/lib/memory';
import { Session } from '@/components/ClassCalendar';
import syllabus from '@/lib/syllabus.json';
import { toast } from 'sonner';
import { getBestBrief } from './useBriefGeneration';

interface DeltaSummary {
    resolved: string[];
    new: string[];
    progress: string[];
}

interface UseBriefPreviewResult {
    /** Brief being previewed */
    previewBrief: Memory | null;
    /** Previous brief for comparison */
    compareBrief: Memory | null;
    /** Whether preview is shown */
    showPreview: boolean;
    /** Close the preview */
    closePreview: () => void;
    /** Whether compare mode is active */
    isCompareMode: boolean;
    /** Delta summary for comparison */
    deltaSummary: DeltaSummary | null;
    /** Syllabus details for the preview session */
    previewSyllabus: typeof syllabus.sessions[0] | null;
    /** View mode for the preview */
    viewMode: 'executive' | 'full';
    /** Set view mode */
    setViewMode: (mode: 'executive' | 'full') => void;
    /** Load and view a brief */
    viewBrief: (compare?: boolean) => Promise<void>;
}

/**
 * Generate delta summary comparing previous and current briefs
 */
function generateDeltaSummary(prevBrief: Memory, currentBrief: Memory): DeltaSummary {
    const summary: DeltaSummary = {
        resolved: [],
        new: [],
        progress: []
    };

    // 1. Resolved Threads (from current brief's resolver)
    if (currentBrief.payload.structuredData?.resolver) {
        const r = currentBrief.payload.structuredData.resolver;
        summary.resolved.push(`${r.previously} → ${r.update}`);
    }

    // 2. Top Priority (Move #1)
    if (currentBrief.payload.moves && currentBrief.payload.moves.length > 0) {
        const topMove = currentBrief.payload.moves[0];
        const prevMoves = prevBrief.payload.moves || [];

        if (!prevMoves.includes(topMove)) {
            summary.new.push(`${topMove} (Top Priority)`);
        } else {
            summary.progress.push(`${topMove} (Ongoing Priority)`);
        }
    }

    // 3. Other Focus Areas (Moves #2 & #3)
    if (currentBrief.payload.moves && currentBrief.payload.moves.length > 1) {
        currentBrief.payload.moves.slice(1).forEach((move: string) => {
            summary.progress.push(move);
        });
    }

    return summary;
}

interface UseBriefPreviewOptions {
    /** Currently selected session */
    selectedSession: Session | null;
}

/**
 * Hook for managing brief preview and comparison state.
 */
export function useBriefPreview(
    options: UseBriefPreviewOptions
): UseBriefPreviewResult {
    const { selectedSession } = options;

    const [previewBrief, setPreviewBrief] = useState<Memory | null>(null);
    const [compareBrief, setCompareBrief] = useState<Memory | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [isCompareMode, setIsCompareMode] = useState(false);
    const [deltaSummary, setDeltaSummary] = useState<DeltaSummary | null>(null);
    const [previewSyllabus, setPreviewSyllabus] = useState<typeof syllabus.sessions[0] | null>(null);
    const [viewMode, setViewMode] = useState<'executive' | 'full'>('executive');

    const closePreview = useCallback(() => {
        setShowPreview(false);
        setIsCompareMode(false);
        setCompareBrief(null);
        setDeltaSummary(null);
    }, []);

    const viewBrief = useCallback(async (compare: boolean = false) => {
        if (!selectedSession) return;

        try {
            // Fetch CURRENT brief
            const currentBrief = await getBestBrief(selectedSession.date);

            if (currentBrief) {
                setPreviewBrief(currentBrief);

                // Find syllabus details for this session
                const sessionDetails = syllabus.sessions.find(s => s.date === selectedSession.date);
                setPreviewSyllabus(sessionDetails || null);

                if (compare) {
                    // Fetch PREVIOUS brief for comparison
                    const sortedSessions = [...syllabus.sessions].sort((a, b) =>
                        new Date(a.date).getTime() - new Date(b.date).getTime()
                    );
                    const currentIndex = sortedSessions.findIndex(s => s.date === selectedSession.date);
                    const previousSession = currentIndex > 0 ? sortedSessions[currentIndex - 1] : null;

                    if (previousSession) {
                        const prevBrief = await getBestBrief(previousSession.date);

                        if (prevBrief) {
                            setCompareBrief(prevBrief);
                            setDeltaSummary(generateDeltaSummary(prevBrief, currentBrief));
                        } else {
                            setCompareBrief(null);
                            setDeltaSummary(null);
                            toast.info("No previous brief found to compare with.");
                        }
                    }
                    setIsCompareMode(true);
                    setViewMode('executive');
                } else {
                    setIsCompareMode(false);
                    setCompareBrief(null);
                    setDeltaSummary(null);
                }

                setShowPreview(true);
            } else {
                toast.error("No brief found for this session.");
            }
        } catch (err) {
            console.error("Failed to fetch brief for preview", err);
            toast.error("Failed to load brief.");
        }
    }, [selectedSession]);

    return {
        previewBrief,
        compareBrief,
        showPreview,
        closePreview,
        isCompareMode,
        deltaSummary,
        previewSyllabus,
        viewMode,
        setViewMode,
        viewBrief,
    };
}

// Re-export the summary generator for potential use elsewhere
export { generateDeltaSummary };
export type { DeltaSummary };
