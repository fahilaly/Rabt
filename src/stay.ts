// Expected stay: how long until a pilgrim is likely ready to leave hospital.
//
// The doctor picks a condition group; Rabt suggests a typical stay and the doctor can
// change it. The company receives only the expected ready time, never the condition.
//
// The minutes below are SAMPLE FIGURES for the prototype. A real version would learn
// them from past visits (admission time vs. "ready for transport" time, both of which
// Rabt already records), per hospital and per season.

export interface Condition {
  id: string;
  label: string;
  typicalMin: number;
}

export const CONDITIONS: Condition[] = [
  { id: "heat", label: "Heat exhaustion", typicalMin: 120 },
  { id: "dehydration", label: "Dehydration", typicalMin: 180 },
  { id: "injury", label: "Minor injury (sprain, cut)", typicalMin: 90 },
  { id: "sugar", label: "Blood sugar (low or high)", typicalMin: 150 },
  { id: "breathing", label: "Breathing (asthma, COPD)", typicalMin: 180 },
  { id: "chest", label: "Chest pain, observation", typicalMin: 360 },
  { id: "other", label: "Other", typicalMin: 180 },
];

export const STAY_CHOICES = [60, 90, 120, 180, 240, 360, 720];

export function conditionLabel(id?: string) {
  return CONDITIONS.find((c) => c.id === id)?.label ?? "";
}

export function suggestedStay(conditionId: string) {
  return CONDITIONS.find((c) => c.id === conditionId)?.typicalMin ?? 180;
}
