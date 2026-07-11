"use client";

// Dark-mode ambient: a handful of tiny, slow, blurred motes drifting behind all
// content — the night-time counterpart to the daytime biophilic blobs, and the
// same "living in a glowing starfield" language as the day-complete celebration
// card, just dialled down to sit behind ordinary content everywhere. Pure CSS,
// fixed and pointer-transparent; hidden entirely in light mode and under
// reduced-motion (see globals.css .fireflies rules).
const MOTES = [
  { left: "12%", top: "22%", size: 5, delay: "0s", dur: "19s" },
  { left: "20%", top: "10%", size: 3, delay: "-9s", dur: "22s" },
  { left: "78%", top: "16%", size: 4, delay: "-6s", dur: "23s" },
  { left: "90%", top: "8%", size: 4, delay: "-17s", dur: "20s" },
  { left: "64%", top: "68%", size: 6, delay: "-11s", dur: "21s" },
  { left: "28%", top: "74%", size: 4, delay: "-3s", dur: "26s" },
  { left: "88%", top: "48%", size: 5, delay: "-15s", dur: "24s" },
  { left: "6%", top: "54%", size: 3, delay: "-8s", dur: "25s" },
  { left: "45%", top: "88%", size: 4, delay: "-20s", dur: "23s" },
  { left: "55%", top: "30%", size: 3, delay: "-4s", dur: "27s" },
];

export default function Fireflies() {
  return (
    <div className="fireflies pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="firefly"
          style={{
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            animationDelay: m.delay,
            animationDuration: m.dur,
          }}
        />
      ))}
    </div>
  );
}
