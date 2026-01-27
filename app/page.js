'use client'
import { useState } from "react";
import { useEffect } from "react";
import FormCard from "@/components/FormCard"
import ImportCard from "@/components/ImportCard"
import Image from "next/image";

const salesData = [
  { id: 1, date: '12-01-2026', product: "Printer", category: "Electronics", units: 3, price: 200 },
  { id: 2, date: '13-01-2026', product: "Pen Pack", category: "Stationery", units: 50, price: 1 },
  { id: 3, date: '15-01-2026', product: "Notebook", category: "Stationery", units: 20, price: 3 },
  { id: 4, date: '17-01-2026', product: "Mouse", category: "Electronics", units: 8, price: 12 },
  { id: 5, date: '18-01-2026', product: "Chair", category: "Furniture", units: 2, price: 60 },
  { id: 6, date: '19-01-2026', product: "Desk", category: "Furniture", units: 1, price: 120 },
  { id: 7, date: '19-01-2026', product: "USB Cable", category: "Electronics", units: 15, price: 4 },
  { id: 8, date: '20-01-2026', product: "PS5 Game Pad", category: "Electronics", units: 10, price: 60},
  { id: 9, date: '22-01-2026', product: "White Board", category: "Stationery", units: 35, price: 40},
  { id: 10, date: '21-01-2026', product: "Office Desk", category: "Furniture", units: 3, price: 500},
];

function KpiCard({ title, value, helper }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      {helper && <p className="mt-1 text-sm text-slate-600">{helper}</p>}
    </div>
  );
}

function formatMoney(n) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function App() {
  const [rows, setRows] = useState(salesData);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sortByRevenue, setSortByRevenue] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [openImport, setOpenImport] = useState(false);

   // Press "A" to open form, "I" to open import (avoid when typing)
   useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const typing =
        tag === "input" || tag === "textarea" || e.target?.isContentEditable;

      if (!typing) {
        if (e.key.toLowerCase() === "a") {
          e.preventDefault();
          setOpenForm(true);
        } else if (e.key.toLowerCase() === "i") {
          e.preventDefault();
          setOpenImport(true);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleAddRow = (newRow) => {
    // Put newest at top
    setRows((prev) => [newRow, ...prev]);
  };

  const handleImportCSV = (importedData) => {
    // Replace all dashboard data with imported CSV data
    setRows(importedData);
  };

  // filter() — apply category + search filter
  const filtered = rows.filter((row) => {
    const matchesCategory = category === "All" ? true : row.category === category;
    const matchesSearch = row.product.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // map() — add revenue field
  const rowsWithRevenue = filtered.map((row) => ({
    ...row,
    revenue: row.units * row.price,
  }));

  // sort (optional)
  const finalRows = [...rowsWithRevenue].sort((a, b) => {
    if (!sortByRevenue) return a.id - b.id;
    return b.revenue - a.revenue;
  });

  // reduce() — KPI totals
  const totalUnits = finalRows.reduce((sum, row) => sum + row.units, 0);
  const totalRevenue = finalRows.reduce((sum, row) => sum + row.revenue, 0);

  // reduce() — revenue by category
  const revenueByCategory = finalRows.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + row.revenue;
    return acc;
  }, {});

  // pick best category
  const bestCategory =
    Object.entries(revenueByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col md:flex-row md:justify-between items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sales Dashboard</h1>
            <p className="text-slate-600">Mini internal tool (filter + search + KPIs).</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6">
            <button className="btn btn-info rounded-2xl" onClick={() => setOpenForm(true)}>
               + Add Product (A)
            </button>
            <button 
              className="btn btn-outline btn-accent font-semibold border border-gray-400 text-slate-800 rounded-2xl flex items-center gap-2" 
              onClick={() => setOpenImport(true)}
            >
              <Image src={'/import-arrow.svg'} width={30} height={20} alt="Import"/>
              Import CSV (I)
            </button>
          
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard title="Total Revenue" value={`$${formatMoney(totalRevenue)}`} />
          <KpiCard title="Total Units Sold" value={totalUnits.toLocaleString()} />
          <KpiCard title="Best Category" value={bestCategory} />
        </div>

        {/* Controls */}
        <div className="mt-6 grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-gray-400 text-sm"
            >
              <option value="All">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="Stationery">Stationery</option>
              <option value="Furniture">Furniture</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">Search product</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-gray-600 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setSortByRevenue((s) => !s)}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {sortByRevenue ? "Sorted by Revenue ✓" : "Sort by Revenue"}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Units</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {finalRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-gray-700">{row.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.product}</td>
                  <td className="px-4 py-3 text-slate-700">{row.category}</td>
                  <td className="px-4 py-3 text-slate-700">{row.units}</td>
                  <td className="px-4 py-3 text-slate-700">${formatMoney(row.price)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    ${formatMoney(row.revenue)}
                  </td>
                </tr>
              ))}

              {finalRows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-600" colSpan={6}>
                    No results. Try changing the category or search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

       {/* Modal form */}
        <FormCard
          open={openForm}
          onClose={() => setOpenForm(false)}
          onSubmit={handleAddRow}
        />

        {/* Import CSV Modal */}
        <ImportCard
          open={openImport}
          onClose={() => setOpenImport(false)}
          onImport={handleImportCSV}
        />
        {/* Revenue Breakdown */}
        <div className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Revenue by Category</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {Object.entries(revenueByCategory).map(([cat, rev]) => (
              <div key={cat} className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm text-slate-600">{cat}</p>
                <p className="text-xl font-bold text-slate-900">${formatMoney(rev)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}