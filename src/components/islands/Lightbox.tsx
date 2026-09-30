import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

interface Item {
  src: string;
  caption: string;
}

/**
 * Progressively-enhanced gallery viewer. The photo grid itself is rendered by
 * Astro (no JavaScript needed to read the page); this island only intercepts
 * clicks on `[data-lightbox]` and shows the large view.
 */
export default function Lightbox() {
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    const collect = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-lightbox]"));
      setItems(
        nodes.map((node) => ({
          src: node.dataset.full ?? "",
          caption: node.dataset.caption ?? "",
        })),
      );
    };
    collect();
    document.addEventListener("astro:page-load", collect);
    return () => document.removeEventListener("astro:page-load", collect);
  }, []);

  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (delta: number) => {
      setIndex((current) => {
        if (current === null || items.length === 0) return current;
        return (current + delta + items.length) % items.length;
      });
    },
    [items.length],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, close, step]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-lightbox]");
      if (!target) return;
      event.preventDefault();
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-lightbox]"));
      const position = nodes.indexOf(target);
      if (position >= 0) setIndex(position);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (index === null) return null;
  const item = items[index];
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={close}
    >
      <div className="flex items-center justify-between p-4 text-white/80">
        <span className="text-sm">
          {index + 1} / {items.length}
        </span>
        <button
          type="button"
          onClick={close}
          className="rounded-full p-2 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center gap-4 px-4 pb-6">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            step(-1);
          }}
          className="hidden rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20 sm:block"
          aria-label="Previous photo"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <figure className="flex max-h-full max-w-5xl flex-col items-center" onClick={(event) => event.stopPropagation()}>
          <img
            src={item.src}
            alt={item.caption || "Memorial photo"}
            className="max-h-[75vh] w-auto rounded-lg object-contain shadow-2xl"
          />
          {item.caption && (
            <figcaption className="mt-4 max-w-2xl text-center text-sm text-white/80">
              {item.caption}
            </figcaption>
          )}
        </figure>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            step(1);
          }}
          className="hidden rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20 sm:block"
          aria-label="Next photo"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
