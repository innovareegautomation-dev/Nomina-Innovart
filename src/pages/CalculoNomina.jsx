import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const LS_KEY_ACTIVE = "payroll-parametros-ACTIVO";
const LS_KEY_ACTIVE_TS = "payroll-parametros-ACTIVO-ts";

/* ================== Utilidades de fecha ================== */
function startOfFortnight(d){
  const dt = new Date(d);
  const y = dt.getFullYear(); const m = dt.getMonth(); const day = dt.getDate();
  return day <= 15 ? new Date(y, m, 1) : new Date(y, m, 16);
}
function endOfFortnight(d){
  const dt = new Date(d);
  const y = dt.getFullYear(); const m = dt.getMonth(); const day = dt.getDate();
  return day <= 15 ? new Date(y, m, 15) : new Date(y, m + 1, 0);
}
function daysInFortnight(d){
  const s = startOfFortnight(d), e = endOfFortnight(d);
  return Math.round((e - s) / 86400000) + 1; // 15 o 16
}
function weekNumber(d){
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
function periodKey(d){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const half = d.getDate() <= 15 ? "H1" : "H2";
  return `${y}-${m}-${half}`;
}
const currency = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 })
    .format(Number.isFinite(n) ? n : 0);

/* ================== Helpers para bonos ================== */
const isProd  = (b) => (b.nombre || "").toLowerCase().includes("productiv");
const isAsist = (b) => (b.nombre || "").toLowerCase().includes("asist");
const isLimp  = (b) => (b.nombre || "").toLowerCase().includes("limp");

