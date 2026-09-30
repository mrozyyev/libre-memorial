import { useEffect, useRef, useState } from "react";
import type { PhotoResource } from "@/lib/api";
import { api } from "@/lib/api";
import { shrinkImage, formatBytes } from "@/lib/image";
import { Star, Trash, Upload, ArrowUp, ArrowDown, Check, ImagePlus } from "lucide-react";
import { Button, Card, Input, Notice, Spinner } from "./ui";

interface Props {
  slug: string;
  editKey: string;
  photos: PhotoResource[];
  cover?: string;
  onRefresh: () => Promise<void>;
}

interface Upload {
  name: string;
  status: "working" | "done" | "error";
  message?: string;
  bytes?: number;
}

export default function PhotoManager({ slug, editKey, photos, cover, onRefresh }: Props) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCaptions(Object.fromEntries(photos.map((photo) => [photo.file, photo.caption ?? ""])));
  }, [photos]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, 12);
    setError("");
    setBusy(true);
    setUploads(files.map((file) => ({ name: file.name, status: "working" })));

    for (const [index, file] of files.entries()) {
      try {
        if (!file.type.startsWith("image/")) throw new Error("Not an image file.");
        const shrunk = await shrinkImage(file);
        await api.addPhoto(slug, editKey, {
          dataUrl: shrunk.dataUrl,
          caption: "",
          makeCover: photos.length === 0 && index === 0,
        });
        setUploads((current) =>
          current.map((item, position) =>
            position === index ? { ...item, status: "done", bytes: shrunk.bytes } : item,
          ),
        );
      } catch (uploadError) {
        setUploads((current) =>
          current.map((item, position) =>
            position === index
              ? {
                  ...item,
                  status: "error",
                  message:
                    uploadError instanceof Error ? uploadError.message : "Upload failed.",
                }
              : item,
          ),
        );
      }
    }

    setBusy(false);
    await onRefresh();
    window.setTimeout(() => setUploads([]), 6000);
  };

  const remove = async (file: string) => {
    if (!window.confirm("Remove this photo from the memorial?")) return;
    setError("");
    try {
      await api.deletePhoto(slug, editKey, file);
      await onRefresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove the photo.");
    }
  };

  const saveCaption = async (file: string) => {
    const caption = captions[file] ?? "";
    const existing = photos.find((photo) => photo.file === file);
    if (existing && (existing.caption ?? "") === caption) return;
    try {
      await api.updatePhoto(slug, editKey, { file, caption });
      await onRefresh();
    } catch (captionError) {
      setError(captionError instanceof Error ? captionError.message : "Could not save the caption.");
    }
  };

  const makeCover = async (file: string) => {
    try {
      await api.updatePhoto(slug, editKey, {
        file,
        caption: captions[file] ?? photos.find((photo) => photo.file === file)?.caption ?? "",
        makeCover: true,
      });
      await onRefresh();
    } catch (coverError) {
      setError(coverError instanceof Error ? coverError.message : "Could not set the cover photo.");
    }
  };

  const move = async (index: number, delta: number) => {
    const next = [...photos];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await api.reorderPhotos(
        slug,
        editKey,
        next.map((photo) => photo.file),
      );
      await onRefresh();
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : "Could not reorder the photos.");
    }
  };

  return (
    <div className="space-y-6">
      {error && <Notice tone="error">{error}</Notice>}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-brand-400 bg-brand-50" : "border-sand-200 bg-sand-50"
        }`}
      >
        <ImagePlus className="mx-auto h-7 w-7 text-brand-500" />
        <p className="mt-3 text-sm font-medium text-ink">
          Drag photographs here, or choose them from your device
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-muted">
          Photos are resized in your browser before they are uploaded, so a phone snapshot becomes a
          small, fast image. Up to 12 at a time, {formatBytes(8 * 1024 * 1024)} each.
        </p>
        <div className="mt-5 flex justify-center">
          <Button type="button" loading={busy} onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Choose photos
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-2">
          {uploads.map((upload, index) => (
            <li
              key={`${upload.name}-${index}`}
              className="flex items-center gap-3 rounded-xl border border-sand-200 bg-paper px-4 py-2.5 text-sm"
            >
              {upload.status === "working" && <Spinner />}
              {upload.status === "done" && <Check className="h-4 w-4 text-brand-600" />}
              {upload.status === "error" && <span className="text-red-600">!</span>}
              <span className="min-w-0 flex-1 truncate text-ink-soft">{upload.name}</span>
              <span className="text-xs text-ink-muted">
                {upload.status === "error" ? upload.message : formatBytes(upload.bytes)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {photos.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">
            No photographs yet. The first one you add becomes the portrait shown at the top of the
            memorial.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {photos.map((photo, index) => (
            <li key={photo.file} className="card-surface overflow-hidden">
              <div className="relative">
                <img
                  src={photo.url}
                  alt={photo.caption || "Memorial photo"}
                  loading="lazy"
                  className="aspect-[4/3] w-full bg-sand-100 object-cover"
                />
                {cover === photo.file && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
                    <Star className="h-3.5 w-3.5" /> Portrait
                  </span>
                )}
              </div>
              <div className="space-y-3 p-4">
                <Input
                  value={captions[photo.file] ?? ""}
                  onChange={(event) =>
                    setCaptions((current) => ({ ...current, [photo.file]: event.target.value }))
                  }
                  onBlur={() => void saveCaption(photo.file)}
                  placeholder="Caption — where, when, who"
                  maxLength={300}
                  aria-label="Photo caption"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void makeCover(photo.file)}
                    disabled={cover === photo.file}
                  >
                    <Star className="h-3.5 w-3.5" /> Portrait
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move earlier"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void move(index, 1)}
                    disabled={index === photos.length - 1}
                    aria-label="Move later"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    className="ml-auto"
                    onClick={() => void remove(photo.file)}
                  >
                    <Trash className="h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
                <p className="text-[11px] text-ink-muted">{formatBytes(photo.bytes)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
