import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { memoryProvider, Memory } from "@/lib/memory";
import { generateBrief, BriefGenerationResult, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT_TEMPLATE } from "@/lib/llm";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { Loader2, ThumbsUp, ThumbsDown, Clock, CheckCircle, AlertTriangle, Settings2, RotateCcw } from "lucide-react";
import { ClassCalendar, getNextSession, Session } from "@/components/ClassCalendar";

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

  // State for feedback
  const [minutesSaved, setMinutesSaved] = useState(15);
  const [usedInClass, setUsedInClass] = useState(false);

  // Initialize session on mount
  useEffect(() => {
    const next = getNextSession();
    if (next) setSelectedSession(next);
  }, []);

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
      const recentDeltas = await memoryProvider.search("", { episode_type: ["work_delta"] }, 3);
      
      // Fetch last brief specifically for the PREVIOUS session relative to selected
      // For demo simplicity, we just grab the most recent brief_output
      const [lastBrief] = await memoryProvider.search("", { episode_type: ["brief_output"] }, 1);

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
        <div className="w-full md:w-72 shrink-0">
          <ClassCalendar 
            selectedDate={selectedSession?.date || ""} 
            onSelectSession={setSelectedSession} 
          />
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
    </div>
  );
}
