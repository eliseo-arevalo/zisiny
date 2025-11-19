import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { format, parseISO, isValid } from 'date-fns';
import { Calendar, Upload, FileSpreadsheet, Download, Settings, Clock, Coffee, AlertCircle, AlertTriangle, ListChecks } from 'lucide-react';
import { calculateSchedule } from '../utils/scheduler';
import type { Task, SchedulerConfig } from '../utils/scheduler';
import { cn } from '../lib/utils';

const DEFAULT_TASK_COLUMNS = ['Nombre Tarea', 'Tarea', 'Tareas', 'Task', 'Task Name', 'Actividad', 'Descripción', 'Nombre'];
const DEFAULT_EFFORT_COLUMNS = ['Esfuerzo', 'Horas', 'Horas Estimadas', 'Effort', 'Estimated Hours', 'Duración', 'Duration'];

type ColumnVariants = {
    task: string[];
    effort: string[];
};

type ExtractedDataset = {
    rows: Task[];
    warnings: string[];
    headerRow: string[];
    headerIndex: number;
    dataStartIndex: number;
    rowMappings: number[];
};

const normalizeKey = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

const parseListInput = (value: string): string[] =>
    value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

const mergeColumnList = (defaults: string[], userInput: string): string[] => {
    const aliases = [...defaults, ...parseListInput(userInput)];
    const seen = new Set<string>();
    const result: string[] = [];

    aliases.forEach((alias) => {
        const normalized = normalizeKey(alias);
        if (!seen.has(normalized)) {
            seen.add(normalized);
            result.push(alias.trim());
        }
    });

    return result;
};

const findColumnKey = (row: Task, aliases: string[]): string | undefined => {
    const aliasSet = aliases.map(normalizeKey);
    return Object.keys(row).find((key) => aliasSet.includes(normalizeKey(key)));
};

const findHeaderRowIndex = (rows: unknown[][], columns: ColumnVariants): number => {
    const taskAliases = columns.task.map(normalizeKey);
    const effortAliases = columns.effort.map(normalizeKey);

    let bestIndex = -1;
    let bestScore = -1;

    for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const normalizedCells = row.map((cell) => normalizeKey(String(cell ?? '')));
        const matchesTask = normalizedCells.some((cell) => taskAliases.includes(cell));
        const matchesEffort = normalizedCells.some((cell) => effortAliases.includes(cell));
        const nonEmpty = normalizedCells.some((cell) => cell.length > 0);
        if (!nonEmpty) {
            continue;
        }

        const score = Number(matchesTask) + Number(matchesEffort);
        if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
        }
        if (bestScore === 2) {
            break;
        }
    }

    return bestIndex;
};

const buildDatasetFromMatrix = (matrix: unknown[][], columns: ColumnVariants): ExtractedDataset => {
    if (matrix.length === 0) {
        return {
            rows: [],
            warnings: [],
            headerRow: [],
            headerIndex: 0,
            dataStartIndex: 0,
            rowMappings: [],
        };
    }

    const headerIndex = findHeaderRowIndex(matrix, columns);
    const warnings: string[] = [];
    const effectiveHeaderIndex = headerIndex === -1 ? 0 : headerIndex;

    if (headerIndex === -1) {
        warnings.push('No se encontró ninguna fila con encabezados compatibles; se asumió que la primera fila es el encabezado.');
    }

    const headerRowSource = matrix[effectiveHeaderIndex] ?? [];
    const headerRow = headerRowSource.map((value, index) => {
        const text = String(value ?? '').trim();
        return text || `Columna ${index + 1}`;
    });

    const seenHeaders = new Map<string, number>();
    const uniqueHeaders = headerRow.map((header) => {
        const normalized = header || 'Columna';
        const count = seenHeaders.get(normalized) ?? 0;
        seenHeaders.set(normalized, count + 1);
        return count === 0 ? normalized : `${normalized} (${count + 1})`;
    });

    const dataStartIndex = Math.min(effectiveHeaderIndex + 1, matrix.length);
    const dataRows = matrix.slice(dataStartIndex);

    const extractedRows: Task[] = [];
    const rowMappings: number[] = [];

    dataRows.forEach((cells, relativeIndex) => {
        const rowObject: Task = {};
        cells.forEach((cell, columnIndex) => {
            const header = uniqueHeaders[columnIndex] ?? `Columna ${columnIndex + 1}`;
            rowObject[header] = cell ?? '';
        });
        const hasContent = Object.values(rowObject).some((value) => String(value ?? '').trim().length > 0);
        if (hasContent) {
            extractedRows.push(rowObject);
            rowMappings.push(dataStartIndex + relativeIndex);
        }
    });

    return {
        rows: extractedRows,
        warnings,
        headerRow,
        headerIndex: effectiveHeaderIndex,
        dataStartIndex,
        rowMappings,
    };
};

