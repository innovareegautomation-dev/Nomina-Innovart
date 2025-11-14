// src/app.jsx
import React, { useState } from 'react'
import ParametrosNominaTab from './pages/ParametrosNominaTab'
import CalculoNomina from './pages/CalculoNomina'
import ResumenNomina from './pages/ResumenNomina'        // <-- NUEVO
import { Card, CardContent } from './components/ui/card'
import { Button } from './components/ui/button'

export default function App() {
  const [tab, setTab] = useState('parametros')

  const renderTab = () => {
    if (tab === 'parametros') return <ParametrosNominaTab />
    if (tab === 'nomina') {
      return <CalculoNomina onCapturar={() => setTab('captura')} />
    }
    if (tab === 'captura') return <ResumenNomina />
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">LaRaya App</h1>

        <div className="flex gap-2 mb-6">
          <Button
            variant={tab === 'parametros' ? 'default' : 'secondary'}
            onClick={() => setTab('parametros')}
          >
            Parámetros
          </Button>

          <Button
            variant={tab === 'nomina' ? 'default' : 'secondary'}
            onClick={() => setTab('nomina')}
          >
            Cálculo
          </Button>

          <Button
            variant={tab === 'captura' ? 'default' : 'secondary'}
            onClick={() => setTab('captura')}
          >
            Resultados
          </Button>
        </div>

        <Card className="w-full">
          <CardContent className="p-0">
            {renderTab()}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