/* ================== Componente principal ================== */
export default function CalculoNomina(){
  const [fecha, setFecha] = useState(new Date());
  const [meta, setMeta] = useState(false);           // activa productividad (solo Innovart)
  const [activa, setActiva] = useState([]);          // versión ACTIVA de Parámetros
  const [activaTS, setActivaTS] = useState(null);    // sello de tiempo
  const [registros, setRegistros] = useState({});    // capturas por empleado (histórico)

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

  // Cargar/guardar capturas por periodo (no toca los parámetros ACTIVO)
  const pKey = periodKey(fecha);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`payroll-calculo-${pKey}`);
      setRegistros(raw ? JSON.parse(raw) : {});
    } catch { setRegistros({}); }
  }, [pKey]);
  useEffect(() => {
    localStorage.setItem(`payroll-calculo-${pKey}`, JSON.stringify(registros));
  }, [pKey, registros]);

  const diasQ = daysInFortnight(fecha);
  const esPrimeraQ = fecha.getDate() <= 15;
  const semana = weekNumber(fecha);

  // Agrupar empleados por empresa (Innovart / EG)
  const grupos = useMemo(() => {
    const out = {};
    for (const e of activa) (out[e.empresa] ||= []).push(e);
    return out;
  }, [activa]);

  const setReg = (empId, patch) =>
    setRegistros(prev => ({ ...prev, [empId]: { ...(prev[empId] || {}), ...patch } }));

  function bonosPorTipo(emp){
    const prod  = (emp.bonos || []).filter(b => b.tipo==="percepcion" && isProd(b)).reduce((a,b)=>a+(+b.monto||0),0);
    const asist = (emp.bonos || []).filter(b => b.tipo==="percepcion" && isAsist(b)).reduce((a,b)=>a+(+b.monto||0),0);
    const limp  = (emp.bonos || []).filter(b => b.tipo==="percepcion" && isLimp(b)).reduce((a,b)=>a+(+b.monto||0),0);
    const descFijos = (emp.bonos || []).filter(b => b.tipo==="descuento").reduce((a,b)=>a+(+b.monto||0),0);
    return { prod, asist, limp, descFijos };
  }

  // Cálculo por empleado
  function calcEmpleado(emp){
    const r = registros[emp.id] || {};
    const faltas       = Number(r.faltas || 0);
    const retardos     = Number(r.retardos || 0);
    const horas        = Math.max(0, Math.floor(Number(r.horasExtras || 0))); // solo horas completas
    const incentivos   = Number(r.otrosIncentivos || 0);
    const otrosDesc    = Number(r.otrosDescuentos || 0);
    const limpiezaOK   = Boolean(r.limpiezaOK || false); // toggle individual (solo Blanca)

    const { prod, asist, limp, descFijos } = bonosPorTipo(emp);

    const sueldoDiario = (Number(emp.sueldoMensual) || 0) / 30;
    const sueldoBase   = sueldoDiario * diasQ;

    // FALTAS: 1–3 = 0; >=4 = 1 día (tope 1 día)
    const descFaltas   = (faltas >= 4) ? sueldoDiario * 1 : 0;

    // RETARDOS: 1 día cada 4
    const descRetardos = sueldoDiario * Math.floor(retardos / 4);

    // HORAS EXTRA
    const pagoHoras    = (sueldoDiario / 8) * horas;

    // PRODUCTIVIDAD: Meta y solo Innovart
    const productividadOK = meta && emp.empresa === "Innovart Metal Design";
    const prodAplicado = productividadOK ? prod : 0;

    // ASISTENCIA: si no hay faltas y no se acumula un día por retardos
    const asistenciaOK = (faltas === 0) && (retardos < 4);
    const asistAplicado = asistenciaOK ? asist : 0;

    // LIMPIEZA: solo Blanca; toggle individual
    const esBlanca = (emp.nombre || "").toLowerCase().includes("blanca");
    const limpAplicado = (esBlanca && limpiezaOK) ? limp : 0;

    const bonosAplicables = prodAplicado + asistAplicado + limpAplicado;

    const bruto = sueldoBase
      - descFaltas
      - descRetardos
      + pagoHoras
      + bonosAplicables
      + incentivos
      - otrosDesc
      - descFijos;

    const vales = esPrimeraQ ? (Number(emp.limiteVales) || 0) : 0;
    const interna = bruto - vales;

    return {
      sueldoBase, pagoHoras, vales, interna,
      prodAplicado, asistAplicado, limpAplicado,
      descFaltas, descRetardos, descFijos,
      otrosDesc, incentivos
    };
  }

  function TotalesEmpresa(emps){
    return emps.reduce((acc, e)=>{
      const x = calcEmpleado(e);
      acc.base    += x.sueldoBase;
      acc.horas   += x.pagoHoras;
      acc.bonos   += (x.prodAplicado + x.asistAplicado + x.limpAplicado);
      acc.vales   += x.vales;
      acc.interna += x.interna;
      return acc;
    }, { base:0, horas:0, bonos:0, vales:0, interna:0 });
  }

  const empresas = Object.keys(grupos);

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Cálculo de Nómina</h1>
          <div className="text-sm text-gray-600">
            Parámetros ACTIVO: {activaTS ? new Date(activaTS).toLocaleString() : "sin actualizar"}.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={new Date(fecha.getTime()-fecha.getTimezoneOffset()*60000).toISOString().slice(0,10)}
            onChange={e => setFecha(new Date(e.target.value))}
          />
          <div className="text-sm text-gray-700">
            Semana #{semana} • Días quincena: {diasQ} • {esPrimeraQ ? "1ª quincena (aplica vales)" : "2ª quincena"}
          </div>
        </div>
      </div>

      {/* Meta cumplida */}
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={meta} onChange={e => setMeta(e.target.checked)} />
          Meta cumplida <span className="text-gray-500">(activa productividad solo Innovart)</span>
        </label>
      </div>

      {/* Por empresa */}
      {empresas.map((empresa) => {
        const emps = grupos[empresa] || [];
        const tot = TotalesEmpresa(emps);

        return (
          <Card key={empresa} className="shadow-sm">
            <CardContent className="p-4">
              <h2 className="text-xl font-bold mb-3">{empresa}</h2>

              {/* Encabezados de tabla claros (14 columnas para que todo quepa) */}
              <div className="grid grid-cols-14 gap-0 text-xs font-semibold border-b bg-gray-50">
                <div className="p-2 col-span-3">Trabajador / Puesto</div>
                <div className="p-2">Faltas</div>
                <div className="p-2">Retardos</div>
                <div className="p-2">Horas extra</div>
                <div className="p-2">Otros incentivos</div>
                <div className="p-2">Otros desc.</div>
                <div className="p-2">Limpieza</div>
                <div className="p-2">Sueldo base</div>
                <div className="p-2 col-span-2">Bonos (Prod/Asist/Limp)</div>
                <div className="p-2">Horas extra $</div>
                <div className="p-2">Vales</div>
                <div className="p-2 col-span-2">INTERNAL</div>
              </div>

              {emps.map((e) => {
                const r = registros[e.id] || {};
                const x = calcEmpleado(e);
                const { prod, asist, limp } = bonosPorTipo(e);
                const esBlanca = (e.nombre || "").toLowerCase().includes("blanca");

                return (
                  <div key={e.id} className="grid grid-cols-14 items-center border-b text-sm">
                    {/* Nombre / puesto */}
                    <div className="p-2 col-span-3">
                      <div className="font-medium leading-tight">{e.nombre}</div>
                      <div className="text-[11px] text-gray-500">{e.area}</div>
                    </div>

                    {/* Capturas con labels/placeholder */}
                    <div className="p-2">
                      <Input aria-label="Faltas" placeholder="0" type="number"
                        value={r.faltas || ""} onChange={ev => setReg(e.id, { faltas: parseInt(ev.target.value || "0") })}/>
                      <div className="text-[11px] text-gray-400 mt-1">1–3 sin castigo; 4+ = 1 día</div>
                    </div>
                    <div className="p-2">
                      <Input aria-label="Retardos" placeholder="0" type="number"
                        value={r.retardos || ""} onChange={ev => setReg(e.id, { retardos: parseInt(ev.target.value || "0") })}/>
                      <div className="text-[11px] text-gray-400 mt-1">1 día cada 4</div>
                    </div>
                    <div className="p-2">
                      <Input aria-label="Horas extra" placeholder="0" type="number"
                        value={r.horasExtras || ""} onChange={ev => setReg(e.id, { horasExtras: parseInt(ev.target.value || "0") })}/>
                      <div className="text-[11px] text-gray-400 mt-1">Solo horas completas</div>
                    </div>
                    <div className="p-2">
                      <Input aria-label="Otros incentivos" placeholder="0.00" type="number" step="0.01"
                        value={r.otrosIncentivos || ""} onChange={ev => setReg(e.id, { otrosIncentivos: parseFloat(ev.target.value || "0") })}/>
                    </div>
                    <div className="p-2">
                      <Input aria-label="Otros descuentos" placeholder="0.00" type="number" step="0.01"
                        value={r.otrosDescuentos || ""} onChange={ev => setReg(e.id, { otrosDescuentos: parseFloat(ev.target.value || "0") })}/>
                    </div>

                    {/* Limpieza (solo Blanca) */}
                    <div className="p-2">
                      {esBlanca ? (
                        <label className="inline-flex items-center gap-2 text-xs">
                          <input type="checkbox"
                            checked={Boolean(r.limpiezaOK || false)}
                            onChange={(ev)=> setReg(e.id, { limpiezaOK: ev.target.checked })}/>
                          Aplicar
                        </label>
                      ) : <span className="text-[11px] text-gray-400">—</span>}
                    </div>

                    {/* Cálculos */}
                    <div className="p-2">{currency(x.sueldoBase)}</div>

                    {/* Bonos con desglose claro */}
                    <div className="p-2 col-span-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={x.prodAplicado ? "default" : "secondary"}>Prod {currency(prod)}</Badge>
                        <Badge variant={x.asistAplicado ? "default" : "secondary"}>Asist {currency(asist)}</Badge>
                        <Badge variant={x.limpAplicado ? "default" : "secondary"}>Limp {currency(limp)}</Badge>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        Total bonos: <b>{currency(x.prodAplicado + x.asistAplicado + x.limpAplicado)}</b>
                      </div>
                    </div>

                    <div className="p-2">{currency(x.pagoHoras)}</div>
                    <div className="p-2">{currency(x.vales)}</div>
                    <div className="p-2 col-span-2 font-semibold">{currency(x.interna)}</div>
                  </div>
                );
              })}

              {/* Totales por empresa */}
              <div className="mt-3 grid grid-cols-5 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-gray-100">
                  <div className="text-[11px] text-gray-600">Total sueldos base</div>
                  <div className="text-lg font-bold">{currency(tot.base)}</div>
                </div>
                <div className="p-3 rounded-xl bg-gray-100">
                  <div className="text-[11px] text-gray-600">Total bonos</div>
                  <div className="text-lg font-bold">{currency(tot.bonos)}</div>
                </div>
                <div className="p-3 rounded-xl bg-gray-100">
                  <div className="text-[11px] text-gray-600">Pago horas extra</div>
                  <div className="text-lg font-bold">{currency(tot.horas)}</div>
                </div>
                <div className="p-3 rounded-xl bg-gray-100">
                  <div className="text-[11px] text-gray-600">Vales (quincena)</div>
                  <div className="text-lg font-bold">{currency(tot.vales)}</div>
                </div>
                <div className="p-3 rounded-xl bg-gray-100">
                  <div className="text-[11px] text-gray-600">INTERNAL (pagar)</div>
                  <div className="text-lg font-bold">{currency(tot.interna)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Resumen general (Innovart + EG) */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <h2 className="text-xl font-bold mb-2">Resumen General</h2>
          {(() => {
            const all = Object.keys(grupos).flatMap(k => grupos[k]);
            const t = all.reduce((acc, e) => {
              const x = calcEmpleado(e);
              acc.base    += x.sueldoBase;
              acc.bonos   += (x.prodAplicado + x.asistAplicado + x.limpAplicado);
              acc.horas   += x.pagoHoras;
              acc.vales   += x.vales;
              acc.interna += x.interna;
              return acc;
            }, { base:0, bonos:0, horas:0, vales:0, interna:0 });
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
                  <div className="text-[11px] text-gray-600">INTERNAL (pagar)</div>
                  <div className="text-lg font-bold">{currency(t.interna)}</div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
