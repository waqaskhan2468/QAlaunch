import { z } from "zod";
import { type ClaudeIssue } from "@/lib/types";

const responseSchema = z.object({
  issues: z.array(z.object({
    category: z.enum(["functionality", "ui_bugs", "usability_ux", "responsiveness", "performance", "seo", "accessibility"]),
    severity: z.enum(["critical", "high", "medium", "low"]),
    title: z.string().min(6).max(80),
    description: z.string().min(20),
    impact: z.string().min(10),
    page_section: z.string().optional(),
    fix_instructions: z.string().min(10)
  }))
});

const SYSTEM_PROMPT = `You are a senior QA engineer with 10-12 years of professional experience manually testing websites for usability, UI bugs, functionality, and responsiveness.

RULES:
1. Focus on issues that affect real human users first
2. Be specific
3. Every issue must have severity
4. Every issue must have a real business impact statement
5. Provide developer-actionable fix instructions
6. Categorize issues correctly
7. Order findings by severity within each category
8. Be concise but specific
9. Reference exact pages and sections
10. Do NOT report generic improvements

OUTPUT FORMAT: Always return valid JSON matching the schema provided.`;

export async function analyzeWithClaude(input: {
  desktopImageBase64: string;
  mobileImageBase64: string;
  prompt: string;
}) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8000,
      system: [{
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }
      }],
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: input.desktopImageBase64 }
          },
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: input.mobileImageBase64 }
          },
          { type: "text", text: input.prompt }
        ]
      }]
    })
  });

  if (!res.ok) {
    throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export function parseClaudeIssues(raw: any): ClaudeIssue[] {
  const text = raw?.content?.map((item: any) => item.type === "text" ? item.text : "").join("
") ?? "";
  const maybeJson = text.match(/\{[\s\S]*\}$/)?.[0] ?? text;
  const parsed = responseSchema.safeParse(JSON.parse(maybeJson));
  if (!parsed.success) {
    throw new Error(`Invalid Claude JSON: ${parsed.error.message}`);
  }
  return parsed.data.issues;
}
