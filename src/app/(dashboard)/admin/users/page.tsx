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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/types";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: "",
    role: "employee" as "employee" | "manager" | "admin",
    department: "",
    designation: "",
    manager_id: null as string | null,
  });

  async function fetchUsers() {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) {
        toast.error("Failed to load users");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const managers = users.filter((u) => u.role === "manager" || u.role === "admin");

  function openEdit(user: User) {
    setEditing(user);
    setForm({
      name: user.name,
      role: user.role,
      department: user.department,
      designation: user.designation,
      manager_id: user.manager_id,
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...form }),
      });
      if (res.ok) {
        toast.success("User updated");
        setOpen(false);
        fetchUsers();
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch {
      toast.error("Failed to update user");
    }
  }

  function getManagerName(managerId: string | null) {
    if (!managerId) return "-";
    const manager = users.find((u) => u.id === managerId);
    return manager?.name || "-";
  }

  return (
    <div>
      <Header title="User Management" />
      <div className="p-6 space-y-6">
        <p className="text-sm text-muted-foreground">
          Manage user roles, departments, and reporting hierarchy
        </p>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
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
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => v && setForm({ ...form, role: v as typeof form.role })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Designation</Label>
                <Input
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Reports To (Manager)</Label>
                <Select
                  value={form.manager_id || "none"}
                  onValueChange={(v) => v != null && setForm({ ...form, manager_id: v === "none" ? null : v })}
                  items={[
                    { value: "none", label: "No Manager" },
                    ...managers.map((m) => ({ value: m.id, label: `${m.name} (${m.role})` })),
                  ]}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Manager</SelectItem>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Save Changes</Button>
            </form>
          </DialogContent>
        </Dialog>

        {loading ? (
          <div className="animate-pulse text-muted-foreground">Loading users...</div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Reports To</TableHead>
                  <TableHead className="w-[80px]">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{u.role}</Badge>
                    </TableCell>
                    <TableCell>{u.department}</TableCell>
                    <TableCell>{u.designation}</TableCell>
                    <TableCell>{getManagerName(u.manager_id)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No users found
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