const normalizeTaskDataset = (rows: Task[], columns: ColumnVariants) => {
    let missingTaskNames = 0;
    let missingEffortValues = 0;

    const datasetKeys = new Set<string>();
    rows.forEach((row) => {
        Object.keys(row).forEach((key) => datasetKeys.add(normalizeKey(key)));
    });

    const normalizedTasks = rows.map((row, index) => {
        const normalizedRow: Task = { ...row };
        const taskKey = findColumnKey(row, columns.task);
        const effortKey = findColumnKey(row, columns.effort);

        if (taskKey) {
            normalizedRow['Nombre Tarea'] = String(row[taskKey]).trim();
        }

        const rawTaskName = normalizedRow['Nombre Tarea']?.toString().trim();
        if (!rawTaskName) {
            missingTaskNames += 1;
            normalizedRow['Nombre Tarea'] = `Tarea sin nombre #${index + 1}`;
        }

        if (effortKey) {
            const parsedEffort = Number(row[effortKey]);
            normalizedRow['Esfuerzo'] = Number.isFinite(parsedEffort) && parsedEffort >= 0 ? parsedEffort : 0;
            if (!Number.isFinite(parsedEffort) || parsedEffort < 0) {
                missingEffortValues += 1;
            }
        } else {
            missingEffortValues += 1;
            normalizedRow['Esfuerzo'] = Number.isFinite(Number(row['Esfuerzo'])) ? Number(row['Esfuerzo']) : 0;
        }

        if (!Number.isFinite(Number(normalizedRow['Esfuerzo'])) || Number(normalizedRow['Esfuerzo']) < 0) {
            normalizedRow['Esfuerzo'] = 0;
        }

        return normalizedRow;
    });

    const warnings: string[] = [];

    if (rows.length > 0) {
        if (!columns.task.some((alias) => datasetKeys.has(normalizeKey(alias)))) {
            warnings.push('No se detectó ninguna columna equivalente a "Nombre Tarea". Agrega un alias manual o renombra la columna en tu Excel.');
        }
        if (!columns.effort.some((alias) => datasetKeys.has(normalizeKey(alias)))) {
            warnings.push('No se detectó ninguna columna equivalente a "Esfuerzo". Agrega un alias manual o renombra la columna en tu Excel.');
        }
    }

    if (missingTaskNames > 0) {
        warnings.push(`${missingTaskNames} filas no tenían nombre de tarea; se asignó un identificador temporal.`);
    }

    if (missingEffortValues > 0) {
        warnings.push(`${missingEffortValues} filas carecían de horas válidas; se asumió un esfuerzo de 0 horas.`);
    }

    return {
        tasks: normalizedTasks,
        warnings,
    };
};

