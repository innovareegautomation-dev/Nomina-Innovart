
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";

// Datos semilla
const SEED = [
  { id: "inv-jorge", empresa: "Innovart Metal Design", nombre: "Jorge Abraham López Díaz", area: "Jefe de Planta", sueldoMensual: 13800, limiteVales: 1375.78, bonos: [ { id: "b-prod", nombre: "Productividad", monto: 1200, tipo: "percepcion" }, { id: "b-asist", nombre: "Asistencia", monto: 600, tipo: "percepcion" } ] },
  { id: "inv-blanca", empresa: "Innovart Metal Design", nombre: "Blanca Estela Gutiérrez Cerda", area: "Operador", sueldoMensual: 8364, limiteVales: 1375.78, bonos: [ { id: "b-prod", nombre: "Productividad", monto: 500, tipo: "percepcion" }, { id: "b-asist", nombre: "Asistencia", monto: 500, tipo: "percepcion" }, { id: "b-limp", nombre: "Limpieza y orden", monto: 200, tipo: "percepcion" } ] },
  { id: "inv-diego", empresa: "Innovart Metal Design", nombre: "Diego Martín Rico Alvarado", area: "Diseñador", sueldoMensual: 9000, limiteVales: 1375.78, bonos: [ { id: "b-prod", nombre: "Productividad", monto: 600, tipo: "percepcion" }, { id: "b-asist", nombre: "Asistencia", monto: 500, tipo: "percepcion" } ] },
  { id: "inv-rosario", empresa: "Innovart Metal Design", nombre: "María del Rosario Contreras García", area: "Intendencia", sueldoMensual: 8364, limiteVales: 1375.78, bonos: [ { id: "b-asist", nombre: "Asistencia", monto: 500, tipo: "percepcion" } ] },
  { id: "inv-luis", empresa: "Innovart Metal Design", nombre: "Luis Fernando Eduardo Moreno Mondragón", area: "Operaciones", sueldoMensual: 24000, limiteVales: 1375.78, bonos: [ { id: "b-prod", nombre: "Productividad", monto: 4500, tipo: "percepcion" }, { id: "b-asist", nombre: "Asistencia", monto: 518.8, tipo: "percepcion" } ] },
  { id: "inv-emilio", empresa: "Innovart Metal Design", nombre: "Emilio González Javier", area: "Dirección", sueldoMensual: 15600, limiteVales: 1375.78, bonos: [] },
  { id: "inv-isabel", empresa: "Innovart Metal Design", nombre: "Isabel Emilio Cortés", area: "Administración", sueldoMensual: 8500, limiteVales: 1375.78, bonos: [] },
  { id: "inv-joaquin", empresa: "Innovart Metal Design", nombre: "Joaquín Estrada Monjaraz", area: "Recursos Humanos", sueldoMensual: 10000, limiteVales: 1375.78, bonos: [] },
  { id: "inv-lupita", empresa: "Innovart Metal Design", nombre: "María Guadalupe Torres Nieto", area: "Aux. Administrativo", sueldoMensual: 8364, limiteVales: 1375.78, bonos: [ { id: "b-asist", nombre: "Asistencia", monto: 418, tipo: "percepcion" } ] },
  { id: "eg-juan", empresa: "EG Automation SA de CV", nombre: "Juan Manuel Sandoval Villalobos", area: "Integrador eléctrico", sueldoMensual: 8600, limiteVales: 0, bonos: [ { id: "b-prod", nombre: "Productividad", monto: 1040, tipo: "percepcion" }, { id: "b-asist", nombre: "Asistencia", monto: 500, tipo: "percepcion" } ] },
  { id: "eg-alfredo", empresa: "EG Automation SA de CV", nombre: "Alfredo Escobedo", area: "Asesor", sueldoMensual: 10000, limiteVales: 0, bonos: [] },
  { id: "eg-juanita", empresa: "EG Automation SA de CV", nombre: "JUANITA", area: "Limpieza", sueldoMensual: 1850, limiteVales: 0, bonos: [] },
];

const LS_KEY = "payroll-parametros-v1";
const LS_KEY_ACTIVE = "payroll-parametros-ACTIVO";
const LS_KEY_ACTIVE_TS = "payroll-parametros-ACTIVO-ts";

