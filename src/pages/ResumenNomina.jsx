// src/pages/ResumenNomina.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LS_KEY_ACTIVE = "payroll-parametros-ACTIVO";
const LS_CAPTURE_INFO = "payroll-captura-info";
const LS_META_KEY = "payroll-meta-cumplida";

/* =============== Utilidades de fecha ================== */
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
  return Math.round((e - s) / 86400000) + 1; // 15 o 16
}

const currency = (n) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

/* =============== Helpers de bonos (igual que en Cálculo) =============== */
const isProd = (b) => (b.nombre || "").toLowerCase().includes("productiv");
const isAsist = (b) => (b.nombre || "").toLowerCase().includes("asist");
const isLimp = (b) => (b.nombre || "").toLowerCase().includes("limp");

function bonosPorTipo(emp) {
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
}

/* =============== Cálculo por empleado (función pura) =============== */
function calcEmpleado(emp, registros, diasPeriodo, meta) {
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
    faltas,
    retardos,
    horas,
    incentivos,
    otrosDesc,
    limpiezaOK,
    sdi,
    sueldoDiario,
    sueldoPeriodo,
    pagoHoras,
    prodAplicado,
    prodBase,
    asistenciaBase,
    asistenciaAplicada,
    limp,
    limpAplicado,
    sumaPercepciones,
    interna,
    neto,
    vales,
    descFijos,
  };
}

