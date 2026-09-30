import { useCallback, useEffect, useState } from "react";
import type { MemorialPayload } from "@/lib/api";
import { api, ApiError } from "@/lib/api";
import { forgetKey, loadKey, parseManageTarget, saveKey } from "@/lib/keys";
import { lifespan } from "@/lib/format";
import DetailsForm from "./DetailsForm";
import PhotoManager from "./PhotoManager";
import StoryManager from "./StoryManager";
import QrPanel from "../islands/QrPanel";
import { Button, Card, Field, Input, Notice, Spinner } from "./ui";
import { ExternalLink, KeyRound, Info, LogOut, Copy, Check } from "lucide-react";

type Tab = "details" | "photos" | "stories" | "share";

const TABS: { id: Tab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "photos", label: "Photographs" },
  { id: "stories", label: "Memories" },
  { id: "share", label: "QR & sharing" },
];

export default function ManageApp() {
  const [slug, setSlug] = useState("");
  const [editKey, setEditKey] = useState("");
  const [payload, setPayload] = useState<MemorialPayload | null>(null);
  const [status, setStatus] = useState<"boot" | "loading" | "locked" | "ready" | "missing">("boot");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("details");
  const [copied, setCopied] = useState("");
  const [keyInput, setKeyInput] = useState("");

  const load = useCallback(async (targetSlug: string, key: string) => {
    setError("");
    if (!targetSlug) {
      setStatus("boot");
      return;
    }
    setStatus("loading");
    try {
      const data = await api.get(targetSlug, key || undefined);
      setPayload(data);
      if (data.canEdit) {
        setStatus("ready");
        saveKey(targetSlug, key);
        return;
      }
      const stored = key ? null : loadKey(targetSlug);
      if (stored) {
        setEditKey(stored);
        void load(targetSlug, stored);
        return;
      }
      setStatus("locked");
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 404) {
        setStatus("missing");
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Could not load the memorial.");
      setStatus("locked");
    }
  }, []);

  useEffect(() => {
    const target = parseManageTarget(window.location.hash, window.location.search);
    if (!target) {
      setStatus("boot");
      return;
    }
    const key = target.key || loadKey(target.slug) || "";
    setSlug(target.slug);
    setEditKey(key);
    void load(target.slug, key);
  }, [load]);

  const refresh = useCallback(async () => {
    if (!slug) return;
    const data = await api.get(slug, editKey);
    setPayload(data);
  }, [slug, editKey]);

  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      await api.update(slug, editKey, patch);
      await refresh();
    },
    [slug, editKey, refresh],
  );

  if (status === "boot" || status === "missing") {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <h1 className="font-serif text-2xl font-semibold text-ink">
            {status === "missing" ? "That memorial does not exist" : "Open a memorial to edit"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            {status === "missing"
              ? "Check the address, or create a new memorial. If you have just created one, it may not have been published yet — but the editor link you were given will still work."
              : "Paste the family edit link you saved, or enter the memorial's address and its edit key."}
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const target = parseManageTarget(keyInput.trim().replace(/^.*#/, "#"), keyInput.trim());
              const nextSlug = target?.slug ?? slug;
              const nextKey = target?.key ?? keyInput.trim();
              if (!nextSlug) {
                setError("Enter the memorial address, for example maria-popescu.");
                return;
              }
              setSlug(nextSlug);
              setEditKey(nextKey);
              saveKey(nextSlug, nextKey);
              void load(nextSlug, nextKey);
            }}
          >
            {error && <Notice tone="error">{error}</Notice>}
            <Field
              label="Edit link or memorial address"
              htmlFor="target"
              hint="Paste the whole edit link, or just the address (the part after /m/)."
            >
              <Input
                id="target"
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                placeholder="maria-popescu.3f7c1a5e9b2d8460"
              />
            </Field>
            <Button type="submit">
              <KeyRound className="h-4 w-4" /> Open the editor
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  if (status === "loading" && !payload) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-sm text-ink-muted">
        <Spinner className="h-4 w-4" /> Loading the memorial…
      </div>
    );
  }

  if (status === "locked" || !payload) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <h1 className="font-serif text-2xl font-semibold text-ink">
            {payload ? `Editing ${payload.memorial.name}` : "Edit key needed"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            This memorial only accepts changes from someone holding its edit key. It was shown once,
            when the page was created, and looks something like{" "}
            <code className="rounded bg-sand-100 px-1.5 py-0.5 text-xs">
              3f7c1a5e9b2d8460a1c93de7f5082b64
            </code>
            .
          </p>
          {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setEditKey(keyInput.trim());
              saveKey(slug, keyInput.trim());
              void load(slug, keyInput.trim());
            }}
          >
            <Field label="Edit key" htmlFor="edit-key">
              <Input
                id="edit-key"
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Button type="submit">
              <KeyRound className="h-4 w-4" /> Unlock
            </Button>
          </form>
          <p className="mt-5 text-xs leading-relaxed text-ink-muted">
            Lost the key? It cannot be recovered from the page — a hash is all that is stored. You
            can still{" "}
            <a className="text-brand-700 underline underline-offset-2" href="/create">
              create a new memorial
            </a>{" "}
            with the same details.
          </p>
        </Card>
      </div>
    );
  }

  const { memorial, photos, stories } = payload;
  const dates = lifespan(memorial.born, memorial.died);
  const publicUrl = `${window.location.origin}/m/${slug}`;
  const editLink = `${window.location.origin}/manage#${slug}.${editKey}`;

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Copy this:", value);
    }
  };

  return (
    <div>
      <Card className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Editing memorial
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-ink">{memorial.name}</h1>
            {dates && <p className="mt-1 text-sm text-ink-muted">{dates}</p>}
            <p className="mt-3 text-xs text-ink-muted">
              /m/{slug} · {photos.length} photos · {stories.length} memories
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(publicUrl, "_blank", "noopener")}
            >
              <ExternalLink className="h-3.5 w-3.5" /> View page
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                forgetKey(slug);
                window.location.hash = "";
                setPayload(null);
                setStatus("boot");
                setEditKey("");
              }}
            >
              <LogOut className="h-3.5 w-3.5" /> Forget key
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-sand-200 pt-5">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === item.id
                  ? "bg-brand-600 text-white"
                  : "text-ink-soft hover:bg-sand-100 hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-xs leading-relaxed text-ink-soft">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
        <p>
          Every change is saved as a commit in the Git repository behind this site, then the page is
          rebuilt — usually within a minute. Nothing you change here can be lost: the previous
          version stays in the history.
        </p>
      </div>

      {error && <div className="mb-6"><Notice tone="error">{error}</Notice></div>}

      {tab === "details" && <DetailsForm memorial={memorial} onSave={save} />}

      {tab === "photos" && (
        <PhotoManager
          slug={slug}
          editKey={editKey}
          photos={photos}
          cover={memorial.cover}
          onRefresh={refresh}
        />
      )}

      {tab === "stories" && (
        <StoryManager slug={slug} editKey={editKey} stories={stories} onRefresh={refresh} />
      )}

      {tab === "share" && (
        <div className="space-y-8">
          <Card>
            <h2 className="font-serif text-xl font-semibold text-ink">Keep these safe</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              The edit link is the only way to change this memorial. Save it somewhere your family
              will look — a password manager, a printed sheet with the photographs, or a note in the
              family group chat. It cannot be recovered if it is lost.
            </p>
            <div className="mt-5 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Edit link
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-sand-100 px-3 py-2 text-xs text-ink-soft">
                    {editLink}
                  </code>
                  <Button type="button" variant="outline" size="sm" onClick={() => copy(editLink, "link")}>
                    {copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Edit key only
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-sand-100 px-3 py-2 text-xs text-ink-soft">
                    {editKey}
                  </code>
                  <Button type="button" variant="outline" size="sm" onClick={() => copy(editKey, "key")}>
                    {copied === "key" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <div className="border-t border-sand-200 pt-8">
            <QrPanel url={publicUrl} name={memorial.name} dates={dates} />
          </div>
        </div>
      )}
    </div>
  );
}
