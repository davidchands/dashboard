"use client";
import { useEffect, useState, useRef } from "react";

export default function ImportCard({ open, onClose, onImport }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Close on ESC (only when not typing)
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const typing =
        tag === "input" || tag === "textarea" || e.target?.isContentEditable;

      if (!typing && e.key === "Escape") {
        onClose();
      }
    };

    if (open) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [open, onClose]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setIsDragging(false);
      setIsProcessing(false);
      setError("");
    }
  }, [open]);

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const parseCSV = (text) => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length === 0) {
      throw new Error("CSV file is empty");
    }

    // Parse header row
    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .map((h) => h.replace(/^"|"$/g, "")); // Remove quotes

    // Required columns
    const requiredColumns = ["date", "product", "category", "units", "price"];
    const missingColumns = requiredColumns.filter(
      (col) => !headers.includes(col)
    );

    if (missingColumns.length > 0) {
      throw new Error(
        `Missing required columns: ${missingColumns.join(", ")}`
      );
    }

    // Get column indices
    const dateIdx = headers.indexOf("date");
    const productIdx = headers.indexOf("product");
    const categoryIdx = headers.indexOf("category");
    const unitsIdx = headers.indexOf("units");
    const priceIdx = headers.indexOf("price");

    // Parse data rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Simple CSV parsing (handles quoted values)
      const values = [];
      let current = "";
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim()); // Add last value

      // Extract values
      const date = values[dateIdx]?.replace(/^"|"$/g, "") || "";
      const product = values[productIdx]?.replace(/^"|"$/g, "") || "";
      const category = values[categoryIdx]?.replace(/^"|"$/g, "") || "";
      const units = values[unitsIdx]?.replace(/^"|"$/g, "") || "";
      const price = values[priceIdx]?.replace(/^"|"$/g, "") || "";

      // Validate row data
      if (!date || !product || !category || !units || !price) {
        continue; // Skip invalid rows
      }

      // Validate date format (DD-MM-YYYY)
      if (!/^\d{2}-\d{2}-\d{4}$/.test(date)) {
        throw new Error(
          `Invalid date format in row ${i + 1}. Expected DD-MM-YYYY, got: ${date}`
        );
      }

      // Validate numeric values
      const unitsNum = Number(units);
      const priceNum = Number(price);

      if (isNaN(unitsNum) || unitsNum <= 0) {
        throw new Error(
          `Invalid units value in row ${i + 1}: ${units}`
        );
      }

      if (isNaN(priceNum) || priceNum < 0) {
        throw new Error(
          `Invalid price value in row ${i + 1}: ${price}`
        );
      }

      rows.push({
        id: Date.now() + i, // Generate unique IDs
        date: date.trim(),
        product: product.trim(),
        category: category.trim(),
        units: unitsNum,
        price: priceNum,
      });
    }

    if (rows.length === 0) {
      throw new Error("No valid data rows found in CSV");
    }

    return rows;
  };

  const handleFile = async (file) => {
    // Validate file type
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const text = await file.text();
      const parsedData = parseCSV(text);

      // Replace all dashboard data with imported data
      onImport(parsedData);

      // Close modal after successful import
      setTimeout(() => {
        onClose();
        setIsProcessing(false);
      }, 500);
    } catch (err) {
      setError(err.message || "Failed to parse CSV file");
      setIsProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        // click outside closes
        if (e.target === e.currentTarget && !isProcessing) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Import CSV</h2>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="mt-5">
          {/* Drag and Drop Zone */}
          <div
            ref={dropZoneRef}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`
              relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors
              ${
                isDragging
                  ? "border-slate-400 bg-slate-50"
                  : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
              }
              ${isProcessing ? "cursor-not-allowed opacity-50" : ""}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={isProcessing}
              className="hidden"
            />

            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"></div>
                <p className="text-sm font-medium text-slate-700">
                  Processing CSV file...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <svg
                  className="h-12 w-12 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Drop your CSV file here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    or click to browse
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  Supported format: .csv
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          {/* CSV Format Info */}
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold text-slate-700">
              Required CSV columns:
            </p>
            <ul className="text-xs text-slate-600 space-y-1">
              <li>• <code className="bg-white px-1 rounded">date</code> (DD-MM-YYYY format)</li>
              <li>• <code className="bg-white px-1 rounded">product</code> (product name)</li>
              <li>• <code className="bg-white px-1 rounded">category</code> (category name)</li>
              <li>• <code className="bg-white px-1 rounded">units</code> (number)</li>
              <li>• <code className="bg-white px-1 rounded">price</code> (number)</li>
            </ul>
          </div>

          {/* Cancel Button */}
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel (esc)
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Press <b>esc</b> to close.
        </p>
      </div>
    </div>
  );
}
