"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DailyTotal } from "@/lib/daily-stats/queries";

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

/**
 * Two charts, each answering one operational question the specification
 * itself names (Section 55): "how much work is moving through each day" and
 * "how much revenue came in, by currency" — not decoration. Revenue currency
 * series are drawn separately, never summed (docs/REQUIREMENTS.md D1).
 */
export function DailyStatsCharts({ totals }: { totals: readonly DailyTotal[] }) {
  if (totals.length === 0) {
    return <p className="text-[13px] text-ink-faint">No entries in this range yet.</p>;
  }

  const currencies = [...new Set(totals.flatMap((day) => Object.keys(day.revenueByCurrency)))];
  const chartData = totals.map((day) => ({
    label: dayFormat.format(new Date(`${day.date}T00:00:00.000Z`)),
    orders: day.orders,
    completed: day.completed,
    ...Object.fromEntries(currencies.map((currency) => [currency, day.revenueByCurrency[currency] ?? 0])),
  }));

  const lineColors = ["#18181b", "#71717a", "#a1a1aa"];

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Orders vs completed / day</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e4e4e7" }} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 3 }} />
            <Bar dataKey="orders" fill="#a1a1aa" name="Orders" radius={[2, 2, 0, 0]} />
            <Bar dataKey="completed" fill="#18181b" name="Completed" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Revenue / day</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e4e4e7" }} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 3 }} />
            {currencies.map((currency, index) => (
              <Line
                key={currency}
                type="monotone"
                dataKey={currency}
                name={currency}
                stroke={lineColors[index % lineColors.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
