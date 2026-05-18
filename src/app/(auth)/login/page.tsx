"use client";

import { useState, useRef, useEffect } from "react";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  type AuthError,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useAuthStore } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { Loader2, Users, Shield, UserCheck, ArrowLeft, Info } from "lucide-react";
import type { UserRole } from "@/types";

const ROLE_CONFIG: Record<UserRole, { label: string; description: string; color: string; icon: React.ReactNode; bgGradient: string }> = {
  employee: {
    label: "Employee",
    description: "Create & track your goals",
    color: "border-blue-500 bg-blue-50 hover:bg-blue-100",
    icon: <Users className="h-8 w-8 text-blue-600" />,
    bgGradient: "from-blue-50 to-slate-50",
  },
  manager: {
    label: "Manager",
    description: "Review & approve team goals",
    color: "border-emerald-500 bg-emerald-50 hover:bg-emerald-100",
    icon: <UserCheck className="h-8 w-8 text-emerald-600" />,
    bgGradient: "from-emerald-50 to-slate-50",
  },
  admin: {
    label: "Admin / HR",
    description: "Monitor & manage the system",
    color: "border-purple-500 bg-purple-50 hover:bg-purple-100",
    icon: <Shield className="h-8 w-8 text-purple-600" />,
    bgGradient: "from-purple-50 to-slate-50",
  },
};

const ROLE_LABELS: Record<string, string> = {
  employee: "Employee",
  manager: "Manager",
  admin: "Admin / HR",
};

function getFirebaseErrorMessage(err: unknown): string {
  const code = (err as AuthError)?.code || "";
  switch (code) {
    case "auth/configuration-not-found":
      return "Email/Password sign-in is not enabled. Go to Firebase Console > Authentication > Sign-in method and enable it.";
    case "auth/email-already-in-use":
      return "This email is already registered. Try logging in instead.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed. Please try again.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    default:
      return (err as Error)?.message || "Authentication failed.";
  }
}

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { setUser, setIsAuthenticating } = useAuthStore();
  const router = useRouter();

  const isLocked = lockoutSeconds > 0;
  useEffect(() => {
    if (!isLocked) return;
    lockoutTimer.current = setInterval(() => {
      setLockoutSeconds((s) => {
        if (s <= 1) {
          if (lockoutTimer.current) clearInterval(lockoutTimer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (lockoutTimer.current) clearInterval(lockoutTimer.current); };
  }, [isLocked]);

  function handleFailedAttempt() {
    const attempts = failedAttempts + 1;
    setFailedAttempts(attempts);
    if (attempts >= 3) {
      const delay = Math.min(attempts * 5, 30);
      setLockoutSeconds(delay);
    }
  }

  const isLockedOut = lockoutSeconds > 0;

  async function syncUser(idToken: string, opts?: { displayName?: string; role?: UserRole; department?: string }) {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken,
        name: opts?.displayName,
        role: opts?.role,
        department: opts?.department,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (data.error === "ROLE_MISMATCH") {
        await signOut(auth).catch(() => {});
        const actualLabel = ROLE_LABELS[data.actualRole] || data.actualRole;
        throw new Error(
          `This account is registered as "${actualLabel}". Please go back and select the ${actualLabel} portal to sign in.`
        );
      }
      throw new Error(data.error || "Failed to verify user");
    }

    setUser(data.user);
    router.push(`/${data.user.role}`);
  }

  async function handleGoogleLogin() {
    if (isLockedOut) return;
    setLoading(true);
    setError("");
    setIsAuthenticating(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      await syncUser(idToken, {
        displayName: result.user.displayName || undefined,
        role: selectedRole || undefined,
        department: department || undefined,
      });
      setFailedAttempts(0);
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
      handleFailedAttempt();
    } finally {
      setLoading(false);
      setIsAuthenticating(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (isLockedOut) return;
    setLoading(true);
    setError("");
    setIsAuthenticating(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken();
      await syncUser(idToken, {
        role: selectedRole || undefined,
      });
      setFailedAttempts(0);
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
      handleFailedAttempt();
    } finally {
      setLoading(false);
      setIsAuthenticating(false);
    }
  }

  async function handleEmailRegister(e: React.FormEvent) {
    e.preventDefault();
    if (isLockedOut) return;
    setLoading(true);
    setError("");
    setIsAuthenticating(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) {
        await updateProfile(result.user, { displayName: name.trim() });
      }
      const idToken = await result.user.getIdToken(true);
      await syncUser(idToken, {
        displayName: name.trim() || undefined,
        role: selectedRole || undefined,
        department: department || undefined,
      });
      setFailedAttempts(0);
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
      handleFailedAttempt();
    } finally {
      setLoading(false);
      setIsAuthenticating(false);
    }
  }

  if (!selectedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50/50 via-slate-50 to-blue-50/30 p-4">
        <div className="w-full max-w-2xl animate-in fade-in duration-500">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Image src="/atomberg-logo.svg" alt="Atomberg" width={48} height={48} className="rounded-xl" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">GoalTracker</h1>
              <p className="text-sm text-muted-foreground">Atomberg Goal Setting & Tracking Portal</p>
            </div>
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Select Your Portal</CardTitle>
              <CardDescription>Choose your role to sign in to the correct dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(Object.keys(ROLE_CONFIG) as UserRole[]).map((role) => {
                  const config = ROLE_CONFIG[role];
                  return (
                    <button
                      key={role}
                      onClick={() => { setSelectedRole(role); setError(""); }}
                      className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer ${config.color}`}
                    >
                      {config.icon}
                      <div className="text-center">
                        <p className="font-semibold text-lg">{config.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-dashed flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Select your portal to sign in or register with that role.
                  Each role has a separate dashboard with specific capabilities.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span>Employee: Create & update goals</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Manager: Approve & review goals</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-purple-500" />
                <span>Admin: Monitor & manage system</span>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Atomberg Technologies &middot; AtomQuest Hackathon 1.0
          </p>
        </div>
      </div>
    );
  }

  const roleConfig = ROLE_CONFIG[selectedRole];
  const roleColorClasses: Record<UserRole, string> = {
    employee: "bg-blue-600 hover:bg-blue-700",
    manager: "bg-emerald-600 hover:bg-emerald-700",
    admin: "bg-purple-600 hover:bg-purple-700",
  };

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${roleConfig.bgGradient} p-4`}>
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-400">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Image src="/atomberg-logo.svg" alt="Atomberg" width={48} height={48} className="rounded-xl" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">GoalTracker</h1>
            <p className="text-sm text-muted-foreground">Atomberg Goal Portal</p>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center pb-3">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedRole(null); setError(""); }}
                className="text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <div className="flex items-center gap-2">
                {roleConfig.icon}
                <span className="font-semibold text-sm">{roleConfig.label} Portal</span>
              </div>
              <div className="w-16" />
            </div>
            <CardTitle className="mt-2">Welcome, {roleConfig.label}</CardTitle>
            <CardDescription>{roleConfig.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-11 gap-2"
              onClick={handleGoogleLogin}
              disabled={loading || isLockedOut}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className={`w-full ${roleColorClasses[selectedRole]}`} disabled={loading || isLockedOut}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {isLockedOut ? `Locked (${lockoutSeconds}s)` : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="register">
                <form onSubmit={handleEmailRegister} className="space-y-3">
                  <div>
                    <Label htmlFor="reg-name">Full Name</Label>
                    <Input
                      id="reg-name"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="Min 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <Label htmlFor="reg-dept">Department</Label>
                    <Select value={department} onValueChange={(v) => v && setDepartment(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                        <SelectItem value="Product">Product</SelectItem>
                        <SelectItem value="Design">Design</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
                    {roleConfig.icon}
                    <div>
                      <p className="text-sm font-medium">Registering as: {roleConfig.label}</p>
                      <p className="text-xs text-muted-foreground">{roleConfig.description}</p>
                    </div>
                  </div>
                  <Button type="submit" className={`w-full ${roleColorClasses[selectedRole]}`} disabled={loading || isLockedOut}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {isLockedOut ? `Locked (${lockoutSeconds}s)` : `Create ${roleConfig.label} Account`}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {isLockedOut && (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-md flex items-center gap-2">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Too many attempts. Try again in {lockoutSeconds}s
              </div>
            )}

            {error && !isLockedOut && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Atomberg Technologies &middot; AtomQuest Hackathon 1.0
        </p>
      </div>
    </div>
  );
}
