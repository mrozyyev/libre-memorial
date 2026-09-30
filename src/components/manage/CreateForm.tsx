import { useEffect, useRef, useState } from "react";
import type { CreateResult } from "@/lib/api";
import { api } from "@/lib/api";
import { slugify } from "@shared/slug";
import { saveKey } from "@/lib/keys";
import { Check, Copy, Download, AlertTriangle, Clock, KeyRound, Sparkles } from "lucide-react";
import { Button, Card, Field, Input, Notice, Select, Spinner, Textarea } from "./ui";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: Record<string, unknown>,
      ) => string | number;
    };
  }
}

const TURNSTILE_SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? "";

export default function CreateForm() {
  const [form, setForm] = useState({
    name: "",
    born: "",
    died: "",
    epitaph: "",
    location: "",
    biography: "",
    visibility: "public",
  });
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CreateResult | null>(null);
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);

  const effectiveSlug = slugTouched ? slug : slugify(form.name);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileRef.current) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      window.turnstile?.render(turnstileRef.current as HTMLElement, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (value: string) => setToken(value),
        "error-callback": () => setToken(""),
        theme: "light",
      });
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!consent) {
      setError("Please confirm you have permission to publish these details.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const created = await api.create({
        ...form,
        slug: effectiveSlug,
        website: honeypot,
        turnstileToken: token,
      });
      saveKey(created.slug, created.editKey);
      setResult(created);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create the memorial.");
    } finally {
      setSubmitting(false);
    }
  };

  // Poll until the freshly created page is actually published by the build.
  useEffect(() => {
    if (!result || published) return;
    let cancelled = false;
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      try {
        const response = await fetch(`${result.memorialPath}?t=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
        });
        if (!cancelled && response.ok) {
          setPublished(true);
          return;
        }
      } catch {
        /* keep polling */
      }
      if (!cancelled && attempts < 40) window.setTimeout(check, 6000);
    };
    const timer = window.setTimeout(check, 5000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [result, published]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Copy this:", value);
    }
  };

  if (result) {
    const origin = window.location.origin;
    const publicUrl = `${origin}${result.memorialPath}`;
    const editLink = `${origin}${result.managePath}`;
    const recovery = [
      `LibreMemorial — recovery sheet`,
      ``,
      `Memorial: ${result.name}`,
      `Public page: ${publicUrl}`,
      `Edit link: ${editLink}`,
      `Edit key: ${result.editKey}`,
      ``,
      `Keep this sheet somewhere safe. Anyone with the edit link can add photos and stories.`,
      `The key cannot be recovered if it is lost — only a one-way hash is stored.`,
      ``,
      `Created: ${new Date(result.createdAt).toLocaleString()}`,
    ].join("\n");

    return (
      <div className="space-y-6">
        <Card>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Check className="h-5 w-5" />
          </span>
          <h1 className="mt-4 font-serif text-3xl font-semibold text-ink">
            {result.name} now has a memorial page
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Save the edit link below — it is the only key to this page and it will not be shown
            again. Then add photographs and memories whenever you are ready.
          </p>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4" /> Save your edit link now
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/70">
                  Edit link
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-paper px-3 py-2 text-xs text-ink-soft">
                    {editLink}
                  </code>
                  <Button type="button" variant="outline" size="sm" onClick={() => copy(editLink, "edit")}>
                    {copied === "edit" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="!text-xs"
                  onClick={() => {
                    const blob = new Blob([recovery], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `librememorial-${result.slug}.txt`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> Download recovery sheet
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="!text-xs"
                  onClick={() => copy(result.editKey, "key")}
                >
                  {copied === "key" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy key only
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => window.open(editLink, "_blank", "noopener")}>
              <KeyRound className="h-4 w-4" /> Open the editor
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(publicUrl, "_blank", "noopener")}
            >
              {published ? "View the page" : "View the page (may not be live yet)"}
            </Button>
          </div>

          <div className="mt-5 flex items-center gap-2 text-xs text-ink-muted">
            {published ? (
              <>
                <Check className="h-3.5 w-3.5 text-brand-600" /> Published — the page is live at{" "}
                <a className="text-brand-700 underline underline-offset-2" href={result.memorialPath}>
                  {result.memorialPath}
                </a>
              </>
            ) : (
              <>
                <Spinner className="h-3.5 w-3.5" /> Publishing your page — this usually takes under a
                minute. You can start adding photos straight away.
              </>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-serif text-xl font-semibold text-ink">What happens next</h2>
          <ol className="mt-4 space-y-3 text-sm leading-relaxed text-ink-soft">
            <li>
              <strong className="font-semibold text-ink">1.</strong> The site rebuilds and your page
              appears at <code className="rounded bg-sand-100 px-1.5 py-0.5 text-xs">{result.memorialPath}</code>.
            </li>
            <li>
              <strong className="font-semibold text-ink">2.</strong> Add photos and memories from the
              editor — the first photo becomes the portrait.
            </li>
            <li>
              <strong className="font-semibold text-ink">3.</strong> Download the QR card from the
              editor and have it printed for the service.
            </li>
          </ol>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      {error && <Notice tone="error">{error}</Notice>}

      <Notice tone="info">
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" /> You can add photographs and stories right after this
          — only the name is needed to begin.
        </span>
      </Notice>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Their name" htmlFor="name" className="sm:col-span-2">
          <Input
            id="name"
            value={form.name}
            onChange={(event) => set("name")(event.target.value)}
            required
            maxLength={80}
            autoComplete="off"
            placeholder="Maria Popescu"
          />
        </Field>
        <Field label="Born" htmlFor="born" hint="A year or a full date.">
          <Input
            id="born"
            value={form.born}
            onChange={(event) => set("born")(event.target.value)}
            maxLength={40}
            placeholder="1943-05-02"
          />
        </Field>
        <Field label="Died" htmlFor="died" hint="Optional.">
          <Input
            id="died"
            value={form.died}
            onChange={(event) => set("died")(event.target.value)}
            maxLength={40}
            placeholder="2025-01-17"
          />
        </Field>
        <Field label="Place" htmlFor="location" hint="Optional.">
          <Input
            id="location"
            value={form.location}
            onChange={(event) => set("location")(event.target.value)}
            maxLength={120}
            placeholder="Cluj-Napoca, Romania"
          />
        </Field>
        <Field label="Epitaph" htmlFor="epitaph" hint="One line, shown under the name.">
          <Input
            id="epitaph"
            value={form.epitaph}
            onChange={(event) => set("epitaph")(event.target.value)}
            maxLength={160}
            placeholder="She planted trees she would never sit under."
          />
        </Field>
      </div>

      <Field
        label="A few words about them"
        htmlFor="biography"
        hint="Optional for now — you can write this later, together with the family. Blank lines make paragraphs."
      >
        <Textarea
          id="biography"
          rows={8}
          value={form.biography}
          onChange={(event) => set("biography")(event.target.value)}
          maxLength={20000}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Who can see it"
          htmlFor="visibility"
          hint="You can change this at any time."
        >
          <Select
            id="visibility"
            value={form.visibility}
            onChange={(event) => set("visibility")(event.target.value)}
          >
            <option value="public">Public — listed for anyone to find</option>
            <option value="unlisted">Unlisted — only people with the link</option>
          </Select>
        </Field>

        <Field
          label="Web address"
          htmlFor="slug"
          hint={`The page will live at /m/${effectiveSlug || "their-name"}`}
        >
          <Input
            id="slug"
            value={effectiveSlug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            maxLength={60}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      </div>

      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      {TURNSTILE_SITE_KEY && <div ref={turnstileRef} />}

      <label className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-sand-200 text-brand-600 focus:ring-brand-400"
        />
        <span>
          I have permission from the family to publish these details, and I understand the page will
          be publicly readable unless it is set to unlisted.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-4 border-t border-sand-200 pt-6">
        <Button type="submit" size="md" loading={submitting}>
          <Sparkles className="h-4 w-4" /> Create the memorial
        </Button>
        <p className="text-xs text-ink-muted">
          No account, no payment, no email address.
        </p>
      </div>
    </form>
  );
}