const currency = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);

function load(key){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

export default function ParametrosNominaTab(){
  const [data, setData] = useState([]);
  const [empresaTab, setEmpresaTab] = useState("todas");
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newEmp, setNewEmp] = useState({ empresa: "Innovart Metal Design", limiteVales: 1375.78 });
  const [lastSavedAt, setLastSavedAt] = useState(null);

  useEffect(()=>{
    const cached = load(LS_KEY);
    setData(cached ?? SEED);
    const ts = load(LS_KEY_ACTIVE_TS);
    setLastSavedAt(ts ?? null);
  }, []);

  useEffect(()=>{ if (data.length) save(LS_KEY, data); }, [data]);

  const filtered = useMemo(()=> data.filter(e=>{
    const byEmpresa = empresaTab === "todas" ? true : e.empresa === empresaTab;
    const byQ = q.trim().length ? (e.nombre.toLowerCase().includes(q.toLowerCase()) || e.area.toLowerCase().includes(q.toLowerCase())) : true;
    return byEmpresa && byQ;
  }), [data, empresaTab, q]);

  function updateEmployee(id, patch){ setData(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e)); }
  function removeEmployee(id){ setData(prev => prev.filter(e => e.id !== id)); }
  function addEmployee(){
    if (!newEmp.nombre || !newEmp.area || !newEmp.empresa) return alert("Completa empresa, nombre y área");
    const id = `${newEmp.empresa === "Innovart Metal Design" ? "inv" : "eg"}-${(Math.random().toString(36).slice(2,8))}`;
    const limite = typeof newEmp.limiteVales === "number" ? newEmp.limiteVales : (newEmp.empresa === "Innovart Metal Design" ? 1375.78 : 0);
    const emp = { id, empresa: newEmp.empresa, nombre: newEmp.nombre, area: newEmp.area, sueldoMensual: Number(newEmp.sueldoMensual)||0, limiteVales: limite, bonos: [] };
    setData(prev => [emp, ...prev]);
    setNewEmp({ empresa: "Innovart Metal Design", limiteVales: 1375.78 });
    setAddOpen(false);
  }

  function addBonus(empId, preset){
    setData(prev => prev.map(e => {
      if (e.id !== empId) return e;
      const b = { id: `b-${(Math.random().toString(36).slice(2,8))}`, nombre: (preset?.nombre || "Nuevo bono"), monto: (preset?.monto ?? 0), tipo: (preset?.tipo || "percepcion") };
      return { ...e, bonos: [...e.bonos, b] };
    }));
  }
  function updateBonus(empId, bonusId, patch){
    setData(prev => prev.map(e => e.id !== empId ? e : { ...e, bonos: e.bonos.map(b => b.id === bonusId ? { ...b, ...patch } : b) }));
  }
  function removeBonus(empId, bonusId){
    setData(prev => prev.map(e => e.id !== empId ? e : { ...e, bonos: e.bonos.filter(b => b.id !== bonusId) }));
  }

  function totalBonos(emp){
    const percep = emp.bonos.filter(b => b.tipo === "percepcion").reduce((a,b)=>a+(Number(b.monto)||0),0);
    const desc = emp.bonos.filter(b => b.tipo === "descuento").reduce((a,b)=>a+(Number(b.monto)||0),0);
    return { percep, desc, neto: percep - desc };
  }

  function exportJson(){
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `parametros_nomina_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
  }
  function importJson(){
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) throw new Error("El JSON debe ser un arreglo de empleados");
      const ok = parsed.every((e) => typeof e.id === "string" && typeof e.nombre === "string" && typeof e.sueldoMensual === "number");
      if (!ok) throw new Error("Formato de empleados inválido");
      setData(parsed);
      setImportOpen(false); setImportText("");
    } catch (e) { alert(e?.message || "No se pudo importar el JSON"); }
  }
  function resetToSeed(){ setData(SEED); }
  function guardarComoActivo(){
    save(LS_KEY_ACTIVE, data);
    const ts = new Date().toISOString();
    save(LS_KEY_ACTIVE_TS, ts);
    setLastSavedAt(ts);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Parámetros de Nómina</h1>
          <p className="text-sm text-muted-foreground">Administra sueldos, bonos (percepciones/ descuentos) y límites de vales. Todo es editable. Usa <b>Actualizar</b> para fijar la versión ACTIVA que usará el cálculo de nómina.</p>
          {lastSavedAt && (<div className="mt-2 text-xs text-muted-foreground">Última actualización activa: <span className="font-medium">{new Date(lastSavedAt).toLocaleString()}</span></div>)}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={guardarComoActivo} className="bg-emerald-600 hover:bg-emerald-700">Actualizar (guardar como ACTIVO)</Button>
          <Button variant="secondary" onClick={exportJson}>Exportar JSON</Button>
          <Button variant="secondary" onClick={()=>setImportOpen(true)}>Importar JSON</Button>
          <Button variant="outline" onClick={resetToSeed}>Restablecer</Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Empresa</Label>
              <select value={empresaTab} onChange={(e)=>setEmpresaTab(e.target.value)} className="w-64 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="todas">Todas</option>
                <option value="Innovart Metal Design">Innovart Metal Design</option>
                <option value="EG Automation SA de CV">EG Automation SA de CV</option>
              </select>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Label className="text-sm">Buscar</Label>
              <Input placeholder="Nombre o área" value={q} onChange={e=>setQ(e.target.value)} />
            </div>
            <Button onClick={()=>setAddOpen(true)}>Agregar trabajador</Button>
          </div>
          <Alert className="bg-muted/40">
            <AlertTitle>Regla de vales</AlertTitle>
            <AlertDescription>
              Innovart: límite por persona predeterminado en <b>{currency(1375.78)}</b>. EG: por defecto 0 (puedes modificar por empleado).
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-0 text-sm font-semibold border-b bg-muted/30">
            <div className="p-3 col-span-3">Trabajador</div>
            <div className="p-3 col-span-2">Área</div>
            <div className="p-3 col-span-2">Sueldo mensual</div>
            <div className="p-3 col-span-3">Bonos mensuales (percepciones / descuentos)</div>
            <div className="p-3 col-span-2">Límite vales</div>
          </div>
          {filtered.map((emp) => {
            const tb = totalBonos(emp);
            return (
              <div key={emp.id} className="grid grid-cols-12 items-start border-b hover:bg-muted/10">
                <div className="p-3 col-span-3">
                  <div className="font-medium leading-tight">{emp.nombre}</div>
                  <div className="text-xs text-muted-foreground">{emp.empresa}</div>
                  <Button variant="ghost" size="sm" className="mt-1 text-red-600" onClick={()=>removeEmployee(emp.id)}>Eliminar</Button>
                </div>
                <div className="p-3 col-span-2"><Input value={emp.area} onChange={(e)=>updateEmployee(emp.id, { area: e.target.value })} /></div>
                <div className="p-3 col-span-2">
                  <Input type="number" step="0.01" value={emp.sueldoMensual} onChange={(e)=>updateEmployee(emp.id, { sueldoMensual: parseFloat(e.target.value||"0") })} />
                  <div className="mt-1 text-xs text-muted-foreground">{currency(emp.sueldoMensual)}</div>
                </div>
                <div className="p-3 col-span-3">
                  <div className="space-y-2">
                    {emp.bonos.length === 0 && (<div className="text-xs text-muted-foreground">Sin bonos</div>)}
                    {emp.bonos.map((b) => (
                      <div key={b.id} className="flex items-center gap-2">
                        <select className="w-36 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs" value={b.tipo} onChange={(e)=>updateBonus(emp.id, b.id, { tipo: e.target.value })}>
                          <option value="percepcion">Percepción (+)</option>
                          <option value="descuento">Descuento (−)</option>
                        </select>
                        <Input className="flex-1" value={b.nombre} onChange={(e)=>updateBonus(emp.id, b.id, { nombre: e.target.value })} />
                        <Input type="number" step="0.01" className="w-36" value={b.monto} onChange={(e)=>updateBonus(emp.id, b.id, { monto: parseFloat(e.target.value||"0") })} />
                        <Button variant="ghost" size="icon" onClick={()=>removeBonus(emp.id, b.id)}>Quitar</Button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2 justify-between items-center">
                      <div className="text-xs space-x-2">
                        <Badge variant="secondary">Percepciones: {currency(tb.percep)}</Badge>
                        <Badge variant="secondary" className="ml-1">Descuentos: {currency(tb.desc)}</Badge>
                        <Badge>Bonos netos: {currency(tb.neto)}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={()=>addBonus(emp.id, { nombre: "Ajuste especial", monto: 0, tipo: "descuento" })}>Agregar descuento</Button>
                        <Button size="sm" onClick={()=>addBonus(emp.id)}>Agregar bono</Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3 col-span-2">
                  <Input type="number" step="0.01" value={emp.limiteVales} onChange={(e)=>updateEmployee(emp.id, { limiteVales: parseFloat(e.target.value||"0") })} />
                  <div className="mt-1 text-xs text-muted-foreground">{currency(emp.limiteVales)}</div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-4 grid md:grid-cols-3 gap-3 text-sm">
          <div className="p-3 rounded-xl bg-muted/40">
            <div className="text-xs text-muted-foreground">Registros en vista</div>
            <div className="text-xl font-bold">{filtered.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-muted/40">
            <div className="text-xs text-muted-foreground">Suma sueldos mensuales</div>
            <div className="text-xl font-bold">{currency(filtered.reduce((a,e)=>a+e.sueldoMensual,0))}</div>
          </div>
          <div className="p-3 rounded-xl bg-muted/40">
            <div className="text-xs text-muted-foreground">Suma neta de bonos</div>
            <div className="text-xl font-bold">{currency(filtered.reduce((a,e)=>{ const t = e.bonos.reduce((acc,b)=> acc + (b.tipo === "percepcion" ? (Number(b.monto)||0) : -(Number(b.monto)||0)), 0); return a + t; },0))}</div>
          </div>
        </CardContent>
      </Card>

      {/* Modales */}
      <Modal
        open={addOpen}
        onClose={()=>setAddOpen(false)}
        title="Nuevo trabajador"
        footer={<>
          <Button variant="secondary" onClick={()=>setAddOpen(false)}>Cancelar</Button>
          <Button onClick={addEmployee}>Agregar</Button>
        </>}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Empresa</Label>
            <select value={newEmp.empresa} onChange={(e)=>setNewEmp(p=>({ ...p, empresa: e.target.value, limiteVales: e.target.value === "Innovart Metal Design" ? 1375.78 : 0 }))} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm">
              <option value="Innovart Metal Design">Innovart Metal Design</option>
              <option value="EG Automation SA de CV">EG Automation SA de CV</option>
            </select>
          </div>
          <div>
            <Label>Área</Label>
            <Input value={newEmp.area || ""} onChange={e=>setNewEmp(p=>({ ...p, area: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Nombre</Label>
            <Input value={newEmp.nombre || ""} onChange={e=>setNewEmp(p=>({ ...p, nombre: e.target.value }))} />
          </div>
          <div>
            <Label>Sueldo mensual</Label>
            <Input type="number" step="0.01" value={newEmp.sueldoMensual || ""} onChange={e=>setNewEmp(p=>({ ...p, sueldoMensual: parseFloat(e.target.value||"0") }))} />
          </div>
          <div>
            <Label>Límite vales</Label>
            <Input type="number" step="0.01" value={newEmp.limiteVales || ""} onChange={e=>setNewEmp(p=>({ ...p, limiteVales: parseFloat(e.target.value||"0") }))} />
          </div>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={()=>setImportOpen(false)}
        title="Importar parámetros desde JSON"
        footer={<>
          <Button variant="secondary" onClick={()=>setImportOpen(false)}>Cancelar</Button>
          <Button onClick={importJson}>Importar</Button>
        </>}
      >
        <textarea value={importText} onChange={e=>setImportText(e.target.value)} className="w-full h-64 p-3 border rounded-md font-mono text-sm" placeholder="Pega aquí el JSON exportado"></textarea>
      </Modal>
    </div>
  );
}
