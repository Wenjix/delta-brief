import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { memoryProvider, Memory } from "@/lib/memory";
import { seedDemoData } from "@/lib/seed";
import { Trash2, RefreshCw, Database, Calendar, Briefcase, FileText, User, GitCompare, BookOpen } from "lucide-react";
import { toast } from "sonner";
import syllabusData from "@/lib/syllabus.json";

// Define syllabus types
interface Framework {
  name: string;
  bullets: string[];
}

interface Session {
  date: string;
  topic: string;
  learning_objectives: string[];
  frameworks: Framework[];
  class_discussion_prompts: string[];
  assignment_hook: string;
}

export default function History() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [diffOpen, setDiffOpen] = useState(false);
  const [selectedBrief, setSelectedBrief] = useState<Memory | null>(null);
  const [previousBrief, setPreviousBrief] = useState<Memory | null>(null);

  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const data = await memoryProvider.list();
      // Sort by session_id (date) descending, then by created_at descending
      const sorted = data.sort((a, b) => {
        if (a.session_id !== b.session_id) {
          return b.session_id.localeCompare(a.session_id);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setMemories(sorted);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  const handleClear = async () => {
    if (confirm("Are you sure? This will wipe all demo data.")) {
      await memoryProvider.clear();
      await loadMemories();
      toast.success("Memory wiped");
    }
  };

  const handleSeed = async () => {
    if (confirm("This will reset memory and inject Week A/B demo data. Continue?")) {
      await seedDemoData();
      await loadMemories();
      toast.success("Demo data seeded (Week A + Week B)");
    }
  };

  const handleCompare = (current: Memory) => {
    // Find the previous brief (chronologically before this one)
    const briefs = memories
      .filter(m => m.episode_type === 'brief_output')
      .sort((a, b) => a.session_id.localeCompare(b.session_id)); // Ascending date

    const currentIndex = briefs.findIndex(b => b.id === current.id);
    const prev = currentIndex > 0 ? briefs[currentIndex - 1] : null;

    if (!prev) {
      toast.info("No previous brief found to compare against.");
      return;
    }

    setSelectedBrief(current);
    setPreviousBrief(prev);
    setDiffOpen(true);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'profile': return <User className="h-4 w-4" />;
      case 'work_delta': return <Briefcase className="h-4 w-4" />;
      case 'brief_output': return <FileText className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'profile': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-800';
      case 'work_delta': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800';
      case 'brief_output': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800';
      case 'feedback': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSyllabusForDate = (date: string): Session | undefined => {
    return (syllabusData.sessions as Session[]).find(s => s.date === date);
  };

  // Group memories by session_id
  const groupedMemories = memories.reduce((acc, mem) => {
    const date = mem.session_id;
    if (!acc[date]) acc[date] = [];
    acc[date].push(mem);
    return acc;
  }, {} as Record<string, Memory[]>);

  const sortedDates = Object.keys(groupedMemories).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Memory Timeline</h2>
          <p className="text-muted-foreground mt-2">
            Visualizing the compounding context from Week A to Week B.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadMemories}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button variant="default" size="sm" onClick={handleSeed}>
            <Database className="h-4 w-4 mr-2" /> Seed Demo Data
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClear}>
            <Trash2 className="h-4 w-4 mr-2" /> Wipe Memory
          </Button>
        </div>
      </div>

      <div className="relative border-l-2 border-muted ml-4 md:ml-6 space-y-12 pb-12">
        {sortedDates.length === 0 ? (
          <div className="ml-8 text-muted-foreground py-12 border-2 border-dashed rounded-lg text-center">
            No timeline data. Click "Seed Demo Data" to visualize the progression.
          </div>
        ) : (
          sortedDates.map((date, dateIndex) => {
            const syllabus = getSyllabusForDate(date);
            
            return (
              <div key={date} className="relative">
                {/* Date Marker */}
                <div className="absolute -left-[21px] md:-left-[29px] bg-background border-2 border-primary rounded-full p-1.5 z-10">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                
                <div className="ml-8 md:ml-12">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      {date}
                      {dateIndex === 0 && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Current Week</span>}
                      {dateIndex === 1 && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Last Week</span>}
                    </h3>
                    
                    {syllabus && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-1 rounded-full border border-muted">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">{syllabus.topic}</span>
                      </div>
                    )}
                  </div>

                  {syllabus && (
                    <div className="mb-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-sm">
                      <div className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Academic Context:</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Key Frameworks</span>
                          <ul className="list-disc list-inside mt-1 text-slate-600 dark:text-slate-400">
                            {syllabus.frameworks.map((fw, i) => (
                              <li key={i}>{fw.name}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Learning Objectives</span>
                          <ul className="list-disc list-inside mt-1 text-slate-600 dark:text-slate-400">
                            {syllabus.learning_objectives.slice(0, 2).map((obj, i) => (
                              <li key={i}>{obj}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4">
                    {groupedMemories[date].map((mem) => (
                      <Card key={mem.id} className="overflow-hidden border-l-4 border-l-transparent hover:border-l-primary transition-all">
                        <CardHeader className="bg-muted/30 py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-1.5 rounded-md border ${getBadgeColor(mem.episode_type)}`}>
                                {getIcon(mem.episode_type)}
                              </div>
                              <span className="font-semibold capitalize">
                                {mem.episode_type.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {mem.episode_type === 'brief_output' && dateIndex === 0 && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 text-xs"
                                  onClick={() => handleCompare(mem)}
                                >
                                  <GitCompare className="h-3 w-3 mr-1" /> Compare
                                </Button>
                              )}
                              <span className="text-xs font-mono text-muted-foreground hidden sm:inline-block">{mem.id.slice(0, 8)}...</span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4 px-4 pb-4">
                          {mem.episode_type === 'work_delta' && (
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">Work Changes:</div>
                              <ul className="list-disc list-inside text-sm space-y-1">
                                {(mem.payload.work_changes as any[])?.map((change: any, i: number) => (
                                  <li key={i}>
                                    <span className="font-medium">{change.bullet || change}</span>
                                    {change.impact && <span className="ml-2 text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">{change.impact}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {mem.episode_type === 'brief_output' && (
                            <div className="space-y-3">
                              <div className="text-sm font-medium text-muted-foreground">Generated Moves:</div>
                              <ul className="list-decimal list-inside text-sm space-y-1 pl-2 border-l-2 border-green-200 dark:border-green-900 ml-1">
                                {(mem.payload.moves as string[])?.map((move, i) => (
                                  <li key={i} className="py-0.5">{move}</li>
                                ))}
                              </ul>
                              {mem.payload.open_threads && (
                                <>
                                  <div className="text-sm font-medium text-muted-foreground mt-2">Open Threads (carried forward):</div>
                                  <ul className="list-disc list-inside text-xs text-muted-foreground pl-2">
                                    {(mem.payload.open_threads as string[])?.map((thread, i) => (
                                      <li key={i}>{thread}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </div>
                          )}

                          {mem.episode_type === 'profile' && (
                            <div className="text-sm">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div><span className="text-muted-foreground">Role:</span> {mem.payload.role}</div>
                                <div><span className="text-muted-foreground">Industry:</span> {mem.payload.industry}</div>
                                <div className="sm:col-span-2"><span className="text-muted-foreground">Initiative:</span> {mem.payload.initiative}</div>
                              </div>
                            </div>
                          )}

                          {/* Fallback for other types */}
                          {!['work_delta', 'brief_output', 'profile'].includes(mem.episode_type) && (
                            <pre className="text-xs font-mono bg-slate-950 text-slate-50 p-3 rounded-md overflow-x-auto">
                              {JSON.stringify(mem.payload, null, 2)}
                            </pre>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                
                {/* Connector Line for next item */}
                {dateIndex < sortedDates.length - 1 && (
                  <div className="absolute left-[-1px] top-8 bottom-[-48px] w-0.5 bg-muted -z-10"></div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Diff Dialog */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Strategic Pivot: Week A vs. Week B</DialogTitle>
            <DialogDescription>
              See how the advice evolved based on new constraints and learnings.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Previous Brief */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-semibold text-muted-foreground">Last Week ({previousBrief?.session_id})</h4>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg border border-dashed">
                <ul className="list-decimal list-inside space-y-3 text-sm">
                  {(previousBrief?.payload.moves as string[])?.map((move, i) => (
                    <li key={i} className="text-muted-foreground">{move}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Current Brief */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-semibold text-primary">This Week ({selectedBrief?.session_id})</h4>
              </div>
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                <ul className="list-decimal list-inside space-y-3 text-sm">
                  {(selectedBrief?.payload.moves as string[])?.map((move, i) => (
                    <li key={i} className="font-medium">{move}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md mt-4 text-sm text-blue-800 dark:text-blue-200 flex gap-3">
            <GitCompare className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Compounding Insight:</p>
              <p>Notice how the advice shifted from "Isolate data" (Week A) to "Engage union" (Week B) because the legal blocker forced a pivot to stakeholder management.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
