import { ClientFishSpecies } from '../types';

export interface ClientSpeciesFieldNote {
  species: ClientFishSpecies;
  title: string;
  note: string;
}

export const CLIENT_SPECIES_FIELD_NOTES: Record<ClientFishSpecies, { title: string; note: string }> = {
  grouper: {
    title: 'Nassau Grouper',
    note: 'Nassau groupers are ambush predators, using powerful suction to pull prey into their enormous mouths. At a cleaning station, they open their mouths and gill covers wide, giving tiny cleaners access to places that would otherwise be hard to reach.',
  },
  queen_parrotfish: {
    title: 'Queen Parrotfish',
    note: 'Queen parrotfish use their fused, beak-like teeth to scrape algae from hard surfaces on the reef. Their powerful beaks can even remove small pieces of coral as they feed, helping to shape the reef while they search for food.',
  },
  french_grunt: {
    title: 'French Grunt',
    note: 'French grunts often gather in groups around reefs and rocky structures, where they shelter together during the day. Their bright yellow-and-blue stripes make them easy to spot, and they can produce grunting sounds underwater.',
  },
  whitespotted_filefish: {
    title: 'Whitespotted Filefish',
    note: 'Whitespotted filefish have a wonderfully unusual shape, with a deep, boxy body covered in small spots. Like other filefish, they have a prominent dorsal spine that can be raised when they feel threatened.',
  },
  trumpetfish: {
    title: 'Trumpetfish',
    note: 'Trumpetfish are long, slender predators that often hover almost motionless, using camouflage to get close to their prey. They can change their body coloration and sometimes swim alongside larger fish, using them as moving cover while they hunt.',
  },
  yellowtail_goatfish: {
    title: 'Yellowtail Goatfish',
    note: 'Yellowtail goatfish have a pair of sensitive barbels beneath their chin that they use to search for hidden prey. They sweep these feelers over sand and rubble, detecting small animals buried beneath the surface.',
  },
  queen_triggerfish: {
    title: 'Queen Triggerfish',
    note: 'Queen triggerfish have powerful jaws and teeth for crushing hard-shelled prey such as sea urchins and crabs. They also have a remarkable defense: their first dorsal spine can be locked upright, making them difficult for a predator to swallow.',
  },
  spotted_moray: {
    title: 'Spotted Moray',
    note: "Spotted morays spend much of their time tucked into reef crevices, with only their heads showing. Their constant opening and closing of the mouth isn't a threat — it helps move water across their gills so they can breathe.",
  },
};
