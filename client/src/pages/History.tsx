import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { memoryProvider, Memory } from "@/lib/memory";
import { seedDemoData } from "@/lib/seed";
import { Trash2, RefreshCw, Database, Calendar, Briefcase, FileText, User, GitCompare, BookOpen, AlertTriangle, AlertCircle, Info, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { CompareView } from "@/components/CompareView";
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
  const [, setLocation] = useLocation();
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

      // Auto-redirect to Brief page with Dev Mode enabled for the "Next Up" session
      // We assume the seed data sets up a scenario where the user is ready for the NEXT session
      // The seed data typically populates past sessions.
      // Let's find the latest session in the seed data and target the one AFTER it.

      // For now, we'll just redirect to /brief and let the user see the "Next Up" state
      // But we'll append ?dev=1 to enable the date picker immediately
      setTimeout(() => {
        setLocation("/brief?dev=1");
      }, 1000);
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

  const getImpactBadge = (impact: string) => {
    const normalized = impact?.toLowerCase() || 'low';
    switch (normalized) {
      case 'critical':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><AlertTriangle className="w-3 h-3 mr-1" /> Critical</span>;
      case 'high':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"><AlertCircle className="w-3 h-3 mr-1" /> High</span>;
      case 'medium':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><Info className="w-3 h-3 mr-1" /> Medium</span>;
      default:
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">Low</span>;
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
                              <span className="text-xs font-mono text-muted-foreground hidden sm:inline-block">{(mem.id ?? "").slice(0, 8)}...</span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 text-sm">
                          {mem.episode_type === 'profile' && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-xs text-muted-foreground block">Role</span>
                                <span className="font-medium">{mem.payload.persona?.role}</span>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground block">Initiative</span>
                                <span className="font-medium">{mem.payload.work_initiative}</span>
                              </div>
                            </div>
                          )}

                          {mem.episode_type === 'work_delta' && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Constraint Focus:</span>
                                <span className="font-medium">{mem.payload.constraint_focus_this_week}</span>
                              </div>
                              <div className="bg-muted/50 p-2 rounded text-xs font-mono">
                                {((mem.payload.work_changes as any[]) || []).slice(0, 2).map((change, i) => (
                                  <div key={i} className="truncate">
                                    • {typeof change === 'string' ? change : change.bullet}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {mem.episode_type === 'brief_output' && (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-1">
                                {((mem.payload.highlights as string[]) || []).slice(0, 3).map((h, i) => (
                                  <span key={i} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                    {h}
                                  </span>
                                ))}
                                {((mem.payload.highlights as string[]) || []).length > 3 && (
                                  <span className="text-[10px] text-muted-foreground px-1.5 py-0.5">
                                    +{(mem.payload.highlights as string[]).length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <CompareView
        open={diffOpen}
        onOpenChange={setDiffOpen}
        currentBrief={selectedBrief}
        previousBrief={previousBrief}
        deltaSummary={null}
        sessionTopic={selectedBrief ? getSyllabusForDate(selectedBrief.session_id)?.topic || "" : ""}
        sessionDate={selectedBrief ? selectedBrief.session_id : ""}
      />
    </div>
  );
}
