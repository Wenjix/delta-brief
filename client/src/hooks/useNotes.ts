import { useState, useEffect, useCallback } from 'react';
import { memoryProvider, Memory } from '@/lib/memory';
import { toast } from 'sonner';

interface UseNotesOptions {
    /** Session ID to fetch/save notes for */
    sessionId: string | undefined;
    /** Whether notes should be fetched (e.g., when preview is open) */
    enabled: boolean;
}

interface UseNotesResult {
    /** Current note text being composed */
    noteText: string;
    /** Set the note text */
    setNoteText: (text: string) => void;
    /** Whether note is being saved */
    isSavingNote: boolean;
    /** Previously saved notes for this session */
    savedNotes: Memory[];
    /** Save the current note */
    saveNote: () => Promise<void>;
}

/**
 * Hook for managing session notes (feedback memories).
 */
export function useNotes(options: UseNotesOptions): UseNotesResult {
    const { sessionId, enabled } = options;

    const [noteText, setNoteText] = useState("");
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [savedNotes, setSavedNotes] = useState<Memory[]>([]);

    // Fetch notes when enabled and session changes
    useEffect(() => {
        const fetchNotes = async () => {
            if (!enabled || !sessionId) {
                setSavedNotes([]);
                return;
            }

            try {
                const notes = await memoryProvider.search("", {
                    episode_type: ["feedback"],
                    session_id: [sessionId]
                }, 20);

                // Filter for notes specifically (feedback with 'note' in payload)
                const noteMemories = notes.filter(n => n.payload.note);
                setSavedNotes(noteMemories);
            } catch (err) {
                console.error("Failed to fetch notes", err);
                setSavedNotes([]);
            }
        };

        fetchNotes();
    }, [sessionId, enabled]);

    const saveNote = useCallback(async () => {
        if (!noteText.trim() || !sessionId) return;

        setIsSavingNote(true);
        try {
            const newNote = {
                episode_type: "feedback" as const,
                session_id: sessionId,
                user_id: "demo-user",
                org_id: "demo-org",
                project_id: "demo-project",
                tags: ["user-note"],
                payload: {
                    note: noteText,
                    timestamp: new Date().toISOString()
                }
            };

            await memoryProvider.add(newNote);

            // Optimistically update UI with a mock Memory object
            const mockSavedNote: Memory = {
                ...newNote,
                id: "temp-" + Date.now(),
                created_at: new Date().toISOString(),
                kind: "patched.memory",
                v: 1
            };

            setSavedNotes(prev => [mockSavedNote, ...prev]);
            setNoteText("");
            toast.success("Note saved to memory.");
        } catch (err) {
            console.error("Failed to save note", err);
            toast.error("Failed to save note.");
        } finally {
            setIsSavingNote(false);
        }
    }, [noteText, sessionId]);

    return {
        noteText,
        setNoteText,
        isSavingNote,
        savedNotes,
        saveNote,
    };
}
