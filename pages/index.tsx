import { useEffect, useMemo, useState } from "react";

type Item = {
  sku: string;
  medida: string;
  precioIva: number;
  precioSin: number;
  apps?: string;
};

type Group = {
  categoria: string;
  grabado: string;
  imagen: string;
  items: Item[];
};

export default function Home() {
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(300);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/catalogo-json?limit=${limit}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Error consultando API");
      setGroups(Array.isArray(data.groups) ? data.groups : []);
    } catch (e: any) {
      setErr(e?.message || "Error");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return groups;

    return groups
      .map((g) => {
        const hayAppsGroup = (g.items?.some((it) => (it.apps || "").toLowerCase().includes(term)) ?? false);
        const headerHit =
          (g.categoria || "").toLowerCase().includes(term) ||
          (g.grabado || "").toLowerCase().includes(term) ||
          (hayAppsGroup && term.length >= 2);

        const items = (g.items || []).filter((it) => {
          const sku = (it.sku || "").toLowerCase();
          const medida = (it.medida || "").toLowerCase();
          const apps = (it.apps || "").toLowerCase();
          return sku.includes(term) || medida.includes(term) || apps.includes(term);
        });

        if (headerHit) return { ...g, items: g.items || [] };
        if (items.length) return { ...g, items };
        return null;
      })
      .filter(Boolean) as Group[];
  }, [groups, q]);

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 28 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800 }}>Catálogo Paytton</h1>
        <div style={{ opacity: 0.75, marginTop: 6, marginBottom: 16 }}>
          Datos desde Shopify (colecciones + variantes + metafields).
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por SKU, grabado, medida, categoría, aplicaciones..."
            style={{
              width: 420,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #333",
              outline: "none",
              background: "#0b0b0b",
              color: "#fff",
            }}
          />

          <input
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value || 0))}
            type="number"
            min={1}
            max={5000}
            style={{
              width: 120,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #333",
              outline: "none",
              background: "#0b0b0b",
              color: "#fff",
            }}
          />

          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #444",
              background: loading ? "#111" : "#141414",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>

          <div style={{ marginLeft: "auto", opacity: 0.8 }}>
            Mostrando: <b>{filtered.length}</b> grupos
          </div>
        </div>

        {err ? (
          <div
            style={{
              background: "#2a0000",
              border: "1px solid #5a0000",
              padding: 12,
              borderRadius: 10,
              marginBottom: 14,
              color: "#ffd7d7",
            }}
          >
            {err}
          </div>
        ) : null}

        <div style={{ border: "1px solid #333", borderRadius: 14, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 170px 260px 1fr",
              gap: 0,
              background: "#050505",
              borderBottom: "1px solid #333",
              padding: "12px 14px",
              fontWeight: 900,
              color: "#ffd400",
              letterSpacing: 0.3,
            }}
          >
            <div>CATEGORÍA</div>
            <div>IMAGEN</div>
            <div>GRABADO</div>
            <div>REFERENCIAS / MEDIDAS / APLICACIONES</div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 14, opacity: 0.75 }}>Sin resultados</div>
          ) : (
            filtered.map((g, gi) => (
              <div
                key={`${g.categoria}-${g.grabado}-${gi}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "220px 170px 260px 1fr",
                  gap: 0,
                  borderBottom: "1px solid #222",
                  background: gi % 2 === 0 ? "#070707" : "#050505",
                }}
              >
                <div style={{ padding: 14, borderRight: "1px solid #222", fontWeight: 800 }}>
                  {g.categoria}
                </div>

                <div style={{ padding: 14, borderRight: "1px solid #222" }}>
                  {g.imagen ? (
                    <img
                      src={g.imagen}
                      alt={g.grabado}
                      style={{
                        width: 120,
                        height: 120,
                        objectFit: "contain",
                        background: "#0a0a0a",
                        border: "1px solid #222",
                        borderRadius: 10,
                        padding: 8,
                      }}
                    />
                  ) : (
                    <div style={{ opacity: 0.6 }}>Sin imagen</div>
                  )}
                </div>

                <div style={{ padding: 14, borderRight: "1px solid #222", fontWeight: 900 }}>
                  {g.grabado}
                </div>

                <div style={{ padding: 14 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "#bbb", fontSize: 12 }}>
                        <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #222" }}>SKU</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #222" }}>MEDIDA</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #222" }}>PRECIO+IVA</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #222" }}>SIN IVA</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #222" }}>APLICACIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(g.items || []).map((it, i) => (
                        <tr key={`${it.sku}-${it.medida}-${i}`}>
                          <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", fontWeight: 900 }}>
                            {it.sku}
                          </td>
                          <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", fontWeight: 900 }}>
                            {it.medida}
                          </td>
                          <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>
                            {Number(it.precioIva || 0).toLocaleString("es-CO")}
                          </td>
                          <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>
                            {Number(it.precioSin || 0).toLocaleString("es-CO")}
                          </td>
                          <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", whiteSpace: "pre-wrap" }}>
                            {it.apps || ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
