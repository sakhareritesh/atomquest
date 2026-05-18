"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { ThrustArea } from "@/types";

export default function ThrustAreasPage() {
  const [areas, setAreas] = useState<ThrustArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ThrustArea | null>(null);
  const [form, setForm] = useState({ name: "", description: "", department: "All" });

  async function fetchAreas() {
    try {
      const res = await fetch("/api/thrust-areas");
      if (!res.ok) {
        toast.error("Failed to load thrust areas");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setAreas(data.thrustAreas || []);
    } catch {
      toast.error("Failed to load thrust areas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAreas();
  }, []);

  function openEdit(area: ThrustArea) {
    setEditing(area);
    setForm({ name: area.name, description: area.description, department: area.department });
    setOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", department: "All" });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { ...form, id: editing.id, is_active: editing.is_active } : form;
      const res = await fetch("/api/thrust-areas", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(editing ? "Updated successfully" : "Created successfully");
        setOpen(false);
        fetchAreas();
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch {
      toast.error("Operation failed");
    }
  }

  async function toggleActive(area: ThrustArea) {
    try {
      const res = await fetch("/api/thrust-areas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...area, is_active: !area.is_active }),
      });
      if (res.ok) {
        toast.success(area.is_active ? "Deactivated" : "Activated");
        fetchAreas();
      } else {
        const err = await res.json().catch(() => ({ error: "Failed to update" }));
        toast.error(err.error);
      }
    } catch {
      toast.error("Failed to update thrust area");
    }
  }

  return (
    <div>
      <Header title="Thrust Areas" />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Manage goal categories and thrust areas</p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />} onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add Thrust Area
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit" : "Add"} Thrust Area</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Department</Label>
                  <Input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="All"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editing ? "Update" : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((area) => (
                  <TableRow key={area.id}>
                    <TableCell className="font-medium">{area.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                      {area.description}
                    </TableCell>
                    <TableCell>{area.department}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={area.is_active ? "text-green-700" : "text-red-700"}
                        onClick={() => toggleActive(area)}
                        style={{ cursor: "pointer" }}
                      >
                        {area.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(area)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {areas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No thrust areas found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
