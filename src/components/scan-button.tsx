"use client";

import { useEffect, useRef, useState } from "react";
import { ScanBarcode, X } from "lucide-react";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts?: { formats?: string[] }) => Detector;

/* Uses the phone/laptop camera to read barcodes, where the browser supports it (Chrome, Edge, Android). */
export function ScanButton({ onCode }: { onCode: (code: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [open, setOpen] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Feature check must run in the browser after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices);
  }, []);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let stop = false;
    const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
    const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stop || !video.current) return;
          const found = await detector.detect(video.current).catch(() => []);
          if (found[0]?.rawValue) {
            onCode(found[0].rawValue);
            setOpen(false);
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setOpen(false);
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onCode]);

  if (!supported) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-panel px-3 text-sm font-semibold hover:border-pine/40"
      >
        <ScanBarcode size={17} /> Scan
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-night/80 p-4" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
            <video ref={video} className="aspect-[4/3] w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 bg-citrus shadow-[0_0_20px_#d6f26b]" />
            <button onClick={() => setOpen(false)} aria-label="Stop scanning" className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white">
              <X size={18} />
            </button>
            <p className="bg-night px-4 py-3 text-center text-sm text-white/80">Point the camera at a barcode</p>
          </div>
        </div>
      )}
    </>
  );
}
