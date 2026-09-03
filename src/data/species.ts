import { ClientFishSpecies } from '../types';

/**
 * Single registry of everything the app knows about each client species:
 * display copy, the field note, gameplay tuning and rendering colors.
 * Adding a species means adding one entry here (plus its simulation class,
 * which is wired up in ClientDirector's factory).
 */
export interface SpeciesInfo {
  /** Display name shown on the client card */
  name: string;
  scientificName: string;
  /** Rough adult size, display only */
  size: string;
  keyFeatures: string[];
  /** Field note revealed by clicking the client's name */
  fieldNote: { title: string; note: string };
  /** Seconds a client waits in the queue before drifting off */
  patience: number;
  /**
   * Absolute mouthAperture when fully gaping for a cleaner (resting values
   * run ~0.65-0.92; the trumpetfish's tiny terminal mouth needs the most help)
   */
  gapeTarget: number;
  /**
   * Big-mouthed gapers hold their mouth open for a cleaner (and clamp);
   * small puckered mouths get their lips picked from outside, ungated.
   */
  hasMouthCavity: boolean;
  /**
   * Station parking: x = width - (C * scale + K), matching each class's own
   * profile target so the fish parks exactly where its art expects.
   * The moray ignores this and anchors to its crevice.
   */
  station: { C: number; K: number; y: number };
  /** Gill-flap cover colors (base = the flap plate, edge = its darker margin) */
  flapColor: { base: string; edge: string };
}

