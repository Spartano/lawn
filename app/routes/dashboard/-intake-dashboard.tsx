import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useParams } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";
import { Id } from "@convex/_generated/dataModel";
import { cn, formatRelativeTime } from "@/lib/utils";
import { teamHomePath } from "@/lib/routes";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useTeamData } from "./-team.data";

type CustomField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  required: boolean;
  options?: string[];
};

type ViewState =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; formId: Id<"intakeForms"> }
  | { kind: "submissions"; formId: Id<"intakeForms"> }
  | { kind: "transcript"; submissionId: Id<"intakeSubmissions"> };

export default function IntakeDashboardPage() {
  const params = useParams({ strict: false });
  const teamSlug = typeof params.teamSlug === "string" ? params.teamSlug : "";

  const { team } = useTeamData({ teamSlug });
  const teamId = team?._id;

  const forms = useQuery(
    api.intakeForms.list,
    teamId ? { teamId } : "skip"
  );
  const createForm = useMutation(api.intakeForms.create);
  const updateForm = useMutation(api.intakeForms.update);
  const removeForm = useMutation(api.intakeForms.remove);

  const [view, setView] = useState<ViewState>({ kind: "list" });
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const handleCopyIntakeUrl = useCallback((slug: string) => {
    const url = `${window.location.origin}/intake/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  }, []);

  const handleDeleteForm = useCallback(
    async (formId: Id<"intakeForms">) => {
      if (!confirm("Delete this intake form and all its submissions?")) return;
      await removeForm({ formId });
    },
    [removeForm]
  );

  if (!teamId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#888]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <DashboardHeader
        paths={[
          { label: teamSlug, href: teamHomePath(teamSlug) },
          { label: "Intake Forms" },
        ]}
      >
        {view.kind === "list" && (
          <Button onClick={() => setView({ kind: "create" })}>
            <Plus className="mr-2 h-4 w-4" />
            New form
          </Button>
        )}
        {view.kind !== "list" && (
          <Button variant="outline" onClick={() => setView({ kind: "list" })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}
      </DashboardHeader>

      <div className="flex-1 overflow-auto p-6">
        {view.kind === "list" && (
          <FormList
            forms={forms}
            onEdit={(formId) => setView({ kind: "edit", formId })}
            onViewSubmissions={(formId) => setView({ kind: "submissions", formId })}
            onCopy={handleCopyIntakeUrl}
            onDelete={handleDeleteForm}
            copiedSlug={copiedSlug}
          />
        )}

        {view.kind === "create" && (
          <FormEditor
            teamId={teamId}
            onCreate={async (data) => {
              await createForm({ teamId, ...data });
              setView({ kind: "list" });
            }}
          />
        )}

        {view.kind === "edit" && (
          <FormEditorExisting
            formId={view.formId}
            onSave={async (data) => {
              await updateForm({ formId: view.formId, ...data });
              setView({ kind: "list" });
            }}
          />
        )}

        {view.kind === "submissions" && (
          <SubmissionList
            formId={view.formId}
            onViewTranscript={(submissionId) =>
              setView({ kind: "transcript", submissionId })
            }
          />
        )}

        {view.kind === "transcript" && (
          <TranscriptViewer submissionId={view.submissionId} />
        )}
      </div>
    </div>
  );
}

function FormList({
  forms,
  onEdit,
  onViewSubmissions,
  onCopy,
  onDelete,
  copiedSlug,
}: {
  forms: Awaited<ReturnType<typeof api.intakeForms.list._returnType>> | undefined;
  onEdit: (formId: Id<"intakeForms">) => void;
  onViewSubmissions: (formId: Id<"intakeForms">) => void;
  onCopy: (slug: string) => void;
  onDelete: (formId: Id<"intakeForms">) => void;
  copiedSlug: string | null;
}) {
  if (forms === undefined) {
    return <p className="text-[#888] text-sm">Loading forms...</p>;
  }

  if (forms.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-[#888]">No intake forms yet.</p>
        <p className="text-sm text-[#888]">
          Create a form to start triaging potential clients with AI.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {forms.map((form) => (
        <div
          key={form._id}
          className="border-2 border-[#1a1a1a] p-4 bg-[#e8e8e0] flex items-start justify-between gap-4"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-[#1a1a1a] truncate">{form.name}</h3>
              <Badge variant={form.isActive ? "success" : "secondary"}>
                {form.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <code className="text-xs text-[#888] font-mono mt-1 block">
              /intake/{form.slug}
            </code>
            <div className="flex items-center gap-3 mt-2 text-xs text-[#888]">
              <span>{form.customFields.length} fields</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCopy(form.slug)}
              title="Copy intake URL"
            >
              {copiedSlug === form.slug ? (
                <Check className="h-4 w-4 text-[#2d5a2d]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(`/intake/${form.slug}`, "_blank")}
              title="Open intake page"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewSubmissions(form._id)}
              title="View submissions"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(form._id)}
              title="Edit form"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-[#dc2626] hover:text-[#dc2626]"
              onClick={() => onDelete(form._id)}
              title="Delete form"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function FormEditor({
  teamId,
  onCreate,
}: {
  teamId: Id<"teams">;
  onCreate: (data: {
    name: string;
    slug: string;
    instructions: string;
    customFields: CustomField[];
    autoSendMediaId?: Id<"videos">;
    autoSendShareOptions?: {
      burnAfterReading: boolean;
      expiresInDays?: number;
    };
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [instructions, setInstructions] = useState("");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [autoSendMediaId, setAutoSendMediaId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value));
    }
  };

  const addField = () => {
    setCustomFields((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: "",
        type: "text",
        required: false,
      },
    ]);
  };

  const updateField = (index: number, updates: Partial<CustomField>) => {
    setCustomFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
  };

  const removeField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug || !instructions) return;
    setIsSaving(true);
    try {
      await onCreate({
        name,
        slug,
        instructions,
        customFields: customFields.filter((f) => f.label.trim()),
        autoSendMediaId: autoSendMediaId
          ? (autoSendMediaId as Id<"videos">)
          : undefined,
        autoSendShareOptions: autoSendMediaId
          ? { burnAfterReading: true }
          : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-black text-[#1a1a1a]">Create intake form</h2>

      <div className="border-2 border-[#1a1a1a] p-5 bg-[#e8e8e0] space-y-4">
        <div>
          <label className="text-sm font-bold text-[#1a1a1a] block mb-1">
            Form name *
          </label>
          <Input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Architecture Consultation"
            required
          />
        </div>
        <div>
          <label className="text-sm font-bold text-[#1a1a1a] block mb-1">
            URL slug *
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#888] font-mono">/intake/</span>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="architecture-consultation"
              required
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <div className="border-2 border-[#1a1a1a] p-5 bg-[#e8e8e0] space-y-4">
        <div>
          <label className="text-sm font-bold text-[#1a1a1a] block mb-1">
            AI qualification instructions *
          </label>
          <p className="text-xs text-[#888] mb-2">
            Tell the AI what criteria to use when qualifying clients. Be specific about budget ranges, project types, timelines, etc.
          </p>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Reject anyone with a budget under $5,000. Reject anyone who can't start within 3 months. Prefer clients who have architectural plans already. Ask about their timeline, budget, and project scope."
            required
            className="min-h-[150px]"
          />
        </div>
      </div>

      <div className="border-2 border-[#1a1a1a] p-5 bg-[#e8e8e0] space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-[#1a1a1a]">
            Custom fields
          </label>
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            <Plus className="mr-1 h-3 w-3" />
            Add field
          </Button>
        </div>

        {customFields.length === 0 && (
          <p className="text-sm text-[#888]">
            No custom fields. Name and email are always collected.
          </p>
        )}

        {customFields.map((field, index) => (
          <div
            key={field.id}
            className="border border-[#1a1a1a]/30 p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Input
                value={field.label}
                onChange={(e) => updateField(index, { label: e.target.value })}
                placeholder="Field label"
                className="flex-1"
              />
              <select
                value={field.type}
                onChange={(e) =>
                  updateField(index, {
                    type: e.target.value as CustomField["type"],
                  })
                }
                className="border-2 border-[#1a1a1a] bg-[#f0f0e8] px-2 py-1.5 text-sm"
              >
                <option value="text">Text</option>
                <option value="textarea">Long text</option>
                <option value="number">Number</option>
                <option value="select">Dropdown</option>
              </select>
              <label className="flex items-center gap-1 text-xs text-[#888]">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) =>
                    updateField(index, { required: e.target.checked })
                  }
                />
                Required
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#dc2626]"
                onClick={() => removeField(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            {field.type === "select" && (
              <Input
                value={(field.options ?? []).join(", ")}
                onChange={(e) =>
                  updateField(index, {
                    options: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Options (comma separated)"
              />
            )}
          </div>
        ))}
      </div>

      <div className="border-2 border-[#1a1a1a] p-5 bg-[#e8e8e0] space-y-4">
        <div>
          <label className="text-sm font-bold text-[#1a1a1a] block mb-1">
            Auto-send media ID (optional)
          </label>
          <p className="text-xs text-[#888] mb-2">
            Paste the Convex ID of the media to auto-send when a client is qualified. The link will be burn-after-reading by default.
          </p>
          <Input
            value={autoSendMediaId}
            onChange={(e) => setAutoSendMediaId(e.target.value)}
            placeholder="e.g. k17abc123..."
          />
        </div>
      </div>

      <Button type="submit" disabled={isSaving || !name || !slug || !instructions} className="w-full">
        {isSaving ? "Creating..." : "Create form"}
      </Button>
    </form>
  );
}

function FormEditorExisting({
  formId,
  onSave,
}: {
  formId: Id<"intakeForms">;
  onSave: (data: {
    name?: string;
    slug?: string;
    instructions?: string;
    isActive?: boolean;
    customFields?: CustomField[];
    autoSendMediaId?: Id<"videos"> | null;
  }) => Promise<void>;
}) {
  const form = useQuery(api.intakeForms.get, { formId });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [instructions, setInstructions] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  if (form && !initialized) {
    setName(form.name);
    setSlug(form.slug);
    setInstructions(form.instructions);
    setIsActive(form.isActive);
    setCustomFields(form.customFields as CustomField[]);
    setInitialized(true);
  }

  if (!form) {
    return <p className="text-[#888]">Loading...</p>;
  }

  const addField = () => {
    setCustomFields((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: "",
        type: "text",
        required: false,
      },
    ]);
  };

  const updateField = (index: number, updates: Partial<CustomField>) => {
    setCustomFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
  };

  const removeField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        name,
        slug,
        instructions,
        isActive,
        customFields: customFields.filter((f) => f.label.trim()),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-black text-[#1a1a1a]">Edit: {form.name}</h2>

      <div className="border-2 border-[#1a1a1a] p-5 bg-[#e8e8e0] space-y-4">
        <div>
          <label className="text-sm font-bold text-[#1a1a1a] block mb-1">
            Form name
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-bold text-[#1a1a1a] block mb-1">
            URL slug
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#888] font-mono">/intake/</span>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 border-2 border-[#1a1a1a] accent-[#2d5a2d]"
          />
          <span className="text-sm font-bold text-[#1a1a1a]">Active</span>
        </label>
      </div>

      <div className="border-2 border-[#1a1a1a] p-5 bg-[#e8e8e0] space-y-4">
        <div>
          <label className="text-sm font-bold text-[#1a1a1a] block mb-1">
            AI qualification instructions
          </label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="min-h-[150px]"
          />
        </div>
      </div>

      <div className="border-2 border-[#1a1a1a] p-5 bg-[#e8e8e0] space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-[#1a1a1a]">
            Custom fields
          </label>
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            <Plus className="mr-1 h-3 w-3" />
            Add field
          </Button>
        </div>

        {customFields.map((field, index) => (
          <div
            key={field.id}
            className="border border-[#1a1a1a]/30 p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Input
                value={field.label}
                onChange={(e) => updateField(index, { label: e.target.value })}
                placeholder="Field label"
                className="flex-1"
              />
              <select
                value={field.type}
                onChange={(e) =>
                  updateField(index, {
                    type: e.target.value as CustomField["type"],
                  })
                }
                className="border-2 border-[#1a1a1a] bg-[#f0f0e8] px-2 py-1.5 text-sm"
              >
                <option value="text">Text</option>
                <option value="textarea">Long text</option>
                <option value="number">Number</option>
                <option value="select">Dropdown</option>
              </select>
              <label className="flex items-center gap-1 text-xs text-[#888]">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) =>
                    updateField(index, { required: e.target.checked })
                  }
                />
                Required
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#dc2626]"
                onClick={() => removeField(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            {field.type === "select" && (
              <Input
                value={(field.options ?? []).join(", ")}
                onChange={(e) =>
                  updateField(index, {
                    options: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Options (comma separated)"
              />
            )}
          </div>
        ))}
      </div>

      <Button type="submit" disabled={isSaving} className="w-full">
        {isSaving ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}

function SubmissionList({
  formId,
  onViewTranscript,
}: {
  formId: Id<"intakeForms">;
  onViewTranscript: (submissionId: Id<"intakeSubmissions">) => void;
}) {
  const submissions = useQuery(api.intakeSubmissionsHelpers.listByForm, {
    formId,
  });

  if (submissions === undefined) {
    return <p className="text-[#888] text-sm">Loading submissions...</p>;
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[#888]">No submissions yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-black text-[#1a1a1a]">
        Submissions ({submissions.length})
      </h2>
      {submissions.map((sub) => (
        <div
          key={sub._id}
          className="border-2 border-[#1a1a1a] p-4 bg-[#e8e8e0] cursor-pointer hover:bg-[#e0e0d8] transition-colors"
          onClick={() => onViewTranscript(sub._id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1a1a1a] truncate">
                  {sub.contactName ?? "Anonymous"}
                </span>
                <Badge
                  variant={
                    sub.status === "qualified"
                      ? "success"
                      : sub.status === "rejected"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {sub.status}
                </Badge>
              </div>
              {sub.contactEmail && (
                <p className="text-xs text-[#888] font-mono mt-0.5">
                  {sub.contactEmail}
                </p>
              )}
              {sub.aiDecision && (
                <p className="text-xs text-[#888] mt-1 truncate">
                  {sub.aiDecision}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 text-xs text-[#888]">
              <span>{sub.chatHistory.length} messages</span>
              <span className="font-mono">
                {formatRelativeTime(sub.createdAt)}
              </span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TranscriptViewer({
  submissionId,
}: {
  submissionId: Id<"intakeSubmissions">;
}) {
  const submission = useQuery(api.intakeSubmissionsHelpers.getSubmission, {
    submissionId,
  });

  if (!submission) {
    return <p className="text-[#888]">Loading transcript...</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-black text-[#1a1a1a]">
          {submission.contactName ?? "Anonymous"}
        </h2>
        <div className="flex items-center gap-3 mt-1 text-sm text-[#888]">
          {submission.contactEmail && (
            <span className="font-mono">{submission.contactEmail}</span>
          )}
          <Badge
            variant={
              submission.status === "qualified"
                ? "success"
                : submission.status === "rejected"
                  ? "destructive"
                  : "secondary"
            }
          >
            {submission.status}
          </Badge>
          <span className="font-mono">
            {formatRelativeTime(submission.createdAt)}
          </span>
        </div>
        {submission.aiDecision && (
          <p className="text-sm text-[#888] mt-2 border-l-2 border-[#1a1a1a] pl-3">
            {submission.aiDecision}
          </p>
        )}
      </div>

      {submission.formData && Object.keys(submission.formData).length > 0 && (
        <div className="border-2 border-[#1a1a1a] p-4 bg-[#e8e8e0] space-y-2">
          <h3 className="font-bold text-sm text-[#1a1a1a]">Form responses</h3>
          {Object.entries(submission.formData as Record<string, string>).map(
            ([key, value]) => (
              <div key={key} className="text-sm">
                <span className="font-bold text-[#1a1a1a]">{key}:</span>{" "}
                <span className="text-[#888]">{value}</span>
              </div>
            )
          )}
        </div>
      )}

      <div className="border-2 border-[#1a1a1a] bg-[#e8e8e0]">
        <div className="border-b-2 border-[#1a1a1a] px-4 py-2">
          <h3 className="font-bold text-sm text-[#1a1a1a]">Chat transcript</h3>
        </div>
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {submission.chatHistory.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={cn(
                  "max-w-[80%] px-4 py-2.5 text-sm whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-[#1a1a1a] text-[#f0f0e8] border-2 border-[#1a1a1a]"
                    : "bg-[#f0f0e8] text-[#1a1a1a] border-2 border-[#1a1a1a]"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      {submission.shareLinkToken && (
        <div className="border-2 border-[#2d5a2d] p-4 bg-[#2d5a2d]/5">
          <p className="text-sm font-bold text-[#2d5a2d]">
            Share link sent to client:
          </p>
          <code className="text-xs font-mono text-[#888] mt-1 block">
            /share/{submission.shareLinkToken}
          </code>
        </div>
      )}
    </div>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
