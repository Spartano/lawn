"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import OpenAI from "openai";

const DECISION_TAG_QUALIFIED = "[DECISION:QUALIFIED]";
const DECISION_TAG_REJECTED = "[DECISION:REJECTED]";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable not set");
  }
  return new OpenAI({ apiKey });
}

function buildSystemPrompt(
  instructions: string,
  formData: Record<string, unknown> | null,
): string {
  let prompt = `You are an intake assistant for a professional practice. Your role is to have a natural, friendly conversation with a potential client to determine if they are a good fit.

The practice owner has set these qualification criteria:
---
${instructions}
---
`;

  if (formData && Object.keys(formData).length > 0) {
    prompt += `\nThe client has already provided this information:\n`;
    for (const [key, value] of Object.entries(formData)) {
      prompt += `- ${key}: ${value}\n`;
    }
    prompt += "\n";
  }

  prompt += `IMPORTANT RULES:
1. Be conversational, professional, and friendly. Ask follow-up questions to understand the client's needs.
2. Do NOT reveal the qualification criteria to the client.
3. When you have gathered enough information to make a decision, include one of these tags at the END of your message (after your conversational response):
   - ${DECISION_TAG_QUALIFIED} if the client is a good fit
   - ${DECISION_TAG_REJECTED} if the client is not a good fit
4. When rejecting, be polite. Explain that your services may not be the best fit for their needs right now, without revealing the specific criteria.
5. When qualifying, express enthusiasm and let them know you'd love to work with them.
6. Do NOT include a decision tag until you are confident in your assessment. Ask at least 2-3 questions first.
7. Keep your responses concise (2-4 sentences typically).`;

  return prompt;
}

function extractDecision(aiResponse: string): {
  decision: "qualified" | "rejected" | null;
  cleanedResponse: string;
} {
  if (aiResponse.includes(DECISION_TAG_QUALIFIED)) {
    return {
      decision: "qualified",
      cleanedResponse: aiResponse.replace(DECISION_TAG_QUALIFIED, "").trim(),
    };
  }
  if (aiResponse.includes(DECISION_TAG_REJECTED)) {
    return {
      decision: "rejected",
      cleanedResponse: aiResponse.replace(DECISION_TAG_REJECTED, "").trim(),
    };
  }
  return { decision: null, cleanedResponse: aiResponse };
}

export const startSubmission = action({
  args: {
    formId: v.id("intakeForms"),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    formData: v.optional(v.any()),
  },
  returns: v.object({
    submissionId: v.id("intakeSubmissions"),
    aiMessage: v.string(),
  }),
  handler: async (ctx, args) => {
    const formDoc: Doc<"intakeForms"> | null = await ctx.runQuery(
      internal.intakeSubmissionsHelpers.getFormById,
      {
        formId: args.formId,
      },
    );
    if (!formDoc || !formDoc.isActive) {
      throw new Error("Intake form not found or inactive");
    }

    const openai = getOpenAIClient();
    const systemPrompt = buildSystemPrompt(
      formDoc.instructions,
      args.formData as Record<string, unknown> | null,
    );

    const greeting = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            "Hi, I just filled out your intake form and I'm interested in your services.",
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const aiMessage =
      greeting.choices[0]?.message?.content ??
      "Hello! Thanks for your interest. How can I help you today?";
    const { cleanedResponse } = extractDecision(aiMessage);

    const now = Date.now();
    const submissionId: Id<"intakeSubmissions"> = await ctx.runMutation(
      internal.intakeSubmissionsHelpers.createSubmission,
      {
        formId: args.formId,
        contactName: args.contactName,
        contactEmail: args.contactEmail,
        formData: args.formData,
        chatHistory: [
          {
            role: "assistant" as const,
            content: cleanedResponse,
            timestamp: now,
          },
        ],
        createdAt: now,
      },
    );

    return {
      submissionId,
      aiMessage: cleanedResponse,
    };
  },
});

export const sendMessage = action({
  args: {
    submissionId: v.id("intakeSubmissions"),
    message: v.string(),
  },
  returns: v.object({
    aiMessage: v.union(v.string(), v.null()),
    status: v.string(),
    shareLinkUrl: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args): Promise<{
    aiMessage: string | null;
    status: string;
    shareLinkUrl: string | null;
  }> => {
    const submission: Doc<"intakeSubmissions"> | null = await ctx.runQuery(
      internal.intakeSubmissionsHelpers.getSubmissionInternal,
      { submissionId: args.submissionId },
    );

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (submission.status !== "chatting") {
      return {
        aiMessage: null,
        status: submission.status,
        shareLinkUrl: submission.shareLinkToken
          ? `/share/${submission.shareLinkToken}`
          : null,
      };
    }

    const form: Doc<"intakeForms"> | null = await ctx.runQuery(
      internal.intakeSubmissionsHelpers.getFormById,
      { formId: submission.formId },
    );
    if (!form) {
      throw new Error("Intake form not found");
    }

    const openai = getOpenAIClient();
    const systemPrompt = buildSystemPrompt(
      form.instructions,
      submission.formData as Record<string, unknown> | null,
    );

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: systemPrompt }];

    for (const msg of submission.chatHistory) {
      messages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    messages.push({ role: "user", content: args.message });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 400,
      temperature: 0.7,
    });

    const aiResponse =
      completion.choices[0]?.message?.content ??
      "I appreciate your time. Let me think about this.";
    const { decision, cleanedResponse } = extractDecision(aiResponse);

    const now = Date.now();
    const newHistory = [
      ...submission.chatHistory,
      { role: "user" as const, content: args.message, timestamp: now },
      {
        role: "assistant" as const,
        content: cleanedResponse,
        timestamp: now,
      },
    ];

    let shareLinkToken: string | null = null;

    if (decision === "qualified" && form.autoSendMediaId) {
      const shareLinkResult: { token: string } = await ctx.runMutation(
        internal.intakeSubmissionsHelpers.createAutoShareLink,
        {
          videoId: form.autoSendMediaId,
          burnAfterReading: form.autoSendShareOptions?.burnAfterReading ?? true,
          expiresInDays: form.autoSendShareOptions?.expiresInDays,
          password: form.autoSendShareOptions?.password,
        },
      );
      shareLinkToken = shareLinkResult.token;
    }

    await ctx.runMutation(internal.intakeSubmissionsHelpers.updateSubmission, {
      submissionId: args.submissionId,
      chatHistory: newHistory,
      status: decision ?? "chatting",
      aiDecision: decision
        ? `${decision}: ${cleanedResponse.slice(0, 200)}`
        : undefined,
      shareLinkToken: shareLinkToken ?? undefined,
    });

    return {
      aiMessage: cleanedResponse,
      status: decision ?? "chatting",
      shareLinkUrl: shareLinkToken ? `/share/${shareLinkToken}` : null,
    };
  },
});
