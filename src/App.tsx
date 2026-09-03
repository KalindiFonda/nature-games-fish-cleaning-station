/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef, useState } from 'react';
import { FishCanvas } from './components/FishCanvas';
import { ControlsOverlay } from './components/ControlsOverlay';
import { FieldNotes, FIELD_NOTES, FieldNote } from './components/FieldNoteCard';
import { ControlledFish, ClientFishInfo } from './types';
import { playFishCleanedCelebrationSound } from './utils/audio';

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

  // Field note active state: pauses the parasite timer while reading
  const [isFieldNoteActive, setIsFieldNoteActive] = useState<boolean>(false);

  const [clientFishInfo, setClientFishInfo] = useState<ClientFishInfo>({
    species: 'grouper',
    name: 'Nassau Grouper',
    scientificName: 'Epinephelus striatus',
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

  // Field notes: a notebook of earned facts. Each fully-cleaned client
  // unlocks a new field note; the notebook button carries a crawling crab
  // notification badge until the new note is opened.
  const [unlockedNotes, setUnlockedNotes] = useState<FieldNote[]>([]);
  const [unreadNotes, setUnreadNotes] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [cleanedCount, setCleanedCount] = useState(0);
  const cleanedCountRef = useRef(0);
  const unlockedCountRef = useRef(0);

  const handleClientCleaned = useCallback(() => {
    playFishCleanedCelebrationSound();
    cleanedCountRef.current += 1;
    const c = cleanedCountRef.current;
    setCleanedCount(c);
    if (unlockedCountRef.current >= FIELD_NOTES.length) return;
    const note = FIELD_NOTES[unlockedCountRef.current];
    unlockedCountRef.current += 1;
    setUnlockedNotes((prev) => [...prev, note]);
    setUnreadNotes((u) => u + 1);
  }, []);

  // Clients still to clean before the next note unlocks (null = all found)
  const notesToNext =
    unlockedNotes.length >= FIELD_NOTES.length
      ? null
      : 1;

  const toggleNotes = useCallback(() => {
    setNotesOpen((prev) => !prev);
    setUnreadNotes(0);
  }, []);

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
        pausePatience={isFieldNoteActive}
        onParasiteStatsUpdate={setParasiteStats}
        onClientFishUpdate={setClientFishInfo}
        onClientCleaned={handleClientCleaned}
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
        onFieldNoteVisibilityChange={setIsFieldNoteActive}
      />

      {/* Earned biology notebook */}
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
