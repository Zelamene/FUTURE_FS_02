import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import type { LeadSource } from "../lib/format";
import { useToast } from "../hooks/useToast";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent";
const labelClass = "mb-[6px] block text-xs font-medium text-content-secondary";
const SOURCES: LeadSource[] = ["contact-form", "referral", "whatsapp", "other"];

export function CapturePage() {
  const [params] = useSearchParams();
  const prefill = params.get("source");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState<LeadSource>(
    SOURCES.includes(prefill as LeadSource) ? (prefill as LeadSource) : "contact-form"
  );
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const { notify } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setDone(false);
    setSending(true);
    try {
      const botField = (document.getElementById("capture-bot") as HTMLInputElement | null)?.value ?? "";
      await api.post("/api/capture", {
        name,
        email,
        phone: phone || undefined,
        company: company || undefined,
        source,
        message,
        botField,
      });
      setDone(true);
      setName("");
      setEmail("");
      setPhone("");
      setCompany("");
      setMessage("");
    } catch (err) {
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setFieldErrors(err.fields);
      } else {
        notify("Couldn't save changes. Try again.", "error");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-12">
      <h1 className="text-xl font-semibold text-content-primary">Contact us</h1>
      <p className="mt-2 text-sm text-content-secondary">
        Send an enquiry and we will be in touch.
      </p>
      {done && (
        <p role="status" className="mt-4 rounded-lg border border-border bg-success-subtle px-4 py-3 text-sm text-success">
          Thanks — we&apos;ll be in touch.
        </p>
      )}
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="cap-name" className={labelClass}>
            Name <span aria-hidden="true" style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            id="cap-name"
            className={inputClass}
            placeholder="Thandi Mokoena"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          {fieldErrors.name && <p className="mt-[6px] text-xs text-danger">{fieldErrors.name}</p>}
        </div>
        <div>
          <label htmlFor="cap-email" className={labelClass}>
            Email <span aria-hidden="true" style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            id="cap-email"
            type="email"
            className={inputClass}
            placeholder="thandi@example.co.za"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {fieldErrors.email && <p className="mt-[6px] text-xs text-danger">{fieldErrors.email}</p>}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="cap-phone" className={labelClass}>
              Phone
            </label>
            <input
              id="cap-phone"
              className={inputClass}
              placeholder="0821234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cap-company" className={labelClass}>
              Company
            </label>
            <input
              id="cap-company"
              className={inputClass}
              placeholder="Mokoena Consulting"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label htmlFor="cap-source" className={labelClass}>
            Source
          </label>
          <select
            id="cap-source"
            className={inputClass}
            value={source}
            onChange={(e) => setSource(e.target.value as LeadSource)}
          >
            <option value="contact-form">Contact form</option>
            <option value="referral">Referral</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="cap-message" className={labelClass}>
            Message <span aria-hidden="true" style={{ color: "var(--danger)" }}>*</span>
          </label>
          <textarea
            id="cap-message"
            className="min-h-[96px] w-full resize-y rounded-md border border-border bg-surface px-3 py-[10px] text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent"
            placeholder="I'd like a quote for a website redesign."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
          {fieldErrors.message && <p className="mt-[6px] text-xs text-danger">{fieldErrors.message}</p>}
        </div>
        <input
          id="capture-bot"
          name="botField"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          defaultValue=""
          style={{ position: "absolute", left: "-9999px" }}
        />
        <button
          type="submit"
          disabled={sending}
          className="h-11 rounded-md bg-accent px-5 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? "Sending…" : "Send enquiry"}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-content-tertiary">
        <Link to="/login" className="text-accent">
          Admin sign in
        </Link>
      </p>
    </div>
  );
}
