// src/pages/CalculoNomina.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LS_KEY_ACTIVE = "payroll-parametros-ACTIVO";
const LS_KEY_ACTIVE_TS = "payroll-parametros-ACTIVO-ts";

/* ================== Utilidades de fecha ================== */
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
function weekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
function periodKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const half = d.getDate() <= 15 ? "H1" : "H2";
  return `${y}-${m}-${half}`;
}
const currency = (n) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

/* ================== Helpers para bonos ================== */
const isProd = (b) => (b.nombre || "").toLowerCase().includes("productiv");
const isAsist = (b) => (b.nombre || "").toLowerCase().includes("asist");
const isLimp = (b) => (b.nombre || "").toLowerCase().includes("limp");

/* Productividad FIJA por persona (solo Innovart) */
function prodAmountFixed(emp) {
  if (emp.empresa !== "Innovart Metal Design") return 0;
  const n = (emp.nombre || "").toLowerCase();
  if (n.includes("jorge abraham")) return 1800;
  if (n.includes("blanca estela")) return 250;
  if (n.includes("diego")) return 1100;
  if (n.includes("fernando eduardo") || n.includes("moreno mondrag"))
    return 5018.8;
  return 0;
}

/* Overrides puntuales de asistencia (si algún perfil no es $400) */
const ASISTENCIA_OVERRIDE = {
  // "gonzalo cornejo": 186.67,
};

/* SDI IMSS fijo por persona (solo informativo) */
const SDI_IMSS = {
  "jorge abraham": 292.54,
  "blanca estela": 292.54,
  "diego martín": 292.54,
  "maria del rosario": 292.54,
  "maría del rosario": 292.54,
  "luis fernando eduardo": 839.44,
  "emilio gonzález": 261.20,
  "isabel emilio": 261.20,
};

