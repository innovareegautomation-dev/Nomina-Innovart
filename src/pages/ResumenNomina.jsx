// src/pages/ResumenNomina.jsx
import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LS_CAPTURE_INFO = "payroll-captura-info";

export default function ResumenNomina() {
  const [infoCaptura, setInfoCaptura] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_CAPTURE_INFO);
      if (raw) {
        const parsed = JSON.parse(raw);
        setInfoCaptura(parsed);
      }
    } catch {
      setInfoCaptura(null);
    }
  }, []);

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

  const fechaLabel = (() => {
    try {
      return new Date(fecha).toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
        day: "2-digit",
      });
    } catch {
      return fecha;
    }
  })();

  const periodoLabel =
    periodo === "semanal"
      ? "Periodo semanal"
      : "Periodo quincenal";

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado del resumen */}
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Resultados de nómina</h2>
          <div className="text-sm text-gray-600">
            Última captura: <span className="font-semibold">{fechaLabel}</span>{" "}
            • <span className="font-mono">{pKey}</span> • {periodoLabel}
          </div>
        </div>

        {/* Botones de exportación (aún sin lógica, la añadimos en el siguiente paso) */}
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            Exportar a Excel
          </Button>
          <Button variant="outline" disabled>
            Exportar a PDF
          </Button>
        </div>
      </div>

      {/* Aquí luego mostraremos la tabla detallada por empleado / empresa */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-gray-700">
            En esta sección se mostrarán los resultados detallados de la nómina
            capturada: importes por trabajador, totales por empresa y totales
            generales.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Ya está leyendo la captura del periodo{" "}
            <span className="font-mono">{pKey}</span> desde{" "}
            <span className="font-mono">localStorage</span>. En el siguiente
            paso conectaremos estos datos con los cálculos para mostrar las
            tablas y habilitar la exportación a Excel y PDF.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
