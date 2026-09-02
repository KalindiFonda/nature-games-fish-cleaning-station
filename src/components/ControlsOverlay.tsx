import React, { useState } from 'react';
import { Compass, HelpCircle, MousePointer, Timer, Trophy, X } from 'lucide-react';
import { ControlledFish, ClientFishInfo } from '../types';
import { ChallengeInfo } from '../simulation/ClientDirector';

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
  mode?: 'reef' | 'challenge';
  onToggleMode?: () => void;
  challengeInfo?: ChallengeInfo | null;
}

const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  selectedFish,
  onSelectFish,
  onNextFish,
  clientFishInfo,
  parasiteStats,
  mode = 'reef',
  onToggleMode,
  challengeInfo,
}) => {
  const inChallenge = mode === 'challenge';
  const [helpOpen, setHelpOpen] = useState(false);
  const activeCleanerName = selectedFish === 'wrasse' ? 'Cleaner Wrasse' : 'Sharknose Goby';
  const activeCleanerScientific =
    selectedFish === 'wrasse' ? 'Labroides dimidiatus' : 'Elacatinus evelynae';

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

        {/* Challenge HUD: countdown + nutrition score */}
        {inChallenge && challengeInfo && (
          <div className="pointer-events-none flex items-stretch gap-4 backdrop-blur-md bg-amber-950/70 border-2 border-amber-400/60 px-5 py-2 rounded-2xl text-amber-100 font-mono shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="flex flex-col items-center justify-center">
              <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.25em] text-amber-300/80">
                <Timer className="w-3 h-3" /> Time
              </div>
              <span
                className={`text-xl font-bold tracking-widest tabular-nums leading-tight ${
                  challengeInfo.timeLeft < 30 && !challengeInfo.over
                    ? 'text-red-300 animate-pulse'
                    : ''
                }`}
              >
                {fmtTime(challengeInfo.timeLeft)}
              </span>
            </div>
            <div className="w-px bg-amber-400/30" />
            <div className="flex flex-col items-center justify-center">
              <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.25em] text-amber-300/80">
                <Trophy className="w-3 h-3" /> Nutrition
              </div>
              <span className="text-xl font-bold tracking-widest tabular-nums leading-tight">
                {challengeInfo.score}
              </span>
            </div>
          </div>
        )}

        {/* The single client card: identity, progress, and patience bar */}
        {clientFishInfo && (
          <div
            className={`relative overflow-hidden backdrop-blur-md px-4 pt-2.5 pb-3 rounded-2xl border transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.3)] font-mono min-w-[230px] ${
              isClientPresent
                ? `opacity-100 scale-100 translate-y-0 ${accent.card}`
                : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-semibold tracking-wider">
                {clientName}
                {inChallenge && clientFishInfo.isVisitor && (
                  <span className="ml-2 text-[8px] uppercase tracking-widest bg-amber-400 text-black rounded px-1 py-0.5 font-bold align-middle">
                    visitor ×2
                  </span>
                )}
              </span>
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
            {/* Patience: a soft hairline along the card's bottom edge */}
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/30">
              {clientFishInfo.state !== 'exiting' && (
                <div
                  className={`h-full transition-[width] duration-500 ${
                    patienceLow ? 'bg-amber-400/80' : accent.bar
                  } opacity-60`}
                  style={{ width: `${patienceFrac * 100}%` }}
                />
              )}
            </div>
          </div>
        )}
      </header>

      {/* How to play */}
      {helpOpen && (
        <div className="pointer-events-auto absolute bottom-28 left-1/2 -translate-x-1/2 w-[420px] max-w-[92vw] backdrop-blur-md bg-cyan-950/90 border border-cyan-400/30 rounded-2xl px-5 py-4 text-white font-mono shadow-[0_16px_48px_rgba(0,0,0,0.6)] z-30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] uppercase tracking-[0.3em] text-cyan-300/80">
              How to play
            </span>
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="text-cyan-200/50 hover:text-white cursor-pointer"
              aria-label="Close help"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-cyan-300 mb-1">Reef mode</div>
          <ul className="text-[11px] leading-relaxed opacity-85 space-y-1 mb-3">
            <li>• Click and drag around the water to move your fish — click a cleaner to switch.</li>
            <li>• Brush parasites to eat them. Get close to a gill flap and it lifts open.</li>
            <li>• Hover beside a waiting fish to call it over to the station.</li>
            <li>• Fully cleaned clients leave sparkling — and unlock field notes.</li>
          </ul>
          <div className="text-[10px] uppercase tracking-widest text-amber-300 mb-1">
            3:00 Challenge
          </div>
          <ul className="text-[11px] leading-relaxed opacity-85 space-y-1">
            <li>• Score nutrition: body parasites 10 · teeth &amp; gills 20 · mucus bites 50.</li>
            <li>
              • Hold <b>SPACE</b> on a client's flank to bite mucus — they jolt and lose patience.
            </li>
            <li>• Hold <b>M</b> to massage patience back up.</li>
            <li>• Big-mouthed clients open in timed windows — dart in, leave on the shake.</li>
            <li>• Suitcase fish are visitors: impatient, but worth double.</li>
            <li>• Your colleague preps the waiting queue in the background.</li>
          </ul>
        </div>
      )}

      {/* Bottom Floating Area */}
      <footer className="relative flex flex-col items-center gap-3 w-full">
        <div className="text-[11px] tracking-wider text-cyan-200/80 font-mono flex items-center gap-2 drop-shadow bg-black/30 px-3.5 py-1.5 rounded-full border border-white/10 text-center">
          <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow shrink-0" />
          <span className="uppercase text-[10px] tracking-widest">
            {inChallenge
              ? 'SPACE on the flank: bite mucus • M: massage • gape windows: clean teeth'
              : `Click and drag around the water to move your fish • Click a cleaner to switch`}
          </span>
        </div>

        <div className="pointer-events-auto backdrop-blur-2xl bg-black/45 border border-white/15 px-3 sm:px-4 py-2 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setHelpOpen((o) => !o)}
            aria-label="How to play"
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
              <span>Cleaner Wrasse</span>
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

        <div className="absolute right-0 bottom-0 pointer-events-auto">
          <button
            id="challenge-button"
            type="button"
            onClick={onToggleMode}
            title={inChallenge ? 'End the challenge, back to the reef' : 'Start a 3-minute nutrition challenge'}
            className={`group flex items-center gap-2 px-3 py-2 rounded-2xl border shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-200 cursor-pointer font-mono text-xs ${
              inChallenge
                ? 'bg-amber-900/80 hover:bg-amber-800/90 border-amber-300/60 text-amber-100'
                : 'bg-amber-950/70 hover:bg-amber-900/90 border-amber-400/40 hover:border-amber-300 text-amber-200 hover:text-white'
            }`}
          >
            <Timer className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">
              {inChallenge ? 'End Challenge' : '3:00 Challenge'}
            </span>
          </button>
        </div>

      </footer>
    </div>
  );
};
