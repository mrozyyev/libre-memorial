import { useEffect, useState } from "react";
import { Check, Copy, Download, Printer, Share2, QrCode } from "lucide-react";

interface Props {
  url: string;
  name: string;
  dates: string;
}

type QrResult = { png: string; svg: string };

async function buildQr(url: string): Promise<QrResult> {
  const QRCode = (await import("qrcode")).default;
  const options = {
    errorCorrectionLevel: "M" as const,
    margin: 1,
    color: { dark: "#213a34", light: "#ffffff" },
  };
  const [png, svg] = await Promise.all([
    QRCode.toDataURL(url, { ...options, width: 1024 }),
    QRCode.toString(url, { ...options, type: "svg" }),
  ]);
  return { png, svg };
}

export default function QrPanel({ url, name, dates }: Props) {
  const [qr, setQr] = useState<QrResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    buildQr(url)
      .then((result) => {
        if (!cancelled) setQr(result);
      })
      .catch((error) => {
        console.error("Could not generate the QR code", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const download = (href: string, filename: string) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `In memory of ${name}`, url });
      } catch {
        /* user cancelled */
      }
    } else {
      await copy();
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px] lg:items-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Share</p>
        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-ink">
          The QR code and a card to print
        </h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
          Print this card for the service, a photo frame, a bench or a headstone. Anyone who scans
          the code opens this memorial — no app, no account, nothing to install.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => qr && download(qr.png, `${name.toLowerCase().replace(/\s+/g, "-")}-qr.png`)}
            disabled={!qr}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> PNG
          </button>
          <button
            type="button"
            onClick={() =>
              qr &&
              download(
                `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`,
                `${name.toLowerCase().replace(/\s+/g, "-")}-qr.svg`,
              )
            }
            disabled={!qr}
            className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60"
          >
            <QrCode className="h-4 w-4" /> SVG
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            <Printer className="h-4 w-4" /> Print card
          </button>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            {copied ? <Check className="h-4 w-4 text-brand-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-muted">
          The code is generated in your browser — nothing is uploaded anywhere to make it work.
        </p>
      </div>

      <div className="print-card mx-auto w-full max-w-[340px] rounded-3xl border border-sand-200 bg-white p-7 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
          In loving memory
        </p>
        <h3 className="mt-4 font-serif text-2xl font-semibold leading-tight text-ink">{name}</h3>
        {dates && <p className="mt-1.5 text-sm text-ink-muted">{dates}</p>}

        <div className="mx-auto mt-6 h-44 w-44">
          {qr ? (
            <img src={qr.png} alt={`QR code linking to the memorial page for ${name}`} className="h-full w-full" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-sand-200 p-3 text-center text-xs text-ink-muted">
              {failed ? (
                <>
                  <span className="font-medium text-ink-soft">QR code unavailable</span>
                  <span className="break-all">{url.replace(/^https?:\/\//, "")}</span>
                </>
              ) : (
                "Generating…"
              )}
            </div>
          )}
        </div>

        <p className="mt-5 break-all text-[11px] text-ink-muted">{url.replace(/^https?:\/\//, "")}</p>
        <p className="mt-2 text-[11px] text-ink-muted">Scan to visit the memorial</p>
      </div>
    </div>
  );
}
