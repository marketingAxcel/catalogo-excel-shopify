import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

type Item = {
  sku: string;
  inventario: number;
  precioCatalogoSinIva: number;
  precioCatalogoConIva: number;
  precio35: number;
  precio30: number;
  precio25: number;
  precio20: number;
  apps?: string;
  medida?: string;
};

type Group = {
  categoria: string;
  grabado: string;
  imagen: string;
  apps?: string;
  items: Item[];
};

const money = (n: any) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10 },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 10 },
  category: { fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginBottom: 12 },
  rowTop: { flexDirection: "row", gap: 12 },
  img: { width: 180, height: 180, objectFit: "contain" },
  grabado: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  apps: { fontSize: 9, color: "#444", marginTop: 6 },

  table: { marginTop: 8, borderWidth: 1, borderColor: "#eee" },
  trHead: { flexDirection: "row", backgroundColor: "#f5f5f5", borderBottomWidth: 1, borderBottomColor: "#eee" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee" },
  th: { padding: 6, fontWeight: 700 },
  td: { padding: 6 },

  cSku: { width: "20%" },
  cMedida: { width: "16%" },
  cInv: { width: "10%", textAlign: "right" },
  cPrecio: { width: "18%", textAlign: "right" },
  cPrecioIva: { width: "18%", textAlign: "right" },
  cP35: { width: "18%", textAlign: "right" },
});

export default function CatalogoPdf({ groups }: { groups: Group[] }) {
  const categories = Array.from(new Set(groups.map((g) => g.categoria)));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Catálogo llantas Paytton Tires</Text>

        {categories.map((cat) => {
          const list = groups.filter((g) => g.categoria === cat);
          if (!list.length) return null;

          return (
            <View key={cat}>
              <Text style={styles.category}>{cat}</Text>

              {list.map((g, idx) => (
                <View key={`${cat}-${g.grabado}-${idx}`} style={styles.card} wrap={false}>
                  <View style={styles.rowTop}>
                    {!!g.imagen && <Image src={g.imagen} style={styles.img} />}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.grabado}>{g.grabado}</Text>

                      <View style={styles.table}>
                        <View style={styles.trHead}>
                          <Text style={[styles.th, styles.cSku]}>SKU</Text>
                          <Text style={[styles.th, styles.cMedida]}>Medida</Text>
                          <Text style={[styles.th, styles.cInv]}>INV</Text>
                          <Text style={[styles.th, styles.cPrecio]}>Precio</Text>
                          <Text style={[styles.th, styles.cPrecioIva]}>Precio + IVA</Text>
                          <Text style={[styles.th, styles.cP35]}>35% Dcto</Text>
                        </View>

                        {(g.items || []).map((it, i) => (
                          <View key={`${it.sku}-${i}`} style={styles.tr}>
                            <Text style={[styles.td, styles.cSku]}>{it.sku}</Text>
                            <Text style={[styles.td, styles.cMedida]}>{it.medida || "-"}</Text>
                            <Text style={[styles.td, styles.cInv]}>{String(it.inventario ?? 0)}</Text>
                            <Text style={[styles.td, styles.cPrecio]}>{money(it.precioCatalogoSinIva)}</Text>
                            <Text style={[styles.td, styles.cPrecioIva]}>{money(it.precioCatalogoConIva)}</Text>
                            <Text style={[styles.td, styles.cP35]}>{money(it.precio35)}</Text>
                          </View>
                        ))}
                      </View>

                      {g.apps ? <Text style={styles.apps}>Aplicaciones: {g.apps}</Text> : null}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
