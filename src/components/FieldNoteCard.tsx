import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronLeft, ChevronRight, Sparkles, Volume2, VolumeX, Waves, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { getSoundMode, setSoundMode, SoundMode, initAudioOnInteraction } from '../utils/audio';

export interface FieldNote {
  title: string;
  body: string;
}

/**
 * Earned biology facts. A new one unlocks as clients leave fully cleaned;
 * the notebook button (bottom-left) shows a badge until it's read.
 */
export const FIELD_NOTES: FieldNote[] = [
  {
    title: "The Reef's Cleaning Station",
    body: 'A cleaning station is a regular place on the reef where cleaner animals wait for clients to arrive. Fish can return to the same station repeatedly, creating a remarkable meeting place where predators and tiny cleaners interact peacefully.',
  },
  {
    title: 'No Cleaners, No Reef',
    body: 'Cleaner fish play an important role in the health of a reef community. When scientists removed cleaner wrasses from sections of reef, many fish species left and young fish grew more slowly, showing how much can depend on these tiny cleaners.',
  },
  {
    title: 'What Gets Cleaned?',
    body: "Cleaners pick off parasites and other unwanted material from their clients, including dead tissue and mucus. They can work over the skin, fins, gills and even inside a fish's mouth.",
  },
  {
    title: 'Mucus Tastes Better Than Parasites',
    body: "Cleaner wrasses sometimes prefer to eat the mucus on their clients' skin rather than parasites. The mucus contains nutrients and compounds that help protect the fish, so cleaners and their clients have to maintain a delicate balance.",
  },
  {
    title: 'A Cleaner in Disguise',
    body: 'Juvenile Spanish hogfish often work as cleaners, picking parasites and other unwanted material from larger fish. Their bright markings help advertise their services, and they can approach much larger clients that would normally see a small fish as prey.',
  },
  {
    title: 'A Strange Partnership',
    body: 'Cleaning is a partnership that benefits both sides: the cleaner gets a meal, while the client has unwanted organisms and material removed from its body. This allows tiny cleaner fish and shrimp to approach animals that might otherwise see them as prey.',
  },
  {
    title: 'Regular Customers',
    body: 'Many reef fish visit cleaning stations repeatedly, sometimes returning to the same station for years. Some visit several times a day, waiting for their turn while other clients are being cleaned.',
  },
  {
    title: 'Everyone Needs a Cleaner',
    body: 'Cleaning stations attract an extraordinary variety of clients, from small reef fish to large predators. Caribbean cleaner gobies have been recorded servicing dozens of different fish species, showing just how important these tiny workers can be across the reef community.',
  },
  {
    title: 'The Pose Means "Clean Me"',
    body: 'Fish can signal that they want to be cleaned by hovering in unusual positions, such as pointing their heads up or down, spreading their fins or opening their mouths. Some species also change color during cleaning, which can make parasites and other unwanted material easier to spot.',
  },
  {
    title: 'The Jolt Gives Cheaters Away',
    body: "Cleaner fish sometimes take a bite of their client's mucus instead of eating parasites. Clients can respond with a sudden whole-body jolt, and researchers use these reactions to study how often cleaners cheat during a cleaning interaction.",
  },
  {
    title: 'The Massage Is Real',
    body: 'Cleaner wrasses sometimes gently touch their clients with their pelvic fins while cleaning them. These tactile interactions appear to calm clients, which can encourage them to stay longer and return to the cleaning station again.',
  },
  {
    title: "Groupers Don't Eat Their Cleaners",
    body: 'A grouper could easily swallow a cleaner fish, yet it can hold its mouth open and allow the cleaner to work between its teeth and around its gills. The relationship benefits both fish, so the grouper has good reason to leave its tiny cleaning partner alone.',
  },
  {
    title: "Gobies Go Where Others Won't",
    body: 'Sharknose gobies are important cleaners on Caribbean reefs and can approach some surprisingly large predators. They regularly enter the mouths and gill chambers of fish such as groupers and moray eels while removing unwanted material.',
  },
  {
    title: 'The Mouth Shake Is a Countdown',
    body: 'A grouper that is ready to leave a cleaning station may give the cleaner a warning by partially closing its mouth or making a small movement. The cleaner usually responds quickly, retreating before the grouper moves away.',
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

interface CrawlingCrabProps {
  unread: number;
}

const CrawlingCrab: React.FC<CrawlingCrabProps> = () => {
  return (
    <div
      className="absolute -top-4 left-1 pointer-events-none z-30 flex items-center select-none"
      style={{
        animation: 'crabScuttle 4.5s ease-in-out infinite',
      }}
      title="New biology note unlocked!"
    >
      <svg
        width="28"
        height="20"
        viewBox="0 0 28 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
      >
        <g className="crab-legs">
          {/* Left Walking Legs */}
          <path
            d="M8 12 C 4 11, 2 14, 1 18"
            stroke="#e0532e"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="origin-[8px_12px] animate-[legWalkL_0.35s_ease-in-out_infinite]"
          />
          <path
            d="M9 13 C 5 14, 4 17, 3 19"
            stroke="#ea580c"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="origin-[9px_13px] animate-[legWalkL_0.35s_ease-in-out_infinite_0.1s]"
          />
          <path
            d="M10 14 C 7 16, 6 18, 5 20"
            stroke="#ea580c"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="origin-[10px_14px] animate-[legWalkL_0.35s_ease-in-out_infinite_0.2s]"
          />

          {/* Right Walking Legs */}
          <path
            d="M20 12 C 24 11, 26 14, 27 18"
            stroke="#e0532e"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="origin-[20px_12px] animate-[legWalkR_0.35s_ease-in-out_infinite]"
          />
          <path
            d="M19 13 C 23 14, 24 17, 25 19"
            stroke="#ea580c"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="origin-[19px_13px] animate-[legWalkR_0.35s_ease-in-out_infinite_0.1s]"
          />
          <path
            d="M18 14 C 21 16, 22 18, 23 20"
            stroke="#ea580c"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="origin-[18px_14px] animate-[legWalkR_0.35s_ease-in-out_infinite_0.2s]"
          />
        </g>

        {/* Left Pincer Arm */}
        <g className="origin-[9px_10px] animate-[clawPinchL_0.8s_ease-in-out_infinite_alternate]">
          <path
            d="M9 10 C 6 8, 4 6, 4 3"
            stroke="#ea580c"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Main claw */}
          <path
            d="M4 3 C 2 2, 1 4, 3 6 C 5 6, 6 4, 4 3 Z"
            fill="#f97316"
            stroke="#c2410c"
            strokeWidth="0.8"
          />
          {/* Pincer tip */}
          <path
            d="M3 3 C 1 1, 0 2, 1 4"
            stroke="#fb923c"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>

        {/* Right Pincer Arm */}
        <g className="origin-[19px_10px] animate-[clawPinchR_0.8s_ease-in-out_infinite_alternate]">
          <path
            d="M19 10 C 22 8, 24 6, 24 3"
            stroke="#ea580c"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Main claw */}
          <path
            d="M24 3 C 26 2, 27 4, 25 6 C 23 6, 22 4, 24 3 Z"
            fill="#f97316"
            stroke="#c2410c"
            strokeWidth="0.8"
          />
          {/* Pincer tip */}
          <path
            d="M25 3 C 27 1, 28 2, 27 4"
            stroke="#fb923c"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>

        {/* Crab Carapace / Body */}
        <ellipse
          cx="14"
          cy="12"
          rx="7"
          ry="5.5"
          fill="#ea580c"
          stroke="#9a3412"
          strokeWidth="1"
        />
        {/* Dorsal carapace shell highlight */}
        <ellipse cx="14" cy="10.8" rx="4.8" ry="3.2" fill="#f97316" />
        <ellipse cx="14" cy="9.8" rx="2.5" ry="1.4" fill="#fb923c" opacity="0.9" />

        {/* Eye stalks */}
        <line x1="11.5" y1="8" x2="10.5" y2="5.5" stroke="#9a3412" strokeWidth="1.2" />
        <line x1="16.5" y1="8" x2="17.5" y2="5.5" stroke="#9a3412" strokeWidth="1.2" />

        {/* Eyeballs */}
        <circle cx="10.5" cy="5.2" r="1.6" fill="#ffffff" stroke="#9a3412" strokeWidth="0.6" />
        <circle cx="10.7" cy="5.2" r="0.8" fill="#18181b" />
        <circle cx="10.4" cy="4.8" r="0.3" fill="#ffffff" />

        <circle cx="17.5" cy="5.2" r="1.6" fill="#ffffff" stroke="#9a3412" strokeWidth="0.6" />
        <circle cx="17.3" cy="5.2" r="0.8" fill="#18181b" />
        <circle cx="17.6" cy="4.8" r="0.3" fill="#ffffff" />
      </svg>
      <style>{`
        @keyframes crabScuttle {
          0% {
            transform: translateX(0px) scaleX(1);
          }
          45% {
            transform: translateX(46px) scaleX(1);
          }
          50% {
            transform: translateX(46px) scaleX(-1);
          }
          95% {
            transform: translateX(0px) scaleX(-1);
          }
          100% {
            transform: translateX(0px) scaleX(1);
          }
        }
        @keyframes legWalkL {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-16deg); }
        }
        @keyframes legWalkR {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(16deg); }
        }
        @keyframes clawPinchL {
          0% { transform: rotate(-8deg); }
          100% { transform: rotate(12deg); }
        }
        @keyframes clawPinchR {
          0% { transform: rotate(8deg); }
          100% { transform: rotate(-12deg); }
        }
      `}</style>
    </div>
  );
};

