/**
 * Delivery Mapper — converts ProductIQ internal product records into
 * output rows matching the canonical delivery schema headers.
 *
 * Architecture:
 *   ProductIQ Internal Product
 *           ↓
 *   Delivery Mapper
 *           ↓
 *   Canonical Expected Headers
 *           ↓
 *   Output Row (Record<string, string>)
 *
 * If a header has no supported value, the cell is left blank.
 * No data is ever invented to fill a slot.
 */

import type { Doc } from "@/convex/_generated/dataModel";

type Product = Doc<"products">;

/** Core field mappings — header keyword → product field extractor. */
const CORE_MAPPINGS: {
  match: RegExp;
  extract: (p: Product) => string;
}[] = [
  { match: /part\s*number|part_number|partnumber|part_no|pn\b/i, extract: (p) => p.productName },
  { match: /product\s*name|product_name|productname|item_name|item\s*name/i, extract: (p) => p.productName },
  { match: /manufacturer|maker|brand_name|brand\s*name|mfg\b/i, extract: (p) => extractManufacturer(p) },
  { match: /brand\b/i, extract: (p) => extractManufacturer(p) },
  { match: /category|product_category|product\s*category|type/i, extract: (p) => p.category },
  { match: /subcategory|sub_category|sub\s*category/i, extract: (p) => p.subcategory },
  { match: /description|product_description|product\s*description|desc\b/i, extract: (p) => p.descriptionShort || p.descriptionDetailed },
  { match: /long_description|detailed_description|detailed\s*description/i, extract: (p) => p.descriptionDetailed },
  { match: /short_description|brief_description|brief\s*description/i, extract: (p) => p.descriptionShort },
  { match: /product_url|product\s*url|url|link|product_link|source_url/i, extract: () => "" },
  { match: /search_keywords|keywords|search_terms|tags/i, extract: (p) => p.searchKeywords.join(", ") },
  { match: /material|substance|composition/i, extract: (p) => p.specs.material ?? "" },
  { match: /dimension|size|l_x_w_x_h/i, extract: (p) => formatDimensions(p) },
  { match: /length\b/i, extract: (p) => p.specs.dimensions?.length != null ? String(p.specs.dimensions.length) : "" },
  { match: /width\b/i, extract: (p) => p.specs.dimensions?.width != null ? String(p.specs.dimensions.width) : "" },
  { match: /height\b/i, extract: (p) => p.specs.dimensions?.height != null ? String(p.specs.dimensions.height) : "" },
  { match: /unit_of_measure|uom|dimension_unit|size_unit/i, extract: (p) => p.specs.dimensions?.unit ?? "" },
  { match: /weight\b|mass/i, extract: (p) => p.specs.weight?.value != null ? String(p.specs.weight.value) : "" },
  { match: /weight_unit|mass_unit/i, extract: (p) => p.specs.weight?.unit ?? "" },
  { match: /voltage|voltage_rating|voltage\s*rating|rated_voltage/i, extract: (p) => p.specs.voltageRating ?? "" },
  { match: /certification|compliance|approval|marking/i, extract: (p) => p.specs.certifications.join(", ") },
  { match: /quality_score|product_quality|quality\s*score/i, extract: (p) => String(p.qualityScore.overall) },
  { match: /status|validation_status/i, extract: (p) => p.status },
];

function extractManufacturer(p: Product): string {
  const name = p.productName;
  const match = name.match(/^([A-Za-z][A-Za-z\s&.-]+?)\s+\d/);
  return match ? match[1].trim() : "";
}

function formatDimensions(p: Product): string {
  const d = p.specs.dimensions;
  if (!d) return "";
  const parts = [d.length, d.width, d.height]
    .filter((x): x is number => x !== null)
    .join(" x ");
  return parts + (d.unit ? ` ${d.unit}` : "");
}

/**
 * Maps a ProductIQ product to an output row matching the delivery schema.
 */
