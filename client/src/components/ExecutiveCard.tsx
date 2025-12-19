import { Memory } from "@/lib/memory";
import { cn } from "@/lib/utils";
import { Target, AlertTriangle, MessageCircle, ArrowRight, Clock, Lightbulb, Quote, Mic } from "lucide-react";

interface ExecutiveCardProps {
    brief: Memory | null;
    isCurrent?: boolean;
    sessionTopic?: string;
}

interface ParsedMove {
    title: string;
    framework: string | null;
    inClassLine: string | null;
    whatChanged: string | null;
    whyMatters: string | null;
    capstoneImplication: string | null;
    openThreadUpdate: string | null;
}

interface ParsedRisk {
    risk: string;
    mitigation: string | null;
}

/**
 * Strip markdown formatting from text for clean display in cards.
 * Removes: **bold**, *italic*, `code`, [links](url), etc.
 */
function stripMarkdown(text: string): string {
    return text
        .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** -> bold
        .replace(/\*([^*]+)\*/g, '$1')      // *italic* -> italic
        .replace(/__([^_]+)__/g, '$1')      // __bold__ -> bold
        .replace(/_([^_]+)_/g, '$1')        // _italic_ -> italic
        .replace(/`([^`]+)`/g, '$1')        // `code` -> code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [text](url) -> text
        .replace(/^#+\s*/gm, '')            // # headers -> text
        .replace(/^\s*[-*]\s+/gm, '')       // - bullets -> text
        .trim();
}

/**
 * ExecutiveCard: A complete but scannable view of a brief.
 * 
 * Shows all key content in a card-based layout that's easier to scan than markdown:
 * - This week's lens (topic focus areas)
 * - All 3 moves with in-class lines
 * - Both risks with mitigations
 * - Next action + output artifact
 * - Discussion ammo (contrarian points + question + org story)
 */
export function ExecutiveCard({ brief, isCurrent = false, sessionTopic }: ExecutiveCardProps) {
    if (!brief) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No brief available.</p>
            </div>
        );
    }

    const payload = brief.payload || {};
    const markdown = payload.markdown || "";
    const rawMoves = payload.moves || [];
    const openThreads = payload.open_threads || payload.structuredData?.openThreads || [];

    // Parse the lens section
    const getLensPoints = (): string[] => {
        const lensMatch = markdown.match(/## This week's lens[\s\S]*?\n([\s\S]*?)(?=\n## |\n$)/i);
        if (lensMatch) {
            const points = lensMatch[1].match(/[-•]\s*([^\n]+)/g);
            if (points) {
                return points.map((p: string) => p.replace(/^[-•]\s*/, '').trim()).slice(0, 3);
            }
        }
        return [];
    };

    // Parse all moves from the markdown (more detailed than rawMoves array)
    const parseAllMoves = (): ParsedMove[] => {
        const movesSection = markdown.match(/## 3 moves[\s\S]*?(?=\n## 2 risks|\n$)/i);
        if (!movesSection) return [];

        const moveBlocks = movesSection[0].split(/\n(?=Move:|(?:\d+\)\s*Move:))/i).slice(1);

        return moveBlocks.map((block: string) => {
            // Extract title and framework
            const titleMatch = block.match(/Move:\s*(.+?)(?:\s*\(Framework:\s*([^)]+)\)|\s*\[Framework:\s*([^\]]+)\])?(?:\n|$)/i);
            const title = titleMatch ? titleMatch[1].trim() : "Untitled Move";
            const framework = titleMatch ? (titleMatch[2] || titleMatch[3] || null) : null;

            // Extract in-class line
            const inClassMatch = block.match(/["'""]In-class line["'""].*?:\s*["'""]?([^""'""\n]+)/i) ||
                block.match(/["'""]([^""'""\n]{30,150})["'""](?:\s*$|\s*\n)/);
            const inClassLine = inClassMatch ? inClassMatch[1].trim() : null;

            // Extract what changed - use [\s\S] for dotall
            const whatChangedMatch = block.match(/What changed[\s\S]*?\n[-•]?\s*(?:Assumption:\s*)?([\s\S]+?)(?=\n(?:Why|Capstone|"In-class)|$)/i);
            const whatChanged = whatChangedMatch ? whatChangedMatch[1].trim().replace(/\n/g, ' ') : null;

            // Extract why it matters
            const whyMattersMatch = block.match(/Why it matters[\s\S]*?\n[-•]?\s*(?:Assumption:\s*)?([\s\S]+?)(?=\n(?:Capstone|"In-class)|$)/i);
            const whyMatters = whyMattersMatch ? whyMattersMatch[1].trim().replace(/\n/g, ' ') : null;

            // Extract capstone implication
            const capstoneMatch = block.match(/Capstone implication[\s\S]*?\n[-•]?\s*([\s\S]+?)(?=\n(?:"In-class|Open Thread)|$)/i);
            const capstoneImplication = capstoneMatch ? capstoneMatch[1].trim().replace(/\n/g, ' ') : null;

            // Extract open thread update
            const openThreadMatch = block.match(/Open Thread Update:\s*([\s\S]+?)(?=\n\n|\n(?=Move:)|$)/i);
            const openThreadUpdate = openThreadMatch ? openThreadMatch[1].trim() : null;

            return { title, framework, inClassLine, whatChanged, whyMatters, capstoneImplication, openThreadUpdate };
        }).filter((m: ParsedMove) => m.title !== "Untitled Move" || m.inClassLine);
    };

    // Parse risks
    const parseRisks = (): ParsedRisk[] => {
        const risksSection = markdown.match(/## 2 risks[\s\S]*?(?=\n## 1 next|\n$)/i);
        if (!risksSection) return [];

        // Match lines starting with "- Risk N:" or just "Risk N:" pattern
        const riskMatches = [...risksSection[0].matchAll(/(?:^|\n)[-•]\s*Risk\s*\d+:\s*(.+?)(?:\s*[-—–]\s*Mitigation:\s*(.+?))?(?=\n|$)/gi)];
        return riskMatches.map((m) => ({
            risk: stripMarkdown(m[1]),
            mitigation: m[2] ? stripMarkdown(m[2]) : null
        })).slice(0, 2);
    };

    // Parse next action
    const parseNextAction = (): { action: string | null; artifact: string | null } => {
        const actionMatch = markdown.match(/Action:\s*(.+?)(?:\n|$)/i);
        const artifactMatch = markdown.match(/Output artifact:\s*(.+?)(?:\n|$)/i);
        return {
            action: actionMatch ? stripMarkdown(actionMatch[1]) : null,
            artifact: artifactMatch ? stripMarkdown(artifactMatch[1]) : null
        };
    };

    // Parse discussion ammo
    const parseDiscussionAmmo = (): { contrarian: string[]; question: string | null; orgStory: string | null } => {
        const contrarianMatches = [...markdown.matchAll(/Contrarian point [A-Z]?:?\s*["'"""]?(.+?)["'"""]?(?:\n|$)/gi)];
        const contrarian = contrarianMatches.map(m => stripMarkdown(m[1])).slice(0, 2);

        const questionMatch = markdown.match(/Question to ask.*?:\s*["'"""]?([^""'"""\n]+)/i);
        const question = questionMatch ? stripMarkdown(questionMatch[1]) : null;

        const storyMatch = markdown.match(/My org story.*?:\s*\n?(?:Assumption:\s*)?([\s\S]+?)(?=\n\n|\n##|$)/i);
        const orgStory = storyMatch ? stripMarkdown(storyMatch[1]).slice(0, 300) : null;

        return { contrarian, question, orgStory };
    };

    const lensPoints = getLensPoints();
    const moves = parseAllMoves();
    const risks = parseRisks();
    const nextAction = parseNextAction();
    const discussionAmmo = parseDiscussionAmmo();

    // Extract topic from the brief's own H1 header (e.g., "# Pre-Class Delta Brief — AI Transformation — 2025-12-10")
    const extractedTopic = (() => {
        const h1Match = markdown.match(/^#\s+(?:Pre-Class\s+)?Delta Brief\s*[-—–]\s*(.+?)\s*[-—–]\s*\d{4}/im);
        if (h1Match) return h1Match[1].trim();
        // Fallback: try to find any topic-like pattern
        const altMatch = markdown.match(/^#\s+(.+?)(?:\s*[-—–]|\n)/m);
        return altMatch ? altMatch[1].trim() : null;
    })();

    // Use extracted topic, or fall back to sessionTopic prop, or default
    const displayTopic = extractedTopic || sessionTopic || "This Week's Focus";

    const cardStyles = isCurrent
        ? "border-primary/40"
        : "border-border/50";

    const accentColor = isCurrent ? "text-primary" : "text-muted-foreground";
    const sectionBg = isCurrent ? "bg-primary/5" : "bg-muted/20";

    return (
        <div className={cn("rounded-xl border-2 shadow-lg overflow-hidden", cardStyles)}>
            {/* Header: Topic + Date */}
            <div className={cn(
                "px-5 py-4 border-b",
                isCurrent ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20" : "bg-muted/30 border-border/30"
            )}>
                <div className="flex items-center justify-between mb-2">
                    <span className={cn("text-sm font-bold uppercase tracking-widest", accentColor)}>
                        {displayTopic}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                        {brief.session_id}
                    </span>
                </div>
                {/* Lens Points */}
                {lensPoints.length > 0 && (
                    <div className="space-y-1">
                        {lensPoints.map((point, i) => (
                            <p key={i} className="text-sm text-muted-foreground leading-snug">
                                • {point}
                            </p>
                        ))}
                    </div>
                )}
            </div>

            {/* ALL MOVES */}
            <div className="divide-y divide-border/20">
                {moves.map((move, i) => (
                    <div key={i} className={cn("px-5 py-4", i === 0 && isCurrent ? sectionBg : "")}>
                        <div className="flex items-start gap-3 mb-2">
                            <div className={cn(
                                "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                                isCurrent ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                                {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm leading-tight mb-1">
                                    {move.title}
                                </p>
                                {move.framework && (
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">
                                        {move.framework}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* In-class line - the speakable quote */}
                        {move.inClassLine && (
                            <div className={cn(
                                "ml-9 px-3 py-2 rounded-lg text-sm border-l-4 italic",
                                isCurrent
                                    ? "bg-primary/5 border-primary/40 text-foreground/90"
                                    : "bg-muted/30 border-muted-foreground/30 text-muted-foreground"
                            )}>
                                <Quote className="inline h-3 w-3 mr-1 opacity-50" />
                                "{move.inClassLine}"
                            </div>
                        )}

                        {/* Open Thread Update if present */}
                        {move.openThreadUpdate && (
                            <div className="ml-9 mt-2 text-xs text-muted-foreground bg-purple-500/5 px-2 py-1 rounded border-l-2 border-purple-500/30">
                                <span className="font-semibold text-purple-600 dark:text-purple-400">Thread: </span>
                                {move.openThreadUpdate.slice(0, 120)}...
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* RISKS */}
            {risks.length > 0 && (
                <div className="px-5 py-4 border-t border-border/20 bg-amber-500/5">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                            Risks to Flag
                        </span>
                    </div>
                    <div className="space-y-2">
                        {risks.map((r, i) => (
                            <div key={i} className="text-sm">
                                <span className="font-medium">{r.risk}</span>
                                {r.mitigation && (
                                    <span className="text-muted-foreground"> → {r.mitigation}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* NEXT ACTION */}
            {nextAction.action && (
                <div className="px-5 py-4 border-t border-border/20 bg-green-500/5">
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowRight className="h-4 w-4 text-green-600" />
                        <span className="text-xs font-bold uppercase tracking-widest text-green-700 dark:text-green-400">
                            This Week's Action
                        </span>
                    </div>
                    <p className="text-sm font-medium">{nextAction.action}</p>
                    {nextAction.artifact && (
                        <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-semibold">Output:</span> {nextAction.artifact}
                        </p>
                    )}
                </div>
            )}

            {/* DISCUSSION AMMO */}
            <div className="px-5 py-4 border-t border-border/20">
                <div className="flex items-center gap-2 mb-3">
                    <Mic className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-400">
                        Class Discussion Ammo
                    </span>
                </div>

                {/* Contrarian Points */}
                {discussionAmmo.contrarian.length > 0 && (
                    <div className="space-y-1 mb-3">
                        {discussionAmmo.contrarian.map((point, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                                <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                <span className="text-muted-foreground">"{point}"</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Question to Ask */}
                {discussionAmmo.question && (
                    <div className="flex items-start gap-2 text-sm mb-3">
                        <MessageCircle className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">"{discussionAmmo.question}"</span>
                    </div>
                )}

                {/* Org Story */}
                {discussionAmmo.orgStory && (
                    <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border-l-2 border-border">
                        <span className="font-semibold block mb-1">30-sec org story:</span>
                        {discussionAmmo.orgStory}
                    </div>
                )}
            </div>

            {/* OPEN THREADS */}
            {openThreads.length > 0 && (
                <div className="px-5 py-3 border-t border-border/20 bg-purple-500/5">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-purple-600" />
                        <span className="text-xs font-bold uppercase tracking-widest text-purple-700 dark:text-purple-400">
                            Still Open
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {openThreads.slice(0, 3).map((thread: string, i: number) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300">
                                {typeof thread === 'string' ? thread.slice(0, 50) : String(thread).slice(0, 50)}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