export const SPECIES: Record<ClientFishSpecies, SpeciesInfo> = {
  grouper: {
    name: 'Nassau Grouper',
    scientificName: 'Epinephelus striatus',
    size: '~60–120 cm',
    keyFeatures: [
      'Heavy predatory cranium',
      'Sharp conical predator teeth',
      'Coral red-amber spotted body',
      'Deep cavernous oral cavity',
    ],
    fieldNote: {
      title: 'Nassau Grouper',
      note: 'Nassau groupers are ambush predators, using powerful suction to pull prey into their enormous mouths. At a cleaning station, they open their mouths and gill covers wide, giving tiny cleaners access to places that would otherwise be hard to reach.',
    },
    patience: 60,
    gapeTarget: 2.0,
    hasMouthCavity: true,
    station: { C: 95, K: 24, y: 0.5 },
    flapColor: { base: '#f97316', edge: '#b45309' }, // unused: grouper lifts its own art
  },
  queen_parrotfish: {
    name: 'Queen Parrotfish',
    scientificName: 'Scarus vetula',
    size: '~30–60 cm',
    keyFeatures: [
      'Deep, laterally compressed body',
      'Powerful parrot-like beak',
      'Bright turquoise/blue-green coloration',
      'Contrasting yellow/orange facial mask',
      'Distinctive fused dental plates',
      'Flowing lunate caudal tail',
    ],
    fieldNote: {
      title: 'Queen Parrotfish',
      note: 'Queen parrotfish use their fused, beak-like teeth to scrape algae from hard surfaces on the reef. Their powerful beaks can even remove small pieces of coral as they feed, helping to shape the reef while they search for food.',
    },
    patience: 45,
    gapeTarget: 1.6,
    hasMouthCavity: false,
    station: { C: 99, K: 24, y: 0.48 },
    flapColor: { base: '#2dd4bf', edge: '#0f766e' },
  },
  yellowtail_goatfish: {
    name: 'Yellowtail Goatfish',
    scientificName: 'Mulloidichthys martinicus',
    size: '~25–35 cm',
    keyFeatures: [
      'Slender, streamlined body',
      'Silver/pale iridescent body',
      'Bright yellow tail',
      'Yellowish lateral coloration',
      'Two prominent chin barbels',
      'Small mouth beneath the head',
      'Forked tail',
    ],
    fieldNote: {
      title: 'Yellowtail Goatfish',
      note: 'Yellowtail goatfish have a pair of sensitive barbels beneath their chin that they use to search for hidden prey. They sweep these feelers over sand and rubble, detecting small animals buried beneath the surface.',
    },
    patience: 45,
    gapeTarget: 1.6,
    hasMouthCavity: false,
    station: { C: 97, K: 24, y: 0.48 },
    flapColor: { base: '#ece6cd', edge: '#b3ab84' },
  },
  queen_triggerfish: {
    name: 'Queen Triggerfish',
    scientificName: 'Balistes vetula',
    size: '~30–50 cm',
    keyFeatures: [
      'Deep, chunky, highly compressed body',
      'Small puckered mouth',
      'Large expressive eye',
      'Tall dorsal spines',
      'Strong angular fins',
      'Blue/green/turquoise body',
      'Yellow/orange accents around face and fins',
      'Elaborate tail',
    ],
    fieldNote: {
      title: 'Queen Triggerfish',
      note: 'Queen triggerfish have powerful jaws and teeth for crushing hard-shelled prey such as sea urchins and crabs. They also have a remarkable defense: their first dorsal spine can be locked upright, making them difficult for a predator to swallow.',
    },
    patience: 35,
    gapeTarget: 1.6,
    hasMouthCavity: false,
    station: { C: 109, K: 24, y: 0.48 },
    flapColor: { base: '#38bdf8', edge: '#155e75' },
  },
  trumpetfish: {
    name: 'Atlantic Trumpetfish',
    scientificName: 'Aulostomus maculatus',
    size: '~60–90 cm',
    keyFeatures: [
      'Extremely elongated body',
      'Extremely long tubular snout',
      'Tiny terminal mouth with chin barbel',
      'Long dorsal/anal fins toward rear',
      'Brown, yellow, blue or mottled coloration',
      'Small eye relative to body',
      'Very thin tail with black ocellus',
    ],
    fieldNote: {
      title: 'Trumpetfish',
      note: 'Trumpetfish are long, slender predators that often hover almost motionless, using camouflage to get close to their prey. They can change their body coloration and sometimes swim alongside larger fish, using them as moving cover while they hunt.',
    },
    patience: 40,
    gapeTarget: 2.3,
    hasMouthCavity: false,
    station: { C: 105, K: 24, y: 0.48 },
    flapColor: { base: '#c89455', edge: '#7c5a2b' },
  },
  spotted_moray: {
    name: 'Spotted Moray',
    scientificName: 'Gymnothorax moringa',
    size: '~60–150 cm',
    keyFeatures: [
      'Long, snake-like body',
      'No obvious paired fins',
      'Large rounded head',
      'Huge mouth',
      'Prominent teeth',
      'Small eyes',
      'Cream/tan body covered with dark spots',
      'Often shown emerging from a reef crevice',
    ],
    fieldNote: {
      title: 'Spotted Moray',
      note: "Spotted morays spend much of their time tucked into reef crevices, with only their heads showing. Their constant opening and closing of the mouth isn't a threat. It helps move water across their gills so they can breathe.",
    },
    patience: 70,
    gapeTarget: 1.9,
    hasMouthCavity: true,
    station: { C: 0, K: 0, y: 0 }, // unused: moray anchors to its crevice
    flapColor: { base: '#e8d795', edge: '#a08e4e' },
  },
  whitespotted_filefish: {
    name: 'Whitespotted Filefish',
    scientificName: 'Cantherhines macrocerus',
    size: '~25–35 cm',
    keyFeatures: [
      'Unusual, deep-bodied/oval shape',
      'Rough-looking skin texture',
      'Gray/brown base',
      'Numerous white spots',
      'Small mouth',
      'Tall dorsal spine',
      'Small pectoral fins',
    ],
    fieldNote: {
      title: 'Whitespotted Filefish',
      note: 'Whitespotted filefish have a wonderfully unusual shape, with a deep, boxy body covered in small spots. Like other filefish, they have a prominent dorsal spine that can be raised when they feel threatened.',
    },
    patience: 50,
    gapeTarget: 1.8,
    hasMouthCavity: false,
    station: { C: 70, K: 30, y: 0.47 },
    flapColor: { base: '#ab9f92', edge: '#6e6357' },
  },
  french_grunt: {
    name: 'French Grunt',
    scientificName: 'Haemulon flavolineatum',
    size: '~20–30 cm',
    keyFeatures: [
      'Schooling reef fish',
      'Arrive, wait, and clean together',
      'Silver/cream body & golden head',
      'Yellow horizontal & diagonal stripes',
      'Electric blue facial markings',
      'Large expressive eye & small mouth',
    ],
    fieldNote: {
      title: 'French Grunt',
      note: 'French grunts often gather in groups around reefs and rocky structures, where they shelter together during the day. Their bright yellow-and-blue stripes make them easy to spot, and they can produce grunting sounds underwater.',
    },
    patience: 40,
    gapeTarget: 1.9,
    hasMouthCavity: true,
    station: { C: 64, K: 30, y: 0.47 },
    flapColor: { base: '#f0dd8f', edge: '#b09b4a' },
  },
};

export const ALL_SPECIES = Object.keys(SPECIES) as ClientFishSpecies[];

/** The two playable cleaners */
export const CLEANERS = {
  hogfish: { name: 'Spanish Hogfish (Juvenile)', scientificName: 'Bodianus rufus' },
  goby: { name: 'Sharknose Goby', scientificName: 'Elacatinus evelynae' },
} as const;
