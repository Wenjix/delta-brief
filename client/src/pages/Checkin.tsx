import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { memoryProvider } from "@/lib/memory";
import { toast } from "sonner";
import { History, ArrowRight } from "lucide-react";

// Demo data: Last week's context (shown for demo visibility)
// Matches seed.ts Week A data (2025-12-10)
const LAST_WEEK_CONTEXT = {
  date: "2025-12-10",
  topic: "Data Strategy & Ethics",
  changes: [
    { bullet: "Selected vendor for AI pilot", impact: "high" },
    { bullet: "Union reps expressed concern about job displacement", impact: "high" },
    { bullet: "Legal team is blocking data access request", impact: "critical" },
  ],
  openThreads: [
    "Confirm whether 'non-PHI' carve-out is acceptable to legal",
    "Define what counts as PHI in intake transcripts",
    "Get union rep into governance cadence early",
  ],
};

export default function Checkin() {
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    course: "AI Transformation",
    next_topic: "Operating Model & Governance",
    work_changes: "- CEO announced 10% budget cut for non-clinical projects\n- IT security audit flagged our vendor selection process\n- My team is now fully remote on Fridays",
    constraint_focus: "Budget freeze",
    capstone_milestone: "Drafting the problem statement",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await memoryProvider.add({
        user_id: "u_demo",
        org_id: "org_demo",
        project_id: "p_emba_delta_brief",
        session_id: new Date().toISOString().split('T')[0],
        episode_type: "work_delta",
        tags: ["emba", "delta"],
        payload: {
          course: formData.course,
          next_topic: formData.next_topic,
          work_changes: formData.work_changes.split('\n').filter(line => line.trim().length > 0),
          constraint_focus_this_week: formData.constraint_focus,
          capstone_next_milestone: formData.capstone_milestone
        }
      });

      toast.success("Work delta saved successfully");
      setLocation("/brief");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save check-in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Weekly Check-in</h2>
        <p className="text-muted-foreground mt-2">
          Capture "Episodic Memory". What changed at work since the last class? This ensures the brief is timely and relevant.
        </p>
      </div>

      {/* Last Week's Context (Demo Visibility) */}
      <Card className="border-dashed border-muted-foreground/30 bg-muted/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Last Week's Context
            </CardTitle>
            <span className="text-xs font-mono text-muted-foreground/70 ml-auto">
              {LAST_WEEK_CONTEXT.date} • {LAST_WEEK_CONTEXT.topic}
            </span>
          </div>
          <CardDescription>
            What the system already knows from your previous check-in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Work Changes Recorded</div>
            <ul className="space-y-1">
              {LAST_WEEK_CONTEXT.changes.map((change, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className={change.impact === 'critical' ? 'text-red-500' : 'text-muted-foreground/50'}>
                    {change.impact === 'critical' ? '!' : '•'}
                  </span>
                  <span>{change.bullet}</span>
                  {change.impact === 'critical' && (
                    <span className="text-[10px] uppercase font-bold text-red-500 ml-1">critical</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Open Threads (Unresolved)</div>
            <ul className="space-y-1">
              {LAST_WEEK_CONTEXT.openThreads.map((thread, i) => (
                <li key={i} className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
                  <span className="text-amber-500/50">⚠</span>
                  {thread}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Arrow indicating flow */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ArrowRight className="h-5 w-5" />
          <span className="text-sm font-medium">Now add THIS week's updates</span>
          <ArrowRight className="h-5 w-5" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Work Delta</CardTitle>
          <CardDescription>What's new this week?</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="course">Class Name</Label>
                <Input id="course" name="course" value={formData.course} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next_topic">Next Syllabus Topic</Label>
                <Input id="next_topic" name="next_topic" value={formData.next_topic} onChange={handleChange} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="work_changes">What changed at work? (Bullets)</Label>
              <Textarea
                id="work_changes"
                name="work_changes"
                value={formData.work_changes}
                onChange={handleChange}
                required
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="constraint_focus">Constraint Focus This Week</Label>
              <Input id="constraint_focus" name="constraint_focus" value={formData.constraint_focus} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capstone_milestone">Capstone Milestone Status</Label>
              <Input id="capstone_milestone" name="capstone_milestone" value={formData.capstone_milestone} onChange={handleChange} required />
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={isSubmitting} size="lg">
                {isSubmitting ? "Saving..." : "Save Delta & Generate Brief →"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
