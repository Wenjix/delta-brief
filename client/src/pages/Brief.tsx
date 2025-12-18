import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { memoryProvider, Memory } from "@/lib/memory";
import { generateBrief, BriefGenerationResult } from "@/lib/llm";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { Loader2, ThumbsUp, ThumbsDown, Clock, CheckCircle } from "lucide-react";

export default function Brief() {
  const [, setLocation] = useLocation();
  const [isPersonalized, setIsPersonalized] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<BriefGenerationResult | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // State for feedback
  const [minutesSaved, setMinutesSaved] = useState(15);
  const [usedInClass, setUsedInClass] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResult(null);
    setFeedbackSubmitted(false);

    try {
      // 1. Fetch Context
      const [profile] = await memoryProvider.search("", { episode_type: ["profile"] }, 1);
      const recentDeltas = await memoryProvider.search("", { episode_type: ["work_delta"] }, 3);
      const [lastBrief] = await memoryProvider.search("", { episode_type: ["brief_output"] }, 1);

      // Get latest delta for syllabus info (hack for demo)
      const latestDelta = recentDeltas[0];
      if (!latestDelta) {
        toast.error("No check-in found. Please complete check-in first.");
        setLocation("/checkin");
        return;
      }

      const { course, next_topic } = latestDelta.payload;

      // 2. Generate
      const generated = await generateBrief({
        classDate: new Date().toISOString().split('T')[0],
        className: course,
        syllabusTopic: next_topic,
        mode: isPersonalized ? 'personalized' : 'generic',
        profile: isPersonalized ? profile : undefined,
        recentDeltas: isPersonalized ? recentDeltas : [latestDelta], // Generic still needs current context
        lastBrief: isPersonalized ? lastBrief : undefined
      });

      setResult(generated);

      // 3. Save Output Memory
      await memoryProvider.add({
        user_id: "u_demo",
        org_id: "org_demo",
        project_id: "p_emba_delta_brief",
        session_id: new Date().toISOString().split('T')[0],
        episode_type: "brief_output",
        tags: ["emba", "brief"],
        payload: {
          markdown: generated.markdown,
          highlights: generated.memoryHighlights,
          mode: isPersonalized ? 'personalized' : 'generic'
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
        session_id: new Date().toISOString().split('T')[0],
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Delta Brief</h2>
          <p className="text-muted-foreground mt-2">
            Generate your 1-page pre-class executive summary.
          </p>
        </div>
        
        <div className="flex items-center space-x-4 bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="flex items-center space-x-2">
            <Switch 
              id="mode-toggle" 
              checked={isPersonalized} 
              onCheckedChange={setIsPersonalized} 
            />
            <Label htmlFor="mode-toggle" className="font-medium">
              {isPersonalized ? "Personalized (Memory ON)" : "Generic (Memory OFF)"}
            </Label>
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating}>
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
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleFeedback('up')}>
                      <ThumbsUp className="h-4 w-4 mr-2" /> Useful
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleFeedback('down')}>
                      <ThumbsDown className="h-4 w-4 mr-2" /> Poor
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900">
                <CardContent className="pt-6 flex flex-col items-center text-center text-green-700 dark:text-green-400">
                  <CheckCircle className="h-8 w-8 mb-2" />
                  <p className="font-medium">Feedback Recorded</p>
                  <p className="text-xs mt-1">Compounding your preferences for next time.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
