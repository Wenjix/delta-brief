import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock } from "lucide-react";
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
}

export function getNextSession(currentDateStr: string = new Date().toISOString().split('T')[0]): Session | null {
  const today = new Date(currentDateStr);
  
  // Sort sessions by date
  const sortedSessions = [...syllabus.sessions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Find first session that is today or in the future
  return sortedSessions.find(s => {
    const sessionDate = new Date(s.date);
    // Compare just the dates, ignoring time
    return sessionDate >= today || sessionDate.toISOString().split('T')[0] === currentDateStr;
  }) || sortedSessions[sortedSessions.length - 1]; // Fallback to last session if all past
}

export function ClassCalendar({ selectedDate, onSelectSession, currentDate = new Date().toISOString().split('T')[0] }: ClassCalendarProps) {
  const today = new Date(currentDate);

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Class Schedule</h3>
      <div className="space-y-2">
        {syllabus.sessions.map((session) => {
          const sessionDate = new Date(session.date);
          const isPast = sessionDate < today && session.date !== currentDate;
          const isSelected = session.date === selectedDate;
          const isNext = session.date === getNextSession(currentDate)?.date;

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
              <div className="mt-0.5">
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
                  {isNext && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                      NEXT UP
                    </span>
                  )}
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
