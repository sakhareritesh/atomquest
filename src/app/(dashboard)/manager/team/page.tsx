"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users } from "lucide-react";
import { useAuthStore } from "@/hooks/use-auth";
import { getStatusColor } from "@/lib/utils/score-calculator";
import { formatDateTime } from "@/lib/utils/date-utils";
import type { GoalSheet } from "@/types";

export default function TeamPage() {
  const { user } = useAuthStore();
  const [sheets, setSheets] = useState<GoalSheet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeam = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/goal-sheets?manager_id=${user.id}`);
      const data = await res.json();
      setSheets(data.goalSheets || []);
    } catch {
      console.error("Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading team...</div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Team Goals Overview" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            View all team members&apos; goal sheets and progress
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Team Members ({sheets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sheets.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Goals</TableHead>
                      <TableHead>Total Weightage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Cycle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sheets.map((sheet) => (
                      <TableRow key={sheet.id}>
                        <TableCell>
                          <div className="font-medium">{sheet.employee?.name}</div>
                          {sheet.employee?.department && (
                            <div className="text-xs text-muted-foreground">{sheet.employee.department}</div>
                          )}
                        </TableCell>
                        <TableCell>{sheet.goals?.length || 0}</TableCell>
                        <TableCell>
                          {sheet.goals?.reduce((s, g) => s + g.weightage, 0) || 0}%
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(sheet.status)}>
                            {sheet.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {sheet.submitted_at ? formatDateTime(sheet.submitted_at) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {sheet.cycle?.name || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center py-12 text-muted-foreground">
                No team members assigned to you yet. Ask admin to set reporting hierarchy.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
