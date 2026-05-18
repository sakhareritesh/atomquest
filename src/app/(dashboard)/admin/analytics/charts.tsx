"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from "recharts";

const COLORS = ["#0d9488", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#16a34a", "#ec4899"];

interface AnalyticsData {
  thrustAreaDistribution: { name: string; value: number }[];
  uomDistribution: { name: string; value: number }[];
  statusDistribution: { name: string; value: number }[];
  qoqTrends: { quarter: string; avgScore: number; completed: number; total: number }[];
  managerEffectiveness: {
    name: string;
    teamSize: number;
    approvedSheets: number;
    checkinsCompleted: number;
  }[];
  departmentRates: {
    department: string;
    total: number;
    approved: number;
    rate: number;
  }[];
}

export function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* QoQ Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quarter-on-Quarter Trends</CardTitle>
          <CardDescription>Average score and completion count per quarter</CardDescription>
        </CardHeader>
        <CardContent>
          {data.qoqTrends.some((q) => q.total > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.qoqTrends}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: "Score %", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: "Count", angle: 90, position: "insideRight", style: { fontSize: 11 } }} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgScore"
                  stroke="#0d9488"
                  fill="url(#scoreGradient)"
                  name="Avg Score %"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#0d9488" }}
                  activeDot={{ r: 6 }}
                  animationDuration={1000}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="completed"
                  stroke="#2563eb"
                  fill="url(#completedGradient)"
                  name="Completed"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#2563eb" }}
                  activeDot={{ r: 6 }}
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <svg className="h-8 w-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <p className="text-sm">No achievement data yet</p>
              <p className="text-xs mt-1">Trends will appear after Q1</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thrust Area Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Goals by Thrust Area</CardTitle>
          <CardDescription>Distribution of goals across strategic focus areas</CardDescription>
        </CardHeader>
        <CardContent>
          {data.thrustAreaDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.thrustAreaDistribution}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  animationBegin={200}
                  animationDuration={800}
                >
                  {data.thrustAreaDistribution.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  layout="horizontal"
                  verticalAlign="bottom"
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <svg className="h-8 w-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
              </div>
              <p className="text-sm">No goals created yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Completion Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Department Completion Rates</CardTitle>
          <CardDescription>Percentage of approved goal sheets per department</CardDescription>
        </CardHeader>
        <CardContent>
          {data.departmentRates.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.departmentRates} barCategoryGap="20%">
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, "Completion Rate"]}
                />
                <Bar
                  dataKey="rate"
                  fill="url(#barGradient)"
                  name="Completion %"
                  radius={[6, 6, 0, 0]}
                  animationDuration={800}
                  label={{ position: "top", fontSize: 11, formatter: (v) => `${Number(v).toFixed(0)}%` }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">No department data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manager Effectiveness - converted to chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Manager Effectiveness</CardTitle>
          <CardDescription>Team size, approved sheets, and check-ins by manager</CardDescription>
        </CardHeader>
        <CardContent>
          {data.managerEffectiveness.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={data.managerEffectiveness.slice(0, 8)}
                layout="vertical"
                barCategoryGap="25%"
                margin={{ left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={80}
                  tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + "…" : v}
                />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="teamSize" fill="#0d9488" name="Team Size" radius={[0, 4, 4, 0]} animationDuration={600} />
                <Bar dataKey="approvedSheets" fill="#2563eb" name="Approved" radius={[0, 4, 4, 0]} animationDuration={800} />
                <Bar dataKey="checkinsCompleted" fill="#d97706" name="Check-ins" radius={[0, 4, 4, 0]} animationDuration={1000} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">No managers found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* UoM Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Goals by UoM Type</CardTitle>
          <CardDescription>Unit of measurement distribution across goals</CardDescription>
        </CardHeader>
        <CardContent>
          {data.uomDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.uomDistribution} barCategoryGap="20%">
                <defs>
                  <linearGradient id="uomGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={1} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                  formatter={(value) => [`${value} goals`, "Count"]}
                />
                <Bar
                  dataKey="value"
                  fill="url(#uomGradient)"
                  name="Count"
                  radius={[6, 6, 0, 0]}
                  animationDuration={800}
                  label={{ position: "top", fontSize: 11 }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">No data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Goals by Status</CardTitle>
          <CardDescription>Current status breakdown of all goals in cycle</CardDescription>
        </CardHeader>
        <CardContent>
          {data.statusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.statusDistribution}
                  cx="50%"
                  cy="45%"
                  outerRadius={90}
                  innerRadius={40}
                  paddingAngle={3}
                  dataKey="value"
                  animationBegin={200}
                  animationDuration={800}
                >
                  {data.statusDistribution.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                  formatter={(value, name) => [`${value} goals`, name]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  layout="horizontal"
                  verticalAlign="bottom"
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">No data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
