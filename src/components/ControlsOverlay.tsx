import React from 'react';
import { Compass, MousePointer, Sparkles, Clock, Waves, Shield, SkipForward } from 'lucide-react';
import { ControlledFish, ClientFishInfo } from '../types';

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
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  selectedFish,
  onSelectFish,
  onNextFish,
  clientFishInfo,
  parasiteStats,
}) => {
  const activeCleanerName = selectedFish === 'wrasse' ? 'Cleaner Wrasse' : 'Sharknose Goby';
  const activeCleanerScientific = selectedFish === 'wrasse' ? 'Labroides dimidiatus' : 'Elacatinus evelynae';

  const species = clientFishInfo?.species || 'grouper';
  const isTriggerfish = species === 'queen_triggerfish';
  const isParrotfish = species === 'queen_parrotfish';
  const isGoatfish = species === 'yellowtail_goatfish';
  const isTrumpetfish = species === 'trumpetfish';
  const isMoray = species === 'spotted_moray';
  const isFilefish = species === 'whitespotted_filefish';
  const isGrunt = species === 'french_grunt';

  const clientName = clientFishInfo?.name || 'Coral Grouper';
  const clientScientific = clientFishInfo?.scientificName || 'Epinephelus lanceolatus';
  const isClientPresent = !!(clientFishInfo && clientFishInfo.isVisible && clientFishInfo.state !== 'exited' && clientFishInfo.state !== 'waiting');

  // Dynamic species color schemes
  const getBadgeStyle = () => {
    if (isGrunt) return 'bg-yellow-950/60 border-yellow-300/50 text-yellow-100';
    if (isFilefish) return 'bg-stone-900/70 border-stone-400/50 text-stone-200';
    if (isMoray) return 'bg-stone-950/70 border-amber-500/50 text-amber-100';
    if (isTrumpetfish) return 'bg-amber-950/60 border-amber-400/50 text-amber-200';
    if (isTriggerfish) return 'bg-cyan-950/60 border-cyan-400/50 text-cyan-200';
    if (isGoatfish) return 'bg-yellow-950/50 border-yellow-400/40 text-yellow-200';
    if (isParrotfish) return 'bg-teal-950/50 border-teal-400/40 text-teal-200';
    if (clientFishInfo?.state === 'exiting') return 'bg-amber-950/50 border-amber-400/40 text-amber-200';
    return 'bg-blue-950/50 border-blue-400/40 text-blue-200';
  };

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-8 z-10 select-none">
      {/* Top Header with Specimen Title & Client Specimen Card */}
      <header className="flex flex-wrap items-start justify-between w-full gap-3">
        {/* Specimen Title & Active Cleaner Status */}
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

        {/* Client Fish Info & Parasite Tracking */}
        <div className="pointer-events-auto flex items-center flex-wrap gap-2">
          {/* Dynamic Client Fish Status Badge */}
          {clientFishInfo && (
            <div
              className={`backdrop-blur-md px-3.5 py-2 rounded-2xl border transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center gap-2.5 font-mono ${
                isClientPresent
                  ? `opacity-100 scale-100 translate-y-0 ${getBadgeStyle()}`
                  : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
              }`}
            >
              {isGrunt ? (
                <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin-slow" />
              ) : isFilefish ? (
                <Sparkles className="w-3.5 h-3.5 text-stone-300 animate-spin-slow" />
              ) : isMoray ? (
                <Shield className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              ) : isTrumpetfish ? (
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin-slow" />
              ) : isTriggerfish ? (
                <Shield className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
              ) : isGoatfish ? (
                <Waves className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
              ) : isParrotfish ? (
                <Sparkles className="w-3.5 h-3.5 text-teal-300 animate-spin-slow" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-cyan-300" />
              )}
              <div className="text-left">
                <div className="text-[9px] uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                  <span>Client Specimen: {clientFishInfo.size}</span>
                  {clientFishInfo.state === 'exiting' && (
                    <span className="text-amber-400 font-bold">• Reversing Out...</span>
                  )}
                  {clientFishInfo.state === 'stationary' && clientFishInfo.transitionCountdown > 0 && (
                    <span className="text-cyan-300 font-normal">({clientFishInfo.transitionCountdown}s in station)</span>
                  )}
                </div>
                <div className="text-[10px] sm:text-[11px] font-semibold tracking-wider flex items-center gap-1.5">
                  <span
                    className={
                      isGrunt
                        ? 'text-yellow-300'
                        : isFilefish
                        ? 'text-stone-200'
                        : isMoray
                        ? 'text-amber-400'
                        : isTrumpetfish
                        ? 'text-amber-300'
                        : isTriggerfish
                        ? 'text-cyan-300'
                        : isGoatfish
                        ? 'text-yellow-300'
                        : isParrotfish
                        ? 'text-teal-300'
                        : 'text-white'
                    }
                  >
                    {clientName}
                  </span>
                  <span className="text-[9px] opacity-60 font-normal italic">({clientScientific})</span>
                </div>
              </div>
            </div>
          )}

          {/* Parasites Tracker */}
          {parasiteStats && (
            <div
              className={`backdrop-blur-md bg-amber-950/40 border border-amber-500/30 px-3.5 py-2 rounded-2xl text-amber-200 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hidden md:flex items-center gap-2 font-mono transition-all duration-500 ${
                isClientPresent ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <div className="text-left">
                <div className="text-[9px] uppercase tracking-wider text-amber-300/70">
                  {isGrunt
                    ? 'Small Mouth & Striped Flanks'
                    : isFilefish
                    ? 'Chisel Teeth & Rough Flank'
                    : isMoray
                    ? 'Fangs & Neck Parasites'
                    : isTrumpetfish
                    ? 'Snout & Body Parasites'
                    : isTriggerfish
                    ? 'Mouth & Flank Parasites'
                    : isGoatfish
                    ? 'Barbels & Body Parasites'
                    : isParrotfish
                    ? 'Beak & Body Parasites'
                    : 'Teeth & Body Parasites'}
                </div>
                <div className="text-[10px] sm:text-[11px] font-semibold tracking-wider">
                  {parasiteStats.removed} / {parasiteStats.total} Cleaned
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Floating Center Watermark Specimen Title */}
      <div
        className={`pointer-events-none absolute bottom-28 right-6 sm:right-10 hidden sm:block text-right transition-all duration-500 ${
          isClientPresent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <div className="text-[10px] opacity-30 uppercase tracking-[0.5em] mb-1 font-mono text-cyan-200">
          Client fish
        </div>
        <div className="text-2xl sm:text-3xl font-light tracking-tighter opacity-25 text-white font-mono uppercase">
          {clientScientific}
        </div>
      </div>

      {/* Bottom Floating Area */}
      <footer className="relative flex flex-col items-center gap-3 w-full">
        {/* Interaction Hint */}
        <div className="text-[11px] tracking-wider text-cyan-200/80 font-mono flex items-center gap-2 drop-shadow bg-black/30 px-3.5 py-1.5 rounded-full border border-white/10 text-center">
          <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow shrink-0" />
          <span className="uppercase text-[10px] tracking-widest">
            Drag water to guide {activeCleanerName} • Click cleaner fish to switch
          </span>
        </div>

        {/* Master Frosted Dock with Fish Selector Switcher */}
        <div className="pointer-events-auto backdrop-blur-2xl bg-black/45 border border-white/15 px-3 sm:px-4 py-2 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white flex items-center justify-center gap-3">
          {/* Fish Selector Switcher Pills */}
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
              <MousePointer className={`w-3 h-3 ${selectedFish === 'wrasse' ? 'text-black' : 'text-cyan-400'}`} />
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
              <MousePointer className={`w-3 h-3 ${selectedFish === 'gobi' ? 'text-black' : 'text-cyan-400'}`} />
              <span>Sharknose Goby</span>
            </button>
          </div>
        </div>

        {/* Small "Next Fish" button in the bottom right corner */}
        <div className="absolute right-0 bottom-0 pointer-events-auto">
          <button
            id="next-fish-button"
            type="button"
            onClick={onNextFish}
            title="Bypass 15 seconds and move to next fish"
            className="group flex items-center gap-2 px-3 py-2 rounded-2xl bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-400/40 hover:border-cyan-300 text-cyan-200 hover:text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] backdrop-blur-md transition-all duration-200 cursor-pointer font-mono text-xs"
          >
            <span className="text-[10px] uppercase tracking-wider font-semibold">Next Fish</span>
            <SkipForward className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </footer>
    </div>
  );
};