export const FieldNotes: React.FC<FieldNotesProps> = ({
  unlocked,
  unread,
  open,
  onToggle,
  toNext,
}) => {
  // One note at a time, newest first; arrows page through earlier ones
  const [idx, setIdx] = useState(0);
  const [soundMode, setSoundModeState] = useState<SoundMode>(() => getSoundMode());
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
  const soundMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIdx(Math.max(0, unlocked.length - 1));
  }, [unlocked.length, open]);
  const note = unlocked[idx];

  // Close sound menu on click outside
  useEffect(() => {
    if (!soundMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (soundMenuRef.current && !soundMenuRef.current.contains(e.target as Node)) {
        setSoundMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [soundMenuOpen]);

  const handleSelectSoundMode = (mode: SoundMode) => {
    setSoundModeState(mode);
    setSoundMode(mode);
    setSoundMenuOpen(false);
  };

  return (
    <div className="absolute left-4 sm:left-8 bottom-7 sm:bottom-9 z-20 flex flex-col items-start gap-2">
      {/* Notebook panel with 1.5s slide-up and 1.5s slide-down animation */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 36, scale: 0.96 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto w-80 max-w-[85vw] max-h-[60vh] overflow-y-auto backdrop-blur-md bg-cyan-950/80 border border-cyan-400/30 rounded-2xl px-4 py-3 text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)] origin-bottom-left"
          >
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
                Clean another fish to earn the next note
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notebook button with crawling crab visual clue when a new note is ready */}
      <button
        type="button"
        id="open-field-notes-btn"
        onClick={onToggle}
        className="pointer-events-auto relative flex items-center gap-2 px-3 py-2 rounded-2xl bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-400/40 hover:border-cyan-300 text-cyan-200 hover:text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-200 cursor-pointer font-mono"
        aria-label="Open field notes"
      >
        {/* Crawling crab appears on top of the notes button when a new unread note is unlocked */}
        {unread > 0 && <CrawlingCrab unread={unread} />}

        <BookOpen className="w-4 h-4 text-cyan-400" />
        <span className="text-[10px] uppercase tracking-wider font-semibold">Notes</span>
        {unread > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-black text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(251,191,36,0.8)] animate-pulse">
            {unread}
          </span>
        )}
      </button>

      {/* Sound toggle container with options popup */}
      <div className="relative" ref={soundMenuRef}>
        {/* Popover options: Off, Spa, Carwash */}
        <AnimatePresence>
          {soundMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="pointer-events-auto absolute left-0 bottom-full mb-2 w-44 rounded-2xl bg-cyan-950/95 border border-cyan-400/40 backdrop-blur-xl p-2 shadow-[0_12px_36px_rgba(0,0,0,0.7)] z-30 flex flex-col gap-1 font-mono"
            >
              <div className="px-2 py-1 text-[9px] uppercase tracking-[0.25em] text-cyan-300/80 border-b border-cyan-400/20 font-semibold flex items-center justify-between">
                <span>Sound</span>
                <button
                  type="button"
                  onClick={() => setSoundMenuOpen(false)}
                  className="text-cyan-300/50 hover:text-white cursor-pointer"
                  aria-label="Close sound menu"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Off Option */}
              <button
                type="button"
                id="sound-opt-off"
                onClick={() => handleSelectSoundMode('off')}
                className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                  soundMode === 'off'
                    ? 'bg-white/15 text-white font-bold border border-white/30 shadow-inner'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-black/40 flex items-center justify-center">
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <span className="text-[12px] font-medium leading-none">Off</span>
                </div>
                {soundMode === 'off' && <Check className="w-3.5 h-3.5 text-slate-200" />}
              </button>

              {/* Spa Option */}
              <button
                type="button"
                id="sound-opt-spa"
                onClick={() => handleSelectSoundMode('spa')}
                className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                  soundMode === 'spa'
                    ? 'bg-cyan-500/25 text-cyan-100 font-bold border border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                    : 'text-cyan-200/85 hover:bg-cyan-900/40 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-cyan-900/50 flex items-center justify-center">
                    <Waves className="w-3.5 h-3.5 text-cyan-300" />
                  </div>
                  <span className="text-[12px] font-medium leading-none">Spa</span>
                </div>
                {soundMode === 'spa' && <Check className="w-3.5 h-3.5 text-cyan-300" />}
              </button>

              {/* Carwash Option */}
              <button
                type="button"
                id="sound-opt-carwash"
                onClick={() => handleSelectSoundMode('carwash')}
                className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                  soundMode === 'carwash'
                    ? 'bg-amber-500/25 text-amber-100 font-bold border border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                    : 'text-amber-200/85 hover:bg-amber-900/40 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-amber-900/50 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  </div>
                  <span className="text-[12px] font-medium leading-none">Carwash</span>
                </div>
                {soundMode === 'carwash' && <Check className="w-3.5 h-3.5 text-amber-300" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sound toggle button - strictly says "Sound" as requested */}
        <button
          type="button"
          id="toggle-sound-btn"
          onClick={() => {
            initAudioOnInteraction();
            setSoundMenuOpen((prev) => !prev);
          }}
          className={`pointer-events-auto relative flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all duration-200 cursor-pointer font-mono shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md ${
            soundMode !== 'off'
              ? soundMode === 'carwash'
                ? 'bg-amber-950/70 hover:bg-amber-900/90 border-amber-400/50 hover:border-amber-300 text-amber-200 hover:text-white shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                : 'bg-cyan-950/70 hover:bg-cyan-900/90 border-cyan-400/40 hover:border-cyan-300 text-cyan-200 hover:text-white'
              : 'bg-black/60 hover:bg-black/80 border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-200'
          } ${soundMenuOpen ? 'ring-2 ring-cyan-400/50' : ''}`}
          aria-label="Sound options"
          aria-expanded={soundMenuOpen}
          title="Sound options: Off, Spa, or Carwash"
        >
          {soundMode === 'off' ? (
            <VolumeX className="w-3.5 h-3.5 text-slate-400" />
          ) : soundMode === 'carwash' ? (
            <Volume2 className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
          )}
          <span className="text-[10px] uppercase tracking-wider font-semibold">Sound</span>
        </button>
      </div>
    </div>
  );
};
