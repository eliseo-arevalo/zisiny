<div align="center">

# 📅 Zisiny

### Automatización inteligente de cronogramas de proyectos

Transforma tus listas de tareas en cronogramas profesionales en segundos. Zisiny lee archivos Excel con estimaciones de esfuerzo y calcula automáticamente fechas de inicio y fin, respetando días laborables, feriados y acumulación de horas.

[![Node Version](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

[Características](#-características) • [Inicio Rápido](#-inicio-rápido) • [Documentación](#-documentación) • [Roadmap](#-roadmap)

</div>

---

## 🎯 ¿Para qué sirve?

Zisiny está diseñado para equipos y profesionales que necesitan:

- **Planificar proyectos rápidamente** sin herramientas complejas
- **Automatizar cálculos de fechas** considerando días laborables y feriados
- **Mantener cronogramas actualizados** al ajustar esfuerzos o fechas de inicio
- **Trabajar con Excel** preservando el formato original de tus plantillas

### Caso de uso típico

1. Tienes un Excel con lista de tareas y horas estimadas
2. Subes el archivo a Zisiny
3. Configuras fecha de inicio, horas por día y feriados
4. Descargas el Excel enriquecido con fechas calculadas automáticamente

Todo en el navegador, sin instalaciones ni servidores.

---

## ✨ Características

### 🎨 Interfaz intuitiva
- **Drag & drop** para cargar archivos `.xlsx`
- **Configuración visual** de parámetros del proyecto
- **Vista previa en tiempo real** de tareas procesadas
- **Indicadores de calidad** de datos con advertencias útiles

### 🧠 Algoritmo inteligente
- **Acumulación de horas**: múltiples tareas pueden completarse el mismo día
- **Detección automática de columnas**: funciona con diferentes nombres de encabezados
- **Salto automático** de fines de semana y feriados
- **Fechas dinámicas**: se recalculan al cambiar cualquier parámetro

### 🌍 Localización
- **Feriados precargados** para El Salvador (incluye Semana Santa calculada dinámicamente)
- **Configuración de asuetos** personalizable para cualquier país
- **Alias de columnas** configurables para adaptarse a plantillas en inglés o español

### 📤 Exportación profesional
- **Preserva estilos** del Excel original
- **Actualiza solo fechas**: no modifica el resto de tu archivo
- **Nomenclatura clara**: archivos exportados como `Cronograma_<nombre_original>.xlsx`

---

## 🚀 Inicio Rápido

### Prerequisitos

- Node.js 22.12+ ([Descargar](https://nodejs.org/))
- pnpm 8+ (recomendado) o npm 9+

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/eliseo-arevalo/zisiny.git
cd zisiny

# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo
pnpm dev
```

La aplicación estará disponible en `http://localhost:5173`

### Otros comandos

```bash
pnpm build     # Construir para producción
pnpm preview   # Previsualizar build de producción
pnpm lint      # Ejecutar ESLint
```

---

## 📊 Compatibilidad de columnas

Zisiny reconoce automáticamente diferentes nombres de columnas en tu Excel:

| Tipo | Alias soportados |
|------|------------------|
| **Nombre de tarea** | `Nombre Tarea`, `Tarea`, `Tareas`, `Task`, `Task Name`, `Actividad`, `Descripción`, `Nombre` |
| **Esfuerzo (horas)** | `Esfuerzo`, `Horas`, `Horas Estimadas`, `Effort`, `Estimated Hours`, `Duración`, `Duration` |

### Características avanzadas

- **Detección flexible de encabezados**: encuentra la fila de encabezados aunque no esté en la primera línea
- **Alias personalizados**: agrega tus propios nombres de columnas desde la interfaz
- **Normalización automática**: maneja datos faltantes o inválidos con advertencias claras

---

## 🔧 Tecnologías

Construido con tecnologías modernas para máximo rendimiento:

- **React 19** + **TypeScript 5.9** - Framework UI con tipado estático
- **Vite 7** - Build tool ultra rápido
- **ExcelJS** - Lectura/escritura de archivos Excel preservando estilos
- **date-fns** - Manipulación de fechas
- **Tailwind CSS 4** - Estilos con utilidades
- **React Compiler** - Optimización automática de rendimiento

---

## 📁 Estructura del proyecto

```
src/
├── components/
│   └── SchedulerApp.tsx      # Componente principal (UI, import/export)
├── utils/
│   ├── dateUtils.ts          # Helpers para fines de semana/asuetos
│   └── scheduler.ts          # Algoritmo de planificación
├── lib/
│   └── utils.ts              # Utilidades (cn helper)
├── App.tsx                   # Punto de entrada
├── main.tsx                  # Bootstrap React
└── index.css                 # Estilos globales Tailwind
```

---

## 💡 ¿Cómo funciona?

### Algoritmo de acumulación de horas

Zisiny implementa un algoritmo único que optimiza el uso del tiempo:

```
Configuración: 8 horas/día, inicio Lunes 2 Enero
Tareas:
  - Análisis: 4h    → Lunes 2 Enero (9:00-13:00)
  - Diseño: 4h      → Lunes 2 Enero (13:00-17:00)
  - Desarrollo: 6h  → Martes 3 Enero (9:00-15:00)
```

**Ventajas**:
- Aprovecha días parcialmente utilizados
- Reduce duración total del proyecto
- Refleja cómo trabajan los equipos reales

### Manejo de días no laborables

- **Fines de semana**: Configurable (activar/desactivar)
- **Feriados**: Lista personalizable en formato `YYYY-MM-DD`
- **Semana Santa**: Calculada automáticamente para El Salvador
- **Saltos automáticos**: El algoritmo avanza al siguiente día laborable

---

## 📚 Documentación

### Archivos de referencia

- **[`docs/requisitos-tecnicos.md`](docs/requisitos-tecnicos.md)** - Especificaciones técnicas detalladas
- **[`CLAUDE.md`](CLAUDE.md)** - Guía completa para desarrolladores y AI assistants
- **[`TODO.md`](TODO.md)** - Roadmap y tareas pendientes

### Flujo de datos

```
1. Upload Excel → 2. Parse con ExcelJS → 3. Detectar columnas
         ↓
4. Configurar parámetros → 5. Calcular cronograma → 6. Vista previa
         ↓
7. Exportar Excel (preservando estilos originales)
```

---

## 🗺️ Roadmap

### ✅ Completado
- [x] Carga y exportación de archivos Excel
- [x] Algoritmo de acumulación de horas
- [x] Detección automática de columnas
- [x] Feriados de El Salvador con Semana Santa
- [x] Preservación de estilos en exportación

### 🔜 Próximas características
- [ ] Soporte para múltiples hojas Excel
- [ ] Visualización tipo Gantt
- [ ] Exportación a PDF/CSV
- [ ] Presets de configuración por proyecto
- [ ] Dependencias entre tareas
- [ ] Cálculo de ruta crítica

---

## 🌐 Compatibilidad

### Navegadores soportados
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Archivos Excel
- ✅ Formato `.xlsx` (recomendado para preservar estilos)
- ✅ Formato `.xls` (limitado)
- ❌ CSV (no soportado actualmente)

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Para cambios mayores:

1. Abre un issue primero para discutir los cambios
2. Fork el proyecto
3. Crea una rama para tu feature (`git checkout -b feature/amazing-feature`)
4. Commit tus cambios (`git commit -m 'feat: add amazing feature'`)
5. Push a la rama (`git push origin feature/amazing-feature`)
6. Abre un Pull Request

### Guías de desarrollo

- Sigue las convenciones de código existentes
- Lee [`CLAUDE.md`](CLAUDE.md) para guías detalladas
- Ejecuta `pnpm lint` antes de hacer commit
- Prueba manualmente con archivos Excel de prueba

---

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT. Consulta el archivo [LICENSE](./LICENSE) para más detalles.

---

## 👤 Autor

**Eliseo Arévalo**
- GitHub: [@eliseo-arevalo](https://github.com/eliseo-arevalo)

---

## 🙏 Agradecimientos

- Comunidad de React por las herramientas increíbles
- ExcelJS por la biblioteca robusta de manejo de Excel
- Todos los que han probado y dado feedback sobre Zisiny

---

<div align="center">

**¿Encontraste útil este proyecto?** ⭐ Dale una estrella en GitHub

Construido con ❤️ usando React + TypeScript

</div>
