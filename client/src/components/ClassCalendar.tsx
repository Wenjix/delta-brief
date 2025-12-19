import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, FileText, Info, BookOpen, Target, MessageSquare, GraduationCap } from "lucide-react";
import syllabus from "../lib/syllabus.json";

export interface Session {
  date: string;
  topic: string;
  learning_objectives: string[];
  frameworks: { name: string; bullets: string[] }[];
  class_discussion_prompts: string[];
  assignment_hook: string;
}

interface ClassCalendarProps {
  selectedDate: string;
  onSelectSession: (session: Session) => void;
  currentDate?: string; // Optional override for demo purposes
  briefedSessions?: string[]; // List of session dates that have briefs
}

// Helper to get local ISO date string (YYYY-MM-DD)
export function getLocalISODate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getNextSession(currentDateStr: string = getLocalISODate()): Session | null {
  // Sort sessions by date
  const sortedSessions = [...syllabus.sessions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Find first session that is today or in the future
  // Logic: If a class is TODAY, it is "Next Up" (the one you need to prep for)
  return sortedSessions.find(s => {
    return s.date >= currentDateStr;
  }) || sortedSessions[sortedSessions.length - 1]; // Fallback to last session if all past
}

export function ClassCalendar({ selectedDate, onSelectSession, currentDate = getLocalISODate(), briefedSessions = [] }: ClassCalendarProps) {
  const [detailSession, setDetailSession] = useState<Session | null>(null);
  const [showSampleSyllabus, setShowSampleSyllabus] = useState(false);

  return (
    <>
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider shrink-0">Class Schedule</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] font-medium text-muted-foreground hover:text-foreground px-2"
            onClick={() => setShowSampleSyllabus(true)}
          >
            <FileText className="h-3 w-3 mr-1" />
            View Syllabus
          </Button>
        </div>
        <div className="space-y-2">
          {syllabus.sessions.map((session) => {
            const isPast = session.date < currentDate;
            const isSelected = session.date === selectedDate;
            const isNext = session.date === getNextSession(currentDate)?.date;
            const hasBrief = briefedSessions.includes(session.date);

            return (
              <div
                key={session.date}
                className={cn(
                  "group flex items-start gap-3 p-3 rounded-lg border transition-all",
                  isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-transparent bg-muted/30",
                  isPast && !isSelected && "opacity-60 grayscale"
                )}
              >
                <div
                  className="mt-0.5 relative cursor-pointer"
                  onClick={() => onSelectSession(session as Session)}
                >
                  {isPast ? (
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                  ) : isSelected ? (
                    <CheckCircle2 className="w-4 h-4 text-primary fill-primary/20" />
                  ) : isNext ? (
                    <Clock className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground/40" />
                  )}
                </div>

                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onSelectSession(session as Session)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                    )}>
                      {session.date}
                    </span>
                    <div className="flex items-center gap-1">
                      {hasBrief && (
                        <span className="flex items-center gap-0.5 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
                          <FileText className="w-3 h-3" />
                          BRIEFED
                        </span>
                      )}
                      {isNext && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                          NEXT UP
                        </span>
                      )}
                    </div>
                  </div>
                  <h4 className={cn(
                    "text-sm font-medium leading-tight",
                    isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {session.topic}
                  </h4>
                </div>

                {/* Info Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailSession(session as Session);
                  }}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Session Detail Modal */}
      <Dialog open={!!detailSession} onOpenChange={(open) => !open && setDetailSession(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {detailSession?.topic}
            </DialogTitle>
            <DialogDescription>
              {syllabus.course} • {detailSession?.date}
            </DialogDescription>
          </DialogHeader>

          {detailSession && (
            <div className="space-y-6 pt-4">
              {/* Learning Objectives */}
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  <Target className="h-4 w-4" />
                  Learning Objectives
                </h4>
                <ul className="space-y-2">
                  {detailSession.learning_objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary font-bold">{i + 1}.</span>
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Frameworks */}
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  <BookOpen className="h-4 w-4" />
                  Key Frameworks
                </h4>
                <div className="space-y-4">
                  {detailSession.frameworks.map((fw, i) => (
                    <div key={i} className="bg-muted/30 rounded-lg p-3">
                      <h5 className="font-semibold text-sm mb-2">{fw.name}</h5>
                      <div className="flex flex-wrap gap-1">
                        {fw.bullets.map((bullet, j) => (
                          <span key={j} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                            {bullet}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discussion Prompts */}
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  <MessageSquare className="h-4 w-4" />
                  Class Discussion Prompts
                </h4>
                <ul className="space-y-2">
                  {detailSession.class_discussion_prompts.map((prompt, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground italic">
                      <span className="text-muted-foreground/50">•</span>
                      "{prompt}"
                    </li>
                  ))}
                </ul>
              </div>

              {/* Assignment Hook */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary mb-2">
                  <GraduationCap className="h-4 w-4" />
                  Capstone Connection
                </h4>
                <p className="text-sm">{detailSession.assignment_hook}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sample Syllabus Modal */}
      <Dialog open={showSampleSyllabus} onOpenChange={setShowSampleSyllabus}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-primary" />
              Sample MBA Syllabus
            </DialogTitle>
            <DialogDescription className="text-left space-y-1">
              <div className="font-semibold text-foreground">COLUMBIA BUSINESS SCHOOL • SPRING 2026 • B TERM</div>
              <div className="text-sm">MGMT 8569.001 — Organizational AI: Transforming how organizations operate</div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Course Overview */}
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <h4 className="font-semibold text-sm mb-2">Course Description</h4>
              <p className="text-sm text-muted-foreground">
                This course explores how AI is fundamentally reshaping organizational operations, from structured workflows to unstructured work.
                Students will learn to apply product management principles to AI transformation, design new organizational structures, and lead change in an AI-first world.
              </p>
            </div>

            {/* Session Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Week</th>
                    <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Module</th>
                    <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Topic</th>
                    <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Key Concepts</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-3 font-mono text-xs">Week 1</td>
                    <td className="p-3" rowSpan={2}>
                      <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                        Part 1: AI Fundamentals
                      </span>
                    </td>
                    <td className="p-3 font-medium">AI Transformation State of Play</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      Define: digitization, automation + organizational AI; Consumer AI vs Enterprise AI; Product Led Transformation
                    </td>
                  </tr>
                  <tr className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-3 font-mono text-xs">Week 2</td>
                    <td className="p-3 font-medium">Current State AI in the Market</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      3 companies' AI transformation approaches; Design AI transformation outcome metrics
                    </td>
                  </tr>
                  <tr className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-3 font-mono text-xs">Week 3</td>
                    <td className="p-3" rowSpan={2}>
                      <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
                        Part 2: Transforming Work
                      </span>
                    </td>
                    <td className="p-3 font-medium">Structured vs Unstructured Work</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      Rate of disruption for structured workflows; Innovation needed for unstructured workflows
                    </td>
                  </tr>
                  <tr className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-3 font-mono text-xs">Week 4</td>
                    <td className="p-3 font-medium">Applying Product Management to Workflows</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      AI transformation requires product mindset; Shift from PMO to Product Led Transformation
                    </td>
                  </tr>
                  <tr className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-3 font-mono text-xs">Week 5</td>
                    <td className="p-3" rowSpan={2}>
                      <span className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                        Part 3: Organizational Change
                      </span>
                    </td>
                    <td className="p-3 font-medium">Organizational Change from AI</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      Fast, flat, networked organizations; Microsoft "Frontier Firm" model
                    </td>
                  </tr>
                  <tr className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-3 font-mono text-xs">Week 6</td>
                    <td className="p-3 font-medium">Reimagining G&A Functions</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      Project to product mindset; Upskilling, new roles, new outcomes for AI-first workflows
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Key Readings */}
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                <BookOpen className="h-4 w-4" />
                Featured Case Studies & Readings
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-muted/20 rounded-lg p-3 text-sm">
                  <span className="font-medium">Tobi Lütke (Shopify) AI Memo</span>
                  <span className="text-muted-foreground ml-2">— Enterprise AI strategy</span>
                </div>
                <div className="bg-muted/20 rounded-lg p-3 text-sm">
                  <span className="font-medium">Duo Lingo AI Implementation</span>
                  <span className="text-muted-foreground ml-2">— Consumer vs Enterprise AI</span>
                </div>
                <div className="bg-muted/20 rounded-lg p-3 text-sm">
                  <span className="font-medium">Meta "Naomisms"</span>
                  <span className="text-muted-foreground ml-2">— Product leadership at scale</span>
                </div>
                <div className="bg-muted/20 rounded-lg p-3 text-sm">
                  <span className="font-medium">Microsoft Future of Work 2025</span>
                  <span className="text-muted-foreground ml-2">— The Frontier Firm</span>
                </div>
                <div className="bg-muted/20 rounded-lg p-3 text-sm">
                  <span className="font-medium">WPP AI Transformation</span>
                  <span className="text-muted-foreground ml-2">— G&A function redesign</span>
                </div>
                <div className="bg-muted/20 rounded-lg p-3 text-sm">
                  <span className="font-medium">HBR: AI in Structured vs Unstructured Work</span>
                  <span className="text-muted-foreground ml-2">— Forthcoming article</span>
                </div>
              </div>
            </div>

            {/* Executive Podcasts */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary mb-3">
                <MessageSquare className="h-4 w-4" />
                Executive Podcast Series
              </h4>
              <div className="flex flex-wrap gap-2">
                {["OpenAI CPO", "Atlassian", "Meta", "CBRE", "Cursor", "McKinsey", "IDEO", "Shopify"].map((guest, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {guest}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
