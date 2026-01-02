# CLAUDE.md - AI Assistant Guide for Zisiny

This document provides comprehensive guidance for AI assistants working with the Zisiny codebase.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Codebase Structure](#codebase-structure)
3. [Technology Stack](#technology-stack)
4. [Core Architecture](#core-architecture)
5. [Key Algorithms](#key-algorithms)
6. [Development Workflows](#development-workflows)
7. [Code Conventions](#code-conventions)
8. [Common Tasks](#common-tasks)
9. [Testing Guidelines](#testing-guidelines)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Zisiny** (formerly Zisingfy) is a React + TypeScript application that automates task scheduling from Excel files. It reads task lists with effort estimates, applies workday/holiday rules, and exports the enriched Excel file with calculated start and end dates.

### Primary Use Case
Organizations upload an Excel file containing:
- Task names
- Effort estimates (in hours)

The app calculates:
- Start date for each task
- End date for each task
- Respects holidays, weekends, and working hours per day
- Accumulates hours within the same day when possible

### Key Features
- Drag & drop Excel file upload (`.xlsx` format)
- Dynamic configuration: project start date, work hours/day, weekends, holidays
- Hour accumulation algorithm (multiple tasks can complete in the same day)
- Real-time preview of processed tasks
- Export to `Cronograma_<original filename>.xlsx` preserving original styles
- Auto-detection of column headers with configurable aliases
- Pre-loaded holidays for El Salvador (dynamically calculated including Holy Week)

---

## Codebase Structure

```
zisiny/
├── src/
│   ├── components/
│   │   └── SchedulerApp.tsx         # Main UI component (700+ lines)
│   ├── utils/
│   │   ├── scheduler.ts             # Core scheduling algorithm
│   │   └── dateUtils.ts             # Date helper functions
│   ├── lib/
│   │   └── utils.ts                 # Utility function (cn for className merging)
│   ├── assets/                      # Static assets (SVG icons)
│   ├── App.tsx                      # Root app component
│   ├── main.tsx                     # React entry point
│   ├── App.css                      # App-specific styles
│   └── index.css                    # Global Tailwind styles
├── public/                          # Public static files
├── docs/
│   └── requisitos-tecnicos.md       # Technical requirements (Spanish)
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration (project references)
├── tsconfig.app.json                # TypeScript config for app code
├── tsconfig.node.json               # TypeScript config for Node.js (Vite)
├── vite.config.ts                   # Vite configuration with React Compiler
├── eslint.config.js                 # ESLint flat config (TypeScript + React)
├── .gitignore                       # Git ignore patterns
├── README.md                        # User-facing documentation (Spanish)
├── TODO.md                          # Task tracking
└── initialprompt.txt                # Original prompt (historical reference)
```

### File Responsibilities

#### `src/components/SchedulerApp.tsx`
The main component handling:
- File upload (react-dropzone)
- Excel parsing (ExcelJS)
- Configuration state management
- Schedule calculation invocation
- Excel export with style preservation
- Column alias configuration
- Holiday management (El Salvador defaults)
- UI rendering (configuration panel, preview table, warnings)

**Key State:**
- `config`: SchedulerConfig object
- `tasks`: Task[] (parsed from Excel)
- `workbook`: ExcelJS.Workbook (original file)
- `fileName`: string (original filename)
- `isProcessing`: boolean (loading state)
- `columnVariants`: Configurable column name aliases

#### `src/utils/scheduler.ts`
Core scheduling algorithm:
- `calculateSchedule(tasks, config)`: Main function
- Implements hour accumulation within days
- Uses `dateUtils` for workday validation
- Returns tasks with `Fecha Inicio` and `Fecha Fin` populated

#### `src/utils/dateUtils.ts`
Date helper utilities:
- `isWeekend(date)`: Saturday/Sunday check
- `isHoliday(date, holidays)`: Holiday validation
- `isWorkingDay(date, holidays, includeWeekends)`: Combined workday check
- `getNextWorkingDay(date, holidays, includeWeekends)`: Advance to next valid workday

---

## Technology Stack

### Core Framework
- **React 19.2.0** - Latest React with modern hooks
- **TypeScript 5.9.3** - Static typing
- **Vite 7.2.2** (via rolldown-vite) - Ultra-fast build tool

### Key Dependencies
- **exceljs 4.4.0** - Excel file manipulation (read/write with style preservation)
- **date-fns 4.1.0** - Date manipulation utilities
- **react-dropzone 14.3.8** - File upload component
- **sonner 2.0.7** - Toast notifications

### UI/Styling
- **Tailwind CSS 4.1.17** - Utility-first CSS framework
- **@tailwindcss/vite** - Tailwind Vite integration
- **lucide-react 0.554.0** - Icon library
- **clsx 2.1.1** + **tailwind-merge 3.4.0** - className utilities
- **class-variance-authority 0.7.1** - Component variant management

### Build Tools
- **Vite** with React plugin
- **babel-plugin-react-compiler 1.0.0** - React Compiler for optimization
- **ESLint 9.39.1** with TypeScript + React configs
- **pnpm** - Package manager

### Environment Requirements
- **Node.js 22.12.0+**
- **pnpm 8+** (recommended) or npm 9+
- Modern browsers: Chrome/Edge 90+, Firefox 88+, Safari 14+

---

## Core Architecture

### Data Flow

```
1. User uploads Excel file
   ↓
2. ExcelJS parses workbook → stores in state
   ↓
3. Extract dataset with column mapping
   - Auto-detect header row
   - Map column aliases to standard names
   - Normalize task names and efforts
   - Track original row numbers for export
   ↓
4. User configures parameters
   - Project start date
   - Work hours per day (1-24)
   - Include weekends (boolean)
   - Holidays (comma-separated dates)
   ↓
5. Calculate schedule (automatic on config change)
   - Pass tasks + config to calculateSchedule()
   - Algorithm assigns Fecha Inicio & Fecha Fin
   ↓
6. Display preview (first 10 tasks)
   ↓
7. User clicks "Download Excel"
   - Write dates back to original worksheet
   - Preserve all original styles
   - Export as Cronograma_<filename>.xlsx
```

### State Management Pattern
- **Component-level state** (no external state library)
- `useState` for all configuration and data
- `useMemo` for derived calculations
- `useCallback` for stable function references
- `useEffect` for side effects (e.g., recalculating holidays on date change)

### Component Architecture
- **Single main component**: `SchedulerApp.tsx`
- **Utility modules**: Pure functions in `utils/`
- **Separation of concerns**:
  - UI logic in component
  - Algorithm logic in `scheduler.ts`
  - Date utilities in `dateUtils.ts`

---

## Key Algorithms

### Hour Accumulation Algorithm

**Location**: `src/utils/scheduler.ts:20-78`

**Core Concept**: Tasks can share the same workday if total hours don't exceed `workHoursPerDay`.

**Flow**:
```typescript
1. Initialize:
   - currentDate = projectStartDate (ensure it's a working day)
   - hoursUsedToday = 0

2. For each task:
   a. taskStartDate = currentDate
   b. remainingEffort = task.Esfuerzo

   c. While remainingEffort > 0:
      - If hoursUsedToday >= workHoursPerDay:
          → Move to next working day
          → Reset hoursUsedToday = 0

      - availableHours = workHoursPerDay - hoursUsedToday
      - hoursToBill = min(remainingEffort, availableHours)
      - remainingEffort -= hoursToBill
      - hoursUsedToday += hoursToBill

   d. taskEndDate = currentDate
   e. Return task with Fecha Inicio and Fecha Fin
```

**Example**:
```
Config: 8 hours/day, start Monday Jan 2
Tasks:
  - Task A: 4 hours → Mon Jan 2 (0-4h used)
  - Task B: 4 hours → Mon Jan 2 (4-8h used, day full)
  - Task C: 6 hours → Tue Jan 3 (0-6h used)
```

### Holiday Calculation

**Location**: `src/components/SchedulerApp.tsx:50-100`

**El Salvador Holidays**:
- Fixed dates: New Year, Labor Day, Mother's Day, Father's Day, Independence, etc.
- Dynamic: Holy Week (calculated using Easter algorithm)

**Easter Calculation**: Uses Computus algorithm (Gregorian calendar)
- Implemented in `getEasterDate(year)`
- Returns Easter Sunday
- Subtracts days for Holy Thursday, Good Friday, Holy Saturday

---

## Development Workflows

### Initial Setup
```bash
# Clone repository
git clone <repo-url>
cd zisiny

# Install dependencies
pnpm install

# Start development server
pnpm dev
# App runs at http://localhost:5173
```

### Daily Development
```bash
# Run dev server with hot reload
pnpm dev

# Lint code
pnpm lint

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Git Workflow
- **Main branch**: (not specified in context, typically `main` or `master`)
- **Feature branches**: Use descriptive names (e.g., `feature/gantt-view`)
- **Commit messages**: Clear and descriptive
  - Good: "feat: add holiday management feature with default holidays"
  - Bad: "update files"

### Making Changes

#### Adding a New Feature
1. Read existing code in relevant files first
2. Understand current patterns (state management, styling, etc.)
3. Implement feature following existing conventions
4. Test manually with Excel file upload
5. Update documentation if needed (README.md, TODO.md)

#### Fixing a Bug
1. Reproduce the issue
2. Identify root cause in code
3. Fix with minimal changes
4. Verify fix doesn't break existing functionality
5. Consider edge cases

#### Modifying the Algorithm
1. **Read** `src/utils/scheduler.ts` and `src/utils/dateUtils.ts` first
2. Understand current logic flow
3. Make changes preserving the hour accumulation principle
4. Test with various scenarios:
   - Tasks spanning multiple days
   - Tasks completing in same day
   - Weekend/holiday boundaries
   - Edge cases (0 hours, very large efforts)

---

## Code Conventions

### TypeScript
- **Strict mode**: Enabled
- **Explicit types**: Prefer explicit over implicit
- **Interfaces**: Use for complex objects (e.g., `Task`, `SchedulerConfig`)
- **Type imports**: Use `import type` for type-only imports

**Example**:
```typescript
import type { Task, SchedulerConfig } from '../utils/scheduler';

interface ColumnVariants {
    task: string[];
    effort: string[];
}
```

### React Patterns
- **Functional components**: Use exclusively (no class components)
- **Hooks**:
  - `useState` for local state
  - `useMemo` for expensive computations
  - `useCallback` for stable callbacks (especially in dropzone)
  - `useEffect` for side effects
- **Props**: Destructure in function signature when possible
- **Event handlers**: Prefix with `handle` (e.g., `handleFileUpload`)

### Naming Conventions
- **Components**: PascalCase (`SchedulerApp`)
- **Functions**: camelCase (`calculateSchedule`, `isWorkingDay`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_TASK_COLUMNS`, `EXCEL_MIME_TYPE`)
- **Types/Interfaces**: PascalCase (`Task`, `SchedulerConfig`)
- **Files**: Match export name (component files in PascalCase, utility files in camelCase)

### Styling
- **Tailwind classes**: Use utility classes directly
- **Conditional classes**: Use `cn()` helper from `src/lib/utils.ts`
  ```typescript
  className={cn("base-class", condition && "conditional-class")}
  ```
- **Responsive design**: Mobile-first approach
- **Colors**: Use Tailwind's semantic colors

### File Organization
- **Imports order**:
  1. React imports
  2. Third-party libraries
  3. Local utilities
  4. Types
  5. Styles

**Example**:
```typescript
import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import ExcelJS from 'exceljs';
import { calculateSchedule } from '../utils/scheduler';
import type { Task } from '../utils/scheduler';
import { cn } from '../lib/utils';
```

### Comments
- **Avoid obvious comments**: Code should be self-documenting
- **Use comments for**:
  - Complex algorithms
  - Business logic explanations
  - Non-obvious workarounds
  - TODO/FIXME markers
- **JSDoc**: Optional but encouraged for exported functions

### Error Handling
- **User-facing errors**: Show via `toast.error()` from Sonner
- **Validation**: Validate at boundaries (file upload, config inputs)
- **Graceful degradation**: Handle missing data (e.g., effort defaults to 0)

---

## Common Tasks

### Adding a New Column Alias
**File**: `src/components/SchedulerApp.tsx`

1. User adds alias via UI (comma-separated in config panel)
2. Aliases are stored in `columnVariants` state
3. `extractDataset()` combines defaults + custom aliases
4. Excel parsing uses combined list for column detection

**No code changes needed** - fully UI-driven.

### Modifying Default Holidays
**File**: `src/components/SchedulerApp.tsx:39-100`

Edit `FIXED_SV_HOLIDAYS` array:
```typescript
const FIXED_SV_HOLIDAYS: FixedHoliday[] = [
    { month: 0, day: 1, label: 'Año Nuevo' },
    // Add new holiday
    { month: 6, day: 4, label: 'Independence Day (US)' },
];
```

For other countries:
- Replace `FIXED_SV_HOLIDAYS` with country-specific holidays
- Update `getDefaultElSalvadorHolidays()` to `getDefault<Country>Holidays()`
- Adjust Easter calculation if different calendar system

### Changing Work Hour Validation
**File**: `src/components/SchedulerApp.tsx`

Locate the input for work hours:
```typescript
<input
  type="number"
  min="1"
  max="24"  // Modify this constraint
  value={config.workHoursPerDay}
  onChange={(e) => setConfig({...config, workHoursPerDay: Number(e.target.value)})}
/>
```

### Adding a New Configuration Parameter

1. **Update `SchedulerConfig` interface** in `src/utils/scheduler.ts`:
```typescript
export interface SchedulerConfig {
    projectStartDate: Date;
    holidays: Date[];
    includeWeekends: boolean;
    workHoursPerDay: number;
    newParameter: string; // Add here
}
```

2. **Add to default config** in `SchedulerApp.tsx`:
```typescript
const [config, setConfig] = useState<SchedulerConfig>({
    // existing fields...
    newParameter: 'default value',
});
```

3. **Add UI input** in configuration panel
4. **Use in algorithm** (`scheduler.ts` or `dateUtils.ts`)

### Exporting to Different Formats

**Current**: Only `.xlsx` export

**To add CSV export**:
1. Install library: `pnpm add papaparse @types/papaparse`
2. Create export function:
```typescript
const exportToCSV = (tasks: Task[]) => {
    const csv = tasks.map(task => ({
        'Nombre Tarea': task['Nombre Tarea'],
        'Esfuerzo': task['Esfuerzo'],
        'Fecha Inicio': format(task['Fecha Inicio'], 'yyyy-MM-dd'),
        'Fecha Fin': format(task['Fecha Fin'], 'yyyy-MM-dd'),
    }));
    // Use papaparse to convert to CSV
    const csvContent = Papa.unparse(csv);
    // Trigger download
};
```

### Modifying Excel Export Behavior

**File**: `src/components/SchedulerApp.tsx` (in `exportExcel` function)

Current behavior:
- Writes to same worksheet as source data
- Adds/updates `Fecha Inicio` and `Fecha Fin` columns
- Preserves all original styles

To modify:
1. Locate `exportExcel` function
2. Modify column writing logic:
```typescript
worksheet.getRow(rowNum).getCell(startDateColIndex).value = format(task['Fecha Inicio'], 'yyyy-MM-dd');
```
3. Change date format, add new columns, or modify styling

---

## Testing Guidelines

### Manual Testing Checklist

#### File Upload
- [ ] Drag & drop `.xlsx` file works
- [ ] Click to upload works
- [ ] Invalid file types are rejected
- [ ] Large files (1000+ rows) load without freezing

#### Column Detection
- [ ] Auto-detects standard column names
- [ ] Handles headers not in first row
- [ ] Custom aliases work correctly
- [ ] Shows warnings for unmapped columns

#### Schedule Calculation
- [ ] Tasks start on configured start date
- [ ] Weekends are skipped (when unchecked)
- [ ] Holidays are skipped
- [ ] Hour accumulation works (multiple tasks same day)
- [ ] Tasks spanning multiple days calculate correctly
- [ ] Zero-effort tasks handled gracefully

#### Export
- [ ] Exported file downloads
- [ ] Filename has `Cronograma_` prefix
- [ ] Original styles are preserved
- [ ] Date columns are added/updated
- [ ] Can re-open exported file in Excel

#### Edge Cases
- [ ] Empty Excel file
- [ ] File with only headers
- [ ] Tasks with 0 hours
- [ ] Very large effort values (e.g., 1000 hours)
- [ ] Start date is a holiday
- [ ] All days are holidays (infinite loop prevention)

### Automated Testing
**Current state**: No automated tests

**Recommended setup**:
- **Unit tests**: Vitest for `scheduler.ts`, `dateUtils.ts`
- **Component tests**: React Testing Library for `SchedulerApp.tsx`
- **E2E tests**: Playwright for full workflow

**Example unit test** (not implemented):
```typescript
import { describe, it, expect } from 'vitest';
import { calculateSchedule } from './scheduler';

describe('calculateSchedule', () => {
    it('should accumulate hours in same day', () => {
        const tasks = [
            { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 4 },
            { 'Nombre Tarea': 'Task 2', 'Esfuerzo': 4 },
        ];
        const config = {
            projectStartDate: new Date(2024, 0, 2), // Tuesday
            holidays: [],
            includeWeekends: false,
            workHoursPerDay: 8,
        };
        const result = calculateSchedule(tasks, config);
        expect(result[0]['Fecha Inicio']).toEqual(new Date(2024, 0, 2));
        expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 2));
        expect(result[1]['Fecha Inicio']).toEqual(new Date(2024, 0, 2));
        expect(result[1]['Fecha Fin']).toEqual(new Date(2024, 0, 2));
    });
});
```

---

## Troubleshooting

### Common Issues

#### Excel File Won't Parse
**Symptom**: Error on file upload

**Causes**:
- File is corrupted
- File is `.xls` (old format) - only `.xlsx` supported
- File has no data or headers

**Solution**:
1. Verify file format
2. Check browser console for specific error
3. Try re-saving Excel as `.xlsx`

#### Dates Are Wrong
**Symptom**: Calculated dates don't match expectations

**Debugging**:
1. Check project start date in config
2. Verify holidays list (format: `YYYY-MM-DD`)
3. Check "Include Weekends" setting
4. Inspect `calculateSchedule` with console logs:
```typescript
console.log('Current date:', currentDate, 'Hours used:', hoursUsedToday);
```

#### Export Doesn't Preserve Styles
**Symptom**: Exported file loses formatting

**Causes**:
- File wasn't `.xlsx` format
- ExcelJS limitations with complex styles

**Solution**:
- Ensure original file is `.xlsx`
- Check ExcelJS documentation for supported style properties

#### Infinite Loop on Calculation
**Symptom**: Browser freezes

**Causes**:
- All days are holidays (no working days available)
- Bug in `getNextWorkingDay` logic

**Debugging**:
1. Add iteration counter in `while` loops
2. Break after 1000 iterations with error
3. Verify holiday list doesn't cover entire year

#### Build Errors
**Symptom**: `pnpm build` fails

**Common causes**:
- TypeScript errors: Run `pnpm lint` to identify
- Missing dependencies: Run `pnpm install`
- Vite config issues: Check `vite.config.ts`

**Solution**:
```bash
# Clean and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Check TypeScript
pnpm exec tsc --noEmit

# Rebuild
pnpm build
```

---

## Additional Resources

### Documentation Files
- **README.md**: User-facing documentation (Spanish)
- **docs/requisitos-tecnicos.md**: Technical requirements (Spanish)
- **TODO.md**: Current tasks and future ideas

### External Documentation
- [React 19 Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vite.dev/guide/)
- [ExcelJS Documentation](https://github.com/exceljs/exceljs)
- [date-fns Documentation](https://date-fns.org)
- [Tailwind CSS](https://tailwindcss.com)

### Project-Specific Notes
- Original prompt in `initialprompt.txt` (historical reference)
- Project renamed from "Zisingfy" to "Zisiny" (package name still "zisingfy")
- Spanish is the primary language for documentation

---

## AI Assistant Interaction Guidelines

### When Working on This Codebase

1. **Always read files before editing**
   - Use Read tool on relevant files
   - Understand existing patterns
   - Preserve code style

2. **Follow existing patterns**
   - Match naming conventions
   - Use same state management approach
   - Keep component structure consistent

3. **Test changes manually**
   - Run `pnpm dev` after changes
   - Upload a test Excel file
   - Verify calculations are correct
   - Check export functionality

4. **Update documentation**
   - If adding features, update README.md
   - If changing algorithm, update docs/requisitos-tecnicos.md
   - Keep this CLAUDE.md file current

5. **Be cautious with dependencies**
   - Prefer existing libraries
   - Check compatibility with React 19
   - Update package.json and run `pnpm install`

6. **Avoid over-engineering**
   - Keep solutions simple
   - Don't add unnecessary abstractions
   - Follow YAGNI (You Aren't Gonna Need It)

7. **Handle edge cases**
   - Zero-effort tasks
   - Missing data
   - Invalid dates
   - Very large files

### Communication Style
- **Spanish preferred** for user-facing content (README, UI text)
- **English acceptable** for code comments and technical docs
- **Be explicit** about changes made
- **Explain trade-offs** when multiple approaches exist

---

**Last Updated**: 2026-01-02 (Initial creation)
**Maintained By**: AI assistants working with this codebase
**Version**: 1.0.0
