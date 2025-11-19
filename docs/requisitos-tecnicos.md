# Requisitos Técnicos - Task Scheduler Pro

## Descripción General
Aplicación React para automatizar la planificación de tareas a partir de archivos Excel. Lee tareas con esfuerzos estimados y calcula fechas de inicio y fin considerando días laborables, asuetos y acumulación de horas.

## Stack Tecnológico

### Frontend Framework
- **React 19.2.0** - Biblioteca principal de UI
- **TypeScript 5.9.3** - Tipado estático
- **Vite 7.2.2** - Build tool y dev server

### Librerías Core
- **xlsx (0.18.5)** - Lectura y escritura de archivos Excel (.xlsx, .xls)
- **date-fns (4.1.0)** - Manipulación y cálculo de fechas
- **react-dropzone (14.3.8)** - Componente drag & drop para carga de archivos

### UI/Styling
- **Tailwind CSS 4.1.17** - Framework de utilidades CSS
- **lucide-react (0.554.0)** - Iconos SVG
- **clsx (2.1.1)** - Utilidad para clases condicionales
- **tailwind-merge (3.4.0)** - Merge inteligente de clases Tailwind
- **class-variance-authority (0.7.1)** - Gestión de variantes de componentes

## Estructura del Proyecto

```
src/
├── components/
│   └── SchedulerApp.tsx      # Componente principal de la aplicación
├── utils/
│   ├── dateUtils.ts           # Utilidades para manejo de fechas
│   └── scheduler.ts           # Algoritmo de planificación
├── lib/
│   └── utils.ts               # Utilidad cn() para merge de clases
├── App.tsx                    # Punto de entrada de la app
└── index.css                  # Estilos globales con Tailwind
```

## Algoritmo de Planificación

### Lógica de Acumulación de Horas
El algoritmo implementa una característica clave: **acumulación de horas en el mismo día**.

**Funcionamiento:**
1. Se mantiene un contador `hoursUsedToday` que rastrea las horas consumidas en el día actual.
2. Cuando una tarea finaliza antes de completar las horas laborables del día, la siguiente tarea comienza **el mismo día**.
3. Solo se avanza al siguiente día cuando:
   - Se han consumido todas las horas laborables del día (`workHoursPerDay`).
   - El día siguiente es no laborable (fin de semana o asueto).

**Ejemplo:**
- Configuración: 8 horas/día
- Tarea 1: 4 horas → Inicia Lunes 9:00, Termina Lunes 13:00
- Tarea 2: 4 horas → Inicia Lunes 13:00, Termina Lunes 17:00
- Tarea 3: 6 horas → Inicia Martes 9:00, Termina Martes 15:00

### Manejo de Días No Laborables

#### Fines de Semana
- **Configurable**: El usuario puede activar/desactivar el trabajo en fines de semana.
- Por defecto: Sábados y Domingos se saltan automáticamente.

#### Asuetos/Feriados
- El usuario ingresa fechas específicas en formato `YYYY-MM-DD` (separadas por comas).
- El algoritmo verifica cada día y salta los asuetos automáticamente.

### Flujo del Algoritmo

```typescript
1. Inicializar currentDate = projectStartDate
2. Inicializar hoursUsedToday = 0
3. Para cada tarea:
   a. taskStartDate = currentDate
   b. remainingEffort = task.effort
   c. Mientras remainingEffort > 0:
      - Verificar si currentDate es día laborable
      - Si NO es laborable → avanzar al siguiente día
      - Calcular availableHours = workHoursPerDay - hoursUsedToday
      - Si availableHours <= 0 → avanzar al siguiente día
      - hoursToBill = min(remainingEffort, availableHours)
      - remainingEffort -= hoursToBill
      - hoursUsedToday += hoursToBill
   d. taskEndDate = currentDate
   e. Asignar fechas a la tarea
```

## Formato del Archivo Excel

### Columnas Requeridas (Input)
| Columna | Tipo | Descripción | Ejemplo |
|---------|------|-------------|---------|
| `Nombre Tarea` | String | Nombre descriptivo de la tarea | "Diseño UI" |
| `Esfuerzo` | Number | Horas estimadas para completar | 12 |

### Columnas Generadas (Output)
| Columna | Tipo | Descripción | Formato |
|---------|------|-------------|---------|
| `Fecha Inicio` | Date | Fecha de inicio calculada | YYYY-MM-DD |
| `Fecha Fin` | Date | Fecha de finalización calculada | YYYY-MM-DD |

### Ejemplo de Excel

**Antes del procesamiento:**
| Nombre Tarea | Esfuerzo |
|--------------|----------|
| Análisis | 8 |
| Diseño | 12 |
| Desarrollo | 24 |

