import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const LS_KEY_ACTIVE = "payroll-parametros-ACTIVO";
const LS_KEY_ACTIVE_TS = "payroll-parametros-ACTIVO-ts";

/* ====== Utilidades de fecha ====== */
function startOfFortnight(d){ const dt=new Date(d); const y=dt.getFullYear(),m=dt.getMonth(),day=dt.getDate(); return day<=15?new Date(y,m,1):new Date(y,m,16); }
function endOfFortnight(d){ const dt=new Date(d); const y=dt.getFullYear(),m=dt.getMonth(),day=dt.getDate(); return day<=15?new Date(y,m,15):new Date(y,m+1,0); }
function daysInFortnight(d){ const s=startOfFortnight(d),e=endOfFortnight(d); return Math.round((e-s)/86400000)+1; }
function weekNumber(d){ const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const dayNum=date.getUTCDay()||7; date.setUTCDate(date.getUTCDate()+4-dayNum); const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1)); return Math.ceil((((date-yearStart)/86400000)+1)/7); }
function periodKey(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),half=d.getDate()<=15?"H1":"H2"; return `${y}-${m}-${half}`; }
const currency = (n) => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);

/* ====== Detectores de bonos por nombre ====== */
const isProd  = (b) => (b.nombre||"").toLowerCase().includes("productiv");
const isAsist = (b) => (b.nombre||"").toLowerCase().includes("asist");
const isLimp  = (b) => (b.nombre||"").toLowerCase().includes("limp");

