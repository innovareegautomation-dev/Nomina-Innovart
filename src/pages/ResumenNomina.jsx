// src/pages/ResumenNomina.jsx
import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LS_CAPTURE_INFO = "payroll-captura-info";
const LS_KEY_ACTIVE = "payroll-parametros-ACTIVO";
const LS_META_KEY = "payroll-meta-cumplida";

const currency = (n) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

export default function ResumenNomina() {
  const [infoCaptura, setInfoCaptura] = useState(null);
  const [empleados, setEmpleados] = useState([]);
  const [meta, setMeta] = useState(false);

  // Cargar info básica de captura
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_CAPTURE_INFO);
      if (raw) {
        const parsed = JSON.parse(raw);
        setInfoCaptura(parsed || null);
      } else {
        setInfoCaptura(null);
      }
    } catch {
      setInfoCaptura(null);
    }
  }, []);

  // Cargar parámetros activos (para al menos mostrar nombres, empresas, etc.)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_ACTIVE);
      const data = raw ? JSON.parse(raw) : null;
      setEmpleados(Array.isArray(data) ? data : []);
    } catch {
      setEmpleados([]);
    }
  }, []);

  // Cargar meta cumplida
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_META_KEY);
      setMeta(raw === "1");
    } catch {
      setMeta(false);
    }
  }, []);

  /* ========== Si NO hay captura, mensaje simple ========== */
  if (!infoCaptura) {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-2xl font-bold">Resultados de nómina</h2>
        <p className="text-sm text-gray-600">
          Aún no hay una captura registrada. Ve a la pestaña{" "}
          <span className="font-semibold">Cálculo</span> y usa el botón{" "}
          <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">
            Capturar
          </span>{" "}
          para guardar el periodo actual.
        </p>
      </div>
    );
  }

  const { fecha, periodo, pKey } = infoCaptura;
  const fechaObj = new Date(fecha);
  const fechaLabel = fechaObj.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const periodoTexto = periodo === "quincenal" ? "Periodo quincenal" : "Periodo semanal";

  /* ========== Exportar a Excel (CSV sencillo) ========== */
  const handleExportExcel = () => {
    try {
      const filas = [];

      filas.push(["Periodo", "Clave periodo", "Fecha", "Meta cumplida"]);
      filas.push([
        periodoTexto,
        pKey || "",
        fechaLabel,
        meta ? "Sí" : "No",
      ]);
      filas.push([]);
      filas.push(["Empresa", "Nombre", "Área / Puesto", "Sueldo mensual"]);

      empleados.forEach((e) => {
        filas.push([
          e.empresa || "",
          e.nombre || "",
          e.area || "",
          currency(+e.sueldoMensual || 0),
        ]);
      });

      const csvContent = filas
        .map((row) =>
          row
            .map((cell) =>
              typeof cell === "string" && cell.includes(",")
                ? `"${cell.replace(/"/g, '""')}"`
                : cell
            )
            .join(",")
        )
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nomina-${pKey || "periodo"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al exportar CSV:", err);
      alert("Ocurrió un error al exportar a Excel (CSV).");
    }
  };

  /* ========== Exportar a PDF (por ahora: imprimir) ========== */
  const handleExportPDF = () => {
    try {
      window.print();
    } catch (err) {
      console.error("Error al exportar PDF:", err);
      alert("Ocurrió un error al intentar exportar a PDF.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Resultados de nómina</h2>
          <div className="text-sm text-gray-600">
            Última captura:{" "}
            <span className="font-semibold">{fechaLabel}</span> •{" "}
            <span className="font-mono">{pKey}</span> • {periodoTexto}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleExportExcel}>Exportar a Excel</Button>
          <Button variant="secondary" onClick={handleExportPDF}>
            Exportar a PDF
          </Button>
        </div>
      </div>

      {/* Card con resumen muy simple */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-gray-700 mb-4">
            En esta sección se mostrarán los resultados detallados de la nómina
            capturada (importes por trabajador, totales por empresa y totales
            generales). Por ahora se muestran solo los datos básicos de la
            captura para validar que la lectura desde{" "}
            <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">
              localStorage
            </code>{" "}
            funciona correctamente.
          </p>

          <div className="space-y-2 text-sm">
            <div>
              <span className="font-semibold">Periodo:</span> {periodoTexto}
            </div>
            <div>
              <span className="font-semibold">Clave periodo:</span>{" "}
              <span className="font-mono">{pKey}</span>
            </div>
            <div>
              <span className="font-semibold">Fecha de captura:</span>{" "}
              {fechaLabel}
            </div>
            <div>
              <span className="font-semibold">Meta cumplida:</span>{" "}
              {meta ? "Sí" : "No"}
            </div>
            <div>
              <span className="font-semibold">Empleados en parámetros:</span>{" "}
              {empleados.length}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
