/**
 * Seed catalog for ProductIQ.
 *
 * 42 realistic industrial products across 8 categories, deliberately varied
 * so the Validation Center and Dashboard demonstrate real value:
 *  - complete, high-quality records
 *  - records with missing fields
 *  - records with conflicting values
 *  - records with unit inconsistencies
 *  - records with implausible/suspicious values (needing review)
 *
 * Each entry carries the raw source text the record was "built from", so the
 * Evidence view shows original values with verbatim snippets.
 */
import type {
  FieldKey,
  SourceKind,
  ValidationFlags,
} from "./types";

export interface SeedInput {
  name: string;
  category: string;
  subcategory?: string;
  material?: string;
  dimensions?: { length: number; width: number; height: number; unit: string };
  weight?: { value: number; unit: string };
  voltageRating?: string;
  certifications?: string[];
  otherSpecs?: Record<string, string>;
  descriptionShort: string;
  descriptionDetailed?: string;
  keywords?: string[];
  /** The raw source text this product was extracted from. */
  raw: string;
  /** Source document label shown in the Evidence view. */
  doc?: string;
  /** Per-field source-classification overrides. */
  meta?: Partial<
    Record<FieldKey, { source?: SourceKind; confidence?: number; explanation?: string | null }>
  >;
  /** Extra validation flags (e.g. conflicts the source text contains). */
  extraFlags?: Partial<ValidationFlags>;
  /** Default confidence for AI-inferred fields (default 72). */
  inferredConfidence?: number;
}

