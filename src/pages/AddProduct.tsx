import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, FileUp, Lightbulb, Loader2, ScanSearch, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const SAMPLES = [
  {
    label: "Ball bearing",
    text: `SKF 6205-2RS1 deep groove ball bearing, sealed on both sides. Bore diameter 25 mm, outside diameter 52 mm, width 15 mm. Chrome steel rings and balls. Static load rating 7.8 kN, dynamic load rating 14.8 kN. Limiting speed 12,000 rpm. Weight 0.128 kg. Manufactured under ISO 9001.`,
  },
  {
    label: "Centrifugal pump",
    text: `Grundfos CR5-10 vertical multistage centrifugal pump. Stainless steel EN 1.4301. Flow 5 m3/h, head 87 m, max pressure 16 bar. IP55. 230 V AC. Weight 15 kg. CE.`,
  },
  {
    label: "Proximity sensor",
    text: `Sick IME12-04BPSZC0S inductive proximity sensor. M12, nickel-plated brass. Sensing range 4 mm. PNP NO. 10-30 V DC. IP67. Weight 0.03 kg. CE.`,
  },
];

/** Minimal CSV parser that handles quoted fields, commas, and newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function rowToText(header: string[], cells: string[]): string {
  return cells
    .map((cell, index) => {
      const label = header[index]?.trim();
      const value = cell.trim();
      if (!label && !value) return null;
      return label && value ? `${label}: ${value}` : value || null;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
}

export default function AddProduct() {
  const navigate = useNavigate();
  const start = useMutation(api.processing.start);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"paste" | "csv">("paste");
  const [rawInput, setRawInput] = useState("");
  const [inputName, setInputName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvHeader, setCsvHeader] = useState<string[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result ?? ""));
        if (rows.length === 0) {
          setCsvError("The file is empty or contains no data rows.");
          return;
        }
        const header = rows[0];
        const data = rows.slice(1);
        if (data.length === 0) {
          setCsvError("The file only contains a header row — add at least one product row.");
          return;
        }
        setCsvHeader(header);
        setCsvRows(data.slice(0, 50));
        setInputName(file.name);
      } catch {
        setCsvError("Could not read the CSV file. Make sure it is a valid .csv file.");
      }
    };
    reader.readAsText(file);
  };

  const loadCsvRow = (index: number) => {
    const text = rowToText(csvHeader, csvRows[index]);
    setRawInput(text);
    setInputName(csvHeader[0] ? `${inputName} — row ${index + 2}` : inputName);
    setMode("paste");
    setError(null);
  };

  const handleSubmit = async () => {
    const text = rawInput.trim();
    if (!text) {
      setError("Paste or load some product information before starting the pipeline.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const jobId = await start({ rawInputText: text, inputName });
      navigate(`/processing/${jobId}`);
    } catch (err) {
      const data = (err as { data?: { message?: string } }).data;
      setError(data?.message ?? "Could not start processing. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
          Add product
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          Feed the pipeline raw product information
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Paste a datasheet, a supplier email, or a catalog extract — or upload a CSV. ProductIQ
          extracts, enriches, validates, scores, and saves a structured record using the live AI
          pipeline.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-xl border bg-zinc-100/70 p-1">
        {(
          [
            { key: "paste", label: "Paste text", icon: ScanSearch },
            { key: "csv", label: "Upload CSV", icon: FileUp },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setMode(key);
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              mode === key
                ? "bg-card text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {mode === "paste" && (
        <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <div>
            <label htmlFor="input-name" className="mb-1.5 block text-[13px] font-medium text-zinc-700">
              Source label <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <Input
              id="input-name"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="e.g. Supplier datasheet 2026-03"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="raw-input" className="text-[13px] font-medium text-zinc-700">
                Raw product information
              </label>
              <span className="text-[12px] text-zinc-400">{rawInput.length} characters</span>
            </div>
            <Textarea
              id="raw-input"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={"e.g.\nSKF 6205-2RS1 deep groove ball bearing, sealed on both sides. Bore 25 mm, OD 52 mm, width 15 mm...\n\nAnything goes — messy, incomplete, or duplicate text is fine."}
              rows={10}
              className="font-mono text-[13px] leading-relaxed"
            />
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-zinc-50 px-3.5 py-3 text-[12px] text-zinc-500">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
            <span>
              Try a sample to see the pipeline in action — or paste your own text.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((sample) => (
              <button
                key={sample.label}
                onClick={() => {
                  setRawInput(sample.text);
                  setInputName(`${sample.label} sample`);
                  setError(null);
                }}
                className="rounded-full border px-3 py-1.5 text-[12px] font-medium text-zinc-600 transition-colors hover:border-primary hover:text-primary"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "csv" && (
        <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-10 transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="size-5" />
            </span>
            <span className="text-sm font-medium text-zinc-700">
              {csvRows.length > 0 ? `${csvRows.length} rows loaded — pick one to process` : "Choose a CSV file"}
            </span>
            <span className="text-[12px] text-zinc-400">
              Each row becomes a product. Columns are used as field labels.
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {csvError && (
            <p className="flex items-center gap-2 rounded-lg bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
              <AlertTriangle className="size-4 shrink-0" />
              {csvError}
            </p>
          )}
          {csvRows.length > 0 && (
            <div className="overflow-hidden rounded-xl border">
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="sticky top-0 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-400">
                    <tr>
                      {csvHeader.slice(0, 5).map((header, i) => (
                        <th key={i} className="px-3 py-2 font-semibold">{header || `Col ${i + 1}`}</th>
                      ))}
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 8).map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        onClick={() => loadCsvRow(rowIndex)}
                        className="cursor-pointer border-t transition-colors hover:bg-primary/[0.04]"
                      >
                        {row.slice(0, 5).map((cell, cellIndex) => (
                          <td key={cellIndex} className="max-w-[180px] truncate px-3 py-2 text-zinc-700">
                            {cell}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right text-[12px] font-medium text-primary">
                          Load
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t bg-zinc-50 px-3.5 py-2 text-[12px] text-zinc-500">
                Click a row to load it into the editor as formatted text, then run the pipeline.
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3.5 py-3 text-[13px] text-rose-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="max-w-sm text-[12px] leading-relaxed text-zinc-400">
          <Sparkles className="mr-1 inline size-3.5 text-primary" />
          Requires an <span className="font-medium text-zinc-500">OPENAI_API_KEY</span> in the
          project's Keys tab. Every stage of the pipeline is shown live — nothing is simulated.
        </p>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !rawInput.trim()}
          className="gap-2 px-5 py-2.5"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {isSubmitting ? "Starting pipeline…" : "Start AI processing"}
        </Button>
      </div>
    </div>
  );
}
