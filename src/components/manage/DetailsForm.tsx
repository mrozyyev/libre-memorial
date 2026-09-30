import { useState } from "react";
import type { Memorial } from "@shared/types";
import { parseVideoUrl } from "@shared/video";
import { Plus, Trash, Save } from "lucide-react";
import { Button, Field, Input, Notice, Select, Textarea } from "./ui";

type PublicMemorial = Omit<Memorial, "auth">;
type LinkRow = { label: string; url: string };

interface Props {
  memorial: PublicMemorial;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}

export default function DetailsForm({ memorial, onSave }: Props) {
  const [form, setForm] = useState({
    name: memorial.name,
    born: memorial.born ?? "",
    died: memorial.died ?? "",
    epitaph: memorial.epitaph ?? "",
    location: memorial.location ?? "",
    quote: memorial.quote ?? "",
    quoteAuthor: memorial.quoteAuthor ?? "",
    biography: memorial.biography ?? "",
    visibility: memorial.visibility,
  });
  const [links, setLinks] = useState<LinkRow[]>(memorial.links.map((link) => ({ ...link })));
  const [donations, setDonations] = useState<LinkRow[]>(
    memorial.donations.map((donation) => ({ ...donation })),
  );
  const [media, setMedia] = useState<LinkRow[]>(
    memorial.media.map((item) => ({ label: item.title ?? "", url: item.url })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const usable = media.filter((row) => parseVideoUrl(row.url));
    const dropped = media.length - usable.length;
    try {
      await onSave({
        ...form,
        links,
        donations,
        media: usable.map((row) => ({ title: row.label, url: row.url })),
      });
      if (dropped > 0) {
        setMedia(usable);
        setError(
          `${dropped} link${dropped === 1 ? " is" : "s are"} not a YouTube or Vimeo video, so ${dropped === 1 ? "it was" : "they were"} left out. Nothing else was lost.`,
        );
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 4000);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save the changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      {error && <Notice tone="error">{error}</Notice>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="name">
          <Input
            id="name"
            value={form.name}
            onChange={(event) => set("name")(event.target.value)}
            required
            maxLength={80}
          />
        </Field>
        <Field label="Place" htmlFor="location" hint="Town, region, country — or leave blank.">
          <Input
            id="location"
            value={form.location}
            onChange={(event) => set("location")(event.target.value)}
            maxLength={120}
            placeholder="Cluj-Napoca, Romania"
          />
        </Field>
        <Field label="Born" htmlFor="born" hint="A year or a full date: 1943 or 1943-05-02.">
          <Input
            id="born"
            value={form.born}
            onChange={(event) => set("born")(event.target.value)}
            maxLength={40}
            placeholder="1943-05-02"
          />
        </Field>
        <Field label="Died" htmlFor="died" hint="Leave blank if you would rather not say.">
          <Input
            id="died"
            value={form.died}
            onChange={(event) => set("died")(event.target.value)}
            maxLength={40}
            placeholder="2025-01-17"
          />
        </Field>
      </div>

      <Field
        label="Epitaph"
        htmlFor="epitaph"
        hint="One line shown beneath the name, on the page and on the QR card."
      >
        <Input
          id="epitaph"
          value={form.epitaph}
          onChange={(event) => set("epitaph")(event.target.value)}
          maxLength={160}
          placeholder="She planted trees she would never sit under."
        />
      </Field>

      <Field
        label="Their life"
        htmlFor="biography"
        hint="Plain text. Leave a blank line between paragraphs."
      >
        <Textarea
          id="biography"
          rows={12}
          value={form.biography}
          onChange={(event) => set("biography")(event.target.value)}
          maxLength={20000}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Favourite quote" htmlFor="quote" hint="Optional — shown in larger type.">
          <Textarea
            id="quote"
            rows={3}
            value={form.quote}
            onChange={(event) => set("quote")(event.target.value)}
            maxLength={400}
          />
        </Field>
        <Field label="Who said it" htmlFor="quoteAuthor" hint="Optional attribution.">
          <Input
            id="quoteAuthor"
            value={form.quoteAuthor}
            onChange={(event) => set("quoteAuthor")(event.target.value)}
            maxLength={80}
          />
        </Field>
      </div>

      <ListEditor
        title="Donation links"
        hint="A GoFundMe, a hospice, a charity. We never handle the money and take no cut."
        rows={donations}
        setRows={setDonations}
        labelPlaceholder="Hospice Casa Speranței"
        urlPlaceholder="https://hospice.ro/"
      />

      <MediaEditor rows={media} setRows={setMedia} />

      <ListEditor
        title="Other links"
        hint="An obituary, a photo album, a favourite song — anything worth keeping."
        rows={links}
        setRows={setLinks}
        labelPlaceholder="Photo album"
        urlPlaceholder="https://photos.example.com/album"
      />

      <Field
        label="Who can see it"
        htmlFor="visibility"
        hint="Unlisted pages are kept out of the memorial list and the sitemap, but anyone with the link can open them."
      >
        <Select
          id="visibility"
          value={form.visibility}
          onChange={(event) => set("visibility")(event.target.value)}
        >
          <option value="public">Public — listed on the memorials page</option>
          <option value="unlisted">Unlisted — only people with the link</option>
        </Select>
      </Field>

      <div className="flex items-center gap-3 border-t border-sand-200 pt-6">
        <Button type="submit" loading={saving}>
          <Save className="h-4 w-4" /> Save changes
        </Button>
        {saved && <span className="text-sm text-brand-700">Saved — publishing now.</span>}
      </div>
    </form>
  );
}

function MediaEditor({
  rows,
  setRows,
}: {
  rows: LinkRow[];
  setRows: (rows: LinkRow[]) => void;
}) {
  return (
    <fieldset className="rounded-2xl border border-sand-200 p-5">
      <legend className="px-1 text-sm font-semibold text-ink">Videos and music</legend>
      <p className="text-xs leading-relaxed text-ink-muted">
        Paste a YouTube or Vimeo link — a favourite song, a recording of a speech, a slideshow. The
        video stays on YouTube or Vimeo; nothing is uploaded here, and nothing is requested from them
        until a visitor presses play.
      </p>

      <div className="mt-4 space-y-3">
        {rows.map((row, index) => {
          const invalid = row.url.trim().length > 0 && !parseVideoUrl(row.url);
          return (
            <div key={index} className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={row.label}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, label: event.target.value };
                  setRows(next);
                }}
                placeholder="Her favourite song"
                maxLength={60}
                aria-label="Video title"
                className="sm:w-1/3"
              />
              <Input
                type="url"
                value={row.url}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, url: event.target.value };
                  setRows(next);
                }}
                placeholder="https://www.youtube.com/watch?v=…"
                maxLength={500}
                aria-label="Video URL"
                aria-invalid={invalid}
                className={invalid ? "border-red-300 focus:border-red-400" : ""}
              />
              <Button
                type="button"
                variant="danger"
                onClick={() => setRows(rows.filter((_, position) => position !== index))}
                className="shrink-0"
                aria-label="Remove video"
              >
                <Trash className="h-4 w-4" />
              </Button>
              {invalid && (
                <p className="text-xs text-red-700 sm:w-1/3">
                  Not a YouTube or Vimeo link — this row will be left out when you save.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => setRows([...rows, { label: "", url: "" }])}
      >
        <Plus className="h-3.5 w-3.5" /> Add a video
      </Button>
    </fieldset>
  );
}

function ListEditor({
  title,
  hint,
  rows,
  setRows,
  labelPlaceholder,
  urlPlaceholder,
}: {
  title: string;
  hint: string;
  rows: LinkRow[];
  setRows: (rows: LinkRow[]) => void;
  labelPlaceholder: string;
  urlPlaceholder: string;
}) {
  return (
    <fieldset className="rounded-2xl border border-sand-200 p-5">
      <legend className="px-1 text-sm font-semibold text-ink">{title}</legend>
      <p className="text-xs leading-relaxed text-ink-muted">{hint}</p>

      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={row.label}
              onChange={(event) => {
                const next = [...rows];
                next[index] = { ...row, label: event.target.value };
                setRows(next);
              }}
              placeholder={labelPlaceholder}
              maxLength={60}
              aria-label={`${title} label`}
              className="sm:w-1/3"
            />
            <Input
              type="url"
              value={row.url}
              onChange={(event) => {
                const next = [...rows];
                next[index] = { ...row, url: event.target.value };
                setRows(next);
              }}
              placeholder={urlPlaceholder}
              maxLength={500}
              aria-label={`${title} URL`}
            />
            <Button
              type="button"
              variant="danger"
              onClick={() => setRows(rows.filter((_, position) => position !== index))}
              className="shrink-0"
              aria-label={`Remove ${title} entry`}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => setRows([...rows, { label: "", url: "" }])}
      >
        <Plus className="h-3.5 w-3.5" /> Add a link
      </Button>
    </fieldset>
  );
}
