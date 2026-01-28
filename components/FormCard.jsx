"use client";
import { useEffect, useState } from "react";

export default function FormCard({ open, onClose, onSubmit }) {
  // Controlled inputs
  const [product, setProduct] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [units, setUnits] = useState(1);
  const [price, setPrice] = useState("0");
  const [saleDate, setSaleDate] = useState(""); // "DD-MM-YYYY"


  // Close on ESC + open on "A" (only when not typing)
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const typing =
        tag === "input" || tag === "textarea" || e.target?.isContentEditable;

      if (!typing && e.key.toLowerCase() === "a") {
        // let page handle opening if you want; but if this component is mounted always:
        // do nothing here. (We'll open from page)
      }

      if (e.key === "Escape") onClose();
    };

    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Reset form whenever it opens (optional)
  useEffect(() => {
    if (open) {
      setProduct("");
      setCategory("Electronics");
      setUnits(1);
      setPrice("0");
      setSaleDate("");
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const cleanProduct = product.trim();
    if (!cleanProduct) return;

    if (!isValidDate(saleDate)) {
      alert("Please enter a valid date (DD-MM-YYYY)");
      return;
    }

    const cleanCategory = category.trim();
    if (!cleanCategory) return;

    const priceNum = Number(String(price).replace(",", "."));
    if (!Number.isFinite(priceNum) || priceNum < 0) return;

    // Create a new sale row object
    const newRow = {
      id: Date.now(),
      date: saleDate,
      product: cleanProduct,
      category: cleanCategory,
      units: Number(units),
      price: priceNum,
    };

    onSubmit(newRow); // send to dashboard
    onClose();        // close modal after submit
  };

  if (!open) return null;

  const formatDate = (value) => {
    // keep digits only
    const digits = value.replace(/\D/g, "").slice(0, 8); // max 8 digits
  
    // auto add dash after 2 digits
    if (digits.length <= 2) return digits;
    if (digits.length <=4) {
        return `${digits.slice(0, 2)}-${digits.slice(2)}`
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  };

  const isValidDate = (value) => {
    if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) return false;
  
    const [day, month, year] = value.split("-").map(Number);
  
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 2000 || year > 2100) return false;
  
    return true;
  };
  
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        // click outside closes
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Add Product</h2>

          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-slate-700 hover:bg-slate-100"
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-12">
          {/* Date */}
        <div className="md:col-span-6">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
                Date
            </label>
            <input
                value={saleDate}
                onChange={(e) => setSaleDate(formatDate(e.target.value))}
                placeholder="DD-MM-YYYY"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
            />
        </div>

          {/* Product */}
          <div className="md:col-span-12">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Product Name
            </label>
            <input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="e.g., Printer"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
            />
          </div>

          {/* Category */}
          <div className="md:col-span-6">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Category
            </label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Electronics"
              list="category-suggestions"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
            />
            <datalist id="category-suggestions">
              <option value="Electronics" />
              <option value="Stationery" />
              <option value="Furniture" />
            </datalist>
          </div>

          {/* Units */}
          <div className="md:col-span-3">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Units
            </label>
            <input
              type="number"
              min={1}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
            />
          </div>

          {/* Price */}
          <div className="md:col-span-3">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Price
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => {
                // allow digits, one dot, and optional comma (we normalize on submit)
                const next = e.target.value.replace(/[^\d.,]/g, "");
                setPrice(next);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
            />
            </div>

          {/* Buttons */}
          <div className="md:col-span-12 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel (esc)
            </button>

            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Save
            </button>
          </div>
        </form>

        <p className="mt-3 text-xs text-slate-500">
            Press <b>esc</b> to close.
        </p>
      </div>
    </div>
  );
};