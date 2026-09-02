import React, { useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';

export interface FieldNote {
  title: string;
  body: string;
  link: string;
  linkLabel: string;
}

/**
 * Earned biology facts. A new one unlocks as clients leave fully cleaned;
 * the notebook button (bottom-left) shows a badge until it's read.
 */
export const FIELD_NOTES: FieldNote[] = [
  {
    title: 'No cleaners, no reef',
    body: 'When scientists removed cleaner wrasses from patches of reef, many fish species left within weeks and juveniles grew slower. One tiny fish props up the health of the whole neighborhood.',
    link: 'https://en.wikipedia.org/wiki/Bluestreak_cleaner_wrasse',
    linkLabel: 'Cleaner wrasse ecology — Wikipedia',
  },
  {
    title: 'A cleaner eats ~1,200 parasites a day',
    body: 'A single bluestreak cleaner wrasse inspects over 2,000 clients a day and eats around 1,200 parasites. The handful you see per fish here is mercy — real fish can carry hundreds of gnathiid isopods each.',
    link: 'https://en.wikipedia.org/wiki/Bluestreak_cleaner_wrasse',
    linkLabel: 'Bluestreak cleaner wrasse — Wikipedia',
  },
  {
    title: 'Mucus tastes better than parasites',
    body: 'Given a free choice, cleaner wrasses prefer their clients’ mucus to the parasites they’re supposed to eat — it’s richer food, full of nutrients and even UV-protective compounds. The clients hate losing it: that slime is their own sunscreen and germ shield. Every cleaning is a negotiation.',
    link: 'https://royalsocietypublishing.org/doi/10.1098/rspb.2003.2409',
    linkLabel: 'Grutter & Bshary 2003 — Proc. R. Soc. B',
  },
  {
    title: 'Regular customers',
    body: 'Many reef fish visit a cleaning station several times a day, and return to the same station for years. Residents wait their turn; some clients queue up like at a barbershop.',
    link: 'https://en.wikipedia.org/wiki/Cleaning_station',
    linkLabel: 'Cleaning stations — Wikipedia',
  },
  {
    title: 'The pose means "clean me"',
    body: 'Clients signal they want service by hovering still in odd postures — head up, head down, fins flared, mouth open. Some even change color while being cleaned so parasites stand out against their skin.',
    link: 'https://en.wikipedia.org/wiki/Cleaning_symbiosis',
    linkLabel: 'Cleaning symbiosis — Wikipedia',
  },
  {
    title: 'The stripe is an advertisement',
    body: 'The cleaner’s blue-and-black stripe is a uniform that clients recognize from afar. It works so well that a fanged blenny mimics it — impersonating a cleaner to dart in and bite fins instead.',
    link: 'https://en.wikipedia.org/wiki/False_cleanerfish',
    linkLabel: 'The false cleanerfish — Wikipedia',
  },
  {
    title: 'The jolt gives cheaters away',
    body: 'When a cleaner cheats and nips mucus, the client flinches with a whole-body jolt. Researchers count those jolts to measure dishonesty on a reef without touching a single fish.',
    link: 'https://en.wikipedia.org/wiki/Cleaner_fish',
    linkLabel: 'Cleaner fish honesty — Wikipedia',
  },
  {
    title: 'The massage is real',
    body: 'Cleaner wrasses calm nervous clients by fluttering their pelvic fins against them — a genuine tactile massage. Massaged clients stay longer, come back sooner, and even show lower stress hormones.',
    link: 'https://www.nature.com/articles/ncomms1547',
    linkLabel: 'Soares et al. 2011 — Nature Communications',
  },
  {
    title: 'Groupers never eat their cleaner',
    body: 'A grouper could swallow a cleaner wrasse in one gulp — yet it holds its mouth open and lets the little fish pick between its teeth. Predators honor the truce: a good cleaner is worth more alive.',
    link: 'https://en.wikipedia.org/wiki/Cleaner_fish',
    linkLabel: 'Cleaner fish — Wikipedia',
  },
  {
    title: 'Gobies go where wrasses won’t',
    body: 'Sharknose gobies are the Caribbean’s cleaners, and they are bold — they routinely work inside the mouths of moray eels and groupers that would eat almost anything else their size.',
    link: 'https://en.wikipedia.org/wiki/Elacatinus',
    linkLabel: 'Elacatinus gobies — Wikipedia',
  },
  {
    title: 'The mouth shake is a countdown',
    body: 'A grouper that’s done being serviced doesn’t just snap shut — it gives a warning first, a little shake or a partial close, and the cleaner darts out in time. Betrayals are vanishingly rare: eating your dentist is a terrible long-term strategy.',
    link: 'https://en.wikipedia.org/wiki/Cleaning_symbiosis',
    linkLabel: 'Cleaning symbiosis — Wikipedia',
  },
];

interface FieldNotesProps {
  unlocked: FieldNote[];
  unread: number;
  open: boolean;
  onToggle: () => void;
  /** Clients still to clean before the next note unlocks; null = all found */
  toNext: number | null;
}

export const FieldNotes: React.FC<FieldNotesProps> = ({
  unlocked,
  unread,
  open,
  onToggle,
  toNext,
}) => {
  // One note at a time, newest first; arrows page through earlier ones
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(Math.max(0, unlocked.length - 1));
  }, [unlocked.length, open]);
  const note = unlocked[idx];

  return (
    <div className="absolute left-4 sm:left-8 bottom-20 z-20 flex flex-col items-start gap-2">
      {/* Notebook panel */}
      {open && (
        <div className="pointer-events-auto w-80 max-w-[85vw] max-h-[60vh] overflow-y-auto backdrop-blur-md bg-cyan-950/80 border border-cyan-400/30 rounded-2xl px-4 py-3 text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.3em] text-cyan-300/80 font-mono">
              <BookOpen className="w-3 h-3" />
              Field notes · {unlocked.length}/{FIELD_NOTES.length}
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="text-cyan-200/50 hover:text-white transition-colors cursor-pointer"
              aria-label="Close field notes"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {!note && (
            <div className="text-[11px] opacity-70 leading-relaxed py-2">
              Nothing collected yet — send clients away fully cleaned to earn field notes about
              real cleaning-station biology.
            </div>
          )}
          {toNext !== null ? (
            <div className="text-[10px] font-mono text-cyan-300/70 pb-1">
              Clean {toNext} more client{toNext === 1 ? '' : 's'} to earn the next note
            </div>
          ) : (
            <div className="text-[10px] font-mono text-amber-300/80 pb-1">
              ★ All field notes collected
            </div>
          )}
          {note && (
            <div className="py-1.5">
              <div className="text-[12px] font-semibold tracking-wide">{note.title}</div>
              <div className="text-[11px] leading-relaxed opacity-80 mt-1">{note.body}</div>
              <a
                href={note.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-cyan-300 hover:text-cyan-100 mt-1.5 underline underline-offset-2"
              >
                <ExternalLink className="w-3 h-3" />
                {note.linkLabel}
              </a>
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-cyan-400/15">
                <button
                  type="button"
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  disabled={idx === 0}
                  className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-cyan-300 disabled:opacity-25 hover:text-cyan-100 cursor-pointer disabled:cursor-default"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Older
                </button>
                <span className="text-[10px] font-mono opacity-60">
                  {idx + 1} / {unlocked.length}
                </span>
                <button
                  type="button"
                  onClick={() => setIdx((i) => Math.min(unlocked.length - 1, i + 1))}
                  disabled={idx >= unlocked.length - 1}
                  className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-cyan-300 disabled:opacity-25 hover:text-cyan-100 cursor-pointer disabled:cursor-default"
                >
                  Newer <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notebook button with notification badge */}
      <button
        type="button"
        onClick={onToggle}
        className="pointer-events-auto relative flex items-center gap-2 px-3 py-2 rounded-2xl bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-400/40 hover:border-cyan-300 text-cyan-200 hover:text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-200 cursor-pointer font-mono"
        aria-label="Open field notes"
      >
        <BookOpen className="w-4 h-4 text-cyan-400" />
        <span className="text-[10px] uppercase tracking-wider font-semibold">Notes</span>
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-black text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(251,191,36,0.8)] animate-pulse">
            {unread}
          </span>
        )}
      </button>
    </div>
  );
};
