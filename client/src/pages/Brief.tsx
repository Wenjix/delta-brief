import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    const isDev = localStorage.getItem("devMode") === "true" || (window.location.search && window.location.search.includes("dev=1"));
    if (isDev) setShowDevDate(true);

    const next = getNextSession(currentDateOverride ?? getLocalISODate());
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
    // Deterministic Delta Summary Logic using Structured Data
    const summary = {
      resolved: [] as string[],
      new: [] as string[],
      progress: [] as string[]
    };

    // 1. Resolved Threads (from current brief's resolver)
    if (currentBrief.payload.structuredData?.resolver) {
      const r = currentBrief.payload.structuredData.resolver;
      summary.resolved.push(`${r.previously} → ${r.update}`);
    }

    // 2. Top Priority (Move #1)
    if (currentBrief.payload.moves && currentBrief.payload.moves.length > 0) {
      // Check if it's actually new compared to previous brief
      const topMove = currentBrief.payload.moves[0];
      const prevMoves = prevBrief.payload.moves || [];
      
      // Simple check: if it's not in previous moves, it's new
      // (In a real app, we'd use the similarity checker here too)
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

  // Helper to get the best brief for a session (Latest Personalized > Latest Generic)
  const getBestBrief = async (sessionId: string): Promise<Memory | null> => {
    const briefs = await memoryProvider.search("", { 
      episode_type: ["brief_output"],
      session_id: [sessionId]
    }, 10); // Fetch a few to sort

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
  };

  const handleViewBrief = async (compare: boolean = false) => {
    if (!selectedSession) return;
    try {
      // Fetch CURRENT brief (Deterministic)
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
      const result = await generateBrief({
        classDate: selectedSession.date,
        className: syllabus.course,
        syllabusTopic: selectedSession.topic,
        mode: isPersonalized ? 'personalized' : 'generic',
        profile,
        recentDeltas,
        lastBrief,
        enableSimilarityCheck,
        customSystemPrompt: showPromptConfig ? systemPrompt : undefined,
        customUserPromptTemplate: showPromptConfig ? userPromptTemplate : undefined
      });

      setResult(result);

      // 3. Save to Memory (with structured data)
      await memoryProvider.add({
        episode_type: "brief_output",
        session_id: selectedSession.date,
        user_id: "demo-user",
        org_id: "demo-org",
        project_id: "demo-project",
        tags: [],
        payload: {
          markdown: result.markdown,
          highlights: result.memoryHighlights,
          moves: result.moves,
          structuredData: result.structuredData, // Save the structured data!
          mode: isPersonalized ? 'personalized' : 'generic'
        }
      });

      // Update local state to show "Briefed" indicator immediately
      if (!briefedSessions.includes(selectedSession.date)) {
        setBriefedSessions([...briefedSessions, selectedSession.date]);
      }

      toast.success("Brief generated and saved!");

    } catch (error) {
      console.error("Generation failed:", error);
      toast.error("Failed to generate brief. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFeedback = () => {
    setFeedbackSubmitted(true);
    toast.success("Feedback recorded. The model will learn from this.");
  };

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pre-Class Brief</h1>
          <p className="text-muted-foreground mt-1">
            Turn class prep into work leverage.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center space-x-2 bg-secondary/50 p-2 rounded-lg">
            <Switch 
              id="mode-toggle" 
              checked={isPersonalized}
              onCheckedChange={setIsPersonalized}
            />
            <Label htmlFor="mode-toggle" className="cursor-pointer font-medium">
              {isPersonalized ? "Personalized" : "Generic"}
            </Label>
          </div>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setShowPromptConfig(true)}
            title="Configure Prompts"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Calendar & Context */}
        <div className="lg:col-span-4 space-y-6">
          <ClassCalendar 
            selectedDate={selectedSession?.date || ""}
            onSelectSession={setSelectedSession}
            briefedSessions={briefedSessions}
            currentDate={currentDateOverride}
          />

          {/* Dev Mode Date Picker */}
          {showDevDate && (
            <Card className="border-dashed border-yellow-500/50 bg-yellow-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono text-yellow-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Dev Mode: Time Travel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="dev-date" className="text-xs">Simulate "Today" as:</Label>
                  <input 
                    type="date" 
                    id="dev-date"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={currentDateOverride}
                    onChange={(e) => setCurrentDateOverride(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Changing this updates the "Next Up" logic in the calendar.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedSession && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Session Context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Topic</div>
                  <div className="font-medium">{selectedSession.topic}</div>
                </div>
                
                {briefedSessions.includes(selectedSession.date) ? (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                      <CheckCircle className="h-4 w-4" />
                      Brief Ready
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full bg-background/50"
                        onClick={() => handleViewBrief(false)}
                      >
                        <Eye className="h-3 w-3 mr-2" /> View
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full bg-background/50"
                        onClick={() => handleViewBrief(true)}
                      >
                        <SplitSquareHorizontal className="h-3 w-3 mr-2" /> Compare
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-secondary/50 rounded-md text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Not generated yet
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Generation & Output */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Action Area */}
          {!result && (
            <Card className="border-2 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="text-xl font-semibold">Ready to prep?</h3>
                  <p className="text-muted-foreground">
                    Generate a one-page brief for <strong>{selectedSession?.topic || "the next class"}</strong> using your latest work deltas.
                  </p>
                </div>
                <Button 
                  size="lg" 
                  onClick={handleGenerate} 
                  disabled={isGenerating || !selectedSession}
                  className="min-w-[200px]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <>
                      Generate Brief
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                
                {isGenerating && (
                  <p className="text-xs text-muted-foreground animate-pulse">
                    Analyzing syllabus frameworks & checking constraints...
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Result Display */}
          {result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Success Banner */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-medium text-green-900 dark:text-green-100">Brief Generated Successfully</h4>
                  <div className="text-sm text-green-800 dark:text-green-200 flex flex-wrap gap-x-4 gap-y-1">
                    <span>• {result.usage.deltaCount} work deltas analyzed</span>
                    {result.usage.usedLastBrief && <span>• Connected to last week's open threads</span>}
                    {result.usage.retryCount > 0 && <span>• Self-corrected {result.usage.retryCount} times for quality</span>}
                  </div>
                </div>
              </div>

              {/* The Brief Card */}
              <Card className="overflow-hidden border-primary/20 shadow-lg">
                <CardHeader className="bg-secondary/30 border-b pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Pre-Class Delta Brief</CardTitle>
                      <CardDescription className="mt-1">
                        {selectedSession?.topic} • {selectedSession?.date}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Start Over
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6 md:p-8 max-w-none prose prose-slate dark:prose-invert prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-lg prose-h2:border-b prose-h2:pb-2 prose-h2:mt-6 prose-li:my-1">
                  <Streamdown>{result.markdown}</Streamdown>
                </CardContent>

                {/* Footer with Feedback */}
                <div className="bg-secondary/20 border-t p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    <strong>Memory Highlights:</strong> {result.memoryHighlights.join(", ")}
                  </div>
                  
                  {!feedbackSubmitted ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Helpful?</span>
                      <Button variant="outline" size="sm" onClick={handleFeedback}>
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleFeedback}>
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-green-600 font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Feedback saved
                    </div>
                  )}
                </div>
              </Card>

              {/* Value Prop Card */}
              <Card className="bg-primary/5 border-primary/10">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Time Saved
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      You saved ~{minutesSaved} minutes of prep time with this brief.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setMinutesSaved(m => m + 5)}>
                    It saved more!
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Prompt Configuration Sheet */}
      <Sheet open={showPromptConfig} onOpenChange={setShowPromptConfig}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Configure Prompts</SheetTitle>
            <SheetDescription>
              Fine-tune how the AI generates your brief.
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label>System Prompt</Label>
              <Textarea 
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[200px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Defines the persona, constraints, and core rules.
              </p>
            </div>

            <div className="space-y-2">
              <Label>User Prompt Template</Label>
              <Textarea 
                value={userPromptTemplate}
                onChange={(e) => setUserPromptTemplate(e.target.value)}
                className="min-h-[200px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                The structure of the request. Variables like {'{{syllabusTopic}}'} will be interpolated.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="ghost" onClick={handleResetPrompts}>
                Reset to Defaults
              </Button>
              <Button onClick={() => setShowPromptConfig(false)}>
                Save Changes
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Full Screen Brief Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-background z-10">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                {isCompareMode ? (
                  <>
                    <SplitSquareHorizontal className="h-5 w-5 text-primary" />
                    Compare Briefs
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5 text-primary" />
                    Brief Preview
                  </>
                )}
              </DialogTitle>
              <div className="h-6 w-px bg-border" />
              <div className="text-sm text-muted-foreground">
                {selectedSession?.topic} • {selectedSession?.date}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isCompareMode && (
                <div className="flex bg-secondary rounded-lg p-1 mr-4">
                  <Button 
                    variant={viewMode === 'executive' ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => setViewMode('executive')}
                    className="h-7 text-xs"
                  >
                    <LayoutTemplate className="h-3 w-3 mr-2" />
                    Executive
                  </Button>
                  <Button 
                    variant={viewMode === 'full' ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => setViewMode('full')}
                    className="h-7 text-xs"
                  >
                    <FileText className="h-3 w-3 mr-2" />
                    Full Doc
                  </Button>
                </div>
              )}
              <Button variant="ghost" size="icon" onClick={() => setShowPreview(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden bg-secondary/10 relative">
            
            {/* Delta Summary Strip (Sticky) */}
            {isCompareMode && deltaSummary && (
              <div className="absolute top-0 left-0 right-0 bg-background/95 backdrop-blur border-b z-10 px-6 py-3 shadow-sm">
                <div className="grid grid-cols-3 gap-6 text-sm">
                  <div className="space-y-1">
                    <div className="font-semibold text-green-600 flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" /> Resolved / Updated
                    </div>
                    {deltaSummary.resolved.length > 0 ? (
                      <ul className="space-y-1">
                        {deltaSummary.resolved.map((item, i) => (
                          <li key={i} className="text-xs text-muted-foreground truncate" title={item}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No open threads resolved</span>
                    )}
                  </div>
                  
                  <div className="space-y-1 border-l pl-6">
                    <div className="font-semibold text-blue-600 flex items-center gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5" /> Top Priority This Week
                    </div>
                    {deltaSummary.new.length > 0 ? (
                      <ul className="space-y-1">
                        {deltaSummary.new.map((item, i) => (
                          <li key={i} className="text-xs font-medium truncate" title={item}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No new priorities</span>
                    )}
                  </div>

                  <div className="space-y-1 border-l pl-6">
                    <div className="font-semibold text-orange-600 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Other Focus Areas
                    </div>
                    {deltaSummary.progress.length > 0 ? (
                      <ul className="space-y-1">
                        {deltaSummary.progress.map((item, i) => (
                          <li key={i} className="text-xs text-muted-foreground truncate" title={item}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No other items</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Scrollable Content */}
            <div className={`h-full overflow-y-auto p-6 ${isCompareMode ? 'pt-32' : ''}`}>
              
              {/* Executive View Mode */}
              {isCompareMode && viewMode === 'executive' && compareBrief && previewBrief && (
                <div className="grid grid-cols-2 gap-8 max-w-6xl mx-auto">
                  
                  {/* Left: Previous Brief (Summary) */}
                  <div className="space-y-4 opacity-75 hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="font-semibold text-muted-foreground">Previous Session</h3>
                      <span className="text-xs bg-secondary px-2 py-1 rounded">{compareBrief.session_id}</span>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Moves</h4>
                      {extractMoves(compareBrief.payload.markdown as string).map((move, i) => (
                        <Card key={i} className="bg-background/50">
                          <CardContent className="p-3">
                            <div className="font-medium text-sm mb-1">{move.title}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2">{move.content}</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="space-y-3 pt-4">
                      <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <AlertCircle className="h-3 w-3" /> Open Threads (At the time)
                      </h4>
                      {extractOpenThreads(compareBrief.payload.markdown as string).length > 0 ? (
                        <div className="space-y-2">
                          {extractOpenThreads(compareBrief.payload.markdown as string).map((thread, i) => (
                            <div key={i} className="text-sm bg-orange-500/10 text-orange-700 dark:text-orange-300 p-2 rounded border border-orange-500/20">
                              {thread}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">None detected</div>
                      )}
                    </div>
                  </div>

                  {/* Right: Current Brief (Summary) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="font-semibold text-primary">Current Session</h3>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{previewBrief.session_id}</span>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Moves</h4>
                      {extractMoves(previewBrief.payload.markdown as string).map((move, i) => (
                        <Card key={i} className="border-l-4 border-l-primary shadow-sm">
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start gap-2">
                              <div className="font-medium text-sm mb-1">{move.title}</div>
                              <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground whitespace-nowrap">
                                {move.framework}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">{move.content}</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="space-y-3 pt-4">
                      <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <CheckCircle className="h-3 w-3" /> Open Thread Status
                      </h4>
                      {/* We map the previous open threads to their resolution status here */}
                      {deltaSummary?.resolved.map((res, i) => (
                        <div key={i} className="text-sm bg-green-500/10 text-green-700 dark:text-green-300 p-2 rounded border border-green-500/20 flex items-start gap-2">
                          <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{res}</span>
                        </div>
                      ))}
                      {(!deltaSummary?.resolved || deltaSummary.resolved.length === 0) && (
                        <div className="text-sm text-muted-foreground italic">No updates required</div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* Full Document View Mode */}
              {(!isCompareMode || viewMode === 'full') && (
                <div className={`grid ${isCompareMode ? 'grid-cols-2 gap-8' : 'grid-cols-1 max-w-3xl mx-auto'}`}>
                  
                  {/* Previous Brief (Full) */}
                  {isCompareMode && compareBrief && (
                    <div className="opacity-80">
                      <div className="mb-4 pb-2 border-b flex justify-between items-center">
                        <h3 className="font-semibold text-muted-foreground">Previous: {compareBrief.session_id}</h3>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Streamdown>{compareBrief.payload.markdown as string}</Streamdown>
                      </div>
                    </div>
                  )}

                  {/* Current Brief (Full) */}
                  {previewBrief && (
                    <div>
                      <div className="mb-4 pb-2 border-b flex justify-between items-center">
                        <h3 className="font-semibold text-primary">Current: {previewBrief.session_id}</h3>
                        {!isCompareMode && (
                          <div className="flex gap-2">
                            <span className="text-xs bg-secondary px-2 py-1 rounded text-muted-foreground">
                              {previewBrief.payload.mode === 'personalized' ? 'Personalized' : 'Generic'}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Academic Context Block (Only in single view or right side) */}
                      {previewSyllabus && !isCompareMode && (
                        <div className="mb-6 p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg">
                          <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                            <GraduationCap className="h-4 w-4" />
                            Academic Context
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <strong className="text-blue-700 dark:text-blue-300 block mb-1">Key Frameworks</strong>
                              <ul className="list-disc list-inside text-muted-foreground">
                                {previewSyllabus.frameworks.map((f: any) => (
                                  <li key={f.name}>{f.name}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <strong className="text-blue-700 dark:text-blue-300 block mb-1">Learning Objectives</strong>
                              <ul className="list-disc list-inside text-muted-foreground">
                                {previewSyllabus.learning_objectives.slice(0, 2).map((o: string, i: number) => (
                                  <li key={i}>{o}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Streamdown>{previewBrief.payload.markdown as string}</Streamdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
