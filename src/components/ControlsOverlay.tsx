import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, HelpCircle, MousePointer, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ControlledFish, ClientFishInfo } from '../types';
import { CLIENT_SPECIES_FIELD_NOTES } from '../data/clientFieldNotes';

interface ControlsOverlayProps {
  isRunning?: boolean;
  onToggleRunning?: () => void;
  selectedFish: ControlledFish;
  onSelectFish: (fish: ControlledFish) => void;
  onNextFish?: () => void;
  clientFishInfo?: ClientFishInfo;
  parasiteStats?: {
    total: number;
    remaining: number;
    removed: number;
    teethRemaining: number;
    bodyRemaining: number;
  };
  onFieldNoteVisibilityChange?: (isVisible: boolean) => void;
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  selectedFish,
  onSelectFish,
  clientFishInfo,
  parasiteStats,
  onFieldNoteVisibilityChange,
}) => {
  const [helpOpen, setHelpOpen] = useState(false);
  const [infoTab, setInfoTab] = useState<'instructions' | 'about' | 'resources'>('instructions');
  const [fieldNoteOpen, setFieldNoteOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activeCleanerName =
    selectedFish === 'wrasse' ? 'Spanish Hogfish (Juvenile)' : 'Sharknose Goby';
  const activeCleanerScientific =
    selectedFish === 'wrasse' ? 'Bodianus rufus' : 'Elacatinus evelynae';

  const species = clientFishInfo?.species || 'grouper';
  const clientName = clientFishInfo?.name || '';
  const clientScientific = clientFishInfo?.scientificName || '';
  const isClientPresent = !!(
    clientFishInfo &&
    clientFishInfo.isVisible &&
    clientFishInfo.state !== 'exited' &&
    clientFishInfo.state !== 'waiting'
  );
  const patienceFrac = Math.max(0, Math.min(1, clientFishInfo?.patienceFrac ?? 1));

  const activeNote = species in CLIENT_SPECIES_FIELD_NOTES ? CLIENT_SPECIES_FIELD_NOTES[species] : null;

  // Handle open / close lifecycle for the 15-second field note
  const handleOpenFieldNote = () => {
    setFieldNoteOpen(true);
  };

  const handleCloseFieldNote = () => {
    setFieldNoteOpen(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleToggleFieldNote = () => {
    if (fieldNoteOpen) {
      handleCloseFieldNote();
    } else {
      handleOpenFieldNote();
    }
  };

  // Synchronize pause state with parent
  useEffect(() => {
    onFieldNoteVisibilityChange?.(fieldNoteOpen);
  }, [fieldNoteOpen, onFieldNoteVisibilityChange]);

  // 15-second auto-close timer when field note is visible
  useEffect(() => {
    if (fieldNoteOpen) {
      const timer = setTimeout(() => {
        handleCloseFieldNote();
      }, 15000);
      timerRef.current = timer;
      return () => {
        clearTimeout(timer);
      };
    }
  }, [fieldNoteOpen]);

  // If the client fish departs, close the field note
  useEffect(() => {
    if (!isClientPresent && fieldNoteOpen) {
      handleCloseFieldNote();
    }
  }, [isClientPresent, fieldNoteOpen]);

  // Dynamic species color accent for the single client card
  const accent = (() => {
    switch (species) {
      case 'french_grunt':
        return { card: 'bg-yellow-950/60 border-yellow-300/50 text-yellow-100', bar: 'bg-yellow-300' };
      case 'whitespotted_filefish':
        return { card: 'bg-stone-900/70 border-stone-400/50 text-stone-200', bar: 'bg-stone-300' };
      case 'spotted_moray':
        return { card: 'bg-stone-950/70 border-amber-500/50 text-amber-100', bar: 'bg-amber-400' };
      case 'trumpetfish':
        return { card: 'bg-amber-950/60 border-amber-400/50 text-amber-200', bar: 'bg-amber-300' };
      case 'queen_triggerfish':
        return { card: 'bg-cyan-950/60 border-cyan-400/50 text-cyan-200', bar: 'bg-cyan-300' };
      case 'yellowtail_goatfish':
        return { card: 'bg-yellow-950/50 border-yellow-400/40 text-yellow-200', bar: 'bg-yellow-300' };
      case 'queen_parrotfish':
        return { card: 'bg-teal-950/50 border-teal-400/40 text-teal-200', bar: 'bg-teal-300' };
      default:
        return { card: 'bg-blue-950/50 border-blue-400/40 text-blue-200', bar: 'bg-sky-300' };
    }
  })();

  const patienceLow = patienceFrac < 0.3;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-8 z-10 select-none">
      {/* Top Header with Station Title & the one Client Card */}
      <header className="flex flex-wrap items-start justify-between w-full gap-3">
        <div className="pointer-events-auto flex items-center gap-3.5 backdrop-blur-md bg-white/5 px-4 py-2.5 rounded-2xl border border-white/10 text-white shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="w-9 h-9 rounded-full bg-cyan-400/20 flex items-center justify-center border border-cyan-400/40 shrink-0">
            <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.9)] animate-pulse" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-light tracking-[0.25em] uppercase text-white">
              Coral Reef Cleaning Station
            </h1>
            <p className="text-[10px] opacity-60 uppercase tracking-widest font-mono text-cyan-200">
              Active Cleaner: {activeCleanerName} ({activeCleanerScientific})
            </p>
          </div>
        </div>

        {/* Right column: The single client card & the sliding Field Note card */}
        <div className="flex flex-col items-end gap-2.5 max-w-[360px]">
          {/* The single client card: identity, progress, and patience bar */}
          {clientFishInfo && (
            <div
              className={`relative overflow-hidden backdrop-blur-md px-4 pt-2.5 pb-3 rounded-2xl border transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.3)] font-mono min-w-[240px] pointer-events-auto ${
                isClientPresent
                  ? `opacity-100 scale-100 translate-y-0 ${accent.card}`
                  : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                {/* Clickable fish name to toggle field note */}
                <button
                  type="button"
                  id="client-fish-name-button"
                  onClick={handleToggleFieldNote}
                  className="group flex items-center gap-1.5 text-[12px] font-semibold tracking-wider hover:text-white transition-colors cursor-pointer text-left focus:outline-none"
                  title="Click to reveal species field note (pauses parasite timer)"
                  aria-expanded={fieldNoteOpen}
                >
                  <span className="underline decoration-cyan-400/50 underline-offset-2 group-hover:decoration-cyan-300">
                    {clientName}
                  </span>
                  <BookOpen className="w-3 h-3 text-cyan-300/70 group-hover:text-cyan-200 group-hover:scale-110 transition-transform" />
                </button>
                <span className="text-[9px] opacity-60 uppercase tracking-wider">
                  {clientFishInfo.size}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 mt-0.5">
                <span className="text-[9px] opacity-60 italic">{clientScientific}</span>
                {parasiteStats && (
                  <span className="text-[10px] font-semibold tracking-wider">
                    {parasiteStats.removed}/{parasiteStats.total} cleaned
                  </span>
                )}
              </div>
              {clientFishInfo.state === 'exiting' && (
                <div className="text-[9px] uppercase tracking-wider opacity-70 mt-1">
                  Swimming off…
                </div>
              )}
              {/* Patience / timer bar */}
              <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/30">
                {clientFishInfo.state !== 'exiting' && (
                  <div
                    className={`h-full transition-[width] duration-500 ${
                      fieldNoteOpen
                        ? 'bg-amber-400 animate-pulse'
                        : patienceLow
                        ? 'bg-amber-400/80'
                        : accent.bar
                    } opacity-80`}
                    style={{ width: `${patienceFrac * 100}%` }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Field Note Card: slowly slides down on name click, auto slides back after 15s or on close */}
          <AnimatePresence>
            {fieldNoteOpen && activeNote && isClientPresent && (
              <motion.div
                id="client-field-note-card"
                initial={{ opacity: 0, y: -28, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -24, scale: 0.94 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-auto w-full backdrop-blur-xl bg-[#001830]/95 border border-cyan-400/40 rounded-2xl p-4 text-white shadow-[0_16px_40px_rgba(0,0,0,0.6)] font-mono z-30 select-text"
              >
                {/* Header with Title and Close Button */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-cyan-400/20">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-300 font-semibold flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                    Field Note
                  </span>
                  <button
                    type="button"
                    id="close-client-field-note-btn"
                    onClick={handleCloseFieldNote}
                    className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-cyan-200/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Close field note"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Species Title */}
                <div className="mt-2.5">
                  <h3 className="text-sm font-semibold text-white tracking-wide">{activeNote.title}</h3>
                  <p className="text-[10px] italic opacity-60 text-cyan-200 font-mono">{clientScientific}</p>
                </div>

                {/* Body Text */}
                <p className="text-[11.5px] leading-relaxed opacity-90 text-slate-100 mt-2 font-sans">
                  {activeNote.note}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Info / Instructions Modal */}
      {helpOpen && (
        <div
          id="instructions-modal"
          className="pointer-events-auto absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 w-[490px] max-w-[92vw] h-[290px] max-h-[75vh] flex flex-col backdrop-blur-xl bg-[#001830]/95 border border-cyan-400/40 rounded-2xl p-5 text-white shadow-[0_16px_48px_rgba(0,0,0,0.6)] z-30"
        >
          {/* Header with 3 Tabs and Close button */}
          <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-cyan-400/20 shrink-0">
            {/* Tab navigation */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                id="tab-instructions-btn"
                onClick={() => setInfoTab('instructions')}
                className={`px-3 py-1 text-[11px] font-sans font-medium rounded-lg transition-all cursor-pointer ${
                  infoTab === 'instructions'
                    ? 'bg-cyan-400 text-black font-semibold shadow-[0_0_10px_rgba(34,211,238,0.5)]'
                    : 'text-cyan-100/70 hover:text-white hover:bg-white/10'
                }`}
              >
                Instructions
              </button>
              <button
                type="button"
                id="tab-about-btn"
                onClick={() => setInfoTab('about')}
                className={`px-3 py-1 text-[11px] font-sans font-medium rounded-lg transition-all cursor-pointer ${
                  infoTab === 'about'
                    ? 'bg-cyan-400 text-black font-semibold shadow-[0_0_10px_rgba(34,211,238,0.5)]'
                    : 'text-cyan-100/70 hover:text-white hover:bg-white/10'
                }`}
              >
                About
              </button>
              <button
                type="button"
                id="tab-resources-btn"
                onClick={() => setInfoTab('resources')}
                className={`px-3 py-1 text-[11px] font-sans font-medium rounded-lg transition-all cursor-pointer ${
                  infoTab === 'resources'
                    ? 'bg-cyan-400 text-black font-semibold shadow-[0_0_10px_rgba(34,211,238,0.5)]'
                    : 'text-cyan-100/70 hover:text-white hover:bg-white/10'
                }`}
              >
                Resources
              </button>
            </div>

            <button
              type="button"
              id="close-instructions-btn"
              onClick={() => setHelpOpen(false)}
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-cyan-200/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tab Content Area: fixed size across tabs, scrolls vertically when needed */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 custom-scrollbar">
            {/* Tab 1: Instructions */}
            {infoTab === 'instructions' && (
              <ul className="text-[11.5px] leading-relaxed opacity-90 space-y-2.5 font-sans text-slate-100">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
                  <span>Move your mouse around the water to guide your cleaner fish - click either cleaner to switch</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
                  <span>Brush parasites to eat them. Get close to a gill flap to check behind.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
                  <span>Click on a waiting client fish to attract them to the cleaning station</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
                  <span>Click the client fish name in the top right to read more about it</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
                  <span>Fully clean a fish of parasites and watch them sparkle - rewarding you with a new field note in the bottom left</span>
                </li>
              </ul>
            )}

            {/* Tab 2: About */}
            {infoTab === 'about' && (
              <div className="py-2 font-sans text-slate-100">
                <p className="text-[12px] sm:text-[12.5px] leading-relaxed font-normal text-slate-200">
                  A collaboration between Nature Venture and Internet of Elephants. Developed by Gautam Shah and Kalindi Fonda.
                </p>
              </div>
            )}

            {/* Tab 3: Resources (Blank for now) */}
            {infoTab === 'resources' && (
              <div className="py-2 font-sans" />
            )}
          </div>
        </div>
      )}

      {/* Bottom Floating Area */}
      <footer className="relative flex flex-col items-center gap-3 w-full">
        <div className="pointer-events-auto backdrop-blur-2xl bg-black/45 border border-white/15 px-3 sm:px-4 py-2 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white flex items-center justify-center gap-3">
          <button
            type="button"
            id="open-instructions-btn"
            onClick={() => {
              setHelpOpen((o) => {
                if (!o) setInfoTab('instructions');
                return !o;
              });
            }}
            aria-label="Instructions, About & Resources"
            title="Instructions, About & Resources"
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 border border-white/10 text-cyan-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              id="select-wrasse-btn"
              type="button"
              onClick={() => onSelectFish('wrasse')}
              className={`text-[10px] sm:text-[11px] uppercase tracking-wider font-mono px-3.5 py-1.5 rounded-xl transition duration-150 cursor-pointer flex items-center gap-1.5 ${
                selectedFish === 'wrasse'
                  ? 'bg-cyan-400 text-black font-semibold shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <MousePointer
                className={`w-3 h-3 ${selectedFish === 'wrasse' ? 'text-black' : 'text-cyan-400'}`}
              />
              <span>Spanish Hogfish</span>
            </button>

            <button
              id="select-gobi-btn"
              type="button"
              onClick={() => onSelectFish('gobi')}
              className={`text-[10px] sm:text-[11px] uppercase tracking-wider font-mono px-3.5 py-1.5 rounded-xl transition duration-150 cursor-pointer flex items-center gap-1.5 ${
                selectedFish === 'gobi'
                  ? 'bg-cyan-400 text-black font-semibold shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <MousePointer
                className={`w-3 h-3 ${selectedFish === 'gobi' ? 'text-black' : 'text-cyan-400'}`}
              />
              <span>Sharknose Goby</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

