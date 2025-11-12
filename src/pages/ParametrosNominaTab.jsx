// src/pages/ParametrosNominaTab.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const LS_KEY_ACTIVE = "payroll-parametros-ACTIVO";
const LS_KEY_ACTIVE_TS = "payroll-parametros-ACTIVO-ts";

/* ====== Helpers de bonos (mismo criterio que en Cálculo de Nómina) ====== */
const isProd = (b) => (b.nombre || "").toLowerCase().includes("productiv");
const isAsist = (b) => (b.nombre || "").toLowerCase().includes("asist");
const isLimp = (b) => (b.nombre || "").toLowerCase().includes("limp");

function currency(n) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(+n) ? +n : 0);
}

/** Normaliza un registro antiguo de parámetros a la nueva forma de fila editable */
function normalizarEmpleado(emp) {
  const bonos = Array.isArray(emp.bonos) ? emp.bonos : [];

  const suma = (pred) =>
    bonos.filter(pred).reduce((acc, b) => acc + (+b.monto || 0), 0);

  const bonoAsistencia = suma(isAsist);
  const bonoLimpieza = suma(isLimp);
  const bonoProductividad = suma(isProd);

  return {
    id: emp.id || crypto.randomUUID?.() || `emp-${Date.now()}-${Math.random()}`,
    empresa: emp.empresa || "",
    nombre: emp.nombre || "",
    area: emp.area || "",
    sueldoMensual: emp.sueldoMensual ?? "",
    fechaIngreso: emp.fechaIngreso || "",
    bonoAsistencia: bonoAsistencia || "", // Puntualidad y asistencia
    bonoLimpieza: bonoLimpieza || "",
    bonoProductividad: bonoProductividad || "",
    infonavitCredito: emp.infonavitCredito ?? "",
    altaIMSS: !!emp.altaIMSS,
    sdi: emp.sdi ?? "",
    limiteVales: emp.limiteVales ?? "",
    dispersion: emp.dispersionBase ?? "",
    primaVacacional: emp.primaVacacional ?? "",
    aguinaldo: emp.aguinaldo ?? "",
  };
}

/** Convierte la fila editable al formato que espera Cálculo de Nómina */
function filaAEmpleado(fila) {
  const bonos = [];

  // Solo agregamos bonos con monto > 0 para no llenar basura
  if (+fila.bonoAsistencia > 0) {
    bonos.push({
      id: "asistencia",
      tipo: "percepcion",
      nombre: "Puntualidad y asistencia",
      monto: +fila.bonoAsistencia,
    });
  }
  if (+fila.bonoLimpieza > 0) {
    bonos.push({
      id: "limpieza",
      tipo: "percepcion",
      nombre: "Bono de orden y limpieza",
      monto: +fila.bonoLimpieza,
    });
  }
  if (+fila.bonoProductividad > 0) {
    bonos.push({
      id: "productividad",
      tipo: "percepcion",
      nombre: "Bono de productividad",
      monto: +fila.bonoProductividad,
    });
  }

  return {
    id: fila.id,
    empresa: fila.empresa || "",
    nombre: fila.nombre || "",
    area: fila.area || "",
    sueldoMensual: +fila.sueldoMensual || 0,
    fechaIngreso: fila.fechaIngreso || "",
    limiteVales: +fila.limiteVales || 0,
    bonos,
    infonavitCredito: +fila.infonavitCredito || 0,
    altaIMSS: !!fila.altaIMSS,
    sdi: +fila.sdi || 0,
    dispersionBase: +fila.dispersion || 0,
    primaVacacional: +fila.primaVacacional || 0,
    aguinaldo: +fila.aguinaldo || 0,
  };
}

