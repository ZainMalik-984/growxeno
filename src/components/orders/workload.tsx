import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";
import type { Workload, WorkloadLine } from "@/lib/outsourced-workers/workload";

/**
 * A worker's current workload (2026-11-11): active tasks, then per unit
 * "2,500 / 10,000 watch hours delivered · 7,500 left" with a bar. Used on the
 * worker's page, their dashboard, and (compact) when choosing who to assign.
 */

const number = new Intl.NumberFormat("en-US");

export function WorkloadLines({ workload, className }: { workload: Workload; className?: string }) {
  if (workload.active === 0) {
    return <p className={cn("text-[13px] text-zinc-500", className)}>No active tasks right now.</p>;
  }
  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-[13px] text-zinc-600">
        <span className="text-2xl font-semibold tabular-nums text-zinc-900">{workload.active}</span>{" "}
        active {workload.active === 1 ? "task" : "tasks"}
        {workload.notAccepted > 0 ? <span className="text-zinc-500"> · {workload.notAccepted} not accepted yet</span> : null}
      </p>
      {workload.lines.map((line) => (
        <WorkloadRow key={line.metricType} line={line} />
      ))}
    </div>
  );
}

function WorkloadRow({ line }: { line: WorkloadLine }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-medium capitalize text-zinc-800">
          {line.unit} <span className="font-normal normal-case text-zinc-500">· {line.tasks} {line.tasks === 1 ? "task" : "tasks"}</span>
        </span>
        <span className="tabular text-xs font-semibold text-zinc-700">{line.percent}%</span>
      </div>
      <ProgressBar percent={line.percent} className="mt-1.5" />
      <p className="mt-1 text-xs tabular-nums text-zinc-600">
        <span className="font-semibold text-zinc-900">{number.format(line.delivered)}</span> / {number.format(line.required)} delivered
        <span className="text-zinc-400"> · </span>
        <span className="font-medium text-amber-700">{number.format(line.remaining)} left</span>
      </p>
    </div>
  );
}

/** One line for the assign list: the load in this item's unit, plus how many tasks in all. */
export function WorkloadHint({ workload, metricType }: { workload: Workload; metricType: string | null }) {
  if (workload.active === 0) return <span className="text-emerald-700">Free · no active tasks</span>;
  const line = metricType ? workload.lines.find((l) => l.metricType === metricType) : undefined;
  return (
    <span>
      {workload.active} active
      {line ? (
        <>
          {" · "}
          <span className="tabular-nums">
            {number.format(line.delivered)}/{number.format(line.required)} {line.unit}
          </span>{" "}
          <span className="font-medium text-amber-700">({number.format(line.remaining)} left)</span>
        </>
      ) : null}
    </span>
  );
}
