import { useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Send, ExternalLink } from "lucide-react";
import { Id } from "@convex/_generated/dataModel";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type FormPhase = "form" | "chatting" | "qualified" | "rejected";

export default function IntakePage() {
  const params = useParams({ strict: false });
  const slug = params.slug as string;

  const form = useQuery(api.intakeForms.getBySlug, { slug });

  const startSubmission = useAction(api.intakeSubmissions.startSubmission);
  const sendMessage = useAction(api.intakeSubmissions.sendMessage);

  const [phase, setPhase] = useState<FormPhase>("form");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<Id<"intakeSubmissions"> | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [shareLinkUrl, setShareLinkUrl] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form || isSubmitting) return;

      setIsSubmitting(true);
      try {
        const formData: Record<string, string> = {};
        for (const field of form.customFields) {
          if (formValues[field.id]) {
            formData[field.label] = formValues[field.id];
          }
        }

        const result = await startSubmission({
          formId: form._id,
          contactName: contactName || undefined,
          contactEmail: contactEmail || undefined,
          formData,
        });

        setSubmissionId(result.submissionId);
        setChatMessages([{ role: "assistant", content: result.aiMessage }]);
        setPhase("chatting");
      } catch (error) {
        console.error("Failed to start submission:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, formValues, contactName, contactEmail, isSubmitting, startSubmission]
  );

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!submissionId || !chatInput.trim() || isSending) return;

      const userMessage = chatInput.trim();
      setChatInput("");
      setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);
      setIsSending(true);

      try {
        const result = await sendMessage({
          submissionId,
          message: userMessage,
        });

        if (result.aiMessage) {
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.aiMessage },
          ]);
        }

        if (result.status === "qualified") {
          setPhase("qualified");
          if (result.shareLinkUrl) {
            setShareLinkUrl(result.shareLinkUrl);
          }
        } else if (result.status === "rejected") {
          setPhase("rejected");
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, something went wrong. Please try again." },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [submissionId, chatInput, isSending, sendMessage]
  );

  if (form === undefined) {
    return (
      <div className="min-h-screen bg-[#f0f0e8] flex items-center justify-center">
        <div className="text-[#888]">Loading...</div>
      </div>
    );
  }

  if (form === null) {
    return (
      <div className="min-h-screen bg-[#f0f0e8] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-[#dc2626]/10 flex items-center justify-center mb-4 border-2 border-[#dc2626]">
              <AlertCircle className="h-6 w-6 text-[#dc2626]" />
            </div>
            <CardTitle>Form not found</CardTitle>
            <CardDescription>
              This intake form doesn't exist or is no longer active.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/" preload="intent" className="block">
              <Button variant="outline" className="w-full">
                Go to Signum
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f0e8]">
      <header className="bg-[#f0f0e8] border-b-2 border-[#1a1a1a] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            preload="intent"
            to="/"
            className="text-[#888] hover:text-[#1a1a1a] text-sm font-bold"
          >
            Signum
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        {phase === "form" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-black text-[#1a1a1a] tracking-tight">
                {form.name}
              </h1>
              <p className="text-[#888] mt-2">
                Fill out the form below to get started.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div className="border-2 border-[#1a1a1a] p-5 bg-[#e8e8e0] space-y-4">
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] block mb-1">
                    Your name *
                  </label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] block mb-1">
                    Your email *
                  </label>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                    placeholder="jane@example.com"
                  />
                </div>
              </div>

              {form.customFields.length > 0 && (
                <div className="border-2 border-[#1a1a1a] p-5 bg-[#e8e8e0] space-y-4">
                  {form.customFields.map((field) => (
                    <div key={field.id}>
                      <label className="text-sm font-bold text-[#1a1a1a] block mb-1">
                        {field.label}
                        {field.required && " *"}
                      </label>
                      {field.type === "textarea" ? (
                        <Textarea
                          value={formValues[field.id] ?? ""}
                          onChange={(e) =>
                            setFormValues((prev) => ({
                              ...prev,
                              [field.id]: e.target.value,
                            }))
                          }
                          required={field.required}
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                          className="min-h-[100px]"
                        />
                      ) : field.type === "select" && field.options ? (
                        <select
                          value={formValues[field.id] ?? ""}
                          onChange={(e) =>
                            setFormValues((prev) => ({
                              ...prev,
                              [field.id]: e.target.value,
                            }))
                          }
                          required={field.required}
                          className="w-full border-2 border-[#1a1a1a] bg-[#f0f0e8] px-3 py-2 text-sm"
                        >
                          <option value="">Select...</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          type={field.type === "number" ? "number" : "text"}
                          value={formValues[field.id] ?? ""}
                          onChange={(e) =>
                            setFormValues((prev) => ({
                              ...prev,
                              [field.id]: e.target.value,
                            }))
                          }
                          required={field.required}
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || !contactName || !contactEmail}
                className="w-full"
              >
                {isSubmitting ? "Starting..." : "Continue"}
              </Button>
            </form>
          </div>
        )}

        {(phase === "chatting" || phase === "qualified" || phase === "rejected") && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#1a1a1a] tracking-tight">
                {form.name}
              </h1>
              <p className="text-sm text-[#888] mt-1">
                {contactName && `Chatting as ${contactName}`}
              </p>
            </div>

            <div className="border-2 border-[#1a1a1a] bg-[#e8e8e0] flex flex-col" style={{ minHeight: "400px", maxHeight: "60vh" }}>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-2.5 text-sm whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-[#1a1a1a] text-[#f0f0e8] border-2 border-[#1a1a1a]"
                          : "bg-[#f0f0e8] text-[#1a1a1a] border-2 border-[#1a1a1a]"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-[#f0f0e8] text-[#888] border-2 border-[#1a1a1a] px-4 py-2.5 text-sm">
                      <span className="inline-flex gap-1">
                        <span className="animate-pulse">.</span>
                        <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>.</span>
                        <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>.</span>
                      </span>
                    </div>
                  </div>
                )}

                {phase === "qualified" && shareLinkUrl && (
                  <div className="flex justify-start">
                    <div className="bg-[#2d5a2d] text-[#f0f0e8] border-2 border-[#1a1a1a] px-4 py-3 text-sm space-y-2 max-w-[80%]">
                      <p className="font-bold">Your render is ready to view:</p>
                      <a
                        href={shareLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 underline font-bold hover:text-[#e8e8e0]"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View render
                      </a>
                      <p className="text-xs text-[#e8e8e0]/70">
                        This is a single-use link. It will expire after you open it.
                      </p>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {phase === "chatting" && (
                <form
                  onSubmit={handleSendMessage}
                  className="flex-shrink-0 border-t-2 border-[#1a1a1a] p-3 flex gap-2"
                >
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    disabled={isSending}
                    autoFocus
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={!chatInput.trim() || isSending}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              )}

              {phase === "rejected" && (
                <div className="flex-shrink-0 border-t-2 border-[#1a1a1a] p-4 text-center text-sm text-[#888]">
                  This conversation has ended. Thank you for your time.
                </div>
              )}

              {phase === "qualified" && (
                <div className="flex-shrink-0 border-t-2 border-[#1a1a1a] p-4 text-center text-sm text-[#2d5a2d] font-bold">
                  You've been approved! Check the link above to view your render.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t-2 border-[#1a1a1a] px-6 py-4 mt-8">
        <div className="max-w-2xl mx-auto text-center text-sm text-[#888]">
          Powered by{" "}
          <Link
            to="/"
            preload="intent"
            className="text-[#1a1a1a] hover:text-[#2d5a2d] font-bold"
          >
            Signum
          </Link>
        </div>
      </footer>
    </div>
  );
}