export function mapProductToRow(
  product: Product,
  headers: string[],
  inputRawData: Record<string, string>,
): Record<string, string> {
  const output: Record<string, string> = {};

  for (const header of headers) {
    const h = header.trim();

    // ATTRIBUTE_LABEL/VALUE/UOM pattern
    const attrLabelMatch = h.match(/^ATTRIBUTE_LABEL\s*(\d+)$/i);
    if (attrLabelMatch) {
      const idx = parseInt(attrLabelMatch[1], 10);
      const attr = getAttributeByIndex(product, idx);
      output[h] = attr?.label ?? "";
      continue;
    }
    const attrValMatch = h.match(/^ATTRIBUTE_VALUE\s*(\d+)$/i);
    if (attrValMatch) {
      const idx = parseInt(attrValMatch[1], 10);
      const attr = getAttributeByIndex(product, idx);
      output[h] = attr?.value ?? "";
      continue;
    }
    const attrUomMatch = h.match(/^ATTRIBUTE_UOM\s*(\d+)$/i);
    if (attrUomMatch) {
      const idx = parseInt(attrUomMatch[1], 10);
      const attr = getAttributeByIndex(product, idx);
      output[h] = attr?.uom ?? "";
      continue;
    }

    // Try exact match against input raw data
    const inputKey = findInputKey(header, Object.keys(inputRawData));
    if (inputKey && inputRawData[inputKey]) {
      output[h] = inputRawData[inputKey];
      continue;
    }

    // Try core field mappings
    const mapping = CORE_MAPPINGS.find((m) => m.match.test(h));
    if (mapping) {
      output[h] = mapping.extract(product);
      continue;
    }

    // Try otherSpecs key match
    const specVal = findSpecValue(header, product);
    if (specVal !== null) {
      output[h] = specVal;
      continue;
    }

    // No match — leave blank
    output[h] = "";
  }

  return output;
}

function findInputKey(header: string, inputKeys: string[]): string | null {
  const normalized = header.toLowerCase().replace(/[\s_-]+/g, "");
  for (const key of inputKeys) {
    if (key.toLowerCase().replace(/[\s_-]+/g, "") === normalized) return key;
  }
  for (const key of inputKeys) {
    const nk = key.toLowerCase().replace(/[\s_-]+/g, "");
    if (normalized.includes(nk) || nk.includes(normalized)) return key;
  }
  return null;
}

function findSpecValue(header: string, product: Product): string | null {
  const normalized = header.toLowerCase().replace(/[\s_-]+/g, "");
  for (const [key, value] of Object.entries(product.specs.otherSpecs)) {
    if (key.startsWith("normalized_")) continue;
    const nk = key.toLowerCase().replace(/_/g, "");
    if (normalized === nk || normalized.includes(nk) || nk.includes(normalized)) {
      return value;
    }
  }
  return null;
}

interface Attribute {
  label: string;
  value: string;
  uom: string;
}

function getAllAttributes(product: Product): Attribute[] {
  const attrs: Attribute[] = [];

  const coreFields: [string, string | null, string][] = [
    ["Material", product.specs.material, ""],
    ["Voltage Rating", product.specs.voltageRating, ""],
    ["Weight", product.specs.weight?.value != null ? String(product.specs.weight.value) : null, product.specs.weight?.unit ?? ""],
    ["Length", product.specs.dimensions?.length != null ? String(product.specs.dimensions.length) : null, product.specs.dimensions?.unit ?? ""],
    ["Width", product.specs.dimensions?.width != null ? String(product.specs.dimensions.width) : null, product.specs.dimensions?.unit ?? ""],
    ["Height", product.specs.dimensions?.height != null ? String(product.specs.dimensions.height) : null, product.specs.dimensions?.unit ?? ""],
    ["Certifications", product.specs.certifications.length > 0 ? product.specs.certifications.join(", ") : null, ""],
  ];

  for (const [label, value, uom] of coreFields) {
    if (value) attrs.push({ label, value, uom });
  }

  for (const [key, value] of Object.entries(product.specs.otherSpecs)) {
    if (key.startsWith("normalized_")) continue;
    if (!value) continue;
    attrs.push({
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
      uom: "",
    });
  }

  attrs.sort((a, b) => {
    const confA = getAttributeConfidence(a.label, product);
    const confB = getAttributeConfidence(b.label, product);
    return confB - confA;
  });

  return attrs.slice(0, 50);
}

function getAttributeConfidence(label: string, product: Product): number {
  const normalized = label.toLowerCase().replace(/[\s_-]+/g, "");
  for (const [key, meta] of Object.entries(product.otherSpecsMetadata)) {
    if (key.toLowerCase().replace(/_/g, "") === normalized) {
      return meta.confidence;
    }
  }
  return 0;
}

function getAttributeByIndex(product: Product, index: number): Attribute | null {
  const attrs = getAllAttributes(product);
  return attrs[index - 1] ?? null;
}

export function mapBatchToOutput(
  products: { product: Product; inputRawData: Record<string, string> }[],
  headers: string[],
): Record<string, string>[] {
  return products.map(({ product, inputRawData }) =>
    mapProductToRow(product, headers, inputRawData),
  );
}