export default function ParametrosNominaTab() {
  const [filas, setFilas] = useState([]);
  const [ts, setTs] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Cargar parámetros existentes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_ACTIVE);
      const data = raw ? JSON.parse(raw) : null;
      const lista = Array.isArray(data) ? data : [];
      setFilas(lista.map(normalizarEmpleado));

      const tsRaw = localStorage.getItem(LS_KEY_ACTIVE_TS);
      setTs(tsRaw && !Number.isNaN(Date.parse(tsRaw)) ? tsRaw : null);
    } catch {
      setFilas([]);
      setTs(null);
    }
  }, []);

  const empresasDisponibles = useMemo(() => {
    const set = new Set();
    filas.forEach((f) => f.empresa && set.add(f.empresa));
    if (!set.size) {
      set.add("Innovart Metal Design");
    }
    return Array.from(set);
  }, [filas]);

  const handleChange = (id, field, value) => {
    setFilas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const handleToggleAltaIMSS = (id) => {
    setFilas((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, altaIMSS: !f.altaIMSS } : f
      )
    );
  };

  const agregarFila = () => {
    const nueva = {
      id: crypto.randomUUID?.() || `emp-${Date.now()}-${Math.random()}`,
      empresa: empresasDisponibles[0] || "Innovart Metal Design",
      nombre: "",
      area: "",
      sueldoMensual: "",
      fechaIngreso: "",
      bonoAsistencia: "",
      bonoLimpieza: "",
      bonoProductividad: "",
      infonavitCredito: "",
      altaIMSS: true,
      sdi: "",
      limiteVales: "",
      dispersion: "",
      primaVacacional: "",
      aguinaldo: "",
    };
    setFilas((prev) => [...prev, nueva]);
  };

  const eliminarFila = (id) => {
    if (!window.confirm("¿Eliminar este trabajador de los parámetros?")) return;
    setFilas((prev) => prev.filter((f) => f.id !== id));
  };

  const guardar = () => {
    setGuardando(true);
    try {
      const empleados = filas.map(filaAEmpleado);
      localStorage.setItem(LS_KEY_ACTIVE, JSON.stringify(empleados));
      const tsNow = new Date().toISOString();
      localStorage.setItem(LS_KEY_ACTIVE_TS, tsNow);
      setTs(tsNow);
      alert("Parámetros de nómina guardados correctamente.");
    } catch (e) {
      console.error(e);
      alert("Ocurrió un error al guardar los parámetros.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Parámetros de Nómina</h1>
          <p className="text-sm text-gray-600">
            Aquí defines los valores base por trabajador (bonos, SDI, vales, etc.).
            Estos datos son los que usará la pantalla de{" "}
            <span className="font-semibold">Cálculo de Nómina</span>.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Última actualización:{" "}
            {ts ? new Date(ts).toLocaleString() : "sin guardar aún"}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={agregarFila}>
            + Agregar trabajador
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar parámetros"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border">
              <colgroup>
                <col style={{ width: "8rem" }} />   {/* Empresa */}
                <col style={{ width: "14rem" }} />  {/* Nombre */}
                <col style={{ width: "12rem" }} />  {/* Departamento */}
                <col style={{ width: "8rem" }} />   {/* Sueldo mensual */}
                <col style={{ width: "8rem" }} />   {/* Fecha ingreso */}
                <col style={{ width: "7rem" }} />   {/* Bono asistencia */}
                <col style={{ width: "7rem" }} />   {/* Bono limpieza */}
                <col style={{ width: "7rem" }} />   {/* Bono productividad */}
                <col style={{ width: "7rem" }} />   {/* Infonavit */}
                <col style={{ width: "6rem" }} />   {/* Alta IMSS */}
                <col style={{ width: "7rem" }} />   {/* SDI IMSS */}
                <col style={{ width: "7rem" }} />   {/* Límite vales */}
                <col style={{ width: "7rem" }} />   {/* Dispersión base */}
                <col style={{ width: "7rem" }} />   {/* Prima vacacional */}
                <col style={{ width: "7rem" }} />   {/* Aguinaldo */}
                <col style={{ width: "5rem" }} />   {/* Acciones */}
              </colgroup>

              <thead className="bg-gray-100 border-b">
                <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:border-r">
                  <th>EMPRESA</th>
                  <th>NOMBRE DEL EMPLEADO</th>
                  <th>DEPARTAMENTO</th>
                  <th>SUELDO MENSUAL (30 días)</th>
                  <th>FECHA DE INGRESO</th>
                  <th>Bº PUNTUALIDAD Y ASISTENCIA</th>
                  <th>BONO DE ORDEN Y LIMPIEZA</th>
                  <th>BONO DE PRODUCTIVIDAD</th>
                  <th>INFONAVIT CRÉDITO</th>
                  <th>ALTA EN IMSS</th>
                  <th>SDI IMSS</th>
                  <th>LÍMITE VALES</th>
                  <th>DISPERSIÓN BASE</th>
                  <th>PRIMA VACACIONAL</th>
                  <th>AGUINALDO</th>
                  <th></th>
                </tr>
              </thead>

              <tbody className="[&>tr>td]:px-2 [&>tr>td]:py-1.5">
                {filas.map((fila, idx) => {
                  const bg = idx % 2 ? "bg-white" : "bg-gray-50/60";
                  return (
                    <tr key={fila.id} className={`${bg} border-b`}>
                      {/* Empresa */}
                      <td className="border-r">
                        <Input
                          value={fila.empresa}
                          onChange={(e) =>
                            handleChange(fila.id, "empresa", e.target.value)
                          }
                          className="h-8 text-xs"
                          placeholder="Empresa"
                        />
                      </td>

                      {/* Nombre */}
                      <td className="border-r">
                        <Input
                          value={fila.nombre}
                          onChange={(e) =>
                            handleChange(fila.id, "nombre", e.target.value)
                          }
                          className="h-8 text-xs"
                          placeholder="Nombre completo"
                        />
                      </td>

                      {/* Departamento / área */}
                      <td className="border-r">
                        <Input
                          value={fila.area}
                          onChange={(e) =>
                            handleChange(fila.id, "area", e.target.value)
                          }
                          className="h-8 text-xs"
                          placeholder="Área / Puesto"
                        />
                      </td>

                      {/* Sueldo mensual */}
                      <td className="border-r">
                        <Input
                          type="number"
                          className="h-8 text-right text-xs"
                          value={fila.sueldoMensual}
                          onChange={(e) =>
                            handleChange(fila.id, "sueldoMensual", e.target.value)
                          }
                          placeholder="0.00"
                        />
                        <div className="text-[10px] text-gray-500">
                          {fila.sueldoMensual ? currency(fila.sueldoMensual) : ""}
                        </div>
                      </td>

                      {/* Fecha ingreso */}
                      <td className="border-r">
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          value={fila.fechaIngreso || ""}
                          onChange={(e) =>
                            handleChange(fila.id, "fechaIngreso", e.target.value)
                          }
                        />
                      </td>

                      {/* Bono asistencia */}
                      <td className="border-r">
                        <Input
                          type="number"
                          className="h-8 text-right text-xs"
                          value={fila.bonoAsistencia}
                          onChange={(e) =>
                            handleChange(fila.id, "bonoAsistencia", e.target.value)
                          }
                          placeholder="0.00"
                        />
                      </td>

                      {/* Bono limpieza */}
                      <td className="border-r">
                        <Input
                          type="number"
                          className="h-8 text-right text-xs"
                          value={fila.bonoLimpieza}
                          onChange={(e) =>
                            handleChange(fila.id, "bonoLimpieza", e.target.value)
                          }
                          placeholder="0.00"
                        />
                      </td>

                      {/* Bono productividad */}
                      <td className="border-r">
                        <Input
                          type="number"
                          className="h-8 text-right text-xs"
                          value={fila.bonoProductividad}
                          onChange={(e) =>
                            handleChange(
                              fila.id,
                              "bonoProductividad",
                              e.target.value
                            )
                          }
                          placeholder="0.00"
                        />
                      </td>

                      {/* Infonavit crédito */}
                      <td className="border-r">
                        <Input
                          type="number"
                          className="h-8 text-right text-xs"
                          value={fila.infonavitCredito}
                          onChange={(e) =>
                            handleChange(
                              fila.id,
                              "infonavitCredito",
                              e.target.value
                            )
                          }
                          placeholder="0.00"
                        />
                      </td>

                      {/* Alta en IMSS */}
                      <td className="border-r text-center">
                        <Label className="inline-flex items-center gap-1 text-[11px]">
                          <input
                            type="checkbox"
                            checked={fila.altaIMSS}
                            onChange={() => handleToggleAltaIMSS(fila.id)}
                          />
                          <span>{fila.altaIMSS ? "Sí" : "No"}</span>
                        </Label>
                      </td>

                      {/* SDI IMSS */}
                      <td className="border-r">
                        <Input
                          type="number"
                          className="h-8 text-right text-xs"
                          value={fila.sdi}
                          onChange={(e) =>
                            handleChange(fila.id, "sdi", e.target.value)
                          }
                          placeholder="0.00"
                        />
                      </td>

                      {/* Límite vales */}
                      <td className="border-r">
                        <Input
                          type="number"
                          className="h-8 text-right text-xs"
                          value={fila.limiteVales}
                          onChange={(e) =>
                            handleChange(fila.id, "limiteVales", e.target.value)
                          }
                          placeholder="0.00"
                        />
                      </td>

                      {/* Dispersión base (opcional, solo referencia para ti) */}
                      <td className="border-r">
                        <Input
                          type="number"
                          className="h-8 text-right text-xs"
                          value={fila.dispersion}
                          onChange={(e) =>
                            handleChange(fila.id, "dispersion", e.target.value)
                          }
                          placeholder="0.00"
                        />
                      </td>

                      {/* Prima vacacional */}
                      <td className="border-r">
                        <Input
                          type="number"
                          className="h-8 text-right text-xs"
                          value={fila.primaVacacional}
                          onChange={(e) =>
                            handleChange(
                              fila.id,
                              "primaVacacional",
                              e.target.value
                            )
                          }
                          placeholder="0.00"
                        />
                      </td>

                      {/* Aguinaldo */}
                      <td className="border-r">
                        <Input
                          type="number"
                          className="h-8 text-right text-xs"
                          value={fila.aguinaldo}
                          onChange={(e) =>
                            handleChange(fila.id, "aguinaldo", e.target.value)
                          }
                          placeholder="0.00"
                        />
                      </td>

                      {/* Acciones */}
                      <td className="text-center">
                        <button
                          type="button"
                          className="text-[11px] text-red-600 hover:underline"
                          onClick={() => eliminarFila(fila.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filas.length === 0 && (
                  <tr>
                    <td
                      colSpan={16}
                      className="py-6 text-center text-gray-500 text-sm"
                    >
                      No hay trabajadores configurados.{" "}
                      <button
                        className="text-blue-600 underline"
                        type="button"
                        onClick={agregarFila}
                      >
                        Agregar el primero
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