function totalesEmpresa(emps, registros, diasPeriodo, meta) {
  return emps.reduce(
    (acc, emp) => {
      const x = calcEmpleado(emp, registros, diasPeriodo, meta);
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
}

/* ========================================================
   Componente principal
   ======================================================== */
export default function ResumenNomina() {
  const [infoCaptura, setInfoCaptura] = useState(null);
  const [activa, setActiva] = useState([]);
  const [registros, setRegistros] = useState({});
  const [meta, setMeta] = useState(false);

  /* --- Cargar info de captura --- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_CAPTURE_INFO);
      if (raw) setInfoCaptura(JSON.parse(raw));
    } catch {
      setInfoCaptura(null);
    }
  }, []);

  /* --- Cargar estado de meta cumplida --- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_META_KEY);
      setMeta(raw === "1");
    } catch {
      setMeta(false);
    }
  }, []);

  /* --- Cargar parámetros activos --- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_ACTIVE);
      const data = raw ? JSON.parse(raw) : null;
      setActiva(Array.isArray(data) ? data : []);
    } catch {
      setActiva([]);
    }
  }, []);

  /* --- Cargar registros del periodo capturado --- */
  useEffect(() => {
    if (!infoCaptura || !infoCaptura.pKey) return;
    try {
      const raw = localStorage.getItem(`payroll-calculo-${infoCaptura.pKey}`);
      setRegistros(raw ? JSON.parse(raw) : {});
    } catch {
      setRegistros({});
    }
  }, [infoCaptura]);

  /* --- Si no hay captura, mensaje simple --- */
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
    day: "2-digit",
  });

  const diasPeriodo =
    periodo === "semanal" ? 7 : daysInFortnight(fechaObj);
  const periodoLabel =
    periodo === "semanal" ? "Periodo semanal" : "Periodo quincenal";
  const periodoTexto =
    periodo === "semanal" ? "semanal" : "quincenal";

  /* --- Agrupar empleados por empresa --- */
  const grupos = useMemo(() => {
    const out = {};
    for (const e of activa) {
      if (!out[e.empresa]) out[e.empresa] = [];
      out[e.empresa].push(e);
    }
    return out;
  }, [activa]);

  /* --- Totales generales --- */
  const totalesGenerales = useMemo(() => {
    const t = {
      base: 0,
      horas: 0,
      bonos: 0,
      percepciones: 0,
      interna: 0,
      neto: 0,
    };
    Object.values(grupos).forEach((emps) => {
      emps.forEach((emp) => {
        const x = calcEmpleado(emp, registros, diasPeriodo, meta);
        t.base += x.sueldoPeriodo;
        t.horas += x.pagoHoras;
        t.bonos += x.prodAplicado + x.limpAplicado;
        t.percepciones += x.sumaPercepciones;
        t.interna += x.interna;
        t.neto += x.neto;
      });
    });
    return t;
  }, [grupos, registros, diasPeriodo, meta]);

  /* ========= Exportar a Excel (CSV sencillo) ========= */
  const handleExportExcel = () => {
    const filas = [];

    filas.push([
      "Empresa",
      "Nombre",
      "Área / Puesto",
      "Sueldo mensual",
      "Periodo",
      "Clave periodo",
      "Fecha",
      "Faltas",
      "Retardos",
      "Horas extra",
      "Productividad aplicada",
      "Asistencia aplicada",
      "Limpieza aplicada",
      "Otros incentivos",
      "Otros descuentos",
      "Vales",
      "SDI",
      "Sueldo periodo (L)",
      "Percepciones (U)",
      "INTERNAL (Y)",
      "Sueldo neto",
    ]);

    Object.entries(grupos).forEach(([empresa, emps]) => {
      emps.forEach((emp) => {
        const x = calcEmpleado(emp, registros, diasPeriodo, meta);
        filas.push([
          empresa,
          emp.nombre,
          emp.area || "",
          emp.sueldoMensual || 0,
          periodo,
          pKey,
          fechaLabel,
          x.faltas,
          x.retardos,
          x.horas,
          x.prodAplicado,
          x.asistenciaAplicada,
          x.limpAplicado,
          x.incentivos,
          x.otrosDesc,
          x.vales,
          x.sdi,
          x.sueldoPeriodo,
          x.sumaPercepciones,
          x.interna,
          x.neto,
        ]);
      });

      const t = totalesEmpresa(emps, registros, diasPeriodo, meta);
      filas.push([
        `${empresa} (Totales)`,
        "",
        "",
        "",
        periodo,
        pKey,
        fechaLabel,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        t.base,
        t.percepciones,
        t.interna,
        t.neto,
      ]);
    });

    const csv = filas
      .map((row) =>
        row
          .map((v) => {
            const s = String(v ?? "");
            const escaped = s.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nomina-${pKey}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ========= Exportar a PDF ========= */
  const handleExportPDF = () => {
    window.print(); // luego podemos refinar estilos de impresión
  };

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Resultados de nómina</h2>
          <div className="text-sm text-gray-600">
            Última captura:{" "}
            <span className="font-semibold">{fechaLabel}</span> •{" "}
            <span className="font-mono">{pKey}</span> • {periodoLabel}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel}>
            Exportar a Excel
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            Exportar a PDF
          </Button>
        </div>
      </div>

      {/* Tablas por empresa */}
      {Object.entries(grupos).map(([empresa, emps]) => {
        const tot = totalesEmpresa(emps, registros, diasPeriodo, meta);
        const periodLabel = periodoTexto; // "semanal" | "quincenal"

        return (
          <Card key={empresa} className="shadow-sm">
            <CardContent className="p-4">
              <h3 className="text-xl font-bold mb-3">{empresa}</h3>
              <div className="overflow-x-auto">
                <table className="table-fixed w-full text-sm border">
                  <colgroup>
                    <col style={{ width: "22rem" }} />
                    <col style={{ width: "5rem" }} />
                    <col style={{ width: "6rem" }} />
                    <col style={{ width: "7rem" }} />
                    <col style={{ width: "7.5rem" }} />
                    <col style={{ width: "7.5rem" }} />
                    <col style={{ width: "7.5rem" }} />
                    <col style={{ width: "8rem" }} />
                    <col style={{ width: "8rem" }} />
                    <col style={{ width: "7rem" }} />
                    <col style={{ width: "8rem" }} />
                    <col style={{ width: "9rem" }} />
                    <col style={{ width: "9rem" }} />
                    <col style={{ width: "10rem" }} />
                  </colgroup>

                  <thead className="bg-gray-50 text-xs uppercase">
                    <tr className="[&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:border-b">
                      <th className="sticky left-0 z-20 bg-white">
                        Nombre del empleado
                      </th>
                      <th>Faltas</th>
                      <th>Retardos</th>
                      <th>Horas extra</th>
                      <th>Productividad</th>
                      <th>Asistencia</th>
                      <th>Limpieza</th>
                      <th>Otros incentivos</th>
                      <th>Otros descuentos</th>
                      <th>Vales</th>
                      <th>SDI (IMSS)</th>
                      <th>Percepciones (U)</th>
                      <th>INTERNAL (Y)</th>
                      <th>Sueldo neto {periodLabel}</th>
                    </tr>
                  </thead>

                  <tbody className="[&>tr>td]:px-2.5 [&>tr>td]:py-2">
                    {emps.map((emp) => {
                      const x = calcEmpleado(
                        emp,
                        registros,
                        diasPeriodo,
                        meta
                      );
                      const num =
                        "text-right font-mono whitespace-nowrap";
                      const numTab = {
                        fontVariantNumeric: "tabular-nums",
                      };

                      return (
                        <tr
                          key={emp.id}
                          className="odd:bg-white even:bg-gray-50 border-b"
                        >
                          <td className="sticky left-0 z-10 bg-white">
                            <div className="font-medium leading-tight truncate">
                              {emp.nombre}
                            </div>
                            {emp.area && (
                              <div className="text-[11px] text-gray-500">
                                {emp.area}
                              </div>
                            )}
                            <div className="text-[11px] text-gray-500">
                              {currency(emp.sueldoMensual)} / mes
                            </div>
                          </td>

                          <td className="text-center">{x.faltas}</td>
                          <td className="text-center">{x.retardos}</td>
                          <td className="text-center">{x.horas}</td>

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
                            {currency(x.incentivos)}
                          </td>
                          <td className={num} style={numTab}>
                            {currency(x.otrosDesc)}
                          </td>

                          <td className={num} style={numTab}>
                            {currency(x.vales)}
                          </td>
                          <td className={num} style={numTab}>
                            {x.sdi ? currency(x.sdi) : "—"}
                          </td>
                          <td className={num} style={numTab}>
                            {currency(x.sumaPercepciones)}
                          </td>
                          <td className={num} style={numTab}>
                            {currency(x.interna)}
                          </td>
                          <td
                            className={`${num} font-semibold`}
                            style={numTab}
                          >
                            {currency(x.neto)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr className="bg-gray-100 font-semibold">
                      <td className="px-2.5 py-2 sticky left-0 z-10 bg-gray-100">
                        Totales de {empresa}
                      </td>
                      <td className="px-2.5 py-2" colSpan={3}></td>
                      <td className="px-2.5 py-2" colSpan={3}>
                        Bonos:{" "}
                        <span
                          className="font-mono"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {currency(tot.bonos)}
                        </span>
                      </td>
                      <td className="px-2.5 py-2" colSpan={4}></td>
                      <td className="px-2.5 py-2">
                        Percepciones:{" "}
                        <span
                          className="font-mono"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {currency(tot.percepciones)}
                        </span>
                      </td>
                      <td className="px-2.5 py-2">
                        INTERNAL:{" "}
                        <span
                          className="font-mono"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {currency(tot.interna)}
                        </span>
                      </td>
                      <td className="px-2.5 py-2">
                        NETO:{" "}
                        <span
                          className="font-mono"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {currency(tot.neto)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Resumen general */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <h3 className="text-xl font-bold mb-2">Resumen General</h3>
          <div className="grid grid-cols-6 gap-3 text-sm">
            <div className="p-3 rounded-xl bg-white border">
              <div className="text-[11px] text-gray-600">
                Sueldo {periodoTexto} (L)
              </div>
              <div className="text-lg font-bold">
                {currency(totalesGenerales.base)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white border">
              <div className="text-[11px] text-gray-600">
                Bonos (prod + limp)
              </div>
              <div className="text-lg font-bold">
                {currency(totalesGenerales.bonos)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white border">
              <div className="text-[11px] text-gray-600">Horas extra</div>
              <div className="text-lg font-bold">
                {currency(totalesGenerales.horas)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white border">
              <div className="text-[11px] text-gray-600">
                Percepciones (U)
              </div>
              <div className="text-lg font-bold">
                {currency(totalesGenerales.percepciones)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white border">
              <div className="text-[11px] text-gray-600">INTERNAL (Y)</div>
              <div className="text-lg font-bold">
                {currency(totalesGenerales.interna)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white border">
              <div className="text-[11px] text-gray-600">
                Sueldo neto {periodoTexto}
              </div>
              <div className="text-lg font-bold">
                {currency(totalesGenerales.neto)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
