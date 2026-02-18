"use client";

import { useEffect, useState } from "react";

type Contractor = {
  id: string;
  name: string;
  nip: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
};

const emptyForm = {
  name: "",
  nip: "",
  address: "",
  postalCode: "",
  city: "",
};

export default function ContractorsPage() {
  const [list, setList] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function load() {
    setLoading(true);
    fetch("/api/contractors")
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(c: Contractor) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      nip: c.nip,
      address: c.address ?? "",
      postalCode: c.postalCode ?? "",
      city: c.city ?? "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      nip: form.nip.trim().replace(/\s/g, ""),
      address: form.address.trim() || undefined,
      postalCode: form.postalCode.trim() || undefined,
      city: form.city.trim() || undefined,
    };
    if (editingId) {
      const res = await fetch(`/api/contractors/${editingId}`, {
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
      const res = await fetch("/api/contractors", {
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
    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Czy na pewno usunąć tego kontrahenta?")) return;
    await fetch(`/api/contractors/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Kontrahenci</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90"
        >
          Nowy kontrahent
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-medium">{editingId ? "Edycja kontrahenta" : "Nowy kontrahent"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-muted mb-1">Nazwa *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">NIP *</label>
              <input
                value={form.nip}
                onChange={(e) => setForm((p) => ({ ...p, nip: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-muted mb-1">Adres</label>
              <input
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Kod pocztowy</label>
              <input
                value={form.postalCode}
                onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Miasto</label>
              <input
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90">
              {editingId ? "Zapisz zmiany" : "Dodaj kontrahenta"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
              className="rounded-lg border border-border px-4 py-2 hover:border-accent"
            >
              Anuluj
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted">Ładowanie…</p>
      ) : list.length === 0 ? (
        <p className="text-muted">Brak kontrahentów. Dodaj pierwszego, aby szybko wybierać nabywcę na fakturze.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="p-3 text-left">Nazwa</th>
                <th className="p-3 text-left">NIP</th>
                <th className="p-3 text-left">Adres</th>
                <th className="p-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b border-border">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3">{c.nip}</td>
                  <td className="p-3 text-muted">
                    {[c.postalCode, c.city].filter(Boolean).join(" ") || c.address || "–"}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="text-accent hover:underline"
                    >
                      Edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="text-red-400 hover:underline"
                    >
                      Usuń
                    </button>
                    </div>
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