/* ====== Página ====== */
export default function CalculoNomina(){
  const [fecha, setFecha] = useState(new Date());
  const [meta, setMeta] = useState(false); // activa productividad (solo Innovart)
  const [activa, setActiva] = useState([]); // versión ACTIVA (Parámetros)
  const [activaTS, setActivaTS] = useState(null);
  const [registros, setRegistros] = useState({}); // capturas por periodo

  // Cargar parámetros activos
  useEffect(()=>{ 
    try{
      const raw = localStorage.getItem(LS_KEY_ACTIVE);
      const data = raw?JSON.parse(raw):null;
      setActiva(Array.isArray(data)?data:[]);
      const ts = localStorage.getItem(LS_KEY_ACTIVE_TS);
      setActivaTS(ts && !Number.isNaN(Date.parse(ts)) ? ts : null);
    }catch{ setActiva([]); setActivaTS(null); }
  },[]);

  // Cargar/guardar capturas del periodo
  const pKey = periodKey(fecha);
  useEffect(()=>{ 
    try{ const raw = localStorage.getItem(`payroll-calculo-${pKey}`); setRegistros(raw?JSON.parse(raw):{}); }
    catch{ setRegistros({}); }
  },[pKey]);
  useEffect(()=>{ localStorage.setItem(`payroll-calculo-${pKey}`, JSON.stringify(registros)); },[pKey,registros]);

  const diasQ = daysInFortnight(fecha);
  const esPrimeraQ = fecha.getDate() <= 15;
  const semana = weekNumber(fecha);

  // Agrupar por empresa
  const grupos = useMemo(()=>{
    const out={}; for(const e of activa)(out[e.empresa]??=[]).push(e); return out;
  },[activa]);

  const setReg = (empId, patch) => setRegistros(prev=>({ ...prev, [empId]:{ ...(prev[empId]||{}), ...patch }}));

  const bonosPorTipo = (emp)=>{
    const prod=(emp.bonos||[]).filter(b=>b.tipo==="percepcion"&&isProd(b)).reduce((a,b)=>a+(+b.monto||0),0);
    const asist=(emp.bonos||[]).filter(b=>b.tipo==="percepcion"&&isAsist(b)).reduce((a,b)=>a+(+b.monto||0),0);
    const limp=(emp.bonos||[]).filter(b=>b.tipo==="percepcion"&&isLimp(b)).reduce((a,b)=>a+(+b.monto||0),0);
    const descFijos=(emp.bonos||[]).filter(b=>b.tipo==="descuento").reduce((a,b)=>a+(+b.monto||0),0);
    return { prod, asist, limp, descFijos };
  };

  // Cálculo por empleado
  function calcEmpleado(emp){
    const r = registros[emp.id] || {};
    const faltas = +r.faltas||0;
    const retardos = +r.retardos||0;
    const horas = Math.max(0, Math.floor(+r.horasExtras||0));
    const incentivos = +r.otrosIncentivos||0;
    const otrosDesc = +r.otrosDescuentos||0;
    const limpiezaOK = !!r.limpiezaOK;

    const { prod, asist, limp, descFijos } = bonosPorTipo(emp);
    const sueldoDiario = (+emp.sueldoMensual||0)/30;
    const sueldoBase = sueldoDiario * diasQ;

    const descFaltas = (faltas>=4) ? sueldoDiario*1 : 0;        // 1–3 sin penalización; 4+ = 1 día
    const descRetardos = sueldoDiario * Math.floor(retardos/4); // 1 día cada 4 retardos
    const pagoHoras = (sueldoDiario/8) * horas;

    const productividadOK = meta && emp.empresa === "Innovart Metal Design";
    const prodAplicado = productividadOK ? prod : 0;

    const asistenciaOK = (faltas===0) && (retardos<4);
    const asistAplicado = asistenciaOK ? asist : 0;

    const esBlanca = (emp.nombre||"").toLowerCase().includes("blanca");
    const limpAplicado = (esBlanca && limpiezaOK) ? limp : 0;

    const bonosAplicables = prodAplicado + asistAplicado + limpAplicado;

    const bruto = sueldoBase
      - descFaltas - descRetardos
      + pagoHoras + bonosAplicables + incentivos
      - otrosDesc - descFijos;

    const vales = esPrimeraQ ? (+emp.limiteVales||0) : 0;
    const interna = bruto - vales;

    // Neto quincenal mostrado a la derecha (igual a interna en esta versión)
    const neto = interna;

    return {
      sueldoBase, pagoHoras, vales, interna, neto,
      prodAplicado, asistAplicado, limpAplicado,
      descFaltas, descRetardos, descFijos, otrosDesc, incentivos
    };
  }

  const TotalesEmpresa = (emps)=>{
    return emps.reduce((acc,e)=>{
      const x = calcEmpleado(e);
      acc.base += x.sueldoBase;
      acc.horas += x.pagoHoras;
      acc.bonos += (x.prodAplicado+x.asistAplicado+x.limpAplicado);
      acc.vales += x.vales;
      acc.interna += x.interna;
      acc.neto += x.neto;
      return acc;
    },{base:0,horas:0,bonos:0,vales:0,interna:0,neto:0});
  };

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
            onChange={e=>setFecha(new Date(e.target.value))}
          />
          <div className="text-sm text-gray-700">
            Semana #{weekNumber(fecha)} • Días quincena: {daysInFortnight(fecha)} • {fecha.getDate()<=15?"1ª quincena (aplica vales)":"2ª quincena"}
          </div>
        </div>
      </div>

      {/* Meta global */}
      <div className="flex items-center gap-2 mb-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={meta} onChange={e=>setMeta(e.target.checked)}/>
          Meta cumplida <span className="text-gray-500">(activa productividad solo Innovart)</span>
        </label>
      </div>

      {/* Por empresa */}
      {Object.entries(grupos).map(([empresa, emps])=>{
        const tot = TotalesEmpresa(emps);
        return (
          <Card key={empresa} className="shadow-sm">
            <CardContent className="p-4">
              <h2 className="text-xl font-bold mb-3">{empresa}</h2>

              <div className="overflow-x-auto">
                <table className="min-w-[960px] w-full text-sm border">
                  <thead className="bg-gray-50 text-xs uppercase">
                    <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:border-b">
                      <th>Nombre del empleado</th>
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
                  <tbody>
                    {emps.map(emp=>{
                      const r = registros[emp.id]||{};
                      const x = calcEmpleado(emp);
                      const { prod, asist, limp } = bonosPorTipo(emp);
                      const esBlanca = (emp.nombre||"").toLowerCase().includes("blanca");

                      return (
                        <tr key={emp.id} className="odd:bg-white even:bg-gray-50/60 border-b">
                          <td className="px-3 py-2">
                            <div className="font-medium">{emp.nombre}</div>
                            <div className="text-[11px] text-gray-500">{currency(emp.sueldoMensual)} / mes</div>
                          </td>
                          <td className="px-3 py-2">{emp.area}</td>

                          {/* Entradas */}
                          <td className="px-3 py-2 w-24">
                            <Input aria-label="Faltas" type="number" placeholder="0" value={r.faltas||""}
                                   onChange={e=>setReg(emp.id,{faltas:parseInt(e.target.value||"0")})}/>
                            <div className="text-[10px] text-gray-400">1–3 sin penalización; 4+ = 1 día</div>
                          </td>
                          <td className="px-3 py-2 w-24">
                            <Input aria-label="Retardos" type="number" placeholder="0" value={r.retardos||""}
                                   onChange={e=>setReg(emp.id,{retardos:parseInt(e.target.value||"0")})}/>
                            <div className="text-[10px] text-gray-400">1 día / 4 retardos</div>
                          </td>
                          <td className="px-3 py-2 w-24">
                            <Input aria-label="Horas extra" type="number" placeholder="0" value={r.horasExtras||""}
                                   onChange={e=>setReg(emp.id,{horasExtras:parseInt(e.target.value||"0")})}/>
                            <div className="text-[10px] text-gray-400">Solo horas completas</div>
                          </td>

                          {/* Bonos */}
                          <td className="px-3 py-2">
                            <Badge variant={x.prodAplicado? "default":"secondary"}>{currency(prod)}</Badge>
                            <div className="text-[10px] text-gray-400 mt-1">Meta + Innovart</div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={x.asistAplicado? "default":"secondary"}>{currency(asist)}</Badge>
                            <div className="text-[10px] text-gray-400 mt-1">Sin faltas, &lt; 4 retardos</div>
                          </td>
                          <td className="px-3 py-2 w-28">
                            {esBlanca ? (
                              <label className="inline-flex items-center gap-2 text-xs">
                                <input type="checkbox" checked={!!r.limpiezaOK}
                                       onChange={e=>setReg(emp.id,{limpiezaOK:e.target.checked})}/>
                                {currency(limp)}
                              </label>
                            ) : <span className="text-[11px] text-gray-400">—</span>}
                          </td>

                          {/* Otros movimientos */}
                          <td className="px-3 py-2 w-28">
                            <Input aria-label="Otros incentivos" type="number" step="0.01" placeholder="0.00" value={r.otrosIncentivos||""}
                                   onChange={e=>setReg(emp.id,{otrosIncentivos:parseFloat(e.target.value||"0")})}/>
                          </td>
                          <td className="px-3 py-2 w-28">
                            <Input aria-label="Otros descuentos" type="number" step="0.01" placeholder="0.00" value={r.otrosDescuentos||""}
                                   onChange={e=>setReg(emp.id,{otrosDescuentos:parseFloat(e.target.value||"0")})}/>
                          </td>

                          {/* Resultados */}
                          <td className="px-3 py-2">{currency(x.vales)}</td>
                          <td className="px-3 py-2 font-medium">{currency(x.interna)}</td>
                          <td className="px-3 py-2 font-semibold">{currency(x.neto)}</td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Totales por empresa */}
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold">
                      <td className="px-3 py-2" colSpan={5}>Totales de {empresa}</td>
                      <td className="px-3 py-2" colSpan={2}>Bonos: {currency(tot.bonos)}</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2">Vales: {currency(tot.vales)}</td>
                      <td className="px-3 py-2">Interna: {currency(tot.interna)}</td>
                      <td className="px-3 py-2">Neto: {currency(tot.neto)}</td>
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
            const t = todos.reduce((acc, emp)=>{
              const x = calcEmpleado(emp);
              acc.base+=x.sueldoBase; acc.horas+=x.pagoHoras; acc.bonos+=(x.prodAplicado+x.asistAplicado+x.limpAplicado);
              acc.vales+=x.vales; acc.interna+=x.interna; acc.neto+=x.neto; return acc;
            },{base:0,horas:0,bonos:0,vales:0,interna:0,neto:0});
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
