import type { Signal } from '@citybrain/shared';

export interface Scenario {
  title: string;
  areaLabel: string;
  crisisType: 'flood' | 'heatwave' | 'accident' | 'infrastructure_failure' | 'road_blockage';
  signals: Signal[];
}

export const SCENARIOS: Record<string, Scenario> = {
  g10_flood: {
    title: 'Urban Flooding — G-10',
    areaLabel: 'G-10 Markaz',
    crisisType: 'flood',
    signals: [
      {
        source: 'social',
        rawText: 'G-10 mein pani bhar gaya hai, gaariyan phans gayi hain — koi help?',
        language: 'roman_ur',
        areaLabel: 'G-10',
        location: { lat: 33.6702, lng: 73.0213 },
        confidence: 0.88,
      },
      {
        source: 'social',
        rawText: 'Flash flood happening at George Town for past 30 mins, roads submerged',
        language: 'en',
        areaLabel: 'George Town',
        location: { lat: 33.669, lng: 73.02 },
        confidence: 0.85,
      },
      {
        source: 'weather',
        rawText: 'HEAVY RAINFALL ALERT: Islamabad — 42mm in 2hrs, risk of urban flooding',
        language: 'en',
        areaLabel: 'Islamabad',
        location: { lat: 33.6844, lng: 73.0479 },
        confidence: 0.95,
      },
      {
        source: 'traffic',
        rawText: 'Traffic congestion spike +340% on Kashmir Highway near G-10 interchange',
        language: 'en',
        areaLabel: 'G-10',
        location: { lat: 33.671, lng: 73.025 },
        confidence: 0.92,
      },
    ],
  },

  margalla_heat: {
    title: 'Extreme Heat Event — Margalla',
    areaLabel: 'Margalla Sector',
    crisisType: 'heatwave',
    signals: [
      {
        source: 'weather',
        rawText: 'EXTREME HEAT WARNING: Feels-like 48°C. Avoid outdoor exposure 11am-5pm.',
        language: 'en',
        areaLabel: 'Margalla',
        location: { lat: 33.738, lng: 73.06 },
        confidence: 0.96,
      },
      {
        source: 'field_report',
        rawText: 'PIMS emergency dept reports 40% surge in heat exhaustion cases',
        language: 'en',
        areaLabel: 'Margalla',
        location: { lat: 33.72, lng: 73.065 },
        confidence: 0.87,
      },
      {
        source: 'social',
        rawText: 'Margalla trail par buhat garmi hai, pani khatam — hikers ko shelter chahiye',
        language: 'roman_ur',
        areaLabel: 'Margalla',
        location: { lat: 33.74, lng: 73.058 },
        confidence: 0.82,
      },
    ],
  },

  srinagar_accident: {
    title: 'Multi-Vehicle Accident — Srinagar Highway',
    areaLabel: 'Srinagar Highway',
    crisisType: 'accident',
    signals: [
      {
        source: 'social',
        rawText: 'Srinagar Highway par 3 gaariyan takra gayin, road band hai',
        language: 'roman_ur',
        areaLabel: 'Srinagar Highway',
        location: { lat: 33.652, lng: 73.089 },
        confidence: 0.9,
      },
      {
        source: 'traffic',
        rawText: 'Incident detected: lane blockage, avg speed 5 km/h, 2.1km queue',
        language: 'en',
        areaLabel: 'Srinagar Highway',
        location: { lat: 33.653, lng: 73.088 },
        confidence: 0.94,
      },
    ],
  },

  i9_grid: {
    title: 'Grid Failure — I-9 Industrial',
    areaLabel: 'I-9 Industrial Area',
    crisisType: 'infrastructure_failure',
    signals: [
      {
        source: 'field_report',
        rawText: 'Substation I-9-GRID-A offline. Traffic signals on Faiz Rd running on backup — failing.',
        language: 'en',
        areaLabel: 'I-9',
        location: { lat: 33.648, lng: 73.042 },
        confidence: 0.93,
      },
      {
        source: 'sensor',
        rawText: 'Power grid segment anomaly: voltage collapse detected 14:32 PKT',
        language: 'en',
        areaLabel: 'I-9',
        location: { lat: 33.649, lng: 73.041 },
        confidence: 0.97,
      },
    ],
  },

  faiz_road_block: {
    title: 'Road Blockage — Faiz Road',
    areaLabel: 'Faiz Road',
    crisisType: 'road_blockage',
    signals: [
      {
        source: 'traffic',
        rawText: 'Road closure: Faiz Road blocked due to overturned truck',
        language: 'en',
        areaLabel: 'Faiz Road',
        location: { lat: 33.699, lng: 73.055 },
        confidence: 0.95,
      },
      {
        source: 'social',
        rawText: 'Faiz Road bilkul band hai, 1 hour se stuck hoon',
        language: 'roman_ur',
        areaLabel: 'Faiz Road',
        location: { lat: 33.698, lng: 73.054 },
        confidence: 0.86,
      },
    ],
  },
};
