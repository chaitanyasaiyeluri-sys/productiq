/**
 * Batch Upload page — the primary workflow for UniHack evaluation.
 *
 * 1. Upload the official Expected Output CSV to configure the delivery schema
 * 2. Upload a product dataset (CSV/XLSX) to process
 * 3. Process all rows through the Gemini pipeline
 * 4. Track progress with live status updates
 */
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileUp,
  FileSpreadsheet,
  Loader2,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx";

/** Parse CSV text into array of objects using first row as headers. */
function parseCsvToRows(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      lines.push(current);
      current = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  lines.push(current);

  // Group into rows
  const allCells: string[] = lines;
  // Re-parse properly into rows
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0];
  const dataRows = rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? "";
    });
    return obj;
  });
  return { headers, rows: dataRows };
}

export default function BatchUpload() {
  const navigate = useNavigate();
  const deliverySchema = useQuery(api.deliverySchema.get);
  const uploadSchema = useMutation(api.deliverySchema.upload);
  const clearSchema = useMutation(api.deliverySchema.clear);
  const createBatch = useMutation(api.batchJobs.create);
  const deleteBatch = useMutation(api.batchJobs.deleteBatch);
  const processBatch = useAction(api.batchJobs.processBatch);
  const batchJobs = useQuery(api.batchJobs.listMy);

  const schemaInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);

  const [schemaName, setSchemaName] = useState("");
  const [schemaHeaders, setSchemaHeaders] = useState<string[]>([]);
  const [schemaPreview, setSchemaPreview] = useState(false);

  const [dataName, setDataName] = useState("");
  const [dataHeaders, setDataHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<Record<string, string>[]>([]);
  const [dataPreview, setDataPreview] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isUploadingSchema, setIsUploadingSchema] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [batchSize, setBatchSize] = useState<1 | 2 | 5 | 10 | 25 | 100 | 0>(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const BATCH_OPTIONS: { label: string; value: 1 | 2 | 5 | 10 | 25 | 100 | 0 }[] = [
    { label: "1 row", value: 1 },
    { label: "2 rows", value: 2 },
    { label: "5 rows", value: 5 },
    { label: "10 rows", value: 10 },
    { label: "25 rows", value: 25 },
    { label: "100 rows", value: 100 },
    { label: "All rows", value: 0 },
  ];

  // --- Schema upload ---
  const handleSchemaFile = (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        // Parse first row only
        const firstLine = text.split(/\r?\n/)[0];
        if (!firstLine) {
          setError("The file appears to be empty.");
          return;
        }
        // Simple CSV header parse
        const headers: string[] = [];
        let field = "";
        let inQ = false;
        for (let i = 0; i < firstLine.length; i++) {
          const ch = firstLine[i];
          if (inQ) {
            if (ch === '"') {
              if (firstLine[i + 1] === '"') { field += '"'; i++; }
              else inQ = false;
            } else field += ch;
          } else if (ch === '"') inQ = true;
          else if (ch === ",") { headers.push(field.trim()); field = ""; }
          else field += ch;
        }
        headers.push(field.trim());

        if (headers.length === 0 || headers.every((h) => h === "")) {
          setError("No headers found in the file.");
          return;
        }
        // Check duplicates
        const seen = new Set<string>();
        for (const h of headers) {
          if (seen.has(h)) {
            setError(`Duplicate header: "${h}"`);
            return;
          }
          seen.add(h);
        }

        setSchemaHeaders(headers);
        setSchemaName(file.name.replace(/\.(csv|xlsx?)$/i, ""));
        setSchemaPreview(true);
      } catch {
        setError("Could not parse the schema file.");
      }
    };
    reader.readAsText(file);
  };

  const handleSaveSchema = async () => {
    if (schemaHeaders.length === 0) return;
    setIsUploadingSchema(true);
    setError(null);
    try {
      await uploadSchema({ name: schemaName, headers: schemaHeaders });
      setSchemaPreview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schema.");
    } finally {
      setIsUploadingSchema(false);
    }
  };

  // --- Data upload ---
  const handleDataFile = (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv" || ext === "txt") {
      reader.onload = () => {
        try {
          const result = parseCsvToRows(String(reader.result ?? ""));
          if (result.rows.length === 0) {
            setError("The file contains no data rows.");
            return;
          }
          setDataHeaders(result.headers);
          setDataRows(result.rows);
          setDataName(file.name);
          setDataPreview(true);
        } catch {
          setError("Could not parse the CSV file.");
        }
      };
      reader.readAsText(file);
    } else if (ext === "xlsx" || ext === "xls") {
      reader.onload = () => {
        try {
          const wb = XLSX.read(reader.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
          if (json.length === 0) {
            setError("The file contains no data rows.");
            return;
          }
          const headers = Object.keys(json[0]);
          setDataHeaders(headers);
          setDataRows(json);
          setDataName(file.name);
          setDataPreview(true);
        } catch {
          setError("Could not parse the XLSX file.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError("Unsupported file format. Please upload CSV or XLSX.");
    }
  };

  // --- Create and start batch job ---
  const handleStartBatch = async () => {
    if (dataRows.length === 0) return;
    setIsCreatingJob(true);
    setError(null);
    try {
      const sourceTotalRows = dataRows.length;
      const selectedRows = batchSize === 0 ? dataRows.length : batchSize;
      const rowsToSend = dataRows.slice(0, selectedRows);

      const jobId = await createBatch({
        name: dataName,
        inputHeaders: dataHeaders,
        rows: rowsToSend,
        sourceTotalRows,
        selectedRows: rowsToSend.length,
      });
      setDataPreview(false);
      setDataRows([]);
      setDataHeaders([]);
      // Start processing
      void processBatch({ jobId });
      navigate(`/batch/${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create batch job.");
    } finally {
      setIsCreatingJob(false);
    }
  };

  // --- Delete batch ---
  const handleDeleteBatch = async (jobId: Id<"batchJobs">) => {
    setDeletingId(jobId);
    setConfirmDeleteId(null);
    try {
      await deleteBatch({ jobId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete batch.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
          Batch processing
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          Upload Product Dataset
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload a CSV or XLSX file with product rows. ProductIQ enriches each row
          using the live Gemini pipeline, maps the results to your delivery schema,
          and exports a ready-to-deliver catalog file.
        </p>
      </div>

      {/* Step 1: Delivery Schema */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
            1
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Configure Delivery Schema</h2>
            <p className="text-[12px] text-zinc-500">
              Upload the official Expected Output CSV to define the exact output headers.
            </p>
          </div>
        </div>

        {deliverySchema ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <div className="flex-1">
              <p className="text-[13px] font-medium text-emerald-800">
                Schema loaded — {deliverySchema.headerCount} columns
              </p>
              <p className="text-[12px] text-emerald-600">
                {deliverySchema.name} · Ready for enrichment
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void clearSchema()}
              className="text-[12px] text-zinc-500"
            >
              Replace
            </Button>
          </div>
        ) : schemaPreview ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-sky-50 px-4 py-3">
              <Settings2 className="size-4 text-sky-600" />
              <p className="text-[13px] font-medium text-sky-800">
                {schemaHeaders.length} columns detected in "{schemaName}"
              </p>
            </div>
            <div className="max-h-32 overflow-auto rounded-lg border bg-zinc-50 p-3">
              <div className="flex flex-wrap gap-1.5">
                {schemaHeaders.map((h, i) => (
                  <span key={i} className="rounded bg-white border px-2 py-0.5 text-[11px] font-mono text-zinc-600">
                    {i + 1}. {h}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void handleSaveSchema()} disabled={isUploadingSchema} className="gap-2">
                {isUploadingSchema ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Save Schema
              </Button>
              <Button variant="outline" onClick={() => { setSchemaPreview(false); setSchemaHeaders([]); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => schemaInputRef.current?.click()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-6 transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
          >
            <Settings2 className="size-5 text-zinc-400" />
            <span className="text-sm text-zinc-600">Upload Expected Output CSV</span>
          </button>
        )}
        <input
          ref={schemaInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleSchemaFile(e.target.files?.[0])}
        />
      </div>

      {/* Step 2: Dataset Upload */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
            2
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Upload Product Dataset</h2>
            <p className="text-[12px] text-zinc-500">
              CSV or XLSX with one product per row. Any column combination is supported.
            </p>
          </div>
        </div>

        {dataPreview ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-sky-50 px-4 py-3">
              <FileSpreadsheet className="size-4 text-sky-600" />
              <p className="text-[13px] font-medium text-sky-800">
                {dataRows.length} products · {dataHeaders.length} columns · {dataName}
              </p>
            </div>
            <div className="overflow-auto rounded-lg border max-h-48">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-zinc-50">
                  <tr>
                    {dataHeaders.slice(0, 8).map((h) => (
                      <th key={h} className="px-3 py-2 font-semibold text-zinc-500">{h}</th>
                    ))}
                    {dataHeaders.length > 8 && <th className="px-3 py-2 text-zinc-400">+{dataHeaders.length - 8} more</th>}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t">
                      {dataHeaders.slice(0, 8).map((h) => (
                        <td key={h} className="max-w-[120px] truncate px-3 py-1.5 text-zinc-700">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Batch size selector */}
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-medium text-zinc-600">Process:</span>
              <div className="flex gap-1.5">
                {BATCH_OPTIONS.map((opt) => {
                  const count = opt.value === 0 ? dataRows.length : opt.value;
                  const disabled = count > dataRows.length;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => !disabled && setBatchSize(opt.value)}
                      disabled={disabled}
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        batchSize === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : disabled
                            ? "border-zinc-200 bg-zinc-50 text-zinc-300 cursor-not-allowed"
                            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-[12px] text-zinc-500">
              <span>Testing {batchSize === 0 ? dataRows.length : Math.min(batchSize, dataRows.length)} of {dataRows.length} products</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void handleStartBatch()} disabled={isCreatingJob} className="gap-2">
                {isCreatingJob ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Start AI Processing
              </Button>
              <Button variant="outline" onClick={() => { setDataPreview(false); setDataRows([]); setDataHeaders([]); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => dataInputRef.current?.click()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-6 transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
          >
            <Upload className="size-5 text-zinc-400" />
            <span className="text-sm text-zinc-600">Choose CSV or XLSX file</span>
          </button>
        )}
        <input
          ref={dataInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.txt"
          className="hidden"
          onChange={(e) => handleDataFile(e.target.files?.[0])}
        />
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {/* My batch jobs */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">My Batch Jobs</h2>
        <p className="text-[12px] text-zinc-500 mt-0.5">Only your own batches are shown.</p>
        {batchJobs && batchJobs.length > 0 ? (
          <div className="mt-3 space-y-2">
            {batchJobs.slice(0, 10).map((job) => (
              <div key={job._id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <Link to={`/batch/${job._id}`} className="flex-1 min-w-0 transition-colors hover:bg-zinc-50 rounded-lg -m-3 p-3">
                  <p className="text-[13px] font-medium text-zinc-900">{job.name}</p>
                  <p className="text-[12px] text-zinc-500">
                    {job.processedRows}/{job.totalRows} processed · {job.failedRows} failed
                    {job.sourceTotalRows > job.totalRows && (
                      <> · Dataset: {job.sourceTotalRows} rows</>
                    )}
                  </p>
                </Link>
                <div className="flex items-center gap-2 ml-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    job.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                    job.status === "processing" ? "bg-primary/10 text-primary" :
                    job.status === "failed" ? "bg-rose-50 text-rose-700" :
                    "bg-zinc-100 text-zinc-600"
                  }`}>
                    {job.status}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirmDeleteId === job._id) {
                        void handleDeleteBatch(job._id as Id<"batchJobs">);
                      } else {
                        setConfirmDeleteId(job._id);
                        setTimeout(() => setConfirmDeleteId(null), 3000);
                      }
                    }}
                    disabled={deletingId === job._id || job.status === "processing"}
                    className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    title={confirmDeleteId === job._id ? "Click again to confirm" : "Delete batch"}
                  >
                    {deletingId === job._id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 py-6 text-center text-[13px] text-zinc-400">
            No batch jobs yet. Upload a dataset above to get started.
          </p>
        )}
      </div>
    </div>
  );
}
