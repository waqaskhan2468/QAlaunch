"use client"

import { ArrowRight, CheckCircle2 } from "lucide-react"
import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"
import { contactFormSchema } from "@/types/zod"

/**
 * Contact form — posts to POST /api/contact, which emails the submission to
 * contact@getqalaunch.com (with the submitter set as reply-to). Validation uses
 * the shared `contactFormSchema` so client and server rules stay in sync.
 */

type FieldName =
  | "firstName"
  | "lastName"
  | "email"
  | "websiteUrl"
  | "pageCount"
  | "websiteType"
  | "message"

const EMPTY_FORM: Record<FieldName, string> = {
  firstName: "",
  lastName: "",
  email: "",
  websiteUrl: "",
  pageCount: "",
  websiteType: "",
  message: "",
}

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle")
  const [values, setValues] = useState<Record<FieldName, string>>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  function update(name: FieldName, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
    // Clear a field's error as soon as the user edits it.
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    const parsed = contactFormSchema.safeParse(values)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      const next: Partial<Record<FieldName, string>> = {}
      for (const key of Object.keys(fieldErrors) as FieldName[]) {
        const msg = fieldErrors[key]?.[0]
        if (msg) next[key] = msg
      }
      setErrors(next)
      return
    }

    setStatus("submitting")
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setSubmitError(
          data?.message ??
            "Something went wrong sending your message. Please try again or email us at contact@getqalaunch.com.",
        )
        setStatus("idle")
        return
      }

      setStatus("sent")
    } catch {
      setSubmitError(
        "We couldn't reach the server. Please check your connection and try again, or email us at contact@getqalaunch.com.",
      )
      setStatus("idle")
    }
  }

  if (status === "sent") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center rounded-3xl border border-border-soft bg-white p-10 text-center shadow-sm"
      >
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            delay: 0.15,
            type: "spring",
            stiffness: 280,
            damping: 16,
          }}
          className="mb-4 flex size-14 items-center justify-center rounded-full bg-accent-pale text-accent-emerald"
        >
          <CheckCircle2 className="size-7" />
        </motion.div>
        <h3 className="font-heading text-xl font-black text-ink">
          Message sent!
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-body">
          Thanks for reaching out. We&apos;ll get back to you with a tailored
          quote or answer within 24 hours.
        </p>
        <button
          type="button"
          onClick={() => {
            setValues(EMPTY_FORM)
            setErrors({})
            setStatus("idle")
          }}
          className="mt-6 text-sm font-bold text-brand hover:underline"
        >
          Send another message
        </button>
      </motion.div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-3xl border border-border-soft bg-white p-8 shadow-sm md:p-10"
    >
      <h3 className="mb-6 font-heading text-2xl font-black tracking-tight text-ink">
        Send us a message
      </h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First Name" required error={errors.firstName}>
          <input
            type="text"
            name="firstName"
            value={values.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            placeholder="John"
            className={inputClass}
          />
        </Field>
        <Field label="Last Name" required error={errors.lastName}>
          <input
            type="text"
            name="lastName"
            value={values.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            placeholder="Smith"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Email Address" required className="mt-4" error={errors.email}>
        <input
          type="email"
          name="email"
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="john@company.com"
          className={inputClass}
        />
      </Field>

      <Field label="Website URL" className="mt-4" error={errors.websiteUrl}>
        <input
          type="url"
          name="websiteUrl"
          value={values.websiteUrl}
          onChange={(e) => update("websiteUrl", e.target.value)}
          placeholder="https://yourwebsite.com"
          className={inputClass}
        />
      </Field>

      <Field label="Number of pages" className="mt-4" error={errors.pageCount}>
        <select
          name="pageCount"
          value={values.pageCount}
          onChange={(e) => update("pageCount", e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Select page count
          </option>
          <option>1 page — Basic ($9)</option>
          <option>2–5 pages — Standard ($24)</option>
          <option>6–10 pages — Premium ($59)</option>
          <option>11–25 pages (Custom)</option>
          <option>26–50 pages (Custom)</option>
          <option>50+ pages (Enterprise)</option>
        </select>
      </Field>

      <Field label="Website type" className="mt-4" error={errors.websiteType}>
        <select
          name="websiteType"
          value={values.websiteType}
          onChange={(e) => update("websiteType", e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Select type
          </option>
          <option>AI-built site (Lovable, Bolt, Replit, v0)</option>
          <option>eCommerce / Shopify store</option>
          <option>SaaS web application</option>
          <option>Landing page / Marketing site</option>
          <option>Portfolio / Agency site</option>
          <option>Blog / Content site</option>
          <option>Other</option>
        </select>
      </Field>

      <Field
        label="Tell us about your project"
        className="mt-4"
        error={errors.message}
      >
        <textarea
          rows={5}
          name="message"
          value={values.message}
          onChange={(e) => update("message", e.target.value)}
          placeholder="Describe your website, any specific concerns, or what you'd like us to focus on…"
          className={cn(inputClass, "min-h-28 resize-y")}
        />
      </Field>

      {submitError && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-medium text-danger"
        >
          {submitError}
        </p>
      )}

      <motion.button
        type="submit"
        disabled={status === "submitting"}
        whileHover={status === "idle" ? { y: -2, scale: 1.01 } : undefined}
        whileTap={status === "idle" ? { scale: 0.97 } : undefined}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-extrabold text-white shadow-glow-brand hover:bg-brand-mid focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <AnimatePresence mode="wait" initial={false}>
          {status === "submitting" ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="inline-flex items-center gap-2"
            >
              <motion.span
                className="inline-block size-4 rounded-full border-2 border-white/40 border-t-white"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
              Sending…
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="inline-flex items-center gap-2"
            >
              Send Message
              <motion.span
                className="inline-flex"
                animate={{ x: [0, 3, 0] }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <ArrowRight className="size-4" />
              </motion.span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </form>
  )
}

const inputClass =
  "w-full rounded-xl border border-border-soft bg-surface-soft px-4 py-3 font-sans text-sm text-ink outline-none transition-all placeholder:text-muted-ink focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"

function Field({
  label,
  required,
  children,
  className,
  error,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  className?: string
  error?: string
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-ink">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
      {error && (
        <span className="mt-1.5 block text-xs font-semibold text-danger">
          {error}
        </span>
      )}
    </label>
  )
}
