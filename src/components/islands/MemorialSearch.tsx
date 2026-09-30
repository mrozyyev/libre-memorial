import { useEffect, useState } from "react";
import { Search } from "lucide-react";

/**
 * Client-side filter over the pre-rendered memorial cards. The cards themselves
 * are static HTML; this only toggles visibility, so nothing is fetched.
 */
export default function MemorialSearch() {
  const [query, setQuery] = useState("");
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-memorial]"));
    const term = query.trim().toLowerCase();
    let visible = 0;
    for (const card of cards) {
      const haystack = (card.dataset.search ?? "").toLowerCase();
      const match = !term || haystack.includes(term);
      card.hidden = !match;
      if (match) visible += 1;
    }
    setEmpty(visible === 0 && cards.length > 0);
  }, [query]);

  return (
    <div>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, place or a few words"
          aria-label="Search memorials"
          className="w-full rounded-full border border-sand-200 bg-paper py-3 pl-11 pr-4 text-sm text-ink placeholder:text-ink-muted focus:border-brand-400 focus:outline-none"
        />
      </div>
      {empty && (
        <p className="mt-4 text-sm text-ink-muted">
          No memorial matches “{query}”. Try a different name or place.
        </p>
      )}
    </div>
  );
}
