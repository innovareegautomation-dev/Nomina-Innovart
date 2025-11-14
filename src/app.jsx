// src/app.jsx
import React, { useState } from "react";
import ParametrosNominaTab from "./pages/ParametrosNominaTab";
import CalculoNomina from "./pages/CalculoNomina";
import ResumenNomina from "./pages/ResumenNomina";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";

export default function App() {
  const [tab, setTab] = useState("parametros"); // 'parametros' | 'nomina' | 'captura'

  const renderTab = () => {
    if (tab === "parametros") return <ParametrosNominaTab />;

    if (tab === "nomina") {
      // Pasamos onCapturar para cambiar a la pestaña de Resultados
      return <CalculoNomina onCapturar={() => setTab("captura")} />;
    }

    if (tab === "captura") return <ResumenNomina />;

    return null;
  };

  const baseBtn =
    "px-4 py-2 rounded-full text-sm font-medium transition-colors";

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={
        baseBtn +
        (tab === id
          ? " bg-black text-white"
          : " bg-gray-100 text-gray-700 hover:bg-gray-200")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">LaRaya App</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabBtn("parametros", "Parámetros")}
          {tabBtn("nomina", "Cálculo")}
          {tabBtn("captura", "Resultados")}
        </div>

        {/* Contenido */}
        <Card className="w-full">
          <CardContent className="p-0">{renderTab()}</CardContent>
        </Card>
      </div>
    </div>
  );
}
