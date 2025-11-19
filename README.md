# Zisiny

Aplicación React + TypeScript (Vite) que automatiza la planificación de tareas a partir de archivos Excel. Lee la lista de actividades con esfuerzos estimados, aplica reglas de días laborables/asuetos y exporta el mismo archivo enriquecido con las fechas de inicio y fin calculadas.

Para el detalle funcional revisa `docs/requisitos-tecnicos.md`.

## Características clave

- Carga drag & drop de archivos `.xlsx` usando `react-dropzone` y `exceljs`, preservando estilos originales.
- Configuración dinámica: fecha de inicio del proyecto, horas laborables por día, fines de semana opcionales y asuetos personalizables.
- Algoritmo que acumula horas en la misma jornada y salta automáticamente fines de semana o feriados (ver `src/utils/scheduler.ts` y `src/utils/dateUtils.ts`).
- Vista previa completa de las tareas procesadas con indicadores resumidos.
- Exportación inmediata del cronograma (`Cronograma_<archivo original>.xlsx`) respetando la tabla original y añadiendo/actualizando únicamente las columnas `Fecha Inicio` y `Fecha Fin` en la misma hoja, conservando los estilos existentes.
- Compatibilidad con múltiples nombres de columnas para “Nombre Tarea” y “Esfuerzo”; el usuario puede añadir alias directamente desde la UI para adaptarse a plantillas existentes.
- Auto-detección de encabezados: la app busca la fila que contiene los alias configurados (aunque no esté en la primera fila) y desde ahí construye la tabla.
- Controles UX para incluir fines de semana, ignorar filas de totales y visualizar la información del archivo cargado en todo momento.
- Asuetos precargados: se incluyen por defecto los feriados nacionales de El Salvador (según el año de inicio del proyecto) y se recalculan dinámicamente.

## Requisitos del entorno

- Node.js 22.12+
- pnpm 8+ (recomendado) o npm 9+
- Navegador moderno (Chrome/Edge 90+, Firefox 88+, Safari 14+)

## Comandos

```bash
pnpm install   # instala dependencias
pnpm dev       # modo desarrollo (http://localhost:5173)
pnpm build     # build de producción
pnpm preview   # sirve la build
pnpm lint      # ejecuta ESLint con TypeScript
```

## Estructura

```
src/
├── components/
│   └── SchedulerApp.tsx      # Componente principal (UI, import/export)
├── utils/
│   ├── dateUtils.ts          # helpers para fines de semana/asuetos
│   └── scheduler.ts          # algoritmo de planificación
├── lib/
│   └── utils.ts              # helper cn()
├── App.tsx / main.tsx        # bootstrap React
└── index.css                 # Tailwind base (v4)
```

## Compatibilidad de columnas

La importación intenta mapear automáticamente columnas equivalentes:
- Nombre de tarea: `Nombre Tarea`, `Tarea`, `Tareas`, `Task`, `Task Name`, `Actividad`, `Descripción`, `Nombre`.
- Esfuerzo (horas): `Esfuerzo`, `Horas`, `Horas Estimadas`, `Effort`, `Estimated Hours`, `Duración`, `Duration`.

Además, si tu tabla empieza más abajo o a la derecha, la aplicación analiza todas las filas hasta encontrar una que contenga alguno de los alias anteriores y la usa como encabezado antes de procesar los datos; al exportar se mantiene el orden y los estilos originales de tus columnas y solo se agregan/actualizan `Fecha Inicio` y `Fecha Fin`. Para conservar estilos es necesario trabajar con archivos `.xlsx`. Como ayuda inicial, los asuetos se precargan con los feriados nacionales de El Salvador para el año seleccionado (y se recalculan si cambias la fecha de inicio), aunque puedes sobrescribirlos en cualquier momento.
En la tarjeta “Columnas soportadas” se pueden agregar alias adicionales separados por comas; se combinan con la lista base y se aplican inmediatamente a los datos cargados.

## Documentación adicional

`docs/requisitos-tecnicos.md` describe:

- Flujo del algoritmo de planificación.
- Formato del Excel de entrada/salida.
- Consideraciones de rendimiento y roadmap.
- Requisitos de stack y comandos.

---

Para ideas pendientes y seguimiento de trabajo utiliza `TODO.md` en la raíz.***
