import { useState } from "react";
import type { Story } from "@shared/types";
import { api } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";
import { Pencil, Plus, Trash } from "lucide-react";
import { Button, Card, Field, Input, Notice, Textarea } from "./ui";

interface Props {
  slug: string;
  editKey: string;
  stories: Story[];
  onRefresh: () => Promise<void>;
}

const EMPTY = { title: "", author: "", relation: "", date: "", body: "" };

export default function StoryManager({ slug, editKey, stories, onRefresh }: Props) {
  const [mode, setMode] = useState<"idle" | "new" | string>("idle");
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const startNew = () => {
    setMode("new");
    setForm(EMPTY);
    setError("");
  };

  const startEdit = (story: Story) => {
    setMode(story.id);
    setForm({
      title: story.title ?? "",
      author: story.author,
      relation: story.relation ?? "",
      date: story.date ?? "",
      body: story.body,
    });
    setError("");
  };

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (mode === "new") {
        await api.addStory(slug, editKey, form);
      } else if (mode !== "idle") {
        await api.updateStory(slug, editKey, { id: mode, ...form });
      }
      await onRefresh();
      setMode("idle");
      setForm(EMPTY);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save the story.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this memory from the memorial?")) return;
    try {
      await api.deleteStory(slug, editKey, id);
      await onRefresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove the story.");
    }
  };

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-6">
      {error && <Notice tone="error">{error}</Notice>}

      {mode === "idle" ? (
        <Button type="button" onClick={startNew}>
          <Plus className="h-4 w-4" /> Add a memory
        </Button>
      ) : (
        <Card>
          <h3 className="font-serif text-xl font-semibold text-ink">
            {mode === "new" ? "A new memory" : "Edit this memory"}
          </h3>
          <form onSubmit={submit} className="mt-5 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name of the person writing" htmlFor="story-author">
                <Input
                  id="story-author"
                  value={form.author}
                  onChange={(event) => set("author")(event.target.value)}
                  required
                  maxLength={80}
                  placeholder="Ana Popescu"
                />
              </Field>
              <Field label="How they knew them" htmlFor="story-relation" hint="Optional.">
                <Input
                  id="story-relation"
                  value={form.relation}
                  onChange={(event) => set("relation")(event.target.value)}
                  maxLength={80}
                  placeholder="Granddaughter"
                />
              </Field>
              <Field label="Title" htmlFor="story-title" hint="Optional — a short heading.">
                <Input
                  id="story-title"
                  value={form.title}
                  onChange={(event) => set("title")(event.target.value)}
                  maxLength={120}
                  placeholder="The accordion years"
                />
              </Field>
              <Field label="When" htmlFor="story-date" hint="Optional — a year, a season, anything.">
                <Input
                  id="story-date"
                  value={form.date}
                  onChange={(event) => set("date")(event.target.value)}
                  maxLength={60}
                  placeholder="Summer 2019"
                />
              </Field>
            </div>

            <Field
              label="The memory"
              htmlFor="story-body"
              hint="Plain text. Leave blank lines between paragraphs."
            >
              <Textarea
                id="story-body"
                rows={9}
                value={form.body}
                onChange={(event) => set("body")(event.target.value)}
                required
                maxLength={10000}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={saving}>
                {mode === "new" ? "Add this memory" : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMode("idle");
                  setForm(EMPTY);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {stories.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">
            No memories yet. Stories from friends and family are usually the part people come back to
            — even a few sentences is worth adding.
          </p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {stories.map((story) => (
            <li key={story.id} className="card-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {story.title && (
                    <h3 className="font-serif text-lg font-semibold text-ink">{story.title}</h3>
                  )}
                  <p className="mt-1 text-xs text-ink-muted">
                    {story.author}
                    {story.relation && ` · ${story.relation}`}
                    {story.date && ` · ${story.date}`}
                    {story.createdAt && ` · added ${formatTimestamp(story.createdAt)}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => startEdit(story)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => void remove(story.id)}
                  >
                    <Trash className="h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              </div>
              <p className="mt-4 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                {story.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
