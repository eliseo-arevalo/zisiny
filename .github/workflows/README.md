# GitHub Actions Workflows

Este directorio contiene los workflows de CI/CD para el proyecto Zisiny.

## 📋 Workflows Disponibles

### 1. `test.yml` - Tests y Build
**Trigger**: Pull Requests y Push a `main`

**Jobs**:
- **test**: Ejecuta tests unitarios con Vitest
  - ✅ Ejecuta linter (ESLint)
  - ✅ Ejecuta suite de tests (40 tests)
  - ✅ Genera reporte de cobertura
  - ✅ Sube reporte como artifact (retención: 30 días)

- **build**: Compila el proyecto
  - ✅ Ejecuta build de producción con Vite
  - ✅ Sube artifacts del build (retención: 7 días)

**Requisitos**:
- Node.js 22.12.0
- pnpm 8+

### 2. `coverage.yml` - Reporte de Cobertura
**Trigger**: Pull Requests a `main`

**Features**:
- 📊 Genera reporte detallado de cobertura
- 💬 Publica comentario en el PR con estadísticas
- 📁 Sube reporte HTML completo como artifact

**Permisos requeridos**:
- `pull-requests: write` - Para comentar en PRs
- `contents: read` - Para leer el código

## 🚀 Uso

Los workflows se ejecutan automáticamente:

1. **En Pull Requests**: Ambos workflows se ejecutan para validar cambios
2. **En Push a main**: Solo el workflow de tests se ejecuta

## 📊 Ver Resultados

### En GitHub
1. Ve a la pestaña "Actions" del repositorio
2. Selecciona el workflow run correspondiente
3. Descarga los artifacts para ver reportes detallados

### Localmente
```bash
# Ejecutar tests
pnpm test

# Ver cobertura
pnpm test:coverage

# Ver reporte HTML de cobertura
open coverage/index.html
```

## 🔧 Configuración

### Modificar Node.js version
Edita la propiedad `node-version` en ambos workflows:
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22.12.0'  # Cambiar aquí
```

### Modificar pnpm version
Edita la propiedad `version` en la configuración de pnpm:
```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 8  # Cambiar aquí
```

### Agregar nuevos checks
Agrega steps adicionales en el job `test`:
```yaml
- name: Run custom check
  run: pnpm run custom-script
```

## ⚙️ Status Badges

Puedes agregar badges al README principal:

```markdown
![Tests](https://github.com/eliseo-arevalo/zisiny/workflows/Tests/badge.svg)
![Coverage](https://github.com/eliseo-arevalo/zisiny/workflows/Coverage%20Report/badge.svg)
```

## 🛡️ Protecciones de Branch

Se recomienda configurar protecciones de branch en `main`:

1. Ve a Settings → Branches → Branch protection rules
2. Agrega regla para `main`
3. Habilita:
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Status checks: "Run Tests" y "Code Coverage"

Esto asegurará que todos los tests pasen antes de hacer merge a main.