/* ================== Componente principal ================== */
export default function CalculoNomina() {
  const [fecha, setFecha] = useState(new Date());
  const [meta, setMeta] = useState(false);
  const [activa, setActiva] = useState([]);
  const [activaTS, setActivaTS] = useState(null);
  const [registros, setRegistros] = useState({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_ACTIVE);
      const data = raw ? JSON.parse(raw) : null;
      setActiva(Array.isArray(data) ? data : []);
      const ts = localStorage.getItem(LS_KEY_ACTIVE_TS);
      setActivaTS(ts && !Number.isNaN(Date.parse(ts)) ? ts : null);
    } catch {
      setActiva([]);
      setActivaTS(null);
    }
  }, []);

  const pKey = periodKey(fecha);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`payroll-calculo-${pKey}`);
      setRegistros(raw ? JSON.parse(raw) : {});
    } catch {
      setRegistros({});
    }
  }, [pKey]);
  useEffect(() => {
    localStorage.setItem(`payroll-calculo-${pKey}`, JSON.stringify(registros));
  }, [pKey, registros]);

  const diasQ = daysInFortnight(fecha);
  const semana = weekNumber(fecha);

  const grupos = useMemo(() => {
    const out = {};
    for (const e of activa) (out[e.empresa] ||= []).push(e);
    return out;
  }, [activa]);

  const setReg = (empId, patch) =>
    setRegistros((prev) => ({
      ...prev,
      [empId]: { ...(prev[empId] || {}), ...patch },
    }));

  const bonosPorTipo = (emp) => {
    const prod = (emp.bonos || [])
      .filter((b) => b.tipo === "percepcion" && isProd(b))
      .reduce((a, b) => a + (+b.monto || 0), 0);
    const asist = (emp.bonos || [])
      .filter((b) => b.tipo === "percepcion" && isAsist(b))
      .reduce((a, b) => a + (+b.monto || 0), 0);
    const limp = (emp.bonos || [])
      .filter((b) => b.tipo === "percepcion" && isLimp(b))
      .reduce((a, b) => a + (+b.monto || 0), 0);
    const descFijos = (emp.bonos || [])
      .filter((b) => b.tipo === "descuento")
      .reduce((a, b) => a + (+b.monto || 0), 0);
    return { prod, asist, limp, descFijos };
  };

  // Cálculo por empleado
  function calcEmpleado(emp) {
    const r = registros[emp.id] || {};
    const faltas = +r.faltas || 0;
    const retardos = +r.retardos || 0;
    const horas = Math.max(0, Math.floor(+r.horasExtras || 0));
    const incentivos = +r.otrosIncentivos || 0;
    const otrosDesc = +r.otrosDescuentos || 0;
    const limpiezaOK = !!r.limpiezaOK;
    const sueldoFiscalBruto = +r.sueldoFiscalBruto || 0; // W (editable)
    const dispersion = +r.dispersion || 0;               // X (editable)

    // 👇 FIX: sin comentario dentro de la destructuración
    const { prod: _prodIgnorado, asist, limp, descFijos } = bonosPorTipo(emp);

    const sueldoDiario = (+emp.sueldoMensual || 0) / 30;

    const nombreKey = (emp.nombre || "").toLowerCase();
    const asistenciaBase =
      emp.empresa === "Innovart Metal Design"
        ? (ASISTENCIA_OVERRIDE[nombreKey] ?? 400)
        : asist;
    const asistenciaOK = faltas === 0 && retardos < 4;
    const asistenciaAplicada = asistenciaOK ? asistenciaBase : 0;

    const sueldoQuincenal = sueldoDiario * diasQ + asistenciaAplicada;

    const descFaltas = faltas >= 4 ? sueldoDiario * 1 : 0;
    const descRetardos = sueldoDiario * Math.floor(retardos / 4);
    const pagoHoras = (sueldoDiario / 8) * horas;

    const prodFixed = prodAmountFixed(emp);
    const productividadOK = meta && emp.empresa === "Innovart Metal Design";
    const prodAplicado = productividadOK ? prodFixed : 0;

    const esBlanca = nombreKey.includes("blanca");
    const limpAplicado = esBlanca && limpiezaOK ? limp : 0;

    const sumaPercepciones =
      sueldoQuincenal +
      pagoHoras +
      limpAplicado +
      prodAplicado +
      incentivos -
      otrosDesc -
      descFijos;

    const interna = sumaPercepciones - sueldoFiscalBruto;
    const neto = dispersion + interna;

    const sdi =
      SDI_IMSS[Object.keys(SDI_IMSS).find((k) => nombreKey.includes(k)) || ""] || 0;

    return {
      sdi,
      sueldoDiario,
      sueldoQuincenal,
      pagoHoras,
      prodAplicado,
      asistenciaBase,
      asistenciaAplicada,
      limpAplicado,
      sumaPercepciones,
      interna,
      neto,
      vales: +emp.limiteVales || 0,
      descFaltas,
      descRetardos,
      descFijos,
      otrosDesc,
      incentivos,
      sueldoFiscalBruto,
      dispersion,
    };
  }

  const TotalesEmpresa = (emps) => {
    return emps.reduce(
      (acc, e) => {
        const x = calcEmpleado(e);
        acc.base += x.sueldoQuincenal;
        acc.horas += x.pagoHoras;
        acc.bonos += x.prodAplicado + x.limpAplicado;
        acc.percepciones += x.sumaPercepciones;
        acc.interna += x.interna;
        acc.neto += x.neto;
        return acc;
      },
      { base: 0, horas: 0, bonos: 0, percepciones: 0, interna: 0, neto: 0 }
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Cálculo de Nómina</h1>
          <div className="text-sm text-gray-600">
            Parámetros ACTIVO:{" "}
            {activaTS ? new Date(activaTS).toLocaleString() : "sin actualizar"}.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={new Date(
              fecha.getTime() - fecha.getTimezoneOffset() * 60000
            )
              .toISOString()
              .slice(0, 10)}
            onChange={(e) => setFecha(new Date(e.target.value))}
          />
          <div className="text-sm text-gray-700">
            Semana #{semana} • Días quincena: {diasQ} •{" "}
            {fecha.getDate() <= 15 ? "1ª quincena" : "2ª quincena"}
          </div>
        </div>
      </div>

      {/* Meta global */}
      <div className="flex items-center gap-2 mb-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={meta}
            onChange={(e) => setMeta(e.target.checked)}
          />
          Meta cumplida
          <span className="text-gray-500"> (activa productividad solo Innovart)</span>
        </label>
      </div>

      {/* Por empresa */}
      {Object.entries(grupos).map(([empresa, emps]) => {
        const tot = TotalesEmpresa(emps);
        return (
          <Card key={empresa} className="shadow-sm">
            <CardContent className="p-4">
              <h2 className="text-xl font-bold mb-3">{empresa}</h2>

              <div className="overflow-x-auto">
                <table className="table-fixed w-full text-sm border">
                  <colgroup>
                    <col style={{ width: "22rem" }} />
                    <col style={{ width: "12rem" }} />
                    <col style={{ width: "6rem" }} />
                    <col style={{ width: "6rem" }} />
                    <col style={{ width: "6.5rem" }} />
                    <col style={{ width: "7.5rem" }} />
                    <col style={{ width: "7.5rem" }} />
                    <col style={{ width: "8rem" }} />
                    <col style={{ width: "8rem" }} />
                    <col style={{ width: "8rem" }} />
                    <col style={{ width: "7rem" }} />
                    <col style={{ width: "8rem" }} />
                    <col style={{ width: "9rem" }} />
                    <col style={{ width: "8rem" }} />
                    <col style={{ width: "9rem" }} />
                    <col style={{ width: "10rem" }} />
                  </colgroup>

                  <thead className="bg-gray-50 text-xs uppercase">
                    <tr className="[&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:border-b">
                      <th className="sticky left-0 z-20 bg-gray-50">Nombre del empleado</th>
                      <th>Área</th>
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
                      <th>Sueldo fiscal bruto</th>
                      <th>Dispersión</th>
                      <th>INTERNAL</th>
                      <th>Sueldo neto quincenal</th>
                    </tr>
                  </thead>

                  <tbody className="[&>tr>td]:px-2.5 [&>tr>td]:py-2">
                    {emps.map((emp, idx) => {
                      const r = registros[emp.id] || {};
                      const x = calcEmpleado(emp);

                      // 👇 FIX: sin comentario dentro de la destructuración
                      const { limp } = bonosPorTipo(emp);

                      const esBlanca = (emp.nombre || "").toLowerCase().includes("blanca");

                      const num = "text-right font-mono whitespace-nowrap";
                      const numTab = { fontVariantNumeric: "tabular-nums" };
                      const stickyBg = idx % 2 ? "bg-gray-50/60" : "bg-white";

                      const prodMostrar = prodAmountFixed(emp);
                      const asistMostrar = x.asistenciaBase;

                      return (
                        <tr key={emp.id} className="odd:bg-white even:bg-gray-50/60 border-b">
                          <td className={`sticky left-0 z-10 ${stickyBg}`}>
                            <div className="font-medium leading-tight truncate">{emp.nombre}</div>
                            <div className="text-[11px] text-gray-500">{currency(emp.sueldoMensual)} / mes</div>
                          </td>

                          <td className="truncate">{emp.area}</td>

                          <td>
                            <Input
                              aria-label="Faltas"
                              type="number"
                              placeholder="0"
                              className="h-9 text-right"
                              value={r.faltas || ""}
                              onChange={(e) => setReg(emp.id, { faltas: parseInt(e.target.value || "0") })}
                            />
                            <div className="text-[10px] text-gray-400">1–3 ok; 4+ = 1 día</div>
                          </td>

                          <td>
                            <Input
                              aria-label="Retardos"
                              type="number"
                              placeholder="0"
                              className="h-9 text-right"
                              value={r.retardos || ""}
                              onChange={(e) => setReg(emp.id, { retardos: parseInt(e.target.value || "0") })}
                            />
                            <div className="text-[10px] text-gray-400">1 día / 4</div>
                          </td>

                          <td>
                            <Input
                              aria-label="Horas extra"
                              type="number"
                              placeholder="0"
                              className="h-9 text-right"
                              value={r.horasExtras || ""}
                              onChange={(e) => setReg(emp.id, { horasExtras: parseInt(e.target.value || "0") })}
                            />
                            <div className="text-[10px] text-gray-400">solo enteras</div>
                          </td>

                          <td className={`${num}`} style={numTab}>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${x.prodAplicado ? "bg-black text-white" : "bg-gray-200 text-gray-700"}`}>
                              {currency(prodMostrar)}
                            </span>
                          </td>

                          <td className={`${num}`} style={numTab}>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${x.asistenciaAplicada ? "bg-black text-white" : "bg-gray-200 text-gray-700"}`}>
                              {currency(asistMostrar)}
                            </span>
                          </td>

                          <td className="text-center">
                            {esBlanca ? (
                              <label className="inline-flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={!!r.limpiezaOK}
                                  onChange={(e) => setReg(emp.id, { limpiezaOK: e.target.checked })}
                                />
                                <span className="font-mono" style={numTab}>{currency(limp)}</span>
                              </label>
                            ) : (
                              <span className="text-[11px] text-gray-400">—</span>
                            )}
                          </td>

                          <td>
                            <Input
                              aria-label="Otros incentivos"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="h-9 text-right"
                              value={r.otrosIncentivos || ""}
                              onChange={(e) => setReg(emp.id, { otrosIncentivos: parseFloat(e.target.value || "0") })}
                            />
                          </td>

                          <td>
                            <Input
                              aria-label="Otros descuentos"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="h-9 text-right"
                              value={r.otrosDescuentos || ""}
                              onChange={(e) => setReg(emp.id, { otrosDescuentos: parseFloat(e.target.value || "0") })}
                            />
                          </td>

                          <td className={`${num}`} style={numTab}>
                            {currency(x.vales)}
                          </td>

                          <td className={`${num}`} style={numTab}>
                            {x.sdi ? currency(x.sdi) : "—"}
                          </td>

                          <td>
                            <Input
                              aria-label="Sueldo fiscal bruto"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="h-9 text-right"
                              value={r.sueldoFiscalBruto || ""}
                              onChange={(e) => setReg(emp.id, { sueldoFiscalBruto: parseFloat(e.target.value || "0") })}
                            />
                          </td>

                          <td>
                            <Input
                              aria-label="Dispersión"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="h-9 text-right"
                              value={r.dispersion || ""}
                              onChange={(e) => setReg(emp.id, { dispersion: parseFloat(e.target.value || "0") })}
                            />
                          </td>

                          <td className={`${num} font-medium`} style={numTab}>
                            {currency(x.interna)}
                          </td>

                          <td className={`${num} font-semibold`} style={numTab}>
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
                      <td className="px-2.5 py-2">
                        Hrs extra: <span className="font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>{currency(tot.horas)}</span>
                      </td>
                      <td className="px-2.5 py-2" colSpan={2}>
                        Bonos: <span className="font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>{currency(tot.bonos)}</span>
                      </td>
                      <td className="px-2.5 py-2" colSpan={3}></td>
                      <td className="px-2.5 py-2" colSpan={1}></td>
                      <td className="px-2.5 py-2" colSpan={1}></td>
                      <td className="px-2.5 py-2">
                        INTERNAL: <span className="font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>{currency(tot.interna)}</span>
                      </td>
                      <td className="px-2.5 py-2">
                        NETO: <span className="font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>{currency(tot.neto)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <h2 className="text-xl font-bold mb-2">Resumen General</h2>
          {(() => {
            const todos = Object.values(grupos).flat();
            const t = todos.reduce(
              (acc, emp) => {
                const x = calcEmpleado(emp);
                acc.base += x.sueldoQuincenal;
                acc.horas += x.pagoHoras;
                acc.bonos += x.prodAplicado + x.limpAplicado;
                acc.percepciones += x.sumaPercepciones;
                acc.interna += x.interna;
                acc.neto += x.neto;
                return acc;
              },
              { base: 0, horas: 0, bonos: 0, percepciones: 0, interna: 0, neto: 0 }
            );
            return (
              <div className="grid grid-cols-6 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-white border">
                  <div className="text-[11px] text-gray-600">Sueldo quincenal (L)</div>
                  <div className="text-lg font-bold">{currency(t.base)}</div>
                </div>
                <div className="p-3 rounded-xl bg-white border">
                  <div className="text-[11px] text-gray-600">Bonos (prod + limp)</div>
                  <div className="text-lg font-bold">{currency(t.bonos)}</div>
                </div>
                <div className="p-3 rounded-xl bg-white border">
                  <div className="text-[11px] text-gray-600">Horas extra</div>
                  <div className="text-lg font-bold">{currency(t.horas)}</div>
                </div>
                <div className="p-3 rounded-xl bg-white border">
                  <div className="text-[11px] text-gray-600">Percepciones (U)</div>
                  <div className="text-lg font-bold">{currency(t.percepciones)}</div>
                </div>
                <div className="p-3 rounded-xl bg-white border">
                  <div className="text-[11px] text-gray-600">INTERNAL (Y)</div>
                  <div className="text-lg font-bold">{currency(t.interna)}</div>
                </div>
                <div className="p-3 rounded-xl bg-white border">
                  <div className="text-[11px] text-gray-600">Sueldo neto quincenal</div>
                  <div className="text-lg font-bold">{currency(t.neto)}</div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
