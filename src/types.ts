export type ControlledFish = 'wrasse' | 'gobi';
export type ClientFishSpecies =
  | 'grouper'
  | 'queen_parrotfish'
  | 'yellowtail_goatfish'
  | 'queen_triggerfish'
  | 'trumpetfish'
  | 'spotted_moray'
  | 'whitespotted_filefish'
  | 'french_grunt';

export interface ClientFishInfo {
  species: ClientFishSpecies;
  name: string;
  scientificName: string;
  size: string;
  keyFeatures: string[];
  state: 'entering' | 'stationary' | 'exiting' | 'exited' | 'waiting';
  elapsedSeconds: number;
  transitionCountdown: number;
  patienceFrac?: number; // 0..1 patience remaining for the patience bar
  isVisible: boolean;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface FishSegment {
  pos: Vector2D;
  prevPos: Vector2D;
  angle: number;
  width: number;
  height: number;
}

export interface FishBehaviorState {
  target: Vector2D;
  speed: number;
  baseSpeed: number;
  maxSpeed: number;
  heading: number;
  angularVelocity: number;
  swimPhase: number;
  finPhase: number;
  mode: 'cruise' | 'dart' | 'inspect' | 'hover' | 'follow';
  modeTimer: number;
  isDancing: boolean;
}

export interface FishConfig {
  scale: number;
  segmentCount: number;
  segmentLength: number;
  baseSpeed: number;
  maxSpeed: number;
  turnSpeed: number;
  waveFrequency: number;
  waveAmplitude: number;
}

export interface Parasite {
  id: number;
  type: 'teeth' | 'body';
  localX: number;
  localY: number;
  attachPart: 'upperTeeth' | 'lowerTeeth' | 'body' | 'belly' | 'operculum';
  hoverTimer: number; // accumulated seconds hovered by a fish's mouth
  removed: boolean;
  fishIndex?: number; // for multi-fish species like french_grunt school
}
