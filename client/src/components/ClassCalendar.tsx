import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, FileText } from "lucide-react";
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
  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Class Schedule</h3>
      <div className="space-y-2">
        {syllabus.sessions.map((session) => {
          const isPast = session.date < currentDate;
          const isSelected = session.date === selectedDate;
          const isNext = session.date === getNextSession(currentDate)?.date;
          const hasBrief = briefedSessions.includes(session.date);

          return (
            <div
              key={session.date}
              onClick={() => onSelectSession(session as Session)}
              className={cn(
                "group flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:bg-accent/50",
                isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-transparent bg-muted/30",
                isPast && !isSelected && "opacity-60 grayscale"
              )}
            >
              <div className="mt-0.5 relative">
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
              
              <div className="flex-1 min-w-0">
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
            </div>
          );
        })}
      </div>
    </Card>
  );
}
