import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { memoryProvider, Memory } from "@/lib/memory";
import { seedDemoData } from "@/lib/seed";
import { Trash2, RefreshCw, Database } from "lucide-react";
import { toast } from "sonner";

export default function History() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const data = await memoryProvider.list();
      setMemories(data);
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

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'profile': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'work_delta': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'brief_output': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'feedback': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Memory Log</h2>
          <p className="text-muted-foreground mt-2">
            Raw view of the episodic memory stream.
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

      <div className="space-y-4">
        {memories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            No memories recorded yet. Start the onboarding flow or click "Seed Demo Data".
          </div>
        ) : (
          memories.map((mem) => (
            <Card key={mem.id} className="overflow-hidden">
              <CardHeader className="bg-muted/50 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getBadgeColor(mem.episode_type)}`}>
                      {mem.episode_type.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">{mem.id}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(mem.created_at).toLocaleString()}</span>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <pre className="text-xs font-mono bg-slate-950 text-slate-50 p-4 rounded-md overflow-x-auto">
                  {JSON.stringify(mem.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
