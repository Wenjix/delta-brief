import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { memoryProvider, Memory } from "@/lib/memory";
import { generateBrief, BriefGenerationResult, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT_TEMPLATE } from "@/lib/llm";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { Loader2, ThumbsUp, ThumbsDown, Clock, CheckCircle, AlertTriangle, AlertCircle, Settings2, RotateCcw, Eye, Calendar, ArrowRight, SplitSquareHorizontal, BookOpen, GraduationCap, X, Maximize2, Minimize2, LayoutTemplate, FileText, MoveRight, ArrowDownRight } from "lucide-react";
import { ClassCalendar, getNextSession, Session, getLocalISODate } from "@/components/ClassCalendar";
import syllabus from "@/lib/syllabus.json";

export default function Brief() {
  const [, setLocation] = useLocation();
  const [isPersonalized, setIsPersonalized] = useState(true);
  const [enableSimilarityCheck, setEnableSimilarityCheck] = useState(true); // Default ON
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<BriefGenerationResult | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Prompt Configuration State
  const [showPromptConfig, setShowPromptConfig] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [userPromptTemplate, setUserPromptTemplate] = useState(DEFAULT_USER_PROMPT_TEMPLATE);

  // Session Selection State
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [briefedSessions, setBriefedSessions] = useState<string[]>([]);

  // Brief Preview & Compare State
  const [previewBrief, setPreviewBrief] = useState<Memory | null>(null);
  const [compareBrief, setCompareBrief] = useState<Memory | null>(null); // Previous brief for comparison
  const [showPreview, setShowPreview] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [deltaSummary, setDeltaSummary] = useState<{ resolved: string[], new: string[], progress: string[] } | null>(null);
  const [previewSyllabus, setPreviewSyllabus] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'executive' | 'full'>('executive');

  // Dev Mode State
  const [showDevDate, setShowDevDate] = useState(false);
  const [currentDateOverride, setCurrentDateOverride] = useState(getLocalISODate());

  // State for feedback
  const [minutesSaved, setMinutesSaved] = useState(15);
  const [usedInClass, setUsedInClass] = useState(false);

  // Initialize session on mount and fetch briefed sessions
  useEffect(() => {
    // Check for dev mode flag
    const isDev = localStorage.getItem("devMode") === "true" || window.location.search.includes("dev=1");
    if (isDev) setShowDevDate(true);

    const next = getNextSession(currentDateOverride);
    if (next) setSelectedSession(next);
    
    // Fetch all brief outputs to populate calendar indicators
    const fetchBriefedSessions = async () => {
      try {
        const briefs = await memoryProvider.search("", { episode_type: ["brief_output"] }, 50);
        const sessionIds = briefs.map(b => b.session_id).filter(Boolean);
        setBriefedSessions(Array.from(new Set(sessionIds)));
      } catch (err) {
        console.error("Failed to fetch briefed sessions", err);
      }
    };
    
    fetchBriefedSessions();
  }, [currentDateOverride]); // Re-run when override changes

  // When session changes, check if we have a brief for it
  useEffect(() => {
    if (selectedSession && briefedSessions.includes(selectedSession.date)) {
      // We could auto-load it, but let's just make it available via a button
    }
  }, [selectedSession, briefedSessions]);

  const generateDeltaSummary = (prevBrief: Memory, currentBrief: Memory) => {
    // Deterministic Delta Summary Logic
    const prevMarkdown = prevBrief.payload.markdown as string;
    const currentMarkdown = currentBrief.payload.markdown as string;
    
    const summary = {
      resolved: [] as string[],
      new: [] as string[],
      progress: [] as string[]
    };

    // 1. Extract Open Threads from Previous Brief
    const openThreadRegex = /Open Thread Update: Previously: (.+?) -> Now: (.+?) -> Update: (.+?)$/gm;
    // We actually need to find where these threads *went* in the new brief
    // But for the summary, we look at the NEW brief's "Open Thread Update" lines
    // because those lines describe the resolution of OLD threads.
    
    let match;
    while ((match = openThreadRegex.exec(currentMarkdown)) !== null) {
      // match[1] = Old Plan, match[2] = New Reality, match[3] = Update
      summary.resolved.push(`${match[1]} → ${match[3]}`);
    }

    // 2. Identify New High-Impact Items (Heuristic: Top Move in New Brief)
    const moveRegex = /^\d+\)\s*Move:\s*(.+?)\s*\(Framework:/gm;
    const firstMoveMatch = moveRegex.exec(currentMarkdown);
    if (firstMoveMatch) {
      summary.new.push(`${firstMoveMatch[1]} (Top Priority)`);
    }

    // 3. Progress (Heuristic: Check for "cadence", "committee", "meeting" in moves)
    const progressKeywords = ["cadence", "committee", "meeting", "approval", "signed"];
    const moves = currentMarkdown.split("Move:");
    moves.shift(); // remove preamble
    
    moves.forEach(move => {
      if (progressKeywords.some(k => move.toLowerCase().includes(k))) {
        const title = move.split("(")[0].trim();
        if (!summary.new.includes(`${title} (Top Priority)`)) {
           summary.progress.push(title);
        }
      }
    });

    return summary;
  };

  const extractMoves = (markdown: string) => {
    const moves: { title: string, framework: string, content: string }[] = [];
    const moveRegex = /^\d+\)\s*Move:\s*(.+?)\s*\(Framework:\s*(.+?)\)\n([\s\S]+?)(?=\n\d+\)\s*Move:|$)/gm;
    let match;
    while ((match = moveRegex.exec(markdown)) !== null) {
      moves.push({
        title: match[1].trim(),
        framework: match[2].trim(),
        content: match[3].trim().split('\n')[0] // Just take the first line/paragraph as the "one-liner"
      });
    }
    return moves;
  };

  const extractOpenThreads = (markdown: string) => {
    const threads: string[] = [];
    // Look for the "Open Threads" section
    const sectionRegex = /## Open Threads\n([\s\S]+?)(?=\n##|$)/;
    const match = sectionRegex.exec(markdown);
    if (match) {
      const bullets = match[1].split('\n').filter(line => line.trim().startsWith('-'));
      bullets.forEach(b => threads.push(b.replace(/^-\s*/, '').trim()));
    }
    return threads;
  };

  const handleViewBrief = async (compare: boolean = false) => {
    if (!selectedSession) return;
    try {
      // Fetch CURRENT brief
      const briefs = await memoryProvider.search("", { 
        episode_type: ["brief_output"],
        session_id: [selectedSession.date]
      }, 1);
      
      if (briefs.length > 0) {
        setPreviewBrief(briefs[0]);
        
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
            const prevBriefs = await memoryProvider.search("", { 
              episode_type: ["brief_output"],
              session_id: [previousSession.date]
            }, 1);
            
            if (prevBriefs.length > 0) {
              setCompareBrief(prevBriefs[0]);
              setDeltaSummary(generateDeltaSummary(prevBriefs[0], briefs[0]));
            } else {
              setCompareBrief(null);
              setDeltaSummary(null);
              toast.info("No previous brief found to compare with.");
            }
          }
          setIsCompareMode(true);
          setViewMode('executive'); // Default to executive mode for compare
        } else {
          setIsCompareMode(false);
          setCompareBrief(null);
        }
        
        setShowPreview(true);
      } else {
        toast.error("No brief found for this session.");
      }
    } catch (err) {
      console.error("Failed to fetch brief for preview", err);
      toast.error("Failed to load brief.");
    }
  };

  const handleResetPrompts = () => {
    if (confirm("Reset prompts to default?")) {
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      setUserPromptTemplate(DEFAULT_USER_PROMPT_TEMPLATE);
      toast.success("Prompts reset to default");
    }
  };

  const handleGenerate = async () => {
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
      
      // Deterministic Retrieval Logic:
      // We need the work_delta for the CURRENT session (or latest available)
      // And the brief_output from the PREVIOUS session (to check for open threads/compounding)
      
      // Find previous session date
      const sortedSessions = [...syllabus.sessions].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const currentIndex = sortedSessions.findIndex(s => s.date === selectedSession.date);
      const previousSession = currentIndex > 0 ? sortedSessions[currentIndex - 1] : null;

      // Fetch specific memories
      let recentDeltas: Memory[] = [];
      let lastBrief: Memory | undefined = undefined;

      // Get delta for THIS session (if user checked in for it)
      // Or fallback to most recent delta if specific one missing (for demo robustness)
      const specificDelta = await memoryProvider.search("", { 
        episode_type: ["work_delta"],
        session_id: [selectedSession.date] 
      }, 1);
      
      if (specificDelta.length > 0) {
        recentDeltas = specificDelta;
      } else {
        // Fallback: grab latest delta generally
        recentDeltas = await memoryProvider.search("", { episode_type: ["work_delta"] }, 1);
      }

      // Get brief from PREVIOUS session
      if (previousSession) {
        const prevBriefs = await memoryProvider.search("", { 
          episode_type: ["brief_output"],
          session_id: [previousSession.date]
        }, 1);
        if (prevBriefs.length > 0) {
          lastBrief = prevBriefs[0];
        }
      }

      // If no previous brief found (e.g. first session or gap), maybe fallback to *any* last brief?
      // For strict compounding, we might prefer null, but for demo flow, let's try to find *any* recent brief if strict one fails
      if (!lastBrief) {
         const anyLastBrief = await memoryProvider.search("", { episode_type: ["brief_output"] }, 1);
         // Only use it if it's historically before current session
         if (anyLastBrief.length > 0 && anyLastBrief[0].session_id < selectedSession.date) {
           lastBrief = anyLastBrief[0];
         }
      }

      // Get latest delta for syllabus info (hack for demo)
      const latestDelta = recentDeltas[0];
      if (!latestDelta) {
        toast.error("No check-in found. Please complete check-in first.");
        setLocation("/checkin");
        return;
      }

      const { course } = latestDelta.payload;

      // 2. Generate
      const generated = await generateBrief({
        classDate: selectedSession.date,
        className: course || "AI Transformation", // Fallback if delta missing course
        syllabusTopic: selectedSession.topic,
        mode: isPersonalized ? 'personalized' : 'generic',
        profile: isPersonalized ? profile : undefined,
        recentDeltas: isPersonalized ? recentDeltas : [latestDelta], // Generic still needs current context
        lastBrief: isPersonalized ? lastBrief : undefined,
        enableSimilarityCheck: isPersonalized && enableSimilarityCheck,
        customSystemPrompt: systemPrompt,
        customUserPromptTemplate: userPromptTemplate
      });

      setResult(generated);

      // 3. Save Output Memory
      await memoryProvider.add({
        user_id: "u_demo",
        org_id: "org_demo",
        project_id: "p_emba_delta_brief",
        session_id: selectedSession.date, // Anchor to the specific session date
        episode_type: "brief_output",
        tags: ["emba", "brief"],
        payload: {
          markdown: generated.markdown,
          highlights: generated.memoryHighlights,
          mode: isPersonalized ? 'personalized' : 'generic',
          moves: generated.moves // Store moves for next time
        }
      });
      
      // Update briefed sessions list
      setBriefedSessions(prev => Array.from(new Set([...prev, selectedSession.date])));

    } catch (error) {
      console.error(error);
      toast.error("Failed to generate brief");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFeedback = async (rating: 'up' | 'down') => {
    try {
      await memoryProvider.add({
        user_id: "u_demo",
        org_id: "org_demo",
        project_id: "p_emba_delta_brief",
        session_id: selectedSession?.date || new Date().toISOString().split('T')[0],
        episode_type: "feedback",
        tags: ["feedback"],
        payload: {
          rating,
          minutes_saved: minutesSaved,
          used_in_class: usedInClass
        }
      });
      setFeedbackSubmitted(true);
      toast.success("Feedback saved");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight">Delta Brief</h2>
          <p className="text-muted-foreground mt-2">
            Generate your 1-page pre-class executive summary.
          </p>
        </div>
        
        {/* Calendar Component */}
        <div className="w-full md:w-72 shrink-0 space-y-4">
          {showDevDate && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <Label className="text-xs font-mono text-orange-800 dark:text-orange-200 mb-1 block flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                DEV: SIMULATE DATE
              </Label>
              <input 
                type="date" 
                value={currentDateOverride}
                onChange={(e) => setCurrentDateOverride(e.target.value)}
                className="w-full text-xs p-1 rounded border border-orange-200 dark:border-orange-800 bg-white dark:bg-black"
              />
            </div>
          )}

          <ClassCalendar 
            selectedDate={selectedSession?.date || ""} 
            onSelectSession={setSelectedSession}
            briefedSessions={briefedSessions}
            currentDate={currentDateOverride}
          />
          
          {/* View Brief Button (only if briefed) */}
          {selectedSession && briefedSessions.includes(selectedSession.date) && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => handleViewBrief(false)}
              >
                <Eye className="w-4 h-4 mr-2" />
                View
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => handleViewBrief(true)}
              >
                <SplitSquareHorizontal className="w-4 h-4 mr-2" />
                Compare
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch 
              id="mode-toggle" 
              checked={isPersonalized} 
              onCheckedChange={setIsPersonalized} 
            />
            <Label htmlFor="mode-toggle" className="font-medium text-sm">
              {isPersonalized ? "Personalized" : "Generic"}
            </Label>
          </div>

          {isPersonalized && (
            <div className="flex items-center space-x-2 border-l pl-4">
              <Switch 
                id="similarity-toggle" 
                checked={enableSimilarityCheck} 
                onCheckedChange={setEnableSimilarityCheck} 
              />
              <Label htmlFor="similarity-toggle" className="font-medium text-sm">
                No Repeats
              </Label>
            </div>
          )}
        </div>

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="icon" onClick={() => setShowPromptConfig(true)} title="Configure Prompts">
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !selectedSession}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Brief"
            )}
          </Button>
        </div>
      </div>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Brief Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Warning Banner if similarity check failed after retry */}
            {result.similarityReport && !result.similarityReport.pass && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-md flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200">⚠️ Possible repeat detected (demo)</h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    The generated moves are very similar to last week's brief despite retry attempts.
                  </p>
                </div>
              </div>
            )}

            <Card className="border-2 border-primary/10 shadow-lg">
              <CardContent className="pt-6 prose prose-slate dark:prose-invert max-w-none">
                <Streamdown>{result.markdown}</Streamdown>
              </CardContent>
            </Card>

            {/* Memory Highlights Chips */}
            {result.memoryHighlights.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-mono uppercase text-muted-foreground py-1">Memory Used:</span>
                {result.memoryHighlights.map((highlight, i) => (
                  <span 
                    key={i} 
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: Feedback & Stats */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Context Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Profile Used:</span>
                  <span className={result.usage.usedProfile ? "text-green-600 font-bold" : "text-muted-foreground"}>
                    {result.usage.usedProfile ? "YES" : "NO"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Last Brief:</span>
                  <span className={result.usage.usedLastBrief ? "text-green-600 font-bold" : "text-muted-foreground"}>
                    {result.usage.usedLastBrief ? "YES" : "NO"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Deltas:</span>
                  <span className="font-mono">{result.usage.deltaCount}</span>
                </div>
                {result.usage.retryCount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Retries:</span>
                    <span className="font-mono text-orange-600 font-bold">{result.usage.retryCount}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {!feedbackSubmitted ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Feedback Loop</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Minutes Saved</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <input 
                        type="range" 
                        min="0" 
                        max="60" 
                        step="5" 
                        value={minutesSaved} 
                        onChange={(e) => setMinutesSaved(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <span className="text-sm font-mono w-8">{minutesSaved}m</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="used-in-class" 
                      checked={usedInClass} 
                      onCheckedChange={setUsedInClass} 
                    />
                    <Label htmlFor="used-in-class" className="text-xs">Used in class?</Label>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1" 
                      onClick={() => handleFeedback('up')}
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Helpful
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1" 
                      onClick={() => handleFeedback('down')}
                    >
                      <ThumbsDown className="h-4 w-4 mr-2" />
                      Poor
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardContent className="pt-6 flex flex-col items-center text-center">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
                  <h4 className="font-medium text-green-800 dark:text-green-200">Feedback Received</h4>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    Your input helps improve future briefs.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Prompt Configuration Dialog */}
      <Dialog open={showPromptConfig} onOpenChange={setShowPromptConfig}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prompt Configuration</DialogTitle>
            <DialogDescription>
              Edit the system and user prompts used for generation. Variables like {'{{syllabusTopic}}'} will be interpolated at runtime.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="system-prompt">System Prompt</Label>
              <Textarea 
                id="system-prompt" 
                value={systemPrompt} 
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="font-mono text-xs min-h-[200px]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="user-prompt">User Prompt Template</Label>
              <Textarea 
                id="user-prompt" 
                value={userPromptTemplate} 
                onChange={(e) => setUserPromptTemplate(e.target.value)}
                className="font-mono text-xs min-h-[300px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleResetPrompts} className="mr-auto">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Defaults
            </Button>
            <Button variant="secondary" onClick={() => setShowPromptConfig(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowPromptConfig(false);
              toast.success("Prompt configuration saved");
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-Screen Compare Workspace */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8">
          <div className="bg-background border shadow-2xl w-full h-full max-w-[1600px] rounded-xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <SplitSquareHorizontal className="w-5 h-5 text-primary" />
                  Brief Comparison
                </h2>
                {isCompareMode && compareBrief && previewBrief && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span className="font-mono">{compareBrief.session_id}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="font-mono font-bold text-foreground">{previewBrief.session_id}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                {isCompareMode && (
                  <div className="flex items-center bg-muted p-1 rounded-lg border">
                    <Button 
                      variant={viewMode === 'executive' ? 'secondary' : 'ghost'} 
                      size="sm" 
                      onClick={() => setViewMode('executive')}
                      className="text-xs h-7"
                    >
                      <LayoutTemplate className="w-3 h-3 mr-1.5" />
                      Executive
                    </Button>
                    <Button 
                      variant={viewMode === 'full' ? 'secondary' : 'ghost'} 
                      size="sm" 
                      onClick={() => setViewMode('full')}
                      className="text-xs h-7"
                    >
                      <FileText className="w-3 h-3 mr-1.5" />
                      Full Brief
                    </Button>
                  </div>
                )}
                <Button variant="ghost" size="icon" onClick={() => setShowPreview(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Delta Summary Strip (Sticky) */}
            {isCompareMode && deltaSummary && (
              <div className="bg-blue-50/50 dark:bg-blue-900/10 border-b px-6 py-3 flex gap-6 overflow-x-auto shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 shrink-0">
                  <RotateCcw className="w-4 h-4" />
                  Delta Summary
                </div>
                
                {deltaSummary.resolved.length > 0 && (
                  <div className="flex items-center gap-2 text-sm shrink-0 bg-white dark:bg-black px-3 py-1.5 rounded border shadow-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-medium">Resolved:</span>
                    <span className="text-muted-foreground truncate max-w-[300px]">{deltaSummary.resolved[0]}</span>
                  </div>
                )}
                
                {deltaSummary.new.length > 0 && (
                  <div className="flex items-center gap-2 text-sm shrink-0 bg-white dark:bg-black px-3 py-1.5 rounded border shadow-sm">
                    <AlertCircle className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">New Priority:</span>
                    <span className="text-muted-foreground truncate max-w-[300px]">{deltaSummary.new[0]}</span>
                  </div>
                )}

                {deltaSummary.progress.length > 0 && (
                  <div className="flex items-center gap-2 text-sm shrink-0 bg-white dark:bg-black px-3 py-1.5 rounded border shadow-sm">
                    <Clock className="w-4 h-4 text-orange-600" />
                    <span className="font-medium">In Progress:</span>
                    <span className="text-muted-foreground truncate max-w-[300px]">{deltaSummary.progress[0]}</span>
                  </div>
                )}
              </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50">
              {isCompareMode ? (
                viewMode === 'executive' ? (
                  <div className="grid grid-cols-2 gap-8 max-w-6xl mx-auto">
                    {/* Executive Compare Layout */}
                    <div className="space-y-6">
                      <h3 className="text-sm font-bold uppercase text-muted-foreground border-b pb-2">Previous Session</h3>
                      {compareBrief && (
                        <div className="space-y-4">
                          {/* Open Threads Status Panel */}
                          <Card className="bg-muted/30 border-dashed">
                            <CardHeader className="py-3 px-4">
                              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Open Threads Status</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-2">
                              {extractOpenThreads(compareBrief.payload.markdown as string).map((thread, i) => {
                                const isResolved = deltaSummary?.resolved.some(r => r.includes(thread.split(':')[0]));
                                return (
                                  <div key={i} className="flex items-start gap-2 text-xs">
                                    {isResolved ? (
                                      <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                                    ) : (
                                      <Clock className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                                    )}
                                    <span className={isResolved ? "text-muted-foreground line-through" : "font-medium"}>
                                      {thread}
                                    </span>
                                    {isResolved && <span className="text-[10px] text-green-600 font-bold ml-auto">RESOLVED</span>}
                                  </div>
                                );
                              })}
                              {extractOpenThreads(compareBrief.payload.markdown as string).length === 0 && (
                                <div className="text-xs text-muted-foreground italic">No open threads from this session.</div>
                              )}
                            </CardContent>
                          </Card>

                          {extractMoves(compareBrief.payload.markdown as string).map((move, i) => (
                            <Card key={i} className="border-l-4 border-l-muted-foreground/30">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-mono text-muted-foreground">Move {i + 1}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{move.framework}</span>
                                </div>
                                <h4 className="font-semibold text-sm mb-1">{move.title}</h4>
                                <p className="text-xs text-muted-foreground line-clamp-2">{move.content}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-6">
                      <h3 className="text-sm font-bold uppercase text-primary border-b pb-2">Current Session</h3>
                      {previewBrief && (
                        <div className="space-y-4">
                          {/* Placeholder for alignment with Open Threads panel */}
                          <div className="h-[120px] flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                            <ArrowDownRight className="w-4 h-4 mr-2" />
                            Compounding Actions
                          </div>

                          {extractMoves(previewBrief.payload.markdown as string).map((move, i) => (
                            <Card key={i} className="border-l-4 border-l-primary shadow-md">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-mono text-primary">Move {i + 1}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">{move.framework}</span>
                                </div>
                                <h4 className="font-semibold text-sm mb-1">{move.title}</h4>
                                <p className="text-xs text-muted-foreground line-clamp-2">{move.content}</p>
                                
                                {/* Mapping Arrow Logic */}
                                {deltaSummary?.resolved.some(r => r.includes(move.title) || move.content.includes("Open Thread")) && (
                                  <div className="mt-3 pt-2 border-t flex items-center gap-2 text-xs text-green-600 font-medium">
                                    <CheckCircle className="w-3 h-3" />
                                    Updates Open Thread
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-8 max-w-6xl mx-auto">
                    {/* Full Brief Compare Layout */}
                    {compareBrief && (
                      <div className="space-y-4">
                        <div className="prose prose-sm dark:prose-invert max-w-none opacity-75 bg-white dark:bg-black p-6 rounded-lg border shadow-sm">
                          <Streamdown>{compareBrief.payload.markdown}</Streamdown>
                        </div>
                      </div>
                    )}
                    {previewBrief && (
                      <div className="space-y-4">
                        <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-black p-6 rounded-lg border shadow-sm ring-1 ring-primary/10">
                          <Streamdown>{previewBrief.payload.markdown}</Streamdown>
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                // Single View Mode
                <div className="max-w-3xl mx-auto">
                  {previewSyllabus && (
                    <div className="bg-white dark:bg-black border rounded-lg p-4 mb-6 shadow-sm">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" />
                        Academic Context
                      </h4>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <span className="text-xs font-semibold block mb-2">Frameworks</span>
                          <div className="flex flex-wrap gap-1.5">
                            {previewSyllabus.frameworks.map((f: any, i: number) => (
                              <span key={i} className="text-[10px] px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-medium">
                                {f.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-semibold block mb-2">Objectives</span>
                          <ul className="list-disc pl-3 space-y-1">
                            {previewSyllabus.learning_objectives.slice(0, 2).map((o: string, i: number) => (
                              <li key={i} className="text-[10px] text-muted-foreground leading-tight">{o}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {previewBrief && (
                    <div className="prose prose-slate dark:prose-invert max-w-none bg-white dark:bg-black p-8 rounded-lg border shadow-sm">
                      <Streamdown>{previewBrief.payload.markdown}</Streamdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
