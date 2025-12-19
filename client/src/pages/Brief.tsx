import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Loader2, ThumbsUp, ThumbsDown, Clock, CheckCircle, AlertTriangle,
  Settings2, RotateCcw, Eye, ArrowRight, BookOpen, GraduationCap,
  Download, SplitSquareHorizontal, FileText
} from "lucide-react";
import { CompareView } from "@/components/CompareView";
import { ClassCalendar, Session } from "@/components/ClassCalendar";
import syllabus from "@/lib/syllabus.json";
// @ts-ignore
import html2pdf from "html2pdf.js";
import { cn } from "@/lib/utils";

// Custom hooks
import { useSessionSelection, useBriefGeneration, useBriefPreview, useNotes } from "@/hooks";

export default function Brief() {
  // Prompt configuration sheet visibility
  const [showPromptConfig, setShowPromptConfig] = useState(false);

  // Time saved feedback state
  const [minutesSaved, setMinutesSaved] = useState(15);

  // Session selection hook
  const {
    selectedSession,
    setSelectedSession,
    briefedSessions,
    markSessionBriefed,
    currentDeltas,
    showDevDate,
    currentDateOverride,
    setCurrentDateOverride,
  } = useSessionSelection();

  // Brief generation hook
  const {
    isGenerating,
    result,
    clearResult,
    isPersonalized,
    setIsPersonalized,
    generate,
    promptConfig,
    setPromptConfig,
    resetPrompts,
    useCustomPrompts,
    setUseCustomPrompts,
    feedbackSubmitted,
    submitFeedback,
  } = useBriefGeneration({
    selectedSession,
    onBriefGenerated: markSessionBriefed,
  });

  // Brief preview hook
  const {
    previewBrief,
    compareBrief,
    showPreview,
    closePreview,
    deltaSummary,
    viewBrief,
  } = useBriefPreview({ selectedSession });

  // Notes hook (enabled when preview is open)
  const notes = useNotes({
    sessionId: selectedSession?.date,
    enabled: showPreview,
  });

  // PDF export handler
  const handleDownloadPDF = () => {
    if (!previewBrief || !selectedSession) return;

    const element = document.getElementById('brief-content-to-pdf');
    if (!element) {
      toast.error("Could not find content to export.");
      return;
    }

    const topicSlug = selectedSession.topic.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filename = `DeltaBrief_${topicSlug}_${selectedSession.date}.pdf`;

    const opt = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    toast.promise(
      html2pdf().set(opt).from(element).save(),
      {
        loading: 'Generating PDF...',
        success: 'PDF downloaded successfully!',
        error: 'Failed to generate PDF.'
      }
    );
  };

  // Get syllabus session details
  const getSessionDetails = (date: string) =>
    syllabus.sessions.find(s => s.date === date);

  return (
    <div className="container mx-auto p-4 space-y-8 pb-20 max-w-none">
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
      <div className="grid grid-cols-1 lg:grid-cols-12 xl:grid-cols-12 gap-8">

        {/* Left Column: Calendar & Context */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
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
            <div className="space-y-6">
              {/* Syllabus Intelligence Card */}
              <SyllabusCard
                session={selectedSession}
                sessionDetails={getSessionDetails(selectedSession.date)}
                isBriefed={briefedSessions.includes(selectedSession.date)}
                onView={() => viewBrief(false)}
                onCompare={() => viewBrief(true)}
                onDownload={handleDownloadPDF}
                showPreview={showPreview}
              />

              {/* Work Deltas Card */}
              <DeltasCard deltas={currentDeltas} />
            </div>
          )}
        </div>

        {/* Right Column: Generation & Output */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">

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
                  onClick={generate}
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
            <BriefResultCard
              result={result}
              selectedSession={selectedSession}
              onStartOver={clearResult}
              feedbackSubmitted={feedbackSubmitted}
              onFeedback={submitFeedback}
              minutesSaved={minutesSaved}
              onMinutesSavedChange={() => setMinutesSaved(m => m + 5)}
            />
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
            <div className="flex items-center space-x-2">
              <Switch
                id="use-custom"
                checked={useCustomPrompts}
                onCheckedChange={setUseCustomPrompts}
              />
              <Label htmlFor="use-custom">Use custom prompts</Label>
            </div>

            <div className="space-y-2">
              <Label>System Prompt</Label>
              <Textarea
                value={promptConfig.systemPrompt}
                onChange={(e) => setPromptConfig({ systemPrompt: e.target.value })}
                className="min-h-[200px] font-mono text-xs"
                disabled={!useCustomPrompts}
              />
              <p className="text-xs text-muted-foreground">
                Defines the persona, constraints, and core rules.
              </p>
            </div>

            <div className="space-y-2">
              <Label>User Prompt Template</Label>
              <Textarea
                value={promptConfig.userPromptTemplate}
                onChange={(e) => setPromptConfig({ userPromptTemplate: e.target.value })}
                className="min-h-[200px] font-mono text-xs"
                disabled={!useCustomPrompts}
              />
              <p className="text-xs text-muted-foreground">
                The structure of the request. Variables like {'{{syllabusTopic}}'} will be interpolated.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="ghost" onClick={resetPrompts}>
                Reset to Defaults
              </Button>
              <Button onClick={() => setShowPromptConfig(false)}>
                Save Changes
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Full Screen Compare View */}
      <div className={showPreview ? "fixed inset-0 z-50 bg-background" : "hidden"}>
        <CompareView
          open={showPreview}
          onOpenChange={closePreview}
          currentBrief={previewBrief}
          previousBrief={compareBrief}
          deltaSummary={deltaSummary}
          sessionTopic={selectedSession?.topic || ""}
          sessionDate={selectedSession?.date || ""}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components (extracted for readability)
// ============================================================================

interface SyllabusCardProps {
  session: Session;
  sessionDetails: typeof syllabus.sessions[0] | undefined;
  isBriefed: boolean;
  onView: () => void;
  onCompare: () => void;
  onDownload: () => void;
  showPreview: boolean;
}

function SyllabusCard({
  session,
  sessionDetails,
  isBriefed,
  onView,
  onCompare,
  onDownload,
  showPreview
}: SyllabusCardProps) {
  return (
    <Card className="border-l-4 border-l-primary shadow-sm bg-gradient-to-br from-background to-secondary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          This Week's Lens
        </CardTitle>
        <div className="text-xl font-bold leading-tight mt-1">{session.topic}</div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessionDetails?.learning_objectives && (
          <div>
            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-primary" /> Learning Objectives
            </div>
            <ul className="text-sm space-y-1 text-muted-foreground ml-1">
              {sessionDetails.learning_objectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-primary/40 shrink-0" />
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {sessionDetails?.frameworks && (
          <div>
            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-primary" /> Key Frameworks
            </div>
            <div className="flex flex-wrap gap-2">
              {sessionDetails.frameworks.map((fw, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-medium text-primary">
                  {fw.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Status Actions */}
        <div className="pt-2 border-t mt-2">
          {isBriefed ? (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-green-600 flex items-center gap-1.5 mb-1">
                <CheckCircle className="h-3.5 w-3.5" /> Brief Generated
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs bg-background/50" onClick={onView}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs bg-background/50" onClick={onCompare}>
                  <SplitSquareHorizontal className="h-3.5 w-3.5 mr-1.5" /> Compare
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs bg-background/50 col-span-2" onClick={onDownload} disabled={!showPreview}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Export PDF
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Ready to generate
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface DeltasCardProps {
  deltas: { bullet: string; category?: string; impact?: string }[];
}

function DeltasCard({ deltas }: DeltasCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Your Week in Review
        </CardTitle>
      </CardHeader>
      <CardContent>
        {deltas.length > 0 ? (
          <div className="space-y-3">
            {deltas.map((delta, i) => (
              <div key={i} className="group flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                <div className={cn(
                  "mt-1 w-2 h-2 rounded-full shrink-0",
                  delta.impact === 'critical' ? "bg-red-500 shadow-sm shadow-red-200" :
                    delta.impact === 'high' ? "bg-orange-500" : "bg-blue-400"
                )} title={`Impact: ${delta.impact || 'normal'}`} />
                <div className="space-y-0.5">
                  {delta.category && (
                    <div className="text-xs font-bold uppercase text-muted-foreground/70">{delta.category}</div>
                  )}
                  <div className="text-sm leading-snug">{delta.bullet}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic text-center py-4">
            No work deltas recorded for this week.
            <Button variant="link" className="text-xs h-auto p-0 ml-1">Check in now?</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface BriefResultCardProps {
  result: {
    markdown: string;
    memoryHighlights: string[];
    usage: {
      deltaCount: number;
      usedLastBrief: boolean;
      retryCount: number;
    };
  };
  selectedSession: Session | null;
  onStartOver: () => void;
  feedbackSubmitted: boolean;
  onFeedback: () => void;
  minutesSaved: number;
  onMinutesSavedChange: () => void;
}

function BriefResultCard({
  result,
  selectedSession,
  onStartOver,
  feedbackSubmitted,
  onFeedback,
  minutesSaved,
  onMinutesSavedChange
}: BriefResultCardProps) {
  return (
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
            <Button variant="ghost" size="sm" onClick={onStartOver}>
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
              <Button variant="outline" size="sm" onClick={onFeedback}>
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={onFeedback}>
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
          <Button variant="outline" onClick={onMinutesSavedChange}>
            It saved more!
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