export default function SchedulerApp() {
    // Configuration State
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [workHours, setWorkHours] = useState<string>('8');
    const [includeWeekends, setIncludeWeekends] = useState<boolean>(false);
    const [holidaysInput, setHolidaysInput] = useState<string>('');
    const [customTaskColumnsInput, setCustomTaskColumnsInput] = useState<string>('');
    const [customEffortColumnsInput, setCustomEffortColumnsInput] = useState<string>('');

    // Data State
    const [rawTableRows, setRawTableRows] = useState<unknown[][]>([]);
    const [fileName, setFileName] = useState<string | null>(null);
    const [sheetName, setSheetName] = useState<string>('Cronograma');
    const workbookRef = useRef<XLSX.WorkBook | null>(null);

    const columnVariants = useMemo<ColumnVariants>(() => ({
        task: mergeColumnList(DEFAULT_TASK_COLUMNS, customTaskColumnsInput),
        effort: mergeColumnList(DEFAULT_EFFORT_COLUMNS, customEffortColumnsInput),
    }), [customTaskColumnsInput, customEffortColumnsInput]);

    // Handle File Drop
    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            workbookRef.current = workbook;
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const tableRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
                header: 1,
                defval: '',
                raw: false,
            });
            setRawTableRows(tableRows);
            if (firstSheetName) {
                setSheetName(firstSheetName);
            }
        };
        reader.readAsArrayBuffer(file);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        multiple: false
    });

    const extractedDataset = useMemo<ExtractedDataset>(() => {
        return buildDatasetFromMatrix(rawTableRows, columnVariants);
    }, [rawTableRows, columnVariants]);

    const normalizationResult = useMemo(() => {
        return normalizeTaskDataset(extractedDataset.rows, columnVariants);
    }, [extractedDataset.rows, columnVariants]);

    const tasks = normalizationResult.tasks;
    const normalizationWarnings = [
        ...extractedDataset.warnings,
        ...normalizationResult.warnings,
    ];

    const parsedStartDate = useMemo(() => {
        const parsed = parseISO(startDate);
        return isValid(parsed) ? parsed : null;
    }, [startDate]);

    const startDateError = parsedStartDate ? '' : 'Ingresa una fecha válida en formato YYYY-MM-DD.';

    const workHoursValue = Number(workHours);
    const workHoursError = (() => {
        if (workHours.trim() === '') {
            return 'Ingresa la cantidad de horas por día.';
        }
        if (!Number.isFinite(workHoursValue)) {
            return 'Las horas por día deben ser un número.';
        }
        if (workHoursValue < 1 || workHoursValue > 24) {
            return 'Las horas deben estar entre 1 y 24.';
        }
        return '';
    })();
    const safeWorkHours = workHoursError ? null : workHoursValue;

    const { validHolidays, invalidHolidayTokens } = useMemo(() => {
        const tokens = holidaysInput
            .split(',')
            .map((token) => token.trim())
            .filter(Boolean);

        const valid: Date[] = [];
        const invalid: string[] = [];

        tokens.forEach((token) => {
            const parsed = parseISO(token);
            if (isValid(parsed)) {
                valid.push(parsed);
            } else {
                invalid.push(token);
            }
        });

        return {
            validHolidays: valid,
            invalidHolidayTokens: invalid,
        };
    }, [holidaysInput]);

    const hasConfigErrors = Boolean(startDateError || workHoursError);

    const processedTasks = useMemo(() => {
        if (tasks.length === 0 || !parsedStartDate || safeWorkHours === null) {
            return [];
        }

        const config: SchedulerConfig = {
            projectStartDate: parsedStartDate,
            holidays: validHolidays,
            includeWeekends,
            workHoursPerDay: safeWorkHours,
        };

        try {
            return calculateSchedule(tasks, config);
        } catch (error) {
            console.error('Error calculating schedule:', error);
            return [];
        }
    }, [tasks, parsedStartDate, safeWorkHours, includeWeekends, validHolidays]);

    // Export Handler
    const handleExport = () => {
        if (processedTasks.length === 0 || !workbookRef.current) {
            return;
        }

        const workbook = workbookRef.current;
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            console.error('No se encontró la hoja original para escribir los datos.');
            return;
        }

        const headerRowIndex = extractedDataset.headerIndex ?? 0;
        const baseHeaderRow = extractedDataset.headerRow.length > 0
            ? [...extractedDataset.headerRow]
            : (rawTableRows[headerRowIndex]?.map((value) => String(value ?? '').trim()) ?? []);
        const headerRow = [...baseHeaderRow];

        const formatDateValue = (value?: Date | string) => {
            if (!value) return '';
            const dateValue = value instanceof Date ? value : new Date(value);
            return isValid(dateValue) ? format(dateValue, 'yyyy-MM-dd') : '';
        };

        const existingRange = worksheet['!ref']
            ? XLSX.utils.decode_range(worksheet['!ref'])
            : { s: { r: headerRowIndex, c: 0 }, e: { r: headerRowIndex, c: Math.max(headerRow.length - 1, 0) } };

        let maxRowUsed = existingRange.e.r;
        let maxColUsed = existingRange.e.c;

        const updateCell = (rowIndex: number, colIndex: number, value: string) => {
            const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
            const existingCell = worksheet[address];
            if (existingCell) {
                existingCell.v = value;
                existingCell.t = 's';
            } else if (value !== '') {
                worksheet[address] = { t: 's', v: value };
            }
            maxRowUsed = Math.max(maxRowUsed, rowIndex);
            maxColUsed = Math.max(maxColUsed, colIndex);
        };

        const ensureColumnIndex = (label: string): number => {
            const normalizedLabel = normalizeKey(label);
            let index = headerRow.findIndex(
                (cell) => normalizeKey(String(cell ?? '')) === normalizedLabel
            );
            if (index === -1) {
                index = headerRow.length;
                headerRow.push(label);
            } else {
                headerRow[index] = label;
            }
            updateCell(headerRowIndex, index, label);
            return index;
        };

        const fechaInicioIndex = ensureColumnIndex('Fecha Inicio');
        const fechaFinIndex = ensureColumnIndex('Fecha Fin');

        processedTasks.forEach((task, taskIndex) => {
            const rowIndex = extractedDataset.rowMappings[taskIndex] ?? (extractedDataset.dataStartIndex + taskIndex);
            const fechaInicioValue = formatDateValue(task['Fecha Inicio'] as Date | string | undefined);
            const fechaFinValue = formatDateValue(task['Fecha Fin'] as Date | string | undefined);
            updateCell(rowIndex, fechaInicioIndex, fechaInicioValue);
            updateCell(rowIndex, fechaFinIndex, fechaFinValue);
        });

        worksheet['!ref'] = XLSX.utils.encode_range({
            s: { r: Math.min(existingRange.s.r, headerRowIndex), c: Math.min(existingRange.s.c, 0) },
            e: { r: Math.max(maxRowUsed, existingRange.e.r), c: Math.max(maxColUsed, existingRange.e.c, headerRow.length - 1) },
        });

        const exportFileName = `Cronograma_${fileName || 'export.xlsx'}`;
        XLSX.writeFile(workbook, exportFileName);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-600 p-2 rounded-lg">
                            <FileSpreadsheet className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                            Task Scheduler Pro
                        </h1>
                    </div>
                    <div className="text-sm text-slate-500">
                        Automated Excel Planning
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Sidebar Configuration */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Settings className="w-5 h-5 text-indigo-600" />
                                <h2 className="text-lg font-semibold">Configuración</h2>
                            </div>

                            <div className="space-y-5">
                                {/* Start Date */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> Fecha de Inicio
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className={cn(
                                            "w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all",
                                            startDateError ? "border-rose-400" : "border-slate-200"
                                        )}
                                    />
                                    {startDateError && (
                                        <p className="text-xs text-rose-600">{startDateError}</p>
                                    )}
                                </div>

                                {/* Work Hours */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <Clock className="w-4 h-4" /> Horas por Día
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="24"
                                        value={workHours}
                                        onChange={(e) => setWorkHours(e.target.value)}
                                        className={cn(
                                            "w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all",
                                            workHoursError ? "border-rose-400" : "border-slate-200"
                                        )}
                                    />
                                    {workHoursError && (
                                        <p className="text-xs text-rose-600">{workHoursError}</p>
                                    )}
                                </div>

                                {/* Holidays */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <Coffee className="w-4 h-4" /> Asuetos (YYYY-MM-DD)
                                    </label>
                                    <textarea
                                        value={holidaysInput}
                                        onChange={(e) => setHolidaysInput(e.target.value)}
                                        placeholder="2023-12-25, 2024-01-01"
                                        className={cn(
                                            "w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all h-24 text-sm",
                                            invalidHolidayTokens.length ? "border-amber-400" : "border-slate-200"
                                        )}
                                    />
                                    <p className="text-xs text-slate-500">Separados por comas</p>
                                    {invalidHolidayTokens.length > 0 && (
                                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                            <p className="font-medium">Fechas ignoradas:</p>
                                            <ul className="list-disc pl-4 space-y-1 mt-1">
                                                {invalidHolidayTokens.map((token, index) => (
                                                    <li key={`invalid-holiday-${token}-${index}`}>{token}</li>
                                                ))}
                                            </ul>
                                            <p className="mt-1">Verifica el formato YYYY-MM-DD.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Weekends Toggle */}
                                <div className="flex items-center justify-between pt-2">
                                    <label className="text-sm font-medium text-slate-700">Incluir Fines de Semana</label>
                                    <button
                                        onClick={() => setIncludeWeekends(!includeWeekends)}
                                        className={cn(
                                            "w-11 h-6 rounded-full transition-colors relative",
                                            includeWeekends ? "bg-indigo-600" : "bg-slate-200"
                                        )}
                                    >
                                        <span className={cn(
                                            "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform",
                                            includeWeekends ? "translate-x-5" : "translate-x-0"
                                        )} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Column Compatibility */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <ListChecks className="w-5 h-5 text-indigo-600" />
                                <h3 className="text-lg font-semibold text-slate-900">Columnas soportadas</h3>
                            </div>
                            <p className="text-sm text-slate-600">
                                La app detecta automáticamente las columnas del Excel que contengan cualquiera de los nombres listados. Agrega alias si tus archivos usan etiquetas distintas.
                            </p>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Nombre de la tarea</p>
                                    <div className="flex flex-wrap gap-2">
                                        {columnVariants.task.map((column) => (
                                            <span key={`task-${column}`} className="px-2 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700">
                                                {column}
                                            </span>
                                        ))}
                                    </div>
                                    <textarea
                                        value={customTaskColumnsInput}
                                        onChange={(e) => setCustomTaskColumnsInput(e.target.value)}
                                        placeholder="Ej: Task Title, Work Package"
                                        className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all h-20 text-sm"
                                    />
                                    <p className="text-xs text-slate-500">Escribe alias separados por comas.</p>
                                </div>
                                <div className="pt-2 border-t border-slate-100">
                                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Esfuerzo (horas)</p>
                                    <div className="flex flex-wrap gap-2">
                                        {columnVariants.effort.map((column) => (
                                            <span key={`effort-${column}`} className="px-2 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700">
                                                {column}
                                            </span>
                                        ))}
                                    </div>
                                    <textarea
                                        value={customEffortColumnsInput}
                                        onChange={(e) => setCustomEffortColumnsInput(e.target.value)}
                                        placeholder="Ej: Estimated Effort, HH Totales"
                                        className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all h-20 text-sm"
                                    />
                                    <p className="text-xs text-slate-500">Los alias se combinan con la lista base.</p>
                                </div>
                            </div>
                        </div>

                        {/* Instructions Card */}
                        <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
                            <h3 className="text-indigo-900 font-semibold mb-2 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> Importante
                            </h3>
                            <p className="text-sm text-indigo-700 leading-relaxed">
                                Asegúrate de que tu Excel tenga las columnas: <br />
                                <code className="bg-white/50 px-1 rounded">Nombre Tarea</code> y <code className="bg-white/50 px-1 rounded">Esfuerzo</code>.
                            </p>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="lg:col-span-8 space-y-6">

                        {hasConfigErrors && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-rose-900">
                                <p className="font-semibold">Configura los parámetros antes de calcular.</p>
                                <ul className="list-disc pl-6 space-y-1 mt-2 text-sm">
                                    {startDateError && <li>{startDateError}</li>}
                                    {workHoursError && <li>{workHoursError}</li>}
                                </ul>
                            </div>
                        )}

                        {normalizationWarnings.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900">
                                <div className="flex items-center gap-2 font-semibold">
                                    <AlertTriangle className="w-5 h-5" />
                                    Problemas detectados en el Excel
                                </div>
                                <ul className="mt-3 list-disc pl-6 space-y-1 text-sm">
                                    {normalizationWarnings.map((warning, index) => (
                                        <li key={`${warning}-${index}`}>{warning}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Dropzone */}
                        <div
                            {...getRootProps()}
                            className={cn(
                                "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ease-in-out group",
                                isDragActive
                                    ? "border-indigo-500 bg-indigo-50 scale-[1.02]"
                                    : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50 bg-white"
                            )}
                        >
                            <input {...getInputProps()} />
                            <div className="flex flex-col items-center gap-4">
                                <div className={cn(
                                    "p-4 rounded-full transition-colors",
                                    isDragActive ? "bg-indigo-100" : "bg-slate-100 group-hover:bg-indigo-50"
                                )}>
                                    <Upload className={cn(
                                        "w-8 h-8 transition-colors",
                                        isDragActive ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-500"
                                    )} />
                                </div>
                                <div>
                                    <p className="text-lg font-medium text-slate-700">
                                        {isDragActive ? "Suelta el archivo aquí" : "Arrastra tu Excel aquí"}
                                    </p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        o haz clic para seleccionar
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Results Preview */}
                        {processedTasks.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Vista Previa</h2>
                                        <p className="text-sm text-slate-500">{processedTasks.length} tareas procesadas</p>
                                    </div>
                                    <button
                                        onClick={handleExport}
                                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm hover:shadow-md active:scale-95"
                                    >
                                        <Download className="w-4 h-4" />
                                        Descargar Excel
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-3">Tarea</th>
                                                <th className="px-6 py-3">Esfuerzo (h)</th>
                                                <th className="px-6 py-3">Inicio</th>
                                                <th className="px-6 py-3">Fin</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {processedTasks.slice(0, 10).map((task, index) => (
                                                <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-6 py-3 font-medium text-slate-900">{task['Nombre Tarea'] || 'Sin Nombre'}</td>
                                                    <td className="px-6 py-3 text-slate-600">
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-xs font-medium">
                                                            {task['Esfuerzo']}h
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-slate-600">
                                                        {task['Fecha Inicio'] ? format(task['Fecha Inicio'], 'dd MMM yyyy') : '-'}
                                                    </td>
                                                    <td className="px-6 py-3 text-slate-600">
                                                        {task['Fecha Fin'] ? format(task['Fecha Fin'], 'dd MMM yyyy') : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {processedTasks.length > 10 && (
                                        <div className="px-6 py-3 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-200">
                                            Mostrando 10 de {processedTasks.length} tareas
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Empty State / Placeholder */}
                        {processedTasks.length === 0 && !fileName && (
                            <div className="text-center py-12">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                                    <FileSpreadsheet className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-slate-900 font-medium mb-1">Esperando archivo</h3>
                                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                    Sube un archivo Excel para comenzar a calcular tu cronograma automáticamente.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
