/** Curated, locally implemented motion components inspired by Remocn's catalog. */
export const PRODUCER_COMPONENT_CATALOG = [
  { id: 'stat-card', name: 'Stat card', use: 'Emphasize one metric or number.', type: 'badge', animation: 'bounce' },
  { id: 'quote-card', name: 'Quote card', use: 'Highlight a short quote or key claim.', type: 'callout', animation: 'fade' },
  { id: 'lower-third', name: 'Lower third', use: 'Identify a speaker, subject, or location.', type: 'text', animation: 'slide' },
  { id: 'cta-banner', name: 'CTA banner', use: 'Show a short call to action near the end.', type: 'callout', animation: 'pulse' },
  { id: 'checklist', name: 'Checklist', use: 'Present up to three concise steps or takeaways.', type: 'text', animation: 'slide' },
] as const;

export type ProducerComponentId = (typeof PRODUCER_COMPONENT_CATALOG)[number]['id'];

export function isProducerComponentId(value: unknown): value is ProducerComponentId {
  return typeof value === 'string' && PRODUCER_COMPONENT_CATALOG.some((component) => component.id === value);
}
