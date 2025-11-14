// src/pages/ResumenNomina.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LS_KEY_ACTIVE = "payroll-parametros-ACTIVO";
const LS_META_KEY = "payroll-meta-cumplida";
const LS_CAPTURE_INFO = "payroll-captura-info";

function currency(n) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(+n) ? +n : 0);
}

const isProd = (b) => (b.nombre || "").toLowerCase().includes("productiv");
const isAsist = (b) => (b.nombre || "").toLowerCase().includes("asist");
const isLimp = (b) => (b.nombre || "").toLowerCase().includes("limp");

function startOfFortnight(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = dt.getMonth();
  const day = dt.getDate();
  return day <= 15 ? new Date(y, m, 1) : new Date(y, m, 16);
}
function endOfFortnight(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = dt.getMonth();
  const day = dt.getDate();
  return day <= 15 ? new Date(y, m, 15) : new Date(y, m + 1, 0);
}
function daysInFortnight(d) {
  const s = startOfFortnight(d);
  const e = endOfFortnight(d);
  return Math.round((e - s) / 86400000) + 1;
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ====================================================================== */

export default function ResumenNomina() {
  const [empleados, setEmpleados] = useState([]);
  const [registros, setRegistros] = useState({});
  const [meta, setMeta] = useState(false);
  const [captura, setCaptura] = useState(null);

  useEffect(() => {
    try {
      const rawEmp = localStorage.getItem(LS_KEY_ACTIVE);
      const lista = rawEmp ? JSON.parse(rawEmp) : [];
      setEmpleados(Array.isArray(lista) ? lista : []);

      const rawMeta = localStorage.getItem(LS_META_KEY);
      setMeta(rawMeta === "1");

      const rawCap = localStorage.getItem(LS_CAPTURE_INFO);
      const cap = rawCap ? JSON.parse(rawCap) : null;
      setCaptura(cap);

      if (cap && cap.pKey) {
        const rawRegs = localStorage.getItem(`payroll-calculo-${cap.pKey}`);
        setRegistros(rawRegs ? JSON.parse(rawRegs) : {});
      }
    } catch {
      setEmpleados([]);
      setRegistros({});
      setCaptura(null);
    }
  }, []);

  const fechaObj = captura?.fecha ? new Date(captura.fecha) : null;
  const periodoLabel =
    captura?.periodo === "semanal" ? "semanal" : "quincenal";

  const diasPeriodo = useMemo(() => {
    if (!fechaObj) return 15;
    return captura?.periodo === "quincenal"
      ? daysInFortnight(fechaObj)
      : 7;
  }, [captura, fechaObj]);

  const grupos = useMemo(() => {
    const out = {};
    for (const e of empleados) {
      const key = e.empresa || "Sin empresa";
      (out[key] ||= []).push(e);
    }
    return out;
  }, [empleados]);

  const bonosPorTipo = (emp) => {
    const bonos = Array.isArray(emp.bonos) ? emp.bonos : [];
    const prod = bonos
      .filter((b) => b.tipo === "percepcion" && isProd(b))
      .reduce((a, b) => a + (+b.monto || 0), 0);
    const asist = bonos
      .filter((b) => b.tipo === "percepcion" && isAsist(b))
      .reduce((a, b) => a + (+b.monto || 0), 0);
    const limp = bonos
      .filter((b) => b.tipo === "percepcion" && isLimp(b))
      .reduce((a, b) => a + (+b.monto || 0), 0);
    const descFijos = bonos
      .filter((b) => b.tipo === "descuento")
      .reduce((a, b) => a + (+b.monto || 0), 0);
    return { prod, asist, limp, descFijos };
  };

  function calcEmpleado(emp) {
    const r = registros[emp.id] || {};
    const faltas = +r.faltas || 0;
    const retardos = +r.retardos || 0;
    const horas = Math.max(0, Math.floor(+r.horasExtras || 0));
    const incentivos = +r.otrosIncentivos || 0;
    const otrosDesc = +r.otrosDescuentos || 0;
    const limpiezaOK = !!r.limpiezaOK;

    const { prod, asist, limp, descFijos } = bonosPorTipo(emp);

    const sueldoMensual = +emp.sueldoMensual || 0;
    const sueldoDiario = sueldoMensual / 30;

    const asistenciaBase = asist;
    const asistenciaOK = faltas === 0 && retardos < 4;
    const asistenciaAplicada = asistenciaOK ? asistenciaBase : 0;

    const sueldoBasePeriodo = sueldoDiario * diasPeriodo;
    const sueldoPeriodo = sueldoBasePeriodo + asistenciaAplicada;

    const pagoHoras = (sueldoDiario / 8) * horas;

    const prodBase = prod;
    const productividadOK = meta && emp.empresa === "Innovart Metal Design";
    const prodAplicado = productividadOK ? prodBase : 0;

    const limpAplicado = limpiezaOK ? limp : 0;

    const primaVacacional = +emp.primaVacacional || 0;
    const aguinaldo = +emp.aguinaldo || 0;

    const sumaPercepciones =
      sueldoPeriodo +
      pagoHoras +
      primaVacacional +
      aguinaldo +
      limpAplicado +
      prodAplicado +
      incentivos -
      otrosDesc -
      descFijos;

    const dispersion = +emp.dispersionBase || 0;
    const sueldoFiscalBruto =
      emp.sueldoFiscalBruto != null
        ? +emp.sueldoFiscalBruto || 0
        : dispersion;

    const interna = sumaPercepciones - sueldoFiscalBruto;
    const neto = dispersion + interna;

    const sdi = +emp.sdi || 0;
    const vales = +emp.limiteVales || 0;

    return {
      sueldoPeriodo,
      pagoHoras,
      prodAplicado,
      asistenciaAplicada,
      limpAplicado,
      sumaPercepciones,
      interna,
      neto,
      sdi,
      vales,
      incentivos,
      otrosDesc,
    };
  }

  const TotalesEmpresa = (emps) =>
    emps.reduce(
      (acc, e) => {
        const x = calcEmpleado(e);
        acc.base += x.sueldoPeriodo;
        acc.horas += x.pagoHoras;
        acc.bonos += x.prodAplicado + x.limpAplicado;
        acc.percepciones += x.sumaPercepciones;
        acc.interna += x.interna;
        acc.neto += x.neto;
        return acc;
      },
      { base: 0, horas: 0, bonos: 0, percepciones: 0, interna: 0, neto: 0 }
    );

  const handleExportCSV = () => {
    if (!captura) return;
    const rows = [];
    rows.push([
      "Empresa",
      "Empleado",
      "Área",
      "Sueldo mensual",
      "Sueldo periodo",
      "Horas extra",
      "Bono productividad",
      "Bono asistencia",
      "Bono limpieza",
      "Otros incentivos",
      "Otros descuentos",
      "Vales",
      "SDI",
      "Percepciones (U)",
      "INTERNAL (Y)",
      "Neto",
    ]);

    Object.entries(grupos).forEach(([empresa, emps]) => {
      emps.forEach((emp) => {
        const r = registros[emp.id] || {};
        const x = calcEmpleado(emp);
        rows.push([
          empresa,
          emp.nombre,
          emp.area || "",
          emp.sueldoMensual || 0,
          x.sueldoPeriodo,
          r.horasExtras || 0,
          x.prodAplicado,
          x.asistenciaAplicada,
          x.limpAplicado,
          x.incentivos,
          x.otrosDesc,
          x.vales,
          x.sdi,
          x.sumaPercepciones,
          x.interna,
          x.neto,
        ]);
      });
    });

    const csv = rows
      .map((row) =>
        row
          .map((value) =>
            `"${String(value ?? "")
              .replace(/"/g, '""')
              .replace(/\r?\n/g, " ")}"`
          )
          .join(",")
      )
      .join("\r\n");

    const filename = `nomina-${captura.pKey || "captura"}.csv`;
    downloadBlob(csv, filename, "text/csv;charset=utf-8;");
  };

  const handleExportPDF = () => {
    // El usuario puede elegir "Guardar como PDF" en el diálogo de impresión
    window.print();
  };

  if (!captura) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-2">Resultados de nómina</h2>
            <p className="text-sm text-gray-600">
              Aún no hay ninguna captura registrada. Ve a la pestaña{" "}
              <span className="font-semibold">Cálculo</span>, llena los datos
              y pulsa el botón <span className="font-semibold">“Capturar”</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Resultados de Nómina</h1>
          <p className="text-sm text-gray-600">
            Periodo {periodoLabel}
            {fechaObj && (
              <>
                {" "}
                • Fecha de captura:{" "}
                {fechaObj.toLocaleString()}
              </>
            )}
            {meta && <> • Meta cumplida (activa productividad)</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            Exportar a Excel (CSV)
          </Button>
          <Button onClick={handleExportPDF}>
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Por empresa */}
      {Object.entries(grupos).map(([empresa, emps]) => {
        const tot = TotalesEmpresa(emps);
        return (
          <Card key={empresa} className="shadow-sm">
            <CardContent className="p-4">
              <h2 className="text-xl font-bold mb-3">{empresa}</h2>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border">
                  <thead className="bg-gray-50 text-xs uppercase">
                    <tr className="[&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:border-b">
                      <th>Nombre del empleado</th>
                      <th>Sueldo periodo</th>
                      <th>Horas extra</th>
                      <th>Bono productividad</th>
                      <th>Bono asistencia</th>
                      <th>Bono limpieza</th>
                      <th>Percepciones (U)</th>
                      <th>INTERNAL (Y)</th>
                      <th>Neto</th>
                    </tr>
                  </thead>
                  <tbody className="[&>tr>td]:px-2.5 [&>tr>td]:py-2">
                    {emps.map((emp) => {
                      const x = calcEmpleado(emp);
                      const num = "text-right font-mono whitespace-nowrap";
                      const numTab = { fontVariantNumeric: "tabular-nums" };
                      return (
                        <tr
                          key={emp.id}
                          className="odd:bg-white even:bg-gray-50 border-b"
                        >
                          <td>
                            <div className="font-medium leading-tight">
                              {emp.nombre}
                            </div>
                            {emp.area && (
                              <div className="text-[11px] text-gray-500">
                                {emp.area}
                              </div>
                            )}
                          </td>
                          <td className={num} style={numTab}>
                            {currency(x.sueldoPeriodo)}
                          </td>
                          <td className={num} style={numTab}>
                            {currency(x.pagoHoras)}
                          </td>
                          <td className={num} style={numTab}>
                            {currency(x.prodAplicado)}
                          </td>
                          <td className={num} style={numTab}>
                            {currency(x.asistenciaAplicada)}
                          </td>
                          <td className={num} style={numTab}>
                            {currency(x.limpAplicado)}
                          </td>
                          <td className={num} style={numTab}>
                            {currency(x.sumaPercepciones)}
                          </td>
                          <td className={num} style={numTab}>
                            {currency(x.interna)}
                          </td>
                          <td className={num} style={numTab}>
                            {currency(x.neto)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold">
                      <td className="px-2.5 py-2">
                        Totales de {empresa}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {currency(tot.base)}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {currency(tot.horas)}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {currency(tot.bonos)}
                      </td>
                      <td className="px-2.5 py-2" colSpan={2}></td>
                      <td className="px-2.5 py-2 text-right font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {currency(tot.percepciones)}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {currency(tot.interna)}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {currency(tot.neto)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
