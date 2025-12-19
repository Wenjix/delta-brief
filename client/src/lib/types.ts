/**
 * Shared type definitions for the Delta Brief application.
 */

// Re-export memory types for convenience
export type { Memory, MemoryFilter, EpisodeType, MemoryProvider } from './memory';

/**
 * Represents a single work change/delta recorded during weekly check-ins.
 */
export interface WorkChange {
    /** The description of what changed */
    bullet: string;
    /** Optional category (e.g., 'vendor', 'stakeholders', 'blocker', 'compliance', 'change_mgmt') */
    category?: string;
    /** Impact level for prioritization */
    impact?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Payload structure for work_delta episode type
 */
export interface WorkDeltaPayload {
    course: string;
    next_topic: string;
    work_changes: WorkChange[];
    constraint_focus_this_week?: string;
    capstone_next_milestone?: string;
}

/**
 * Payload structure for profile episode type
 */
export interface ProfilePayload {
    role?: string;
    industry?: string;
    org_size?: string;
    initiative?: string;
    constraints?: string;
    capstone_topic?: string;
    output_preferences?: string;
    learning_goals?: string[];
    leadership_gaps?: string[];
    success_definition?: string;
    // Legacy structure support
    persona?: {
        role: string;
        industry: string;
        org_size: string;
    };
    work_initiative?: string;
    capstone?: string;
    preferences?: string;
}

/**
 * Payload structure for brief_output episode type
 */
export interface BriefOutputPayload {
    markdown: string;
    highlights?: string[];
    moves?: string[];
    structuredData?: {
        resolver?: {
            previously: string;
            now: string;
            update: string;
        };
        openThreads: string[];
        frameworkByMove: string[];
        nextAction?: string;
    };
    mode?: 'generic' | 'personalized';
    open_threads?: string[];
}