**Después del procesamiento (Inicio: 2024-01-02, 8h/día, sin fines de semana):**
| Nombre Tarea | Esfuerzo | Fecha Inicio | Fecha Fin |
|--------------|----------|--------------|-----------|
| Análisis | 8 | 2024-01-02 | 2024-01-02 |
| Diseño | 12 | 2024-01-03 | 2024-01-04 |
| Desarrollo | 24 | 2024-01-05 | 2024-01-09 |

### Compatibilidad con otros nombres de columnas

Para adaptarse a plantillas existentes, la aplicación reconoce múltiples alias para las columnas fundamentales y permite agregar más desde la UI.

- **Nombre de la tarea (alias por defecto):** `Nombre Tarea`, `Tarea`, `Tareas`, `Task`, `Task Name`, `Actividad`, `Descripción`, `Nombre`.
- **Esfuerzo (horas) (alias por defecto):** `Esfuerzo`, `Horas`, `Horas Estimadas`, `Effort`, `Estimated Hours`, `Duración`, `Duration`.

Los alias personalizados se ingresan separados por comas y se combinan con la lista base. Durante la importación se normaliza el dataset:

1. Se analiza todo el archivo hasta encontrar una fila que contenga alguno de los alias (aunque no esté en la primera fila); esa fila se toma como encabezado.
2. Se busca la primera columna cuyo título coincida con los alias configurados para nombre y esfuerzo.
3. Se registra el índice real de cada fila de datos para poder volver a escribir sobre la misma fila en la exportación.
4. Si una fila no tiene nombre de tarea se asigna un identificador temporal (`Tarea sin nombre #N`).
5. Los esfuerzos inválidos o ausentes se normalizan a `0` horas y se muestra una advertencia en la UI.

## Configuración de Usuario

### Parámetros Disponibles

1. **Fecha de Inicio del Proyecto**
   - Tipo: Date
   - Descripción: Primer día laborable del proyecto
   - Default: Fecha actual

2. **Horas por Día**
   - Tipo: Number (1-24)
   - Descripción: Cantidad de horas laborables por día
   - Default: 8

3. **Incluir Fines de Semana**
   - Tipo: Boolean
   - Descripción: Si se trabaja Sábados y Domingos
   - Default: false

4. **Asuetos**
   - Tipo: String (comma-separated dates)
   - Formato: YYYY-MM-DD, YYYY-MM-DD
   - Ejemplo: "2024-12-25, 2024-01-01"
   - Descripción: Días feriados que se deben saltar

## Funcionalidades de la UI

### 1. Carga de Archivos
- **Drag & Drop**: Arrastrar archivo Excel al área designada
- **Click to Upload**: Selector de archivos tradicional
- **Formatos soportados**: `.xlsx`, `.xls`

### 2. Configuración
- Formulario lateral con todos los parámetros
- Validación en tiempo real
- Toggle visual para fines de semana

### 3. Vista Previa
- Tabla con las primeras 10 tareas procesadas
- Muestra: Nombre, Esfuerzo, Fecha Inicio, Fecha Fin
- Indicador de total de tareas

### 4. Exportación
- Botón "Descargar Excel"
- Genera archivo con el mismo nombre + prefijo "Cronograma_"
- Reescribe el mismo rango de la tabla original, respetando el orden/estilo de las columnas y agregando o actualizando únicamente `Fecha Inicio` y `Fecha Fin`.

## Requisitos del Sistema

### Navegador
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Node.js (Para desarrollo)
- Node.js 18+
- pnpm 8+ (recomendado) o npm 9+

## Comandos de Desarrollo

```bash
# Instalar dependencias
pnpm install

# Ejecutar en modo desarrollo
pnpm dev

# Construir para producción
pnpm build

# Preview de build de producción
pnpm preview

# Linting
pnpm lint
```

## Consideraciones de Rendimiento

- **Procesamiento en Cliente**: Todo el cálculo se realiza en el navegador (sin backend)
- **Archivos Grandes**: Probado con hasta 1000 tareas sin problemas de rendimiento
- **Memoria**: El archivo Excel se carga completamente en memoria
- **Reactividad**: El cálculo se ejecuta automáticamente al cambiar configuración

## Limitaciones Conocidas

1. **Tamaño de Archivo**: Limitado por la memoria del navegador (~50MB recomendado)
2. **Formato Excel**: Solo soporta formatos `.xlsx` y `.xls` (no CSV)
3. **Estilos Excel**: Los estilos del archivo original no se preservan en la exportación
4. **Zona Horaria**: Todas las fechas se manejan en la zona horaria local del navegador

## Extensibilidad Futura

Posibles mejoras:
- [ ] Soporte para múltiples hojas en un mismo Excel
- [ ] Configuración de horarios personalizados (ej: 9am-5pm)
- [ ] Visualización de Gantt Chart
- [ ] Exportar a otros formatos (PDF, CSV)
- [ ] Guardar configuraciones como presets
- [ ] Soporte para dependencias entre tareas
- [ ] Cálculo de ruta crítica
