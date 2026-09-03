/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FishCanvas } from './components/FishCanvas';
import { ControlsOverlay } from './components/ControlsOverlay';
import { FieldNotes, FIELD_NOTES, FieldNote } from './components/FieldNoteCard';
import { ControlledFish, ClientFishInfo, ParasiteStats } from './types';
import { installAudioUnlock, playFishCleanedCelebrationSound } from './utils/audio';

// Fixed physical parameters: always Gentle speed and Compact scale
const GENTLE_SPEED = 1.8;
const HOGFISH_COMPACT_SCALE = 0.72;
const GOBY_COMPACT_SCALE = 0.65;

const NO_CLIENT: ClientFishInfo = {
  species: 'grouper',
  name: '',
  scientificName: '',
  size: '',
  keyFeatures: [],
  state: 'waiting',
  elapsedSeconds: 0,
  transitionCountdown: 0,
  isVisible: false,
};

const NO_STATS: ParasiteStats = {
  total: 0,
  remaining: 0,
  removed: 0,
  teethRemaining: 0,
  bodyRemaining: 0,
};

export default function App() {
  // Default selection is the Spanish Hogfish
  const [selectedFish, setSelectedFish] = useState<ControlledFish>('hogfish');

  // Field note open: pauses the client's patience timer while reading
  const [isFieldNoteActive, setIsFieldNoteActive] = useState(false);

  const [clientFishInfo, setClientFishInfo] = useState<ClientFishInfo>(NO_CLIENT);
  const [parasiteStats, setParasiteStats] = useState<ParasiteStats>(NO_STATS);

  // Browsers only allow audio after a user gesture; this listens for the first one
  useEffect(() => installAudioUnlock(), []);

  // Field notes: a notebook of earned facts. Each fully-cleaned client
  // unlocks a new field note; the notebook button carries a crawling crab
  // notification badge until the new note is opened.
  const [unlockedNotes, setUnlockedNotes] = useState<FieldNote[]>([]);
  const [unreadNotes, setUnreadNotes] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const unlockedCountRef = useRef(0);

  const handleClientCleaned = useCallback(() => {
    playFishCleanedCelebrationSound();
    if (unlockedCountRef.current >= FIELD_NOTES.length) return;
    const note = FIELD_NOTES[unlockedCountRef.current];
    unlockedCountRef.current += 1;
    setUnlockedNotes((prev) => [...prev, note]);
    setUnreadNotes((u) => u + 1);
  }, []);

  const toggleNotes = useCallback(() => {
    setNotesOpen((prev) => !prev);
    setUnreadNotes(0);
  }, []);

  return (
    <main
      id="cleaning-station-app"
      className="relative w-screen h-screen overflow-hidden bg-[#001f3f] text-white select-none font-sans"
    >
      {/* 2D Canvas Fish Simulation */}
      <FishCanvas
        isRunning
        selectedFish={selectedFish}
        onSelectFish={setSelectedFish}
        hogfishScale={HOGFISH_COMPACT_SCALE}
        hogfishSpeed={GENTLE_SPEED}
        gobyScale={GOBY_COMPACT_SCALE}
        gobySpeed={GENTLE_SPEED}
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
        selectedFish={selectedFish}
        onSelectFish={setSelectedFish}
        clientFishInfo={clientFishInfo}
        parasiteStats={parasiteStats}
        onFieldNoteVisibilityChange={setIsFieldNoteActive}
      />

      {/* Nibble watermark */}
      <img
        src="/nibble-logo.png"
        alt="Nibble"
        draggable={false}
        className="pointer-events-none select-none absolute right-4 sm:right-8 bottom-4 sm:bottom-7 z-20 h-9 sm:h-11 w-auto opacity-85 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
      />

      {/* Earned biology notebook */}
      <FieldNotes
        unlocked={unlockedNotes}
        unread={unreadNotes}
        open={notesOpen}
        onToggle={toggleNotes}
        allCollected={unlockedNotes.length >= FIELD_NOTES.length}
      />
    </main>
  );
}
