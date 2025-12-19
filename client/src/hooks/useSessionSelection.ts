import { useState, useEffect, useCallback } from 'react';
import { memoryProvider, Memory } from '@/lib/memory';
import { getNextSession, Session, getLocalISODate } from '@/components/ClassCalendar';
import { WorkChange } from '@/lib/types';

interface UseSessionSelectionOptions {
    /** Initial date override for dev mode */
    initialDateOverride?: string;
}

interface UseSessionSelectionResult {
    /** Currently selected session */
    selectedSession: Session | null;
    /** Set the selected session */
    setSelectedSession: (session: Session | null) => void;
    /** List of session dates that have generated briefs */
    briefedSessions: string[];
    /** Add a session to the briefed list */
    markSessionBriefed: (sessionDate: string) => void;
    /** Current deltas for the selected session */
    currentDeltas: WorkChange[];
    /** Dev mode state */
    showDevDate: boolean;
    /** Current date override for dev mode (time travel) */
    currentDateOverride: string;
    /** Set the date override for dev mode */
    setCurrentDateOverride: (date: string) => void;
    /** Refresh briefed sessions from memory */
    refreshBriefedSessions: () => Promise<void>;
}

/**
 * Hook for managing session selection state and calendar integration.
 * Handles fetching briefed sessions and work deltas for the selected session.
 */
export function useSessionSelection(
    options: UseSessionSelectionOptions = {}
): UseSessionSelectionResult {
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [briefedSessions, setBriefedSessions] = useState<string[]>([]);
    const [currentDeltas, setCurrentDeltas] = useState<WorkChange[]>([]);
    const [showDevDate, setShowDevDate] = useState(false);
    const [currentDateOverride, setCurrentDateOverride] = useState(
        options.initialDateOverride ?? getLocalISODate()
    );

    // Fetch all briefed sessions from memory
    const refreshBriefedSessions = useCallback(async () => {
        try {
            const briefs = await memoryProvider.search("", { episode_type: ["brief_output"] }, 50);
            const sessionIds = briefs.map(b => b.session_id).filter(Boolean);
            setBriefedSessions(Array.from(new Set(sessionIds)));
        } catch (err) {
            console.error("Failed to fetch briefed sessions", err);
        }
    }, []);

    // Mark a session as briefed (optimistic update)
    const markSessionBriefed = useCallback((sessionDate: string) => {
        setBriefedSessions(prev =>
            prev.includes(sessionDate) ? prev : [...prev, sessionDate]
        );
    }, []);

    // Initialize on mount
    useEffect(() => {
        // Check for dev mode flag
        const isDev =
            localStorage.getItem("devMode") === "true" ||
            (typeof window !== 'undefined' && window.location.search?.includes("dev=1"));
        if (isDev) setShowDevDate(true);

        // Set next session
        const next = getNextSession(currentDateOverride ?? getLocalISODate());
        if (next) setSelectedSession(next);

        // Fetch briefed sessions
        refreshBriefedSessions();
    }, [currentDateOverride, refreshBriefedSessions]);

    // Fetch deltas when session changes
    useEffect(() => {
        const fetchDeltas = async () => {
            if (!selectedSession) {
                setCurrentDeltas([]);
                return;
            }

            try {
                const deltas = await memoryProvider.search("", {
                    episode_type: ["work_delta"],
                    session_id: [selectedSession.date]
                }, 1);

                if (deltas.length > 0 && deltas[0].payload.work_changes) {
                    // Handle both WorkChange[] and string[] formats
                    const changes = deltas[0].payload.work_changes;
                    if (Array.isArray(changes)) {
                        setCurrentDeltas(
                            changes.map((c: WorkChange | string) =>
                                typeof c === 'string' ? { bullet: c } : c
                            )
                        );
                    } else {
                        setCurrentDeltas([]);
                    }
                } else {
                    setCurrentDeltas([]);
                }
            } catch (err) {
                console.error("Failed to fetch deltas", err);
                setCurrentDeltas([]);
            }
        };

        fetchDeltas();
    }, [selectedSession]);

    return {
        selectedSession,
        setSelectedSession,
        briefedSessions,
        markSessionBriefed,
        currentDeltas,
        showDevDate,
        currentDateOverride,
        setCurrentDateOverride,
        refreshBriefedSessions,
    };
}
