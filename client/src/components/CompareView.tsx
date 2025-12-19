import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import { Memory } from "@/lib/memory";
import { ExecutiveCard } from "@/components/ExecutiveCard";
import { X, CheckCircle, SplitSquareHorizontal, LayoutTemplate, FileText, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompareViewProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    previousBrief: Memory | null;
    currentBrief: Memory | null;
    deltaSummary: { resolved: string[], new: string[], progress: string[] } | null;
    sessionTopic: string;
    sessionDate: string;
}

export function CompareView({
    open,
    onOpenChange,
    previousBrief,
    currentBrief,
    deltaSummary,
    sessionTopic,
    sessionDate
}: CompareViewProps) {
    const [viewMode, setViewMode] = useState<'executive' | 'full'>('executive');

    if (!open) return null;

    // Helper to extract moves safely from payload
    const getMoves = (brief: Memory | null): string[] => {
        if (!brief || !brief.payload) return [];
        // Check if moves property exists directly (from BriefGenerationResult)
        if (Array.isArray(brief.payload.moves)) return brief.payload.moves;
        return [];
    };

    const prevMoves = getMoves(previousBrief);
    const currMoves = getMoves(currentBrief);

    const renderMoves = (moves: string[], isCurrent: boolean) => (
        <div className="flex flex-col gap-3 mb-8">
            <h3 className={cn("text-xs font-bold uppercase tracking-widest mb-1", isCurrent ? "text-primary" : "text-muted-foreground")}>
                key moves
            </h3>
            {moves.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                    {moves.map((move, i) => {
                        // Parse "Move: Title (Framework: Fw)" if possible
                        const titleMatch = move.match(/^Move:\s*(.+?)\s*(?:\[Framework:|\(Framework:)/);
                        const fwMatch = move.match(/(?:\[Framework:|\(Framework:)\s*(.+?)(?:\]|\))/);
                        const title = titleMatch ? titleMatch[1] : move.split('\n')[0].replace(/^Move:\s*/, '');
                        const fw = fwMatch ? fwMatch[1] : null;

                        return (
                            <div key={i} className={cn(
                                "p-3 rounded-lg border text-sm shadow-sm relative overflow-hidden group transition-all",
                                isCurrent
                                    ? "bg-primary/5 border-primary/20 hover:border-primary/40"
                                    : "bg-muted/30 border-border/50 hover:border-border/80"
                            )}>
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-current to-transparent opacity-10" />
                                <div className="font-semibold mb-1 leading-snug">
                                    {title}
                                </div>
                                {fw && (
                                    <div className="text-[10px] uppercase font-bold opacity-60 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                                        {fw}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="p-4 rounded-lg border border-dashed text-xs text-muted-foreground italic text-center">
                    No structured moves found.
                </div>
            )}
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-[100vw] w-screen h-screen flex flex-col p-0 gap-0 border-none rounded-none bg-background/95 backdrop-blur-sm sm:max-w-[100vw]"
                style={{ maxWidth: '100vw', width: '100vw', height: '100vh', margin: 0 }}
            >
                <DialogDescription className="sr-only">
                    Comparison view between two briefs.
                </DialogDescription>

                {/* Top Navigation Bar */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-background/50 backdrop-blur-md z-50">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <SplitSquareHorizontal className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold tracking-tight">Compare Workspace</DialogTitle>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <span>{sessionTopic}</span>
                                <span className="text-muted-foreground/30">•</span>
                                <span className="font-mono text-xs">{sessionDate}</span>
                            </div>
                        </div>
                    </div>

                    {/* Central Controls */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center bg-secondary/50 rounded-lg p-1 border border-border/50 shadow-inner">
                        <Button
                            variant={viewMode === 'executive' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('executive')}
                            className="h-8 text-xs font-medium px-4"
                        >
                            <LayoutTemplate className="h-3.5 w-3.5 mr-2" />
                            Executive View
                        </Button>
                        <Button
                            variant={viewMode === 'full' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('full')}
                            className="h-8 text-xs font-medium px-4"
                        >
                            <FileText className="h-3.5 w-3.5 mr-2" />
                            Full Brief
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full hover:bg-destructive/10 hover:text-destructive">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Delta Summary Strip (Sticky Top) */}
                {deltaSummary && (
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-b bg-muted/20">
                        <div className="px-6 py-3 flex items-start gap-3">
                            <div className="mt-0.5 p-1 bg-green-500/10 rounded-full">
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider block mb-1">Resolved</span>
                                <ul className="text-sm space-y-1">
                                    {deltaSummary.resolved.length > 0 ? (
                                        deltaSummary.resolved.slice(0, 2).map((r, i) => (
                                            <li key={i} className="text-muted-foreground line-clamp-1" title={r}>{r}</li>
                                        ))
                                    ) : (
                                        <li className="text-muted-foreground/50 italic">No resolved threads.</li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        <div className="px-6 py-3 flex items-start gap-3">
                            <div className="mt-0.5 p-1 bg-blue-500/10 rounded-full">
                                <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block mb-1">New Priorities</span>
                                <ul className="text-sm space-y-1">
                                    {deltaSummary.new.length > 0 ? (
                                        deltaSummary.new.slice(0, 2).map((r, i) => (
                                            <li key={i} className="text-muted-foreground line-clamp-1" title={r}>{r}</li>
                                        ))
                                    ) : (
                                        <li className="text-muted-foreground/50 italic">No new major priorities.</li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        <div className="px-6 py-3 flex items-start gap-3">
                            <div className="mt-0.5 p-1 bg-orange-500/10 rounded-full">
                                <ArrowLeft className="h-3.5 w-3.5 text-orange-600" />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider block mb-1">Carried Over</span>
                                <ul className="text-sm space-y-1">
                                    {deltaSummary.progress.length > 0 ? (
                                        deltaSummary.progress.slice(0, 2).map((r, i) => (
                                            <li key={i} className="text-muted-foreground line-clamp-1" title={r}>{r}</li>
                                        ))
                                    ) : (
                                        <li className="text-muted-foreground/50 italic">All previous items resolved.</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Split View */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">

                    {/* LEFT PANEL: Previous Context */}
                    <div className="relative h-full overflow-hidden flex flex-col border-r border-border/50 bg-slate-50/50 dark:bg-slate-950/30">
                        <div className="sticky top-0 z-10 px-8 py-4 border-b border-border/30 bg-background/80 backdrop-blur-sm flex justify-between items-center">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Previous Brief</span>
                            {previousBrief && (
                                <span className="text-xs font-mono text-muted-foreground/70">{previousBrief.session_id}</span>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            {previousBrief ? (
                                <div className="max-w-xl mx-auto">
                                    {viewMode === 'executive' ? (
                                        <ExecutiveCard
                                            brief={previousBrief}
                                            isCurrent={false}
                                            sessionTopic={sessionTopic}
                                        />
                                    ) : (
                                        <article className={cn(
                                            "prose prose-sm prose-slate dark:prose-invert max-w-none",
                                            "prose-headings:font-bold prose-h1:text-xl prose-h2:text-sm prose-h2:uppercase prose-h2:tracking-wider prose-h2:border-b prose-h2:pb-2 prose-h2:mt-8",
                                            "prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-li:my-0.5"
                                        )}>
                                            <Streamdown>{previousBrief.payload.markdown}</Streamdown>
                                        </article>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                                    <div className="p-4 rounded-full bg-muted/50 mb-4">
                                        <FileText className="h-8 w-8 opacity-20" />
                                    </div>
                                    <p>No previous brief available for comparison.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: Current Brief */}
                    <div className="relative h-full overflow-hidden flex flex-col bg-background">
                        <div className="sticky top-0 z-10 px-8 py-4 border-b border-border/30 bg-background/80 backdrop-blur-sm flex justify-between items-center shadow-sm">
                            <span className="text-xs font-bold text-primary uppercase tracking-widest">Current Brief</span>
                            {currentBrief && (
                                <span className="text-xs font-mono text-primary/70">{currentBrief.session_id}</span>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            {currentBrief ? (
                                <div className="max-w-xl mx-auto">
                                    {viewMode === 'executive' ? (
                                        <ExecutiveCard
                                            brief={currentBrief}
                                            isCurrent={true}
                                            sessionTopic={sessionTopic}
                                        />
                                    ) : (
                                        <article className={cn(
                                            "prose prose-sm prose-slate dark:prose-invert max-w-none",
                                            "prose-headings:font-bold prose-h1:text-2xl prose-h2:text-sm prose-h2:uppercase prose-h2:tracking-wider prose-h2:border-b prose-h2:border-primary/20 prose-h2:pb-2 prose-h2:mt-8 prose-h2:text-primary",
                                            "prose-strong:text-foreground prose-li:my-0.5"
                                        )}>
                                            <Streamdown>{currentBrief.payload.markdown}</Streamdown>
                                        </article>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                    <p>Select a session to view brief.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
}
