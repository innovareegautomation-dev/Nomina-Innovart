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

/* Productividad fija por persona (Innovart) */
function prodAmountFixed(emp) {
  if (emp.empresa !== "Innovart Metal Design") return 0;
  const n = (emp.nombre || "").toLowerCase();
  if (n.includes("jorge abraham")) return 1800;
  if (n.includes("blanca estela")) return 250;
  if (n.includes("diego")) return 1100; // Diego Martín Rico Alvarado
  if (n.includes("fernando eduardo") || n.includes("moreno mondrag"))
    return 5018.8; // Luis Fernando Eduardo Moreno Mondragón
  return 0;
}

/* ================== Componente principal ================== */
export default function CalculoNomina() {
  const [fecha, setFecha] = useState(new Date());
  const [meta, setMeta] = useState(false); // activa productividad (solo Innovart)
  const [activa, setActiva] = useState([]); // versión ACTIVA (Parámetros)
  const [activaTS, setActivaTS] = useState(null);
  const [registros, setRegistros] = useState({}); // capturas por periodo

  // Cargar parámetros ACTIVO
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

  // Cargar/guardar capturas por periodo
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
  const esPrimeraQ = fecha.getDate() <= 15;
  const semana = weekNumber(fecha);

  // Agrupar por empresa
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
    const horas = Math.max(0, Math.floor(+r.horasExtras || 0)); // solo enteras
    const incentivos = +r.otrosIncentivos || 0;
    const otrosDesc = +r.otrosDescuentos || 0;
    const limpiezaOK = !!r.limpiezaOK;

    const { /* prod, */ asist, limp, descFijos } = bonosPorTipo(emp);

    // Sueldo diario y base por días de quincena
    const sueldoDiario = (+emp.sueldoMensual || 0) / 30;
    const sueldoBaseDias = sueldoDiario * diasQ;

    // Asistencia: 400 para todos en Innovart (si faltas=0 y retardos<4), se integra en L
    const asistenciaOK = faltas === 0 && retardos < 4;
    const asistBase = emp.empresa === "Innovart Metal Design" ? 400 : asist;
    const asistAplicado = asistenciaOK ? asistBase : 0;

    // L (sueldo quincenal) = base por días + asistencia aplicada
    const sueldoQuincenalL = sueldoBaseDias + asistAplicado;

    // Faltas: 1–3 sin penalización; 4+ = 1 día (tope 1 día)
    const descFaltas = faltas >= 4 ? sueldoDiario * 1 : 0;

    // Retardos: 1 día cada 4 (regla activa)
    const descRetardos = sueldoDiario * Math.floor(retardos / 4);

    // Horas extra (solo enteras)
    const pagoHoras = (sueldoDiario / 8) * horas;

    // Productividad: Meta y solo Innovart, monto FIJO por persona
    const prodFixed = prodAmountFixed(emp);
    const productividadOK = meta && emp.empresa === "Innovart Metal Design";
    const prodAplicado = productividadOK ? prodFixed : 0;

    // Limpieza: solo Blanca; toggle individual
    const esBlanca = (emp.nombre || "").toLowerCase().includes("blanca");
    const limpAplicado = esBlanca && limpiezaOK ? limp : 0;

    // Bonos aplicables (NO incluye asistencia porque va dentro de L)
    const bonosAplicables = prodAplicado + limpAplicado;

    // === Estilo Excel ===
    // Percepciones (U) = L - descFaltas - descRetardos + horas + productividad + limpieza + incentivos - otrosDesc - descFijos
    const percepciones =
      sueldoQuincenalL -
      descFaltas -
      descRetardos +
      pagoHoras +
      bonosAplicables +
      incentivos -
      otrosDesc -
      descFijos;

    // Fiscal (X): si no viene en parámetros, 0
    const sueldoFiscalBruto = Number(emp.sueldoFiscal || 0);

    // Vales: solo 1ª quincena
    const vales = esPrimeraQ ? (Number(emp.limiteVales) || 0) : 0;

    // INTERNA (Z) = U - X - Vales
    const interna = percepciones - sueldoFiscalBruto - vales;

    // NETO (AA) = Y + Z ; usamos Y = X si no se maneja distinto
    const neto = sueldoFiscalBruto + interna;

    return {
      sueldoBase: sueldoQuincenalL, // incluye asistencia si aplica
      pagoHoras,
      vales,
      interna,
      neto,
      prodAplicado,
      asistAplicado, // solo visual
      limpAplicado,
      descFaltas,
      descRetardos,
      descFijos,
      otrosDesc,
      incentivos,
      asistBase,
      prodFixed,
    };
  }

  const TotalesEmpresa = (emps) => {
    return emps.reduce(
      (acc, e) => {
        const x = calcEmpleado(e);
        acc.base += x.sueldoBase;
        acc.horas += x.pagoHoras;
        // Bonos = productividad + limpieza (NO asistencia; ya está en base)
        acc.bonos += x.prodAplicado + x.limpAplicado;
        acc.vales += x.vales;
        acc.interna += x.interna;
        acc.neto += x.neto;
        return acc;
      },
      { base: 0, horas: 0, bonos: 0, vales: 0, interna: 0, neto: 0 }
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
            {fecha.getDate() <= 15
              ? "1ª quincena (aplica vales)"
              : "2ª quincena"}
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
        </label>
        <span className="text-sm">
          Meta cumplida <span className="text-gray-500">(activa productividad solo Innovart)</span>
        </span>
      </div>

      {/* Por empresa */}
      {Object.entries(grupos).map(([empresa, emps]) => {
        const tot = TotalesEmpresa(emps);
        return (
          <Card key={empresa} className="shadow-sm">
            <CardContent className="p-4">
              <h2 className="text-xl font-bold mb-3">{empresa}</h2>

              {/* ======= Tabla (alineada, compacta y con primera columna sticky) ======= */}
              <div className="overflow-x-auto">
                <table className="table-fixed w-full text-sm border">
                  {/* Anchos fijos por columna */}
                  <colgroup>
                    <col style={{ width: "22rem" }} /> {/* Nombre */}
                    <col style={{ width: "12rem" }} /> {/* Área */}
                    <col style={{ width: "6rem" }} />  {/* Faltas */}
                    <col style={{ width: "6rem" }} />  {/* Retardos */}
                    <col style={{ width: "6.5rem" }} />{/* Horas extra */}
                    <col style={{ width: "7.5rem" }} />{/* Productividad */}
                    <col style={{ width: "7.5rem" }} />{/* Asistencia */}
                    <col style={{ width: "8rem" }} />  {/* Limpieza */}
                    <col style={{ width: "8rem" }} />  {/* Otros incentivos */}
                    <col style={{ width: "8rem" }} />  {/* Otros descuentos */}
                    <col style={{ width: "7rem" }} />  {/* Vales */}
                    <col style={{ width: "8rem" }} />  {/* Interna */}
                    <col style={{ width: "9rem" }} />  {/* Neto */}
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
                      <th>Interna</th>
                      <th>Sueldo neto quincenal</th>
                    </tr>
                  </thead>

                  <tbody className="[&>tr>td]:px-2.5 [&>tr>td]:py-2">
                    {emps.map((emp, idx) => {
                      const r = registros[emp.id] || {};
                      const x = calcEmpleado(emp);
                      const { /* asist, limp */ limp } = bonosPorTipo(emp);
                      const esBlanca = (emp.nombre || "")
                        .toLowerCase()
                        .includes("blanca");

                      const num = "text-right font-mono whitespace-nowrap";
                      const numTab = { fontVariantNumeric: "tabular-nums" };
                      const stickyBg = idx % 2 ? "bg-gray-50/60" : "bg-white";

                      // Mostrar en badges: productividad fija y asistencia base (400 en Innovart)
                      const prodMostrar = prodAmountFixed(emp);
                      const asistMostrar = x.asistBase;

                      return (
                        <tr
                          key={emp.id}
                          className="odd:bg-white even:bg-gray-50/60 border-b"
                        >
                          {/* Nombre (sticky) */}
                          <td className={`sticky left-0 z-10 ${stickyBg}`}>
                            <div className="font-medium leading-tight truncate">
                              {emp.nombre}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {currency(emp.sueldoMensual)} / mes
                            </div>
                          </td>

                          {/* Área */}
                          <td className="truncate">{emp.area}</td>

                          {/* Faltas */}
                          <td>
                            <Input
                              aria-label="Faltas"
                              type="number"
                              placeholder="0"
                              className="h-9 text-right"
                              value={r.faltas || ""}
                              onChange={(e) =>
                                setReg(emp.id, {
                                  faltas: parseInt(e.target.value || "0"),
                                })
                              }
                            />
                            <div className="text-[10px] text-gray-400">
                              1–3 ok; 4+ = 1 día
                            </div>
                          </td>

                          {/* Retardos */}
                          <td>
                            <Input
                              aria-label="Retardos"
                              type="number"
                              placeholder="0"
                              className="h-9 text-right"
                              value={r.retardos || ""}
                              onChange={(e) =>
                                setReg(emp.id, {
                                  retardos: parseInt(e.target.value || "0"),
                                })
                              }
                            />
                            <div className="text-[10px] text-gray-400">
                              1 día / 4
                            </div>
                          </td>

                          {/* Horas extra */}
                          <td>
                            <Input
                              aria-label="Horas extra"
                              type="number"
                              placeholder="0"
                              className="h-9 text-right"
                              value={r.horasExtras || ""}
                              onChange={(e) =>
                                setReg(emp.id, {
                                  horasExtras: parseInt(
                                    e.target.value || "0"
                                  ),
                                })
                              }
                            />
                            <div className="text-[10px] text-gray-400">
                              solo enteras
                            </div>
                          </td>

                          {/* Productividad (badge) */}
                          <td className={`${num}`} style={numTab}>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${
                                x.prodAplicado
                                  ? "bg-black text-white"
                                  : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {currency(prodMostrar)}
                            </span>
                          </td>

                          {/* Asistencia (badge) */}
                          <td className={`${num}`} style={numTab}>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${
                                x.asistAplicado
                                  ? "bg-black text-white"
                                  : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {currency(asistMostrar)}
                            </span>
                          </td>

                          {/* Limpieza (solo Blanca) */}
                          <td className="text-center">
                            {esBlanca ? (
                              <label className="inline-flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={!!r.limpiezaOK}
                                  onChange={(e) =>
                                    setReg(emp.id, {
                                      limpiezaOK: e.target.checked,
                                    })
                                  }
                                />
                                <span className="font-mono" style={numTab}>
                                  {currency(limp)}
                                </span>
                              </label>
                            ) : (
                              <span className="text-[11px] text-gray-400">
                                —
                              </span>
                            )}
                          </td>

                          {/* Otros incentivos */}
                          <td>
                            <Input
                              aria-label="Otros incentivos"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="h-9 text-right"
                              value={r.otrosIncentivos || ""}
                              onChange={(e) =>
                                setReg(emp.id, {
                                  otrosIncentivos: parseFloat(
                                    e.target.value || "0"
                                  ),
                                })
                              }
                            />
                          </td>

                          {/* Otros descuentos */}
                          <td>
                            <Input
                              aria-label="Otros descuentos"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="h-9 text-right"
                              value={r.otrosDescuentos || ""}
                              onChange={(e) =>
                                setReg(emp.id, {
                                  otrosDescuentos: parseFloat(
                                    e.target.value || "0"
                                  ),
                                })
                              }
                            />
                          </td>

                          {/* Vales */}
                          <td className={`${num}`} style={numTab}>
                            {currency(x.vales)}
                          </td>

                          {/* Interna */}
                          <td className={`${num} font-medium`} style={numTab}>
                            {currency(x.interna)}
                          </td>

                          {/* Neto */}
                          <td className={`${num} font-semibold`} style={numTab}>
                            {currency(x.neto)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Totales por empresa */}
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold">
                      <td className="px-2.5 py-2 sticky left-0 z-10 bg-gray-100">
                        Totales de {empresa}
                      </td>
                      <td className="px-2.5 py-2" colSpan={5}></td>
                      <td className="px-2.5 py-2" colSpan={2}>
                        Bonos:{" "}
                        <span
                          className="font-mono"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {currency(tot.bonos)}
                        </span>
                      </td>
                      <td className="px-2.5 py-2"></td>
                      <td className="px-2.5 py-2">
                        Vales:{" "}
                        <span
                          className="font-mono"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {currency(tot.vales)}
                        </span>
                      </td>
                      <td className="px-2.5 py-2">
                        Interna:{" "}
                        <span
                          className="font-mono"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {currency(tot.interna)}
                        </span>
                      </td>
                      <td className="px-2.5 py-2">
                        Neto:{" "}
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
          <h2 className="text-xl font-bold mb-2">Resumen General</h2>
          {(() => {
            const todos = Object.values(grupos).flat();
            const t = todos.reduce(
              (acc, emp) => {
                const x = calcEmpleado(emp);
                acc.base += x.sueldoBase;
                acc.horas += x.pagoHoras;
                // Bonos = productividad + limpieza (NO asistencia)
                acc.bonos += x.prodAplicado + x.limpAplicado;
                acc.vales += x.vales;
                acc.interna += x.interna;
                acc.neto += x.neto;
                return acc;
              },
              { base: 0, horas: 0, bonos: 0, vales: 0, interna: 0, neto: 0 }
            );
            return (
              <div className="grid grid-cols-5 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-white border">
                  <div className="text-[11px] text-gray-600">Sueldo base</div>
                  <div className="text-lg font-bold">{currency(t.base)}</div>
                </div>
                <div className="p-3 rounded-xl bg-white border">
                  <div className="text-[11px] text-gray-600">Bonos</div>
                  <div className="text-lg font-bold">{currency(t.bonos)}</div>
                </div>
                <div className="p-3 rounded-xl bg-white border">
                  <div className="text-[11px] text-gray-600">Horas extra</div>
                  <div className="text-lg font-bold">{currency(t.horas)}</div>
                </div>
                <div className="p-3 rounded-xl bg-white border">
                  <div className="text-[11px] text-gray-600">Vales</div>
                  <div className="text-lg font-bold">{currency(t.vales)}</div>
                </div>
                <div className="p-3 rounded-xl bg-white border">
                  <div className="text-[11px] text-gray-600">INTERNAL / Neto</div>
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