export const SEED_PRODUCTS: SeedInput[] = [
  // ------------------------------------------------------------------ 1
  {
    name: "SKF 6205-2RS1 Deep Groove Ball Bearing",
    category: "Bearings",
    subcategory: "Deep groove ball bearings",
    material: "Chrome steel (AISI 52100)",
    dimensions: { length: 25, width: 52, height: 15, unit: "mm" },
    weight: { value: 0.128, unit: "kg" },
    certifications: ["ISO 9001"],
    otherSpecs: {
      static_load_rating: "7.8 kN",
      dynamic_load_rating: "14.8 kN",
      limiting_speed: "12,000 rpm",
    },
    descriptionShort:
      "Single-row deep groove ball bearing, sealed on both sides, ideal for general industrial applications.",
    descriptionDetailed:
      "The SKF 6205-2RS1 is a single-row deep groove ball bearing with contact seals on both sides (2RS1) and a standard C3 clearance. Bore 25 mm, outside diameter 52 mm, width 15 mm. Rings and balls are made of chrome steel (AISI 52100). Static load rating 7.8 kN, dynamic load rating 14.8 kN, limiting speed 12,000 rpm. Supplied under ISO 9001 certified manufacturing.",
    keywords: ["ball bearing", "6205", "SKF", "deep groove", "sealed bearing"],
    raw: "SKF 6205-2RS1 deep groove ball bearing, sealed on both sides. Bore diameter 25 mm, outside diameter 52 mm, width 15 mm. Chrome steel rings and balls. Static load rating 7.8 kN, dynamic load rating 14.8 kN. Limiting speed 12,000 rpm. Weight 0.128 kg. Manufactured under ISO 9001.",
  },
  // ------------------------------------------------------------------ 2
  {
    name: "Timken LM11949/LM11910 Tapered Roller Bearing",
    category: "Bearings",
    subcategory: "Tapered roller bearings",
    material: "Case-carburized steel",
    dimensions: { length: 0.75, width: 1.8562, height: 0.62, unit: "in" },
    weight: { value: 0.13, unit: "lb" },
    certifications: ["ISO 9001", "IATF 16949"],
    otherSpecs: {
      cone_part_number: "LM11949",
      cup_part_number: "LM11910",
      dynamic_load_rating: "12.5 kN",
    },
    descriptionShort:
      "Imperial tapered roller bearing cone and cup set for moderate radial and thrust loads.",
    descriptionDetailed:
      "Timken LM11949 cone and LM11910 cup tapered roller bearing set. Bore 0.7500 in, outside diameter 1.8562 in, width 0.6200 in. Case-carburized steel for long fatigue life. Dynamic load rating 12.5 kN. Weight 0.13 lb. Manufactured under ISO 9001 and IATF 16949.",
    keywords: ["tapered roller bearing", "Timken", "LM11949", "LM11910", "cone and cup"],
    raw: "Timken LM11949/LM11910 tapered roller bearing, cone and cup set. Bore 0.7500 in, outside diameter 1.8562 in, width 0.6200 in. Case-carburized steel. Dynamic load rating 12.5 kN. Weight 0.13 lb. ISO 9001 and IATF 16949 certified production.",
  },
  // ------------------------------------------------------------------ 3
  {
    name: "NSK 6206ZZ Ball Bearing",
    category: "Bearings",
    subcategory: "Deep groove ball bearings",
    material: "Chrome steel",
    dimensions: { length: 30, width: 62, height: 16, unit: "mm" },
    descriptionShort:
      "Deep groove ball bearing with metal shields on both sides, popular in electric motors.",
    descriptionDetailed:
      "NSK 6206ZZ deep groove ball bearing with non-contact metal shields (ZZ). Bore 30 mm, outside diameter 62 mm, width 16 mm. Chrome steel rings and balls.",
    keywords: ["ball bearing", "6206", "NSK", "shielded bearing"],
    raw: "NSK 6206ZZ deep groove ball bearing. Bore 30 mm, outside diameter 62 mm, width 16 mm. Chrome steel. Double shielded (ZZ).",
  },
  // ------------------------------------------------------------------ 4
  {
    name: "NTN 6305-LLU Ball Bearing",
    category: "Bearings",
    subcategory: "Deep groove ball bearings",
    material: "Chrome steel",
    dimensions: { length: 25, width: 62, height: 17, unit: "mm" },
    weight: { value: 0.235, unit: "kg" },
    certifications: ["ISO 9001"],
    otherSpecs: {
      static_load_rating: "11.5 kN",
      dynamic_load_rating: "23.4 kN",
    },
    descriptionShort:
      "Double-sealed deep groove ball bearing; the source sheet lists inconsistent weight and load figures.",
    descriptionDetailed:
      "NTN 6305-LLU deep groove ball bearing with rubber seals on both sides. Bore 25 mm, outside diameter 62 mm, width 17 mm. Chrome steel. Static load rating 11.5 kN, dynamic load rating 23.4 kN.",
    keywords: ["ball bearing", "6305", "NTN", "sealed bearing"],
    extraFlags: {
      conflictingValues: [
        "Weight: the source lists both 0.235 kg and 0.25 kg for this bearing",
        "Static load rating: the source lists both 11.5 kN and 8.5 kN",
      ],
    },
    raw: "NTN 6305-LLU deep groove ball bearing, double sealed. Bore 25 mm, OD 62 mm, width 17 mm. Static load rating 11.5 kN. Weight 0.235 kg. Chrome steel rings and balls. Static load rating 8.5 kN, dynamic load rating 23.4 kN. Weight 0.25 kg.",
  },
  // ------------------------------------------------------------------ 5
  {
    name: "INA HK2016 Needle Roller Bearing",
    category: "Bearings",
    subcategory: "Needle roller bearings",
    material: "Bearing steel",
    dimensions: { length: 20, width: 26, height: 16, unit: "mm" },
    weight: { value: 0.5, unit: "mm" },
    otherSpecs: {
      dynamic_load_rating: "11.6 kN",
      static_load_rating: "16.9 kN",
    },
    descriptionShort:
      "Open-end needle roller bearing; the listed weight uses a length unit and needs correction.",
    descriptionDetailed:
      "INA HK2016 needle roller bearing, open end. Bore 20 mm, outside diameter 26 mm, width 16 mm. Bearing steel. Dynamic load rating 11.6 kN, static load rating 16.9 kN.",
    keywords: ["needle roller bearing", "INA", "HK2016", "drawn cup"],
    raw: "INA HK2016 needle roller bearing, open end. Bore 20 mm, OD 26 mm, width 16 mm. Bearing steel. Dynamic load rating 11.6 kN, static load rating 16.9 kN. Weight 0.5 mm.",
  },
  // ------------------------------------------------------------------ 6
  {
    name: "FAG 7205-B-XL Angular Contact Ball Bearing",
    category: "Bearings",
    subcategory: "Angular contact ball bearings",
    material: "Chrome steel",
    dimensions: { length: 25, width: 52, height: 15, unit: "mm" },
    weight: { value: 950, unit: "kg" },
    otherSpecs: {
      contact_angle: "40°",
      dynamic_load_rating: "15.6 kN",
    },
    descriptionShort:
      "Single-row angular contact ball bearing; recorded weight is implausible and requires review.",
    descriptionDetailed:
      "FAG 7205-B-XL angular contact ball bearing with 40° contact angle. Bore 25 mm, outside diameter 52 mm, width 15 mm. Chrome steel. Dynamic load rating 15.6 kN.",
    keywords: ["angular contact", "ball bearing", "FAG", "7205"],
    raw: "FAG 7205-B-XL angular contact ball bearing, 40 degree contact angle. Bore 25 mm, outside diameter 52 mm, width 15 mm. Chrome steel. Weight 950 kg. Dynamic load rating 15.6 kN.",
  },
  // ------------------------------------------------------------------ 7
  {
    name: "WEG 5.5 kW IE3 Three-Phase Induction Motor",
    category: "Electric Motors",
    subcategory: "Three-phase induction motors",
    material: "Cast iron / aluminum",
    dimensions: { length: 300, width: 250, height: 310, unit: "mm" },
    weight: { value: 48, unit: "kg" },
    voltageRating: "380–480 V AC, 3-phase",
    certifications: ["IE3", "CE"],
    otherSpecs: {
      rated_power: "5.5 kW",
      frequency: "50 Hz",
      speed: "1450 rpm",
      frame_size: "100L",
      protection_class: "IP55",
    },
    descriptionShort:
      "Energy-efficient IE3 three-phase induction motor with 5.5 kW rated power and IP55 protection.",
    descriptionDetailed:
      "WEG IE3 premium-efficiency three-phase induction motor, 5.5 kW, 4-pole, 1450 rpm at 50 Hz. Cast iron frame with aluminum rotor. Frame size 100L, protection class IP55, insulation class F. Supply 380–480 V AC 3-phase.",
    keywords: ["induction motor", "IE3", "WEG", "5.5 kW", "three-phase motor"],
    raw: "WEG IE3 three-phase induction motor. Rated power 5.5 kW, 4-pole, 1450 rpm, 50 Hz. Cast iron frame. Frame size 100L. Protection class IP55. Supply voltage 380-480 V AC 3-phase. Weight 48 kg. CE marked.",
  },
  // ------------------------------------------------------------------ 8
  {
    name: "Siemens 1LE1003-1BA43 2.2 kW Motor",
    category: "Electric Motors",
    subcategory: "Three-phase induction motors",
    material: "Cast iron",
    dimensions: { length: 265, width: 210, height: 250, unit: "mm" },
    weight: { value: 22, unit: "kg" },
    voltageRating: "400 V AC, 3-phase",
    certifications: ["IE3", "CE"],
    otherSpecs: {
      rated_power: "2.2 kW",
      frequency: "50 Hz",
      speed: "1440 rpm",
      protection_class: "IP55",
    },
    descriptionShort:
      "IE3 efficiency three-phase motor, 2.2 kW, 1440 rpm, IP55 cast iron construction.",
    descriptionDetailed:
      "Siemens 1LE1003-1BA43 general-purpose three-phase induction motor, 2.2 kW, 4-pole, 1440 rpm at 50 Hz. Cast iron frame, protection class IP55, IE3 efficiency class. Supply 400 V AC 3-phase.",
    keywords: ["induction motor", "IE3", "Siemens", "2.2 kW", "1LE1003"],
    raw: "Siemens 1LE1003-1BA43 three-phase induction motor. 2.2 kW, 4-pole, 1440 rpm, 50 Hz. IE3 efficiency. Cast iron frame, IP55. 400 V AC 3-phase supply. Weight 22 kg. CE.",
  },
  // ------------------------------------------------------------------ 9
  {
    name: "ABB M3BP 315SMA 75 kW Motor",
    category: "Electric Motors",
    subcategory: "Three-phase induction motors",
    dimensions: { length: 620, width: 720, height: 780, unit: "mm" },
    weight: { value: 545, unit: "kg" },
    otherSpecs: {
      rated_power: "75 kW",
      frequency: "50 Hz",
      speed: "1485 rpm",
      protection_class: "IP55",
    },
    descriptionShort:
      "Heavy-duty IE2 three-phase motor, 75 kW, for pumps and compressors; material and voltage are missing.",
    descriptionDetailed:
      "ABB M3BP 315SMA industrial three-phase induction motor. Rated power 75 kW, 4-pole, 1485 rpm at 50 Hz. Frame size 315, protection class IP55.",
    keywords: ["induction motor", "ABB", "75 kW", "M3BP", "industrial motor"],
    raw: "ABB M3BP 315SMA three-phase induction motor. 75 kW, 4-pole, 1485 rpm, 50 Hz. Frame 315. Protection class IP55. Weight 545 kg.",
  },
  // ------------------------------------------------------------------ 10
  {
    name: "Baldor-Reliance EM3554T 3 HP Motor",
    category: "Electric Motors",
    subcategory: "Single-phase induction motors",
    material: "Rolled steel",
    dimensions: { length: 11.5, width: 7.3, height: 8.9, unit: "in" },
    weight: { value: 62, unit: "kg" },
    voltageRating: "230/460 V AC",
    otherSpecs: {
      rated_power: "3 hp",
      speed: "1725 rpm",
      protection_class: "IP54",
    },
    descriptionShort:
      "General-purpose single-phase motor, 3 hp, 1725 rpm; frame dimensions in inches mixed with metric weight.",
    descriptionDetailed:
      "Baldor-Reliance EM3554T general-purpose single-phase induction motor. 3 hp, 4-pole, 1725 rpm. Rolled steel frame, IP54. Dual voltage 230/460 V AC. Frame dimensions 11.5 x 7.3 x 8.9 in, weight 62 kg.",
    keywords: ["single-phase motor", "Baldor", "3 hp", "EM3554T", "general purpose"],
    raw: "Baldor-Reliance EM3554T single-phase motor. 3 hp, 1725 rpm. Rolled steel frame, IP54. 230/460 V AC dual voltage. Frame 11.5 in x 7.3 in x 8.9 in. Weight 62 kg.",
  },
  // ------------------------------------------------------------------ 11
  {
    name: "Leroy-Somer LSES 3 kW Motor",
    category: "Electric Motors",
    subcategory: "Three-phase induction motors",
    material: "Aluminum",
    dimensions: { length: 230, width: 180, height: 220, unit: "mm" },
    weight: { value: 30, unit: "kg" },
    voltageRating: "230 V AC, 3-phase",
    certifications: ["CE"],
    otherSpecs: {
      rated_power: "3 kW",
      frequency: "50 Hz",
      protection_class: "IP55",
    },
    descriptionShort:
      "Compact aluminum-frame three-phase motor, 3 kW; the datasheet lists two conflicting frequencies.",
    descriptionDetailed:
      "Leroy-Somer LSES three-phase induction motor with aluminum frame. Rated power 3 kW. Protection class IP55. Supply 230 V AC 3-phase.",
    keywords: ["induction motor", "Leroy-Somer", "3 kW", "aluminum frame"],
    extraFlags: {
      conflictingValues: ["Frequency: the source lists both 50 Hz and 60 Hz"],
    },
    raw: "Leroy-Somer LSES three-phase motor. Rated power 3 kW. Frequency: 50 Hz. Aluminum frame, IP55. 230 V AC 3-phase. Rated frequency 60 Hz.",
  },
  // ------------------------------------------------------------------ 12
  {
    name: "Marathon 56C17Z5 0.75 kW Motor",
    category: "Electric Motors",
    subcategory: "Single-phase induction motors",
    material: "Aluminum",
    dimensions: { length: 180, width: 140, height: 160, unit: "mm" },
    weight: { value: 0.05, unit: "kg" },
    voltageRating: "115/230 V AC",
    otherSpecs: {
      rated_power: "0.75 kW",
      speed: "1725 rpm",
    },
    descriptionShort:
      "Single-phase motor, 0.75 kW; the recorded weight is implausibly low and flagged for review.",
    descriptionDetailed:
      "Marathon 56C17Z5 single-phase induction motor. 0.75 kW, 4-pole, 1725 rpm. Aluminum frame. Dual voltage 115/230 V AC.",
    keywords: ["single-phase motor", "Marathon", "0.75 kW", "56C17Z5"],
    raw: "Marathon 56C17Z5 single-phase motor. 0.75 kW, 1725 rpm. Aluminum frame. 115/230 V AC. Weight 0.05 kg.",
  },
  // ------------------------------------------------------------------ 13
  {
    name: "Grundfos CR5-10 Multistage Centrifugal Pump",
    category: "Pumps",
    subcategory: "Multistage centrifugal pumps",
    material: "Stainless steel (EN 1.4301)",
    dimensions: { length: 118, width: 118, height: 495, unit: "mm" },
    weight: { value: 15, unit: "kg" },
    voltageRating: "230 V AC",
    certifications: ["CE"],
    otherSpecs: {
      flow_rate: "5 m³/h",
      head: "87 m",
      max_pressure: "16 bar",
      protection_class: "IP55",
    },
    descriptionShort:
      "Vertical multistage stainless steel pump delivering 5 m³/h at up to 87 m head.",
    descriptionDetailed:
      "Grundfos CR5-10 vertical multistage centrifugal pump in stainless steel (EN 1.4301). Nominal flow 5 m³/h, max head 87 m, max operating pressure 16 bar. Protection class IP55, 230 V AC supply.",
    keywords: ["multistage pump", "centrifugal pump", "Grundfos", "CR5-10", "stainless steel"],
    raw: "Grundfos CR5-10 vertical multistage centrifugal pump. Stainless steel EN 1.4301. Flow 5 m3/h, head 87 m, max pressure 16 bar. IP55. 230 V AC. Weight 15 kg. CE.",
  },
  // ------------------------------------------------------------------ 14
  {
    name: "Wilo Star-RS 25/6 Circulator Pump",
    category: "Pumps",
    subcategory: "Circulator pumps",
    material: "Cast iron",
    dimensions: { length: 130, width: 130, height: 180, unit: "mm" },
    weight: { value: 2.3, unit: "kg" },
    voltageRating: "230 V AC",
    certifications: ["CE"],
    otherSpecs: {
      flow_rate: "4.5 m³/h",
      head: "6 m",
      protection_class: "IP44",
    },
    descriptionShort:
      "Three-speed glanded circulator pump for heating systems, 4.5 m³/h at 6 m head.",
    descriptionDetailed:
      "Wilo Star-RS 25/6 glanded circulator pump with three speed settings for heating and hot-water systems. Max flow 4.5 m³/h, max head 6 m. Cast iron pump housing, IP44, 230 V AC.",
    keywords: ["circulator pump", "heating pump", "Wilo", "Star-RS 25/6"],
    raw: "Wilo Star-RS 25/6 glanded circulator pump, 3 speeds. Max flow 4.5 m3/h, head 6 m. Cast iron housing, IP44. 230 V AC. Weight 2.3 kg. CE.",
  },
  // ------------------------------------------------------------------ 15
  {
    name: "Ebara 3M 40-125/7.5 Pump",
    category: "Pumps",
    subcategory: "End-suction centrifugal pumps",
    material: "Cast iron",
    dimensions: { length: 150, width: 150, height: 450, unit: "mm" },
    voltageRating: "230 V AC",
    otherSpecs: {
      flow_rate: "15 m³/h",
      head: "20 m",
      max_pressure: "10 bar",
    },
    descriptionShort:
      "End-suction centrifugal pump, 15 m³/h at 20 m head; weight and certifications are not recorded.",
    descriptionDetailed:
      "Ebara 3M 40-125/7.5 end-suction centrifugal pump with cast iron casing. Flow 15 m³/h, head 20 m, max pressure 10 bar. 230 V AC supply.",
    keywords: ["centrifugal pump", "end suction", "Ebara", "3M 40-125"],
    raw: "Ebara 3M 40-125/7.5 end-suction centrifugal pump. Cast iron casing. Flow 15 m3/h, head 20 m, max pressure 10 bar. 230 V AC.",
  },
  // ------------------------------------------------------------------ 16
  {
    name: "KSB Etanorm 050-250 Pump",
    category: "Pumps",
    subcategory: "End-suction centrifugal pumps",
    material: "Cast iron",
    dimensions: { length: 300, width: 300, height: 500, unit: "mm" },
    weight: { value: 210, unit: "kg" },
    otherSpecs: {
      flow_rate: "250 m³/h",
      head: "60 m",
      max_pressure: "16 bar",
    },
    descriptionShort:
      "Heavy-duty end-suction pump; the source sheet contains two different flow-rate figures.",
    descriptionDetailed:
      "KSB Etanorm 050-250 end-suction process pump with cast iron casing. Max pressure 16 bar. Nominal flow 250 m³/h at 60 m head.",
    keywords: ["centrifugal pump", "KSB", "Etanorm", "process pump"],
    extraFlags: {
      conflictingValues: [
        "Flow rate: the source lists both 250 m³/h and 115 m³/h",
      ],
    },
    raw: "KSB Etanorm 050-250 end-suction pump. Cast iron casing. Flow rate 250 m3/h, head 60 m, max pressure 16 bar. Weight 210 kg. Flow rate 115 m3/h per revised data sheet.",
  },
  // ------------------------------------------------------------------ 17
  {
    name: "Pedrollo CPm 158 Self-Priming Pump",
    category: "Pumps",
    subcategory: "Self-priming pumps",
    material: "Aluminum",
    dimensions: { length: 380, width: 210, height: 250, unit: "mm" },
    weight: { value: 14.5, unit: "kgs" },
    voltageRating: "230 V AC",
    certifications: ["CE"],
    otherSpecs: {
      flow_rate: "5.4 m³/h",
      head: "45 m",
      suction: "8 m",
    },
    descriptionShort:
      "Self-priming centrifugal pump for garden and irrigation; weight unit is non-standard.",
    descriptionDetailed:
      "Pedrollo CPm 158 self-priming centrifugal pump with aluminum body and thermal motor protection. Flow 5.4 m³/h, max head 45 m, max suction 8 m. 230 V AC.",
    keywords: ["self-priming pump", "irrigation pump", "Pedrollo", "CPm 158"],
    raw: "Pedrollo CPm 158 self-priming centrifugal pump. Aluminum body. Flow 5.4 m3/h, head 45 m, suction 8 m. 230 V AC. Weight 14.5 kgs. CE.",
  },
  // ------------------------------------------------------------------ 18
  {
    name: "Lowara e-SV 2/2 Pump",
    category: "Pumps",
    subcategory: "Multistage centrifugal pumps",
    material: "Stainless steel",
    dimensions: { length: 100, width: 100, height: 350, unit: "mm" },
    weight: { value: 0.003, unit: "kg" },
    voltageRating: "230 V AC",
    otherSpecs: {
      flow_rate: "2 m³/h",
      head: "22 m",
      max_pressure: "16 bar",
    },
    descriptionShort:
      "Compact multistage stainless pump, 2 m³/h at 22 m head; recorded weight is implausible.",
    descriptionDetailed:
      "Lowara e-SV 2/2 vertical multistage pump in stainless steel. Flow 2 m³/h, head 22 m, max pressure 16 bar. 230 V AC supply.",
    keywords: ["multistage pump", "Lowara", "e-SV", "stainless steel pump"],
    raw: "Lowara e-SV 2/2 vertical multistage pump. Stainless steel. Flow 2 m3/h, head 22 m, max pressure 16 bar. 230 V AC. Weight 0.003 kg.",
  },
  // ------------------------------------------------------------------ 19
  {
    name: "Parker Hannifin 2-Way Normally Closed Solenoid Valve",
    category: "Valves",
    subcategory: "Solenoid valves",
    material: "Brass",
    dimensions: { length: 40, width: 40, height: 120, unit: "mm" },
    weight: { value: 0.9, unit: "kg" },
    voltageRating: "24 V DC",
    certifications: ["CE"],
    otherSpecs: {
      connection: "G 3/8",
      max_pressure: "16 bar",
      orifice_size: "DN 6",
    },
    descriptionShort:
      "2/2 normally closed brass solenoid valve, G 3/8, 24 V DC, up to 16 bar.",
    descriptionDetailed:
      "Parker Hannifin 2-way normally closed solenoid valve. Brass body, G 3/8 connection, DN 6 orifice. Max operating pressure 16 bar. Coil 24 V DC. CE marked.",
    keywords: ["solenoid valve", "2-way valve", "Parker", "normally closed", "24 V DC"],
    raw: "Parker 2-way normally closed solenoid valve. Brass body. Connection G 3/8, orifice DN 6. Max pressure 16 bar. Coil 24 V DC. Weight 0.9 kg. CE.",
  },
  // ------------------------------------------------------------------ 20
  {
    name: "Honeywell V5011P 2-Way Globe Valve",
    category: "Valves",
    subcategory: "Globe valves",
    material: "Cast iron",
    dimensions: { length: 60, width: 60, height: 180, unit: "mm" },
    weight: { value: 5.4, unit: "kg" },
    otherSpecs: {
      connection: "DN 25",
      max_pressure: "16 bar",
      max_flow: "6.3 m³/h",
    },
    descriptionShort:
      "Flanged 2-way globe valve, DN 25, for heating and cooling water circuits.",
    descriptionDetailed:
      "Honeywell V5011P 2-way flanged globe valve for water circuits. DN 25 connection, max pressure 16 bar, max flow 6.3 m³/h. Cast iron body.",
    keywords: ["globe valve", "2-way valve", "Honeywell", "V5011P", "DN 25"],
    raw: "Honeywell V5011P 2-way globe valve, flanged. DN 25. Cast iron body. Max pressure 16 bar, max flow 6.3 m3/h. Weight 5.4 kg.",
  },
  // ------------------------------------------------------------------ 21
  {
    name: "Bürkert 2712 Solenoid Valve",
    category: "Valves",
    subcategory: "Solenoid valves",
    material: "Stainless steel",
    dimensions: { length: 35, width: 35, height: 100, unit: "mm" },
    otherSpecs: {
      connection: "G 1/4",
      max_pressure: "10 bar",
      orifice_size: "DN 4",
    },
    descriptionShort:
      "Compact stainless solenoid valve, G 1/4; coil voltage and weight are not recorded.",
    descriptionDetailed:
      "Bürkert 2712 servo-assisted 2/2-way solenoid valve in stainless steel. G 1/4 connection, DN 4 orifice, max pressure 10 bar.",
    keywords: ["solenoid valve", "Burkert", "2712", "stainless steel valve"],
    raw: "Burkert 2712 solenoid valve. Stainless steel body. Connection G 1/4, orifice DN 4. Max pressure 10 bar.",
  },
  // ------------------------------------------------------------------ 22
  {
    name: "Emerson Fisher 667 Diaphragm Actuator",
    category: "Valves",
    subcategory: "Control valve actuators",
    material: "Cast iron",
    dimensions: { length: 250, width: 250, height: 300, unit: "mm" },
    weight: { value: 8, unit: "kg" },
    otherSpecs: {
      max_pressure: "10 bar",
      connection: "DN 25",
    },
    descriptionShort:
      "Diaphragm actuator for control valves; the datasheet gives two different maximum pressures.",
    descriptionDetailed:
      "Emerson Fisher 667 pneumatic diaphragm actuator for control valve operation. Cast iron yoke. Max operating pressure 10 bar.",
    keywords: ["diaphragm actuator", "control valve", "Fisher", "Emerson", "667"],
    extraFlags: {
      conflictingValues: [
        "Max operating pressure: the source lists both 10 bar and 12 bar",
      ],
    },
    raw: "Emerson Fisher 667 diaphragm actuator. Cast iron yoke. Max operating pressure 10 bar. Weight 8 kg. Max operating pressure 12 bar per revised data sheet.",
  },
  // ------------------------------------------------------------------ 23
  {
    name: "Samson 3251 Control Valve",
    category: "Valves",
    subcategory: "Control valves",
    material: "Cast iron",
    dimensions: { length: 320, width: 320, height: 480, unit: "mm" },
    weight: { value: 115, unit: "lb" },
    otherSpecs: {
      connection: "DN 80",
      max_pressure: "16 bar",
    },
    descriptionShort:
      "Flanged control valve, DN 80; metric dimensions combined with a pound weight need normalization.",
    descriptionDetailed:
      "Samson 3251 flanged control valve, DN 80, cast iron body. Max pressure 16 bar. Weight 115 lb with actuator.",
    keywords: ["control valve", "Samson", "3251", "DN 80"],
    raw: "Samson 3251 control valve, flanged DN 80. Cast iron body. Max pressure 16 bar. Dimensions 320 x 320 x 480 mm. Weight 115 lbs.",
  },
  // ------------------------------------------------------------------ 24
  {
    name: "Siemens VVF40.125 Control Valve",
    category: "Valves",
    subcategory: "Control valves",
    material: "Cast iron",
    dimensions: { length: 300, width: 300, height: 400, unit: "mm" },
    weight: { value: 2400, unit: "kg" },
    otherSpecs: {
      connection: "DN 125",
      max_pressure: "16 bar",
    },
    descriptionShort:
      "Flanged two-port control valve, DN 125; recorded weight is implausible.",
    descriptionDetailed:
      "Siemens VVF40.125 flanged two-port control valve for water. DN 125 connection, max pressure 16 bar. Cast iron body.",
    keywords: ["control valve", "Siemens", "VVF40", "DN 125"],
    raw: "Siemens VVF40.125 two-port control valve, flanged DN 125. Cast iron body. Max pressure 16 bar. Weight 2400 kg.",
  },
  // ------------------------------------------------------------------ 25
  {
    name: "Honeywell PX2AN1XX100PABAX Pressure Transmitter",
    category: "Industrial Sensors",
    subcategory: "Pressure transmitters",
    material: "Stainless steel",
    dimensions: { length: 24, width: 24, height: 60, unit: "mm" },
    weight: { value: 0.05, unit: "kg" },
    voltageRating: "5 V DC",
    certifications: ["CE", "ATEX"],
    otherSpecs: {
      pressure_range: "0–100 psi",
      output: "0.5–4.5 V ratiometric",
      protection_class: "IP67",
    },
    descriptionShort:
      "Heavy-duty pressure transmitter, 0–100 psi, 0.5–4.5 V ratiometric output, IP67.",
    descriptionDetailed:
      "Honeywell PX2 pressure transmitter with stainless steel media-isolated sensor. Range 0–100 psi, output 0.5–4.5 V ratiometric, supply 5 V DC. IP67, CE and ATEX certified.",
    keywords: ["pressure transmitter", "Honeywell", "PX2", "0-100 psi"],
    raw: "Honeywell PX2 pressure transmitter. Stainless steel wetted parts. Range 0-100 psi, output 0.5-4.5 V ratiometric, 5 V DC supply. IP67. CE and ATEX. Weight 0.05 kg.",
  },
  // ------------------------------------------------------------------ 26
  {
    name: "Sick IME12-04BPSZC0S Inductive Proximity Sensor",
    category: "Industrial Sensors",
    subcategory: "Proximity sensors",
    material: "Nickel-plated brass",
    dimensions: { length: 12, width: 12, height: 60, unit: "mm" },
    weight: { value: 0.03, unit: "kg" },
    voltageRating: "10–30 V DC",
    certifications: ["CE"],
    otherSpecs: {
      switching_distance: "4 mm",
      output: "PNP NO",
      protection_class: "IP67",
    },
    descriptionShort:
      "M12 inductive proximity sensor, 4 mm sensing range, PNP normally open output.",
    descriptionDetailed:
      "Sick IME12-04BPSZC0S cylindrical inductive proximity sensor, M12, nickel-plated brass housing. Sensing range 4 mm, PNP NO output, supply 10–30 V DC, IP67.",
    keywords: ["proximity sensor", "inductive sensor", "Sick", "IME12", "M12"],
    raw: "Sick IME12-04BPSZC0S inductive proximity sensor. M12, nickel-plated brass. Sensing range 4 mm. PNP NO. 10-30 V DC. IP67. Weight 0.03 kg. CE.",
  },
  // ------------------------------------------------------------------ 27
  {
    name: "Endress+Hauser Cerabar PMP21 Pressure Transmitter",
    category: "Industrial Sensors",
    subcategory: "Pressure transmitters",
    material: "Stainless steel",
    dimensions: { length: 27, width: 27, height: 100, unit: "mm" },
    voltageRating: "10–30 V DC",
    otherSpecs: {
      pressure_range: "0–40 bar",
      output: "4–20 mA HART",
      protection_class: "IP68",
    },
    descriptionShort:
      "Compact hydrostatic pressure transmitter, 0–40 bar, 4–20 mA HART output.",
    descriptionDetailed:
      "Endress+Hauser Cerabar PMP21 compact pressure transmitter with stainless steel process connection. Range 0–40 bar, output 4–20 mA with HART, supply 10–30 V DC, IP68.",
    keywords: ["pressure transmitter", "Endress+Hauser", "Cerabar", "PMP21"],
    raw: "Endress+Hauser Cerabar PMP21 pressure transmitter. Stainless steel process connection. Range 0-40 bar, 4-20 mA HART. 10-30 V DC supply. IP68.",
  },
  // ------------------------------------------------------------------ 28
  {
    name: "Banner QS18VP6D Photoelectric Sensor",
    category: "Industrial Sensors",
    subcategory: "Photoelectric sensors",
    material: "ABS",
    dimensions: { length: 30, width: 20, height: 15, unit: "mm" },
    weight: { value: 0.05, unit: "kg" },
    voltageRating: "10–30 V DC",
    otherSpecs: {
      sensing_mode: "Retroreflective",
      range: "5 m",
      output: "PNP",
      protection_class: "IP67",
    },
    descriptionShort:
      "Retroreflective photoelectric sensor, 5 m range; the datasheet lists conflicting supply voltages.",
    descriptionDetailed:
      "Banner QS18VP6D photoelectric sensor, retroreflective mode with 5 m range. PNP output, supply 10–30 V DC, IP67 housing.",
    keywords: ["photoelectric sensor", "Banner", "QS18", "retroreflective"],
    extraFlags: {
      conflictingValues: [
        "Supply voltage: the source lists both 10–30 V DC and 24 V AC/DC",
      ],
    },
    raw: "Banner QS18VP6D photoelectric sensor, retroreflective, 5 m range. PNP output. Supply voltage: 10-30 V DC. IP67. Weight 0.05 kg. Supply: 24 V AC/DC.",
  },
  // ------------------------------------------------------------------ 29
  {
    name: "Pepperl+Fuchs NBB15-30GM50-E2 Proximity Switch",
    category: "Industrial Sensors",
    subcategory: "Proximity sensors",
    material: "Nickel-plated brass",
    dimensions: { length: 30, width: 30, height: 50, unit: "mm" },
    weight: { value: 4.5, unit: "mm" },
    voltageRating: "10–30 V DC",
    otherSpecs: {
      switching_distance: "15 mm",
      output: "PNP NO",
    },
    descriptionShort:
      "M30 inductive proximity switch, 15 mm range; the weight is recorded in millimetres.",
    descriptionDetailed:
      "Pepperl+Fuchs NBB15-30GM50-E2 inductive proximity switch, M30, nickel-plated brass. Switching distance 15 mm, PNP NO output, supply 10–30 V DC.",
    keywords: ["proximity switch", "inductive sensor", "Pepperl+Fuchs", "NBB15", "M30"],
    raw: "Pepperl+Fuchs NBB15-30GM50-E2 inductive proximity switch. M30, nickel-plated brass. Switching distance 15 mm. PNP NO. 10-30 V DC. Weight 4.5 mm.",
  },
  // ------------------------------------------------------------------ 30
  {
    name: "Siemens SIRIUS 3RT2015-1BB41 Contactor",
    category: "Electrical Components",
    subcategory: "Contactors",
    material: "Thermoplastic",
    dimensions: { length: 45, width: 75, height: 97, unit: "mm" },
    weight: { value: 0.29, unit: "kg" },
    voltageRating: "24 V DC",
    certifications: ["CE", "UL"],
    otherSpecs: {
      rated_current: "9 A",
      coil_voltage: "24 V DC",
      poles: "3",
    },
    descriptionShort:
      "Three-pole contactor, 9 A rated current, 24 V DC coil, for motor switching up to 4 kW.",
    descriptionDetailed:
      "Siemens SIRIUS 3RT2015-1BB41 three-pole contactor. Rated current 9 A AC-3, coil 24 V DC, suitable for motors up to 4 kW at 400 V. Thermoplastic housing, CE and UL approved.",
    keywords: ["contactor", "Siemens", "SIRIUS", "3RT2015", "9 A"],
    raw: "Siemens SIRIUS 3RT2015-1BB41 contactor. 3 poles, rated current 9 A AC-3. Coil 24 V DC. Motor rating 4 kW at 400 V. Thermoplastic housing. Weight 0.29 kg. CE, UL.",
  },
  // ------------------------------------------------------------------ 31
  {
    name: "Schneider LC1D18 Contactor",
    category: "Electrical Components",
    subcategory: "Contactors",
    material: "Polyamide",
    dimensions: { length: 45, width: 85, height: 78, unit: "mm" },
    weight: { value: 0.36, unit: "kg" },
    voltageRating: "24 V AC",
    certifications: ["CE", "UL", "CCC"],
    otherSpecs: {
      rated_current: "18 A",
      coil_voltage: "24 V AC",
      poles: "3",
    },
    descriptionShort:
      "TeSys D three-pole contactor, 18 A, 24 V AC coil, for motor control applications.",
    descriptionDetailed:
      "Schneider Electric TeSys LC1D18 three-pole contactor. Rated current 18 A AC-3, coil 24 V AC 50/60 Hz. Polyamide housing. CE, UL and CCC approvals.",
    keywords: ["contactor", "Schneider", "TeSys", "LC1D18", "18 A"],
    raw: "Schneider Electric TeSys D LC1D18 contactor. 3 poles, 18 A AC-3. Coil 24 V AC 50/60 Hz. Polyamide housing. Weight 0.36 kg. CE, UL, CCC.",
  },
  // ------------------------------------------------------------------ 32
  {
    name: "Eaton DILM15 Contactor",
    category: "Electrical Components",
    subcategory: "Contactors",
    dimensions: { length: 45, width: 80, height: 90, unit: "mm" },
    weight: { value: 0.4, unit: "kg" },
    voltageRating: "230 V AC",
    otherSpecs: {
      rated_current: "15 A",
      coil_voltage: "230 V AC",
      poles: "3",
    },
    descriptionShort:
      "Three-pole contactor, 15 A, 230 V AC coil; material and certifications are missing.",
    descriptionDetailed:
      "Eaton Moeller DILM15 three-pole contactor. Rated current 15 A AC-3, coil 230 V AC. Suitable for motor circuits up to 7.5 kW.",
    keywords: ["contactor", "Eaton", "Moeller", "DILM15", "15 A"],
    raw: "Eaton Moeller DILM15 contactor. 3 poles, rated current 15 A AC-3. Coil 230 V AC. Motor rating 7.5 kW. Weight 0.4 kg.",
  },
  // ------------------------------------------------------------------ 33
  {
    name: "ABB MS116-16 Motor Protection Circuit Breaker",
    category: "Electrical Components",
    subcategory: "Motor protection",
    material: "Plastic",
    dimensions: { length: 45, width: 90, height: 75, unit: "mm" },
    weight: { value: 0.19, unit: "kg" },
    voltageRating: "400 V AC",
    certifications: ["CE"],
    otherSpecs: {
      rated_current: "16 A",
      setting_range: "10–16 A",
      rated_voltage: "690 V AC",
    },
    descriptionShort:
      "Manual motor starter, 10–16 A setting range; the datasheet lists two different rated voltages.",
    descriptionDetailed:
      "ABB MS116-16 manual motor starter for motor protection. Setting range 10–16 A, rated operational voltage 400 V AC. CE marked.",
    keywords: ["motor starter", "circuit breaker", "ABB", "MS116", "16 A"],
    extraFlags: {
      conflictingValues: [
        "Rated voltage: the source lists both 400 V AC and 690 V AC",
      ],
    },
    raw: "ABB MS116-16 manual motor starter. Setting range 10-16 A. Rated operational voltage 690 V AC. Weight 0.19 kg. Rated voltage 400 V AC. CE.",
  },
  // ------------------------------------------------------------------ 34
  {
    name: "Phoenix Contact UK 5-HESI Fuse Terminal Block",
    category: "Electrical Components",
    subcategory: "Terminal blocks",
    material: "Polyamide",
    dimensions: { length: 6.2, width: 47, height: 0.2, unit: "mm" },
    weight: { value: 0.03, unit: "kg" },
    otherSpecs: {
      rated_current: "6.3 A",
      connection: "2.5 mm²",
      rated_voltage: "250 V",
    },
    descriptionShort:
      "Fuse terminal block for 5×20 mm fuses; the recorded height is implausible.",
    descriptionDetailed:
      "Phoenix Contact UK 5-HESI fuse terminal block with knife-edge lever for 5×20 mm fuses. Rated current 6.3 A, rated voltage 250 V, conductor cross-section up to 2.5 mm². Polyamide housing.",
    keywords: ["fuse terminal block", "Phoenix Contact", "UK 5-HESI", "terminal block"],
    raw: "Phoenix Contact UK 5-HESI fuse terminal block. For 5x20 mm fuses. Rated current 6.3 A, 250 V. Conductor 2.5 mm2. Polyamide. Height 0.2 mm. Weight 0.03 kg.",
  },
  // ------------------------------------------------------------------ 35
  {
    name: "Mean Well HDR-60-24 DIN Rail Power Supply",
    category: "Power Supplies",
    subcategory: "DIN rail power supplies",
    material: "Metal",
    dimensions: { length: 35, width: 90, height: 54, unit: "mm" },
    weight: { value: 0.24, unit: "kg" },
    voltageRating: "85–264 V AC input / 24 V DC output",
    certifications: ["CE", "UL", "TUV"],
    otherSpecs: {
      output_power: "60 W",
      output_current: "2.5 A",
      efficiency: "88%",
    },
    descriptionShort:
      "Compact DIN rail power supply, 60 W, 24 V DC output, 2.5 A, for control cabinets.",
    descriptionDetailed:
      "Mean Well HDR-60-24 ultra-slim DIN rail power supply. Output 24 V DC at 2.5 A (60 W). Wide-range input 85–264 V AC. Efficiency 88%. CE, UL and TUV approvals.",
    keywords: ["DIN rail power supply", "Mean Well", "HDR-60-24", "24 V DC", "60 W"],
    raw: "Mean Well HDR-60-24 DIN rail power supply. Output 24 V DC / 2.5 A, 60 W. Input 85-264 V AC. Efficiency 88%. Metal enclosure. Weight 0.24 kg. CE, UL, TUV.",
  },
  // ------------------------------------------------------------------ 36
  {
    name: "Phoenix Contact QUINT-PS/1AC/24DC/5 Power Supply",
    category: "Power Supplies",
    subcategory: "DIN rail power supplies",
    material: "Metal",
    dimensions: { length: 48, width: 99, height: 107, unit: "mm" },
    weight: { value: 0.44, unit: "kg" },
    voltageRating: "100–240 V AC input / 24 V DC output",
    certifications: ["CE", "UL", "GL"],
    otherSpecs: {
      output_power: "120 W",
      output_current: "5 A",
      efficiency: "90%",
    },
    descriptionShort:
      "Industrial DIN rail power supply, 24 V DC at 5 A, with SFB technology for breaker selectivity.",
    descriptionDetailed:
      "Phoenix Contact QUINT-PS/1AC/24DC/5 DIN rail power supply with SFB (Selective Fuse Breaking) technology. Output 24 V DC at 5 A (120 W), input 100–240 V AC. CE, UL and GL approvals.",
    keywords: ["DIN rail power supply", "Phoenix Contact", "QUINT", "24 V DC", "5 A"],
    raw: "Phoenix Contact QUINT-PS/1AC/24DC/5 DIN rail power supply. 24 V DC / 5 A, 120 W. Input 100-240 V AC. SFB technology. Weight 0.44 kg. CE, UL, GL.",
  },
  // ------------------------------------------------------------------ 37
  {
    name: "Siemens SITOP PSU100M 24 V/2.5 A Power Supply",
    category: "Power Supplies",
    subcategory: "DIN rail power supplies",
    dimensions: { length: 45, width: 80, height: 125, unit: "mm" },
    voltageRating: "120/230 V AC input / 24 V DC output",
    otherSpecs: {
      output_power: "60 W",
      output_current: "2.5 A",
    },
    descriptionShort:
      "SITOP modular power supply, 24 V DC at 2.5 A; weight and material are not recorded.",
    descriptionDetailed:
      "Siemens SITOP PSU100M power supply, 24 V DC at 2.5 A (60 W). Input 120/230 V AC selectable. For control and building automation.",
    keywords: ["power supply", "Siemens", "SITOP", "PSU100M", "24 V DC"],
    raw: "Siemens SITOP PSU100M power supply. Output 24 V DC / 2.5 A, 60 W. Input 120/230 V AC selectable.",
  },
  // ------------------------------------------------------------------ 38
  {
    name: "Weidmüller PRO ECO 240W 24V Power Supply",
    category: "Power Supplies",
    subcategory: "DIN rail power supplies",
    material: "Metal",
    dimensions: { length: 60, width: 125, height: 115, unit: "mm" },
    weight: { value: 0.8, unit: "kg" },
    voltageRating: "110–240 V AC input / 24 V DC output",
    otherSpecs: {
      output_power: "240 W",
      output_current: "10 A",
      efficiency: "93%",
    },
    descriptionShort:
      "240 W DIN rail power supply, 24 V DC at 10 A; the datasheet lists two input voltage ranges.",
    descriptionDetailed:
      "Weidmüller PRO ECO 240W 24V DIN rail power supply. Output 24 V DC at 10 A (240 W). Input 110–240 V AC. Efficiency 93%.",
    keywords: ["power supply", "Weidmuller", "PRO ECO", "240 W", "24 V DC"],
    extraFlags: {
      conflictingValues: [
        "Input voltage: the source lists both 85–264 V AC and 110–240 V AC",
      ],
    },
    raw: "Weidmuller PRO ECO 240W 24V DIN rail power supply. 24 V DC / 10 A, 240 W. Input: 85-264 V AC wide range. Efficiency 93%. Weight 0.8 kg. Input voltage 110-240 V AC.",
  },
  // ------------------------------------------------------------------ 39
  {
    name: "SMC CDQ2B32-25DZ Pneumatic Cylinder",
    category: "Pneumatic Components",
    subcategory: "Cylinders",
    material: "Aluminum",
    dimensions: { length: 32, width: 32, height: 145, unit: "mm" },
    weight: { value: 0.35, unit: "kg" },
    certifications: ["CE"],
    otherSpecs: {
      bore: "32 mm",
      stroke: "25 mm",
      max_pressure: "1.0 MPa",
      connection: "G 1/8",
    },
    descriptionShort:
      "Compact round-body air cylinder, 32 mm bore, 25 mm stroke, for light automation.",
    descriptionDetailed:
      "SMC CDQ2B32-25DZ compact cylinder with 32 mm bore and 25 mm stroke. Aluminum barrel, max operating pressure 1.0 MPa, G 1/8 ports. Magnetic piston for position sensing.",
    keywords: ["air cylinder", "pneumatic cylinder", "SMC", "CDQ2B", "32 mm bore"],
    raw: "SMC CDQ2B32-25DZ compact air cylinder. Bore 32 mm, stroke 25 mm. Aluminum barrel. Max pressure 1.0 MPa, ports G 1/8. Weight 0.35 kg. CE.",
  },
  // ------------------------------------------------------------------ 40
  {
    name: "Festo DSNU-25-50-P-A Cylinder",
    category: "Pneumatic Components",
    subcategory: "Cylinders",
    dimensions: { length: 25, width: 25, height: 150, unit: "mm" },
    weight: { value: 0.28, unit: "kg" },
    otherSpecs: {
      bore: "25 mm",
      stroke: "50 mm",
      max_pressure: "10 bar",
    },
    descriptionShort:
      "Double-acting round cylinder, 25 mm bore, 50 mm stroke; material and certifications are missing.",
    descriptionDetailed:
      "Festo DSNU-25-50-P-A double-acting pneumatic cylinder. Bore 25 mm, stroke 50 mm, max pressure 10 bar. Round barrel design with piston position sensing.",
    keywords: ["air cylinder", "pneumatic cylinder", "Festo", "DSNU-25", "round cylinder"],
    raw: "Festo DSNU-25-50-P-A double-acting cylinder. Bore 25 mm, stroke 50 mm. Max pressure 10 bar. Weight 0.28 kg.",
  },
  // ------------------------------------------------------------------ 41
  {
    name: "Parker P1D-S050MS Compact Cylinder",
    category: "Pneumatic Components",
    subcategory: "Cylinders",
    material: "Aluminum",
    dimensions: { length: 2.36, width: 1.38, height: 5.9, unit: "in" },
    weight: { value: 0.8, unit: "kg" },
    otherSpecs: {
      bore: "50 mm",
      stroke: "50 mm",
      max_pressure: "10 bar",
    },
    descriptionShort:
      "Compact ISO cylinder, 50 mm bore; inch dimensions combined with a metric weight.",
    descriptionDetailed:
      "Parker P1D-S050MS compact pneumatic cylinder, ISO 21287. Bore 50 mm, stroke 50 mm, max pressure 10 bar. Aluminum body.",
    keywords: ["air cylinder", "pneumatic cylinder", "Parker", "P1D", "compact cylinder"],
    raw: "Parker P1D-S050MS compact cylinder, ISO 21287. Bore 50 mm, stroke 50 mm. Aluminum body. Max pressure 10 bar. Overall dimensions 2.36 in x 1.38 in x 5.9 in. Weight 0.8 kg.",
  },
  // ------------------------------------------------------------------ 42
  {
    name: "Norgren RM/28025/M/50 Cylinder",
    category: "Pneumatic Components",
    subcategory: "Cylinders",
    material: "Aluminum",
    dimensions: { length: 25, width: 25, height: 200, unit: "mm" },
    weight: { value: 900, unit: "kg" },
    otherSpecs: {
      bore: "25 mm",
      stroke: "50 mm",
      max_pressure: "10 bar",
    },
    descriptionShort:
      "Round-line air cylinder, 25 mm bore, 50 mm stroke; recorded weight is implausible.",
    descriptionDetailed:
      "Norgren RM/28025/M/50 round-line pneumatic cylinder. Bore 25 mm, stroke 50 mm, max pressure 10 bar. Aluminum body.",
    keywords: ["air cylinder", "pneumatic cylinder", "Norgren", "RM/28025", "round cylinder"],
    raw: "Norgren RM/28025/M/50 round-line air cylinder. Bore 25 mm, stroke 50 mm. Aluminum body. Max pressure 10 bar. Weight 900 kg.",
  },
];
