# Guía de Contribución

¡Gracias por tu interés en contribuir a Zisiny! Este documento proporciona las pautas para contribuir al proyecto.

## 📋 Tabla de Contenidos

- [Código de Conducta](#código-de-conducta)
- [¿Cómo puedo contribuir?](#cómo-puedo-contribuir)
- [Configuración del entorno](#configuración-del-entorno)
- [Flujo de trabajo](#flujo-de-trabajo)
- [Guías de estilo](#guías-de-estilo)
- [Reportar bugs](#reportar-bugs)
- [Sugerir mejoras](#sugerir-mejoras)

---

## Código de Conducta

Este proyecto busca mantener un ambiente colaborativo y respetuoso. Se espera que todos los participantes:

- Usen lenguaje inclusivo y respetuoso
- Respeten diferentes puntos de vista
- Acepten críticas constructivas
- Se enfoquen en lo mejor para la comunidad

---

## ¿Cómo puedo contribuir?

Hay varias formas de contribuir a Zisiny:

### 🐛 Reportar bugs
- Usa la plantilla de issue para bugs
- Describe el problema claramente
- Incluye pasos para reproducir
- Menciona versión de navegador y sistema operativo

### ✨ Sugerir nuevas características
- Usa la plantilla de issue para features
- Explica el caso de uso
- Describe la solución propuesta
- Considera alternativas

### 📝 Mejorar documentación
- Corrige typos o errores
- Agrega ejemplos o aclaraciones
- Traduce contenido
- Actualiza documentación obsoleta

### 💻 Contribuir código
- Corrige bugs existentes
- Implementa nuevas características
- Mejora el rendimiento
- Refactoriza código

---

## Configuración del entorno

### Prerrequisitos

- Node.js 22.12.0 o superior
- pnpm 8+ (recomendado) o npm 9+
- Git

### Instalación

1. **Fork el repositorio**
   ```bash
   # Haz fork desde GitHub, luego clona tu fork
   git clone https://github.com/TU_USUARIO/zisiny.git
   cd zisiny
   ```

2. **Instala dependencias**
   ```bash
   pnpm install
   ```

3. **Configura remote upstream**
   ```bash
   git remote add upstream https://github.com/eliseo-arevalo/zisiny.git
   ```

4. **Inicia el servidor de desarrollo**
   ```bash
   pnpm dev
   # La app estará en http://localhost:5173
   ```

---

## Flujo de trabajo

### 1. Crea una rama

```bash
# Asegúrate de estar actualizado
git checkout main
git pull upstream main

# Crea una rama descriptiva
git checkout -b feature/nombre-descriptivo
# o
git checkout -b fix/descripcion-del-bug
```

### 2. Haz tus cambios

- Escribe código limpio y legible
- Sigue las convenciones existentes
- Comenta código complejo
- Actualiza documentación si es necesario

### 3. Prueba tus cambios

```bash
# Ejecuta el linter
pnpm lint

# Construye el proyecto
pnpm build

# Prueba manualmente
pnpm dev
# Sube un archivo Excel de prueba y verifica funcionalidad
```

### 4. Commit

Usa mensajes de commit descriptivos siguiendo [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Ejemplos de buenos commits
git commit -m "feat: add support for multiple Excel sheets"
git commit -m "fix: correct date calculation for leap years"
git commit -m "docs: update installation instructions"
git commit -m "refactor: simplify scheduler algorithm"
git commit -m "style: format code with prettier"
```

**Prefijos comunes:**
- `feat:` Nueva característica
- `fix:` Corrección de bug
- `docs:` Cambios en documentación
- `style:` Formato de código (sin cambios funcionales)
- `refactor:` Refactorización de código
- `test:` Agregar o modificar tests
- `chore:` Tareas de mantenimiento

### 5. Push y Pull Request

```bash
# Push a tu fork
git push origin feature/nombre-descriptivo

# Crea un Pull Request desde GitHub
# Completa la plantilla de PR con detalles
```

---

## Guías de estilo

### TypeScript

- **Usa TypeScript estricto**: No uses `any` sin justificación
- **Tipos explícitos**: Prefiere tipos explícitos sobre inferencia cuando mejora legibilidad
- **Interfaces sobre types**: Usa `interface` para objetos
- **Type imports**: Usa `import type` para importaciones de solo tipos

```typescript
// ✅ Bueno
import type { Task } from '../utils/scheduler';

interface UserConfig {
  name: string;
  email: string;
}

// ❌ Evitar
import { Task } from '../utils/scheduler'; // si solo usas el tipo
type UserConfig = {  // prefiere interface
  name: string;
  email: string;
}
```

### React

- **Componentes funcionales**: Solo usa functional components con hooks
- **Nombres descriptivos**: Variables y funciones deben ser auto-explicativas
- **Hooks personalizados**: Extrae lógica reutilizable a custom hooks
- **Props destructuring**: Destructura props en la firma de la función

```typescript
// ✅ Bueno
const TaskList = ({ tasks, onTaskClick }: TaskListProps) => {
  return (
    <ul>
      {tasks.map(task => (
        <li key={task.id} onClick={() => onTaskClick(task)}>
          {task.name}
        </li>
      ))}
    </ul>
  );
};

// ❌ Evitar
const TaskList = (props) => {  // falta tipado y destructuring
  return (
    <ul>
      {props.tasks.map(task => ...)}
    </ul>
  );
};
```

### CSS/Tailwind

- **Usa utility classes**: Prefiere Tailwind sobre CSS custom
- **Responsive design**: Mobile-first approach
- **Función cn()**: Para clases condicionales usa el helper `cn()`

```typescript
// ✅ Bueno
<div className={cn(
  "base-class",
  isActive && "active-class",
  "another-class"
)}>

// ❌ Evitar
<div className={`base-class ${isActive ? 'active-class' : ''} another-class`}>
```

### Naming Conventions

- **Componentes**: `PascalCase` (`SchedulerApp.tsx`)
- **Funciones**: `camelCase` (`calculateSchedule`)
- **Constantes**: `UPPER_SNAKE_CASE` (`DEFAULT_TASK_COLUMNS`)
- **Archivos**: Coincide con export principal

---

## Reportar bugs

Al reportar un bug, incluye:

1. **Descripción clara** del problema
2. **Pasos para reproducir**:
   - Qué archivo Excel usaste
   - Qué configuración aplicaste
   - Qué acciones ejecutaste
3. **Comportamiento esperado** vs **comportamiento actual**
4. **Screenshots** si es aplicable
5. **Entorno**:
   - Navegador y versión
   - Sistema operativo
   - Versión de Node (si aplica)

---

## Sugerir mejoras

Para sugerir una nueva característica:

1. **Verifica** que no exista ya un issue similar
2. **Describe el problema** que resuelve
3. **Propón una solución** con ejemplos
4. **Considera alternativas** y trade-offs
5. **Mockups/wireframes** si es cambio de UI

---

## Proceso de revisión

1. Un mantenedor revisará tu PR
2. Puede solicitar cambios o aclaraciones
3. Realiza los cambios solicitados
4. Una vez aprobado, tu PR será merged

**Tiempos de respuesta:**
- Este es un proyecto de side project, las revisiones pueden tomar tiempo
- Se agradece la paciencia

---

## Recursos adicionales

- **[README.md](./README.md)** - Documentación principal del proyecto
- **[CLAUDE.md](./CLAUDE.md)** - Guía técnica detallada para desarrolladores
- **[TODO.md](./TODO.md)** - Roadmap y tareas pendientes
- **[docs/requisitos-tecnicos.md](./docs/requisitos-tecnicos.md)** - Especificaciones técnicas

---

## Preguntas

Si tienes preguntas sobre cómo contribuir:

1. Revisa la documentación existente
2. Busca en issues cerrados
3. Abre un nuevo issue con la etiqueta "question"

---

**¡Gracias por contribuir a Zisiny!** 🎉

Cada contribución, por pequeña que sea, es valiosa y apreciada.
