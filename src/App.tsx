/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef, useState } from 'react';
import { RotateCcw, Trophy, Waves } from 'lucide-react';
import { FishCanvas } from './components/FishCanvas';
import { ControlsOverlay } from './components/ControlsOverlay';
import { FieldNotes, FIELD_NOTES, FieldNote } from './components/FieldNoteCard';
import { ChallengeInfo } from './simulation/ClientDirector';
import { ControlledFish, ClientFishInfo } from './types';

// Fixed physical parameters: always Gentle speed and Compact scale
const GENTLE_SPEED = 1.8;
const WRASSE_COMPACT_SCALE = 0.72;
const GOBI_COMPACT_SCALE = 0.65;

export default function App() {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  
  // Default selection is the Cleaner Wrasse
  const [selectedFish, setSelectedFish] = useState<ControlledFish>('wrasse');

  // Trigger state for moving to the next fish immediately
  const [skipTrigger, setSkipTrigger] = useState<number>(0);

  const [clientFishInfo, setClientFishInfo] = useState<ClientFishInfo>({
    species: 'grouper',
    name: 'Coral Grouper',
    scientificName: 'Epinephelus lanceolatus',
    size: '~60–120 cm',
    keyFeatures: [
      'Heavy predatory cranium',
      'Sharp conical predator teeth',
      'Coral red-amber spotted body',
      'Deep cavernous oral cavity',
    ],
    state: 'stationary',
    elapsedSeconds: 0,
    transitionCountdown: 15,
    isVisible: true,
  });

  const [parasiteStats, setParasiteStats] = useState<{
    total: number;
    remaining: number;
    removed: number;
    teethRemaining: number;
    bodyRemaining: number;
  }>({
    total: 72,
    remaining: 72,
    removed: 0,
    teethRemaining: 36,
    bodyRemaining: 36,
  });

  // Field notes: a notebook of earned facts. The first fully-cleaned client
  // unlocks a note, then every 3rd after that; the notebook button carries a
  // notification badge until the new note is read.
  const [unlockedNotes, setUnlockedNotes] = useState<FieldNote[]>([]);
  const [unreadNotes, setUnreadNotes] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [cleanedCount, setCleanedCount] = useState(0);
  const cleanedCountRef = useRef(0);
  const unlockedCountRef = useRef(0);

  const handleClientCleaned = useCallback(() => {
    cleanedCountRef.current += 1;
    const c = cleanedCountRef.current;
    setCleanedCount(c);
    if ((c - 1) % 3 !== 0 || unlockedCountRef.current >= FIELD_NOTES.length) return;
    const note = FIELD_NOTES[unlockedCountRef.current];
    unlockedCountRef.current += 1;
    setUnlockedNotes((prev) => [...prev, note]);
    setUnreadNotes((u) => u + 1);
    setNotesOpen(true); // a fresh note pops the notebook open
  }, []);

  // Clients still to clean before the next note unlocks (null = all found)
  const notesToNext =
    unlockedNotes.length >= FIELD_NOTES.length
      ? null
      : Math.max(0, unlockedNotes.length * 3 + 1 - cleanedCount);

  const toggleNotes = useCallback(() => {
    setNotesOpen((prev) => !prev);
    setUnreadNotes(0);
  }, []);

  // Game mode: relaxed Reef mode, or the 3-minute nutrition Challenge
  const [mode, setMode] = useState<'reef' | 'challenge'>('reef');
  const [challengeInfo, setChallengeInfo] = useState<ChallengeInfo | null>(null);
  const [challengeRestart, setChallengeRestart] = useState(0);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'reef' ? 'challenge' : 'reef'));
  }, []);

  const restartChallenge = useCallback(() => {
    setChallengeRestart((n) => n + 1);
  }, []);

  const backToReef = useCallback(() => setMode('reef'), []);

  const showEndScreen = mode === 'challenge' && !!challengeInfo?.over;

  const toggleRunning = () => {
    setIsRunning((prev) => !prev);
  };

  const handleNextFish = () => {
    setSkipTrigger((prev) => prev + 1);
  };

  return (
    <main
      id="cleaner-wrasse-app"
      className="relative w-screen h-screen overflow-hidden bg-[#001f3f] text-white select-none font-sans"
    >
      {/* 2D Canvas Fish Simulation */}
      <FishCanvas
        isRunning={isRunning}
        onToggleRunning={toggleRunning}
        selectedFish={selectedFish}
        onSelectFish={setSelectedFish}
        wrasseScale={WRASSE_COMPACT_SCALE}
        wrasseSpeed={GENTLE_SPEED}
        gobiScale={GOBI_COMPACT_SCALE}
        gobiSpeed={GENTLE_SPEED}
        skipTrigger={skipTrigger}
        onParasiteStatsUpdate={setParasiteStats}
        onClientFishUpdate={setClientFishInfo}
        onClientCleaned={handleClientCleaned}
        mode={mode}
        challengeRestartTrigger={challengeRestart}
        onChallengeUpdate={setChallengeInfo}
      />

      {/* Atmospheric Ambient Layers of Frosted Glass Theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-black/60 pointer-events-none" />
      <div className="absolute inset-0 bg-dot-grid opacity-10 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Floating Interactive Controls Overlay */}
      <ControlsOverlay
        isRunning={isRunning}
        onToggleRunning={toggleRunning}
        selectedFish={selectedFish}
        onSelectFish={setSelectedFish}
        onNextFish={handleNextFish}
        clientFishInfo={clientFishInfo}
        parasiteStats={parasiteStats}
        mode={mode}
        onToggleMode={toggleMode}
        challengeInfo={challengeInfo}
      />

      {/* Challenge pre-shift countdown */}
      {mode === 'challenge' && challengeInfo && challengeInfo.countdown > 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center">
            <div
              key={Math.ceil(challengeInfo.countdown)}
              className="text-9xl font-bold font-mono text-amber-300 drop-shadow-[0_0_40px_rgba(251,191,36,0.6)]"
              style={{ animation: 'countPop 1s ease-out' }}
            >
              {Math.ceil(challengeInfo.countdown)}
            </div>
            <div className="mt-4 text-[12px] font-mono uppercase tracking-widest text-amber-200/90 bg-black/40 px-4 py-2 rounded-full">
              Space — bite mucus · M — massage · eat everything
            </div>
          </div>
          <style>{`@keyframes countPop { 0% { transform: scale(1.6); opacity: 0.2; } 30% { transform: scale(1); opacity: 1; } 100% { transform: scale(0.92); opacity: 0.9; } }`}</style>
        </div>
      )}

      {/* Challenge end screen */}
      {showEndScreen && challengeInfo && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="pointer-events-auto w-96 max-w-[90vw] backdrop-blur-md bg-cyan-950/90 border border-amber-400/40 rounded-3xl px-8 py-7 text-white font-mono shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-center">
            <div className="flex justify-center mb-2">
              <Trophy className="w-8 h-8 text-amber-400" />
            </div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-amber-300/80">
              Shift over
            </div>
            <div className="text-4xl font-bold tracking-tight mt-2 tabular-nums">
              {challengeInfo.score}
            </div>
            <div className="text-[10px] uppercase tracking-widest opacity-60 mb-4">
              nutrition points
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-6">
              <div className="bg-white/5 rounded-xl py-2">
                <div className="text-lg font-bold tabular-nums">{challengeInfo.cleanedClients}</div>
                <div className="text-[8px] uppercase tracking-wider opacity-60">
                  clients cleaned
                </div>
              </div>
              <div className="bg-white/5 rounded-xl py-2">
                <div className="text-lg font-bold tabular-nums">{challengeInfo.parasitesEaten}</div>
                <div className="text-[8px] uppercase tracking-wider opacity-60">parasites</div>
              </div>
              <div className="bg-white/5 rounded-xl py-2">
                <div className="text-lg font-bold tabular-nums">{challengeInfo.mucusBites}</div>
                <div className="text-[8px] uppercase tracking-wider opacity-60">mucus bites</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={restartChallenge}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black text-[11px] uppercase tracking-wider font-bold cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Swim again
              </button>
              <button
                type="button"
                onClick={backToReef}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] uppercase tracking-wider font-semibold cursor-pointer transition-colors"
              >
                <Waves className="w-3.5 h-3.5" /> Back to reef
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Earned biology notebook (Reef mode) */}
      <FieldNotes
        unlocked={unlockedNotes}
        unread={unreadNotes}
        open={notesOpen}
        onToggle={toggleNotes}
        toNext={notesToNext}
      />
    </main>
  );
}
