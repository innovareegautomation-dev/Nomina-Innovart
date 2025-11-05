# Payroll App (Versión estable JS)

Pestaña de **Parámetros de Nómina** para gestionar sueldos, bonos (percepciones y descuentos) y límites de vales por trabajador para Innovart y EG.

## Requisitos
- Node 18+
- npm o pnpm

## Inicio
```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Construir
```bash
npm run build
npm run preview
```

## Notas
- La pestaña **Parámetros** guarda automáticamente en `localStorage` (edición en curso) y permite **Actualizar (guardar como ACTIVO)**. Esa versión activa puede ser consumida por la pestaña de cálculo.
- Exporta/Importa JSON para respaldar o compartir parámetros.
- Componentes UI mínimos en `src/components/ui` (sin dependencias externas complejas) para evitar fallos de compilación.
- Selects y diálogos implementados con elementos nativos y un modal simple para máxima compatibilidad.
