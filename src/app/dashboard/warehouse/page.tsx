"use client";

import { useEffect, useState } from "react";

type Product = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  priceNet: number;
  vatRate: number;
};

export default function WarehousePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    unit: "szt.",
    priceNet: "",
    vatRate: "23",
  });

  function load() {
    setLoading(true);
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm({ name: "", description: "", unit: "szt.", priceNet: "", vatRate: "23" });
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description ?? "",
      unit: p.unit,
      priceNet: String(p.priceNet),
      vatRate: String(p.vatRate),
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceNet = parseFloat(form.priceNet);
    const vatRate = parseFloat(form.vatRate);
    if (!form.name.trim() || isNaN(priceNet) || priceNet < 0) return;

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      unit: form.unit.trim() || "szt.",
      priceNet,
      vatRate: isNaN(vatRate) ? 23 : vatRate,
    };

    if (editingId) {
      const res = await fetch(`/api/products/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Błąd zapisu");
        return;
      }
    } else {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Błąd zapisu");
        return;
      }
    }
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Usunąć pozycję z magazynu?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Magazyn</h1>
      <p className="text-muted text-sm mb-6">
        Towary i usługi – możesz je wybierać przy wystawianiu faktury.
      </p>

      <button
        type="button"
        onClick={openAdd}
        className="rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90 mb-6"
      >
        Dodaj pozycję
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 mb-6 max-w-md">
          <h2 className="font-medium mb-4">{editingId ? "Edycja" : "Nowa pozycja"}</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-muted mb-1">Nazwa *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Opis</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-muted mb-1">Jednostka</label>
                <input
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="w-full rounded border border-border bg-bg px-3 py-2"
                  placeholder="szt."
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Cena netto *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.priceNet}
                  onChange={(e) => setForm((f) => ({ ...f, priceNet: e.target.value }))}
                  className="w-full rounded border border-border bg-bg px-3 py-2"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Stawka VAT (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.vatRate}
                onChange={(e) => setForm((f) => ({ ...f, vatRate: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90">
              {editingId ? "Zapisz" : "Dodaj"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-4 py-2 hover:border-accent"
            >
              Anuluj
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted">Ładowanie…</p>
      ) : products.length === 0 ? (
        <p className="text-muted">Brak pozycji w magazynie. Dodaj pierwszą.</p>
      ) : (
        <div className="table-wrap rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="p-3 text-left">Nazwa</th>
                <th className="p-3 text-left">Jednostka</th>
                <th className="p-3 text-right">Cena netto</th>
                <th className="p-3 text-right">VAT %</th>
                <th className="p-3 text-right">Brutto</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-border">
                  <td className="p-3">
                    <strong>{p.name}</strong>
                    {p.description && <span className="text-muted text-xs block">{p.description}</span>}
                  </td>
                  <td className="p-3">{p.unit}</td>
                  <td className="p-3 text-right">{p.priceNet.toFixed(2)}</td>
                  <td className="p-3 text-right">{p.vatRate}%</td>
                  <td className="p-3 text-right">
                    {(p.priceNet * (1 + p.vatRate / 100)).toFixed(2)} PLN
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="text-accent hover:underline mr-2"
                    >
                      Edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="text-red-400 hover:underline"
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
