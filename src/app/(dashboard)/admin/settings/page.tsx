"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  Shield,
  Globe,
  Mail,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";

interface IntegrationSettings {
  email_notifications_enabled: string;
  slack_notifications_enabled: string;
  slack_webhook_url: string;
  email_from_name: string;
  app_base_url: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<IntegrationSettings>({
    email_notifications_enabled: "true",
    slack_notifications_enabled: "true",
    slack_webhook_url: "",
    email_from_name: "GoalTracker",
    app_base_url: "",
  });
  const [hasResendKey, setHasResendKey] = useState(false);
  const [hasSlackEnvUrl, setHasSlackEnvUrl] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [fromNameInput, setFromNameInput] = useState("GoalTracker");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setHasResendKey(data.hasResendKey);
        setHasSlackEnvUrl(data.hasSlackEnvUrl);
        setFromNameInput(data.settings.email_from_name || "GoalTracker");
        setBaseUrlInput(data.settings.app_base_url || "");
      }
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            email_notifications_enabled: settings.email_notifications_enabled,
            slack_notifications_enabled: settings.slack_notifications_enabled,
            slack_webhook_url: webhookUrlInput || settings.slack_webhook_url,
            email_from_name: fromNameInput,
            app_base_url: baseUrlInput,
          },
        }),
      });
      if (res.ok) {
        toast.success("Settings saved");
        await fetchSettings();
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    setTestingEmail(true);
    try {
      const res = await fetch("/api/settings/test-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "email" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message || "Test email failed");
      }
    } catch {
      toast.error("Test email failed");
    } finally {
      setTestingEmail(false);
    }
  }

  async function handleTestSlack() {
    setTestingSlack(true);
    try {
      const res = await fetch("/api/settings/test-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "slack" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message || "Test Slack notification failed");
      }
    } catch {
      toast.error("Test Slack notification failed");
    } finally {
      setTestingSlack(false);
    }
  }

  const emailConfigured = hasResendKey;
  const slackConfigured =
    hasSlackEnvUrl || (settings.slack_webhook_url && settings.slack_webhook_url !== "");

  if (loading) {
    return (
      <div>
        <Header title="Settings" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Settings" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* System Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">Max Goals per Employee</span>
                <Badge variant="secondary">8</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">Min Weightage per Goal</span>
                <Badge variant="secondary">10%</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">Total Weightage Required</span>
                <Badge variant="secondary">100%</Badge>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm">UoM Types</span>
                <div className="flex gap-1">
                  <Badge variant="outline">Min</Badge>
                  <Badge variant="outline">Max</Badge>
                  <Badge variant="outline">Timeline</Badge>
                  <Badge variant="outline">Zero</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">Auth Provider</span>
                <Badge>Firebase</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">Google SSO</span>
                <Badge className="bg-green-100 text-green-800">Enabled</Badge>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm">Database</span>
                <Badge>Supabase PostgreSQL</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Email Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Notifications
                {emailConfigured ? (
                  <Badge className="bg-green-100 text-green-800 ml-auto">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="ml-auto">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Configured
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Enable Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Send emails on goal submission, approval, rejection, and escalations
                  </p>
                </div>
                <Switch
                  checked={settings.email_notifications_enabled === "true"}
                  onCheckedChange={(checked: boolean) =>
                    setSettings((s) => ({
                      ...s,
                      email_notifications_enabled: checked ? "true" : "false",
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">From Name</Label>
                <Input
                  value={fromNameInput}
                  onChange={(e) => setFromNameInput(e.target.value)}
                  placeholder="GoalTracker"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t">
                <div>
                  <span className="text-sm font-medium">Resend API Key</span>
                  <p className="text-xs text-muted-foreground">
                    {hasResendKey
                      ? "Set via RESEND_API_KEY environment variable"
                      : "Add RESEND_API_KEY to your environment variables"}
                  </p>
                </div>
                {hasResendKey ? (
                  <Badge className="bg-green-100 text-green-800">Set</Badge>
                ) : (
                  <Badge variant="outline">Missing</Badge>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleTestEmail}
                disabled={!emailConfigured || testingEmail}
                className="w-full"
              >
                {testingEmail ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Test Email
              </Button>
            </CardContent>
          </Card>

          {/* Slack Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Slack
                {slackConfigured ? (
                  <Badge className="bg-green-100 text-green-800 ml-auto">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="ml-auto">
                    Not Configured
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Enable Slack Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Send notifications to a Slack channel for key events
                  </p>
                </div>
                <Switch
                  checked={settings.slack_notifications_enabled === "true"}
                  onCheckedChange={(checked: boolean) =>
                    setSettings((s) => ({
                      ...s,
                      slack_notifications_enabled: checked ? "true" : "false",
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Incoming Webhook URL</Label>
                <Input
                  type="url"
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  placeholder={
                    settings.slack_webhook_url
                      ? settings.slack_webhook_url
                      : "https://hooks.slack.com/services/T.../B.../xxxx"
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {hasSlackEnvUrl
                    ? "Fallback URL set via SLACK_WEBHOOK_URL env var. DB value takes priority."
                    : "Get this from your Slack App > Incoming Webhooks > Add New Webhook to Workspace."}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleTestSlack}
                disabled={!slackConfigured || testingSlack}
                className="w-full"
              >
                {testingSlack ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Test to Slack
              </Button>
            </CardContent>
          </Card>

          {/* General Settings */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                General Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Application Base URL</Label>
                  <Input
                    value={baseUrlInput}
                    onChange={(e) => setBaseUrlInput(e.target.value)}
                    placeholder="https://goaltracker.vercel.app"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for deep links in email and Slack notifications
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Notification Events</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { event: "Goal Sheet Submitted", target: "Manager", channels: "Email + Slack + In-App" },
                    { event: "Goal Sheet Approved", target: "Employee", channels: "Email + Slack + In-App" },
                    { event: "Goal Sheet Rejected", target: "Employee", channels: "Email + Slack + In-App" },
                    { event: "Escalation Created", target: "Target + Manager", channels: "Email + Slack + In-App" },
                    { event: "Check-in Reminder", target: "Manager", channels: "Email + Slack (Weekly Cron)" },
                  ].map((item) => (
                    <div key={item.event} className="flex items-center justify-between p-2.5 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{item.event}</p>
                        <p className="text-xs text-muted-foreground">To: {item.target}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {item.channels}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
