import { BookOpen, CalendarRange, Users } from "lucide-react";
import { useDataStore } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScopeBarProps {
  compact?: boolean;
}

export function ScopeBar({ compact }: ScopeBarProps) {
  const { data, scope, setScope } = useDataStore();
  const sections = data.sections.filter(
    (section) => section.periodId === scope.periodId && !section.archived,
  );
  const subjects = data.subjects.filter((subject) => !subject.archived);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-xl border border-border/80 bg-card p-1 shadow-sm",
        compact ? "w-full" : "",
      )}
    >
      <span className="hidden items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground xl:flex">
        <CalendarRange className="size-3.5" />
        Scope
      </span>
      <Select
        value={scope.periodId}
        onValueChange={(value) => {
          const firstSection = data.sections.find(
            (section) => section.periodId === value && !section.archived,
          );
          setScope({
            periodId: value,
            sectionId: firstSection?.id ?? scope.sectionId,
          });
        }}
      >
        <SelectTrigger className="h-8 min-w-[150px] gap-1.5 border-0 bg-transparent px-2.5 text-xs font-medium shadow-none focus:ring-0">
          <CalendarRange className="size-3.5 text-muted-foreground xl:hidden" />
          <SelectValue placeholder="Academic period" />
        </SelectTrigger>
        <SelectContent>
          {data.periods
            .filter((period) => !period.archived)
            .map((period) => (
              <SelectItem key={period.id} value={period.id}>
                {period.academicYear} · {period.term}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <span className="h-5 w-px bg-border" />

      <Select
        value={scope.sectionId}
        onValueChange={(value) => setScope({ sectionId: value })}
      >
        <SelectTrigger className="h-8 min-w-[150px] gap-1.5 border-0 bg-transparent px-2.5 text-xs font-medium shadow-none focus:ring-0">
          <Users className="size-3.5 text-muted-foreground xl:hidden" />
          <SelectValue placeholder="Section" />
        </SelectTrigger>
        <SelectContent>
          {sections.map((section) => (
            <SelectItem key={section.id} value={section.id}>
              {section.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="h-5 w-px bg-border" />

      <Select
        value={scope.subjectId}
        onValueChange={(value) => setScope({ subjectId: value })}
      >
        <SelectTrigger className="h-8 min-w-[140px] gap-1.5 border-0 bg-transparent px-2.5 text-xs font-medium shadow-none focus:ring-0">
          <BookOpen className="size-3.5 text-muted-foreground xl:hidden" />
          <SelectValue placeholder="Subject" />
        </SelectTrigger>
        <SelectContent>
          {subjects.map((subject) => (
            <SelectItem key={subject.id} value={subject.id}>
              {subject.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
