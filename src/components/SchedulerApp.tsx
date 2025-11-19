import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import ExcelJS from 'exceljs';
import { format, parseISO, isValid, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Upload, FileSpreadsheet, Download, Settings, Clock, Coffee, AlertCircle, AlertTriangle, ListChecks, X } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { calculateSchedule } from '../utils/scheduler';
import type { Task, SchedulerConfig } from '../utils/scheduler';
import { cn } from '../lib/utils';

const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

const DEFAULT_TASK_COLUMNS = ['Nombre Tarea', 'Tarea', 'Tareas', 'Task', 'Task Name', 'Actividad', 'Descripción', 'Nombre'];
const DEFAULT_EFFORT_COLUMNS = ['Esfuerzo', 'Horas', 'Horas Estimadas', 'Effort', 'Estimated Hours', 'Duración', 'Duration'];

type HolidayEntry = {
    dateString: string;
    label?: string; // Nombre personalizado (opcional)
    date?: Date; // Fecha parseada (opcional, solo para defaults)
};

type FixedHoliday = { month: number; day: number; label: string };

const FIXED_SV_HOLIDAYS: FixedHoliday[] = [
    { month: 0, day: 1, label: 'Año Nuevo' },
    { month: 4, day: 1, label: 'Día del Trabajo' },
    { month: 4, day: 10, label: 'Día de la Madre' },
    { month: 5, day: 17, label: 'Día del Padre' },
    { month: 7, day: 6, label: 'Fiesta de San Salvador' },
    { month: 8, day: 15, label: 'Independencia' },
    { month: 10, day: 2, label: 'Día de los Muertos' },
    { month: 11, day: 25, label: 'Navidad' },
];

const getEasterDate = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
};

const getDefaultElSalvadorHolidays = (year: number): HolidayEntry[] => {
    const baseEntries = FIXED_SV_HOLIDAYS.map(({ month, day, label }) => {
        const date = new Date(year, month, day);
        return {
            date,
            dateString: format(date, 'yyyy-MM-dd'),
            label,
        };
    });

    const easterSunday = getEasterDate(year);
    const holyWeek = [
        { date: subDays(easterSunday, 3), label: 'Jueves Santo' },
        { date: subDays(easterSunday, 2), label: 'Viernes Santo' },
        { date: subDays(easterSunday, 1), label: 'Sábado Santo' },
    ].map(({ date, label }) => ({
        date,
        dateString: format(date, 'yyyy-MM-dd'),
        label,
    }));

    const uniqueMap = new Map<string, HolidayEntry>();
    [...baseEntries, ...holyWeek].forEach((entry) => {
        if (!uniqueMap.has(entry.dateString)) {
            uniqueMap.set(entry.dateString, entry);
        }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
        if (a.date && b.date) {
            return a.date.getTime() - b.date.getTime();
        }
        return a.dateString.localeCompare(b.dateString);
    });
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

const worksheetToMatrix = (worksheet: ExcelJS.Worksheet): unknown[][] => {
    const values = worksheet.getSheetValues(); // primer elemento es undefined
    const matrix: unknown[][] = [];

    for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
        const row = values[rowIndex];
        if (Array.isArray(row)) {
            matrix.push(row.slice(1));
        } else if (row && typeof row === 'object') {
            const entries = Object.entries(row)
                .map(([key, value]) => ({ index: Number(key), value }))
                .filter(({ index }) => Number.isFinite(index) && index > 0);
            const maxColumn = entries.reduce((max, entry) => Math.max(max, entry.index), 0);
            const rowValues: unknown[] = new Array(maxColumn).fill('');
            entries.forEach(({ index, value }) => {
                rowValues[index - 1] = value ?? '';
            });
            matrix.push(rowValues);
        } else {
            matrix.push([]);
        }
    }

    return matrix;
};

const parseEffortValue = (value: unknown): number | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'object') {
        const formulaResult = (value as { result?: unknown }).result;
        if (formulaResult !== undefined) {
            return parseEffortValue(formulaResult);
        }
    }

    let candidate: unknown = value;
    if (typeof candidate === 'string') {
        const normalized = candidate
            .replace(/[\sA-Za-z]/g, '')
            .replace(/,/g, '.');
        if (normalized.trim() === '') return null;
        candidate = normalized;
    }

    const numberValue = Number(candidate);
    if (Number.isFinite(numberValue) && numberValue >= 0) {
        return numberValue;
    }
    return null;
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

        const rawEffortValue = effortKey ? row[effortKey] : row['Esfuerzo'];
        const parsedEffort = parseEffortValue(rawEffortValue);
        if (parsedEffort !== null) {
            normalizedRow['Esfuerzo'] = parsedEffort;
        } else {
            missingEffortValues += 1;
            console.warn(
                'Fila sin esfuerzo válido:',
                normalizedRow['Nombre Tarea'] || `Fila #${index + 1}`,
                rawEffortValue
            );
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

const STORAGE_KEY_HOLIDAYS = 'zisingfy-holidays';

const loadHolidaysFromStorage = (): HolidayEntry[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_HOLIDAYS);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading holidays from storage:', error);
    }
    // Si no hay datos guardados, usar los por defecto
    return getDefaultElSalvadorHolidays(new Date().getFullYear()).map(entry => ({
        dateString: entry.dateString,
        label: entry.label || undefined,
    }));
};

const saveHolidaysToStorage = (holidays: HolidayEntry[]) => {
    try {
        localStorage.setItem(STORAGE_KEY_HOLIDAYS, JSON.stringify(holidays));
    } catch (error) {
        console.error('Error saving holidays to storage:', error);
    }
};

export default function SchedulerApp() {
    // Configuration State
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [workHours, setWorkHours] = useState<string>('8');
    const [includeWeekends, setIncludeWeekends] = useState<boolean>(false);
    const [holidaysEntries, setHolidaysEntries] = useState<HolidayEntry[]>(() => loadHolidaysFromStorage());
    const [isHolidaysModalOpen, setIsHolidaysModalOpen] = useState<boolean>(false);
    const [newHolidayInput, setNewHolidayInput] = useState<string>('');
    const [newHolidayLabel, setNewHolidayLabel] = useState<string>('');
    const [showHolidayInputError, setShowHolidayInputError] = useState<boolean>(false);
    const [editingHoliday, setEditingHoliday] = useState<string | null>(null);
    const [customTaskColumnsInput, setCustomTaskColumnsInput] = useState<string>('');
    const [customEffortColumnsInput, setCustomEffortColumnsInput] = useState<string>('');

    // Data State
    const [rawTableRows, setRawTableRows] = useState<unknown[][]>([]);
    const [fileName, setFileName] = useState<string | null>(null);
    const [sheetName, setSheetName] = useState<string>('Cronograma');
    const [skipLastRow, setSkipLastRow] = useState<boolean>(true);
    const workbookRef = useRef<ExcelJS.Workbook | null>(null);

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
        reader.onload = async (e) => {
            const buffer = e.target?.result;
            if (!buffer) return;

            try {
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer as ArrayBuffer);
                const worksheet = workbook.worksheets[0];
                if (!worksheet) {
                    toast.error('Error al procesar Excel', {
                        description: 'El archivo no contiene hojas válidas.',
                    });
                    return;
                }
                workbookRef.current = workbook;
                setSheetName(worksheet.name);
                setRawTableRows(worksheetToMatrix(worksheet));
                toast.success('Excel cargado exitosamente', {
                    description: `Archivo "${file.name}" procesado correctamente.`,
                });
            } catch (error) {
                console.error('Error al leer el archivo Excel:', error);
                toast.error('Error al cargar Excel', {
                    description: 'No se pudo leer el archivo. Verifica que sea un archivo .xlsx válido.',
                });
            }
        };
        reader.readAsArrayBuffer(file);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            [EXCEL_MIME_TYPE]: ['.xlsx'],
        },
        multiple: false
    });

    const extractedDataset = useMemo<ExtractedDataset>(() => {
        return buildDatasetFromMatrix(rawTableRows, columnVariants);
    }, [rawTableRows, columnVariants]);

    const adjustedDataset = useMemo<ExtractedDataset>(() => {
        if (!skipLastRow || extractedDataset.rows.length <= 1) {
            return extractedDataset;
        }
        return {
            ...extractedDataset,
            rows: extractedDataset.rows.slice(0, -1),
            rowMappings: extractedDataset.rowMappings.slice(0, -1),
        };
    }, [extractedDataset, skipLastRow]);

    const normalizationResult = useMemo(() => {
        return normalizeTaskDataset(adjustedDataset.rows, columnVariants);
    }, [adjustedDataset.rows, columnVariants]);

    const tasks = normalizationResult.tasks;
    const normalizationWarnings = [
        ...adjustedDataset.warnings,
        ...(skipLastRow && fileName && extractedDataset.rows.length > adjustedDataset.rows.length 
            ? ['Se ignoró la última fila del archivo (posible total).'] 
            : []),
        ...normalizationResult.warnings,
    ];

    const parsedStartDate = useMemo(() => {
        const parsed = parseISO(startDate);
        return isValid(parsed) ? parsed : null;
    }, [startDate]);

    const effectiveYear = parsedStartDate?.getFullYear() ?? new Date().getFullYear();
    const defaultHolidayEntries = useMemo(() => getDefaultElSalvadorHolidays(effectiveYear), [effectiveYear]);
    const defaultHolidayLabelMap = useMemo(() => {
        const map = new Map<string, string>();
        defaultHolidayEntries.forEach((entry) => {
            if (entry.label) {
                map.set(entry.dateString, entry.label);
            }
        });
        return map;
    }, [defaultHolidayEntries]);
    const configuredHolidayCount = holidaysEntries.length;

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

    // Convertir holidaysEntries a string para compatibilidad con la lógica existente
    const holidaysInput = useMemo(() => {
        return holidaysEntries.map(entry => entry.dateString).join(', ');
    }, [holidaysEntries]);

    // Guardar en localStorage cuando cambien los asuetos
    useEffect(() => {
        saveHolidaysToStorage(holidaysEntries);
    }, [holidaysEntries]);

    const { validHolidays, invalidHolidayTokens } = useMemo(() => {
        const tokens = holidaysInput
            .split(',')
            .map((token) => token.trim())
            .filter(Boolean);

        const valid: Date[] = [];
        const invalid: string[] = [];
        const dateStrings: string[] = [];

        tokens.forEach((token) => {
            const parsed = parseISO(token);
            if (isValid(parsed)) {
                valid.push(parsed);
                dateStrings.push(token);
            } else {
                invalid.push(token);
            }
        });

        return {
            validHolidays: valid,
            invalidHolidayTokens: invalid,
            holidayDateStrings: dateStrings,
        };
    }, [holidaysInput]);

    const addHoliday = useCallback((dateString: string, label?: string) => {
        const trimmed = dateString.trim();
        if (!trimmed) return;

        // Validar antes de agregar
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(trimmed)) {
            setShowHolidayInputError(true);
            return;
        }

        const parsed = parseISO(trimmed);
        if (!isValid(parsed)) {
            setShowHolidayInputError(true);
            return;
        }

        // Verificar que no esté ya agregada
        if (holidaysEntries.some(entry => entry.dateString === trimmed)) {
            setShowHolidayInputError(true);
            return;
        }

        // Agregar la fecha con su nombre
        const newEntry: HolidayEntry = {
            dateString: trimmed,
            label: label?.trim() || undefined,
        };
        setHolidaysEntries([...holidaysEntries, newEntry].sort((a, b) => 
            a.dateString.localeCompare(b.dateString)
        ));
        setNewHolidayInput('');
        setNewHolidayLabel('');
        setShowHolidayInputError(false);
    }, [holidaysEntries]);

    const removeHoliday = useCallback((dateString: string) => {
        setHolidaysEntries(holidaysEntries.filter(entry => entry.dateString !== dateString));
    }, [holidaysEntries]);

    const updateHolidayLabel = useCallback((dateString: string, label: string) => {
        setHolidaysEntries(holidaysEntries.map(entry => 
            entry.dateString === dateString 
                ? { ...entry, label: label.trim() || undefined }
                : entry
        ));
        setEditingHoliday(null);
    }, [holidaysEntries]);

    // Función para formatear el input con guiones automáticamente
    const formatDateInput = useCallback((value: string): string => {
        // Remover todo lo que no sean dígitos
        const digits = value.replace(/\D/g, '');
        
        // Limitar a 8 dígitos (YYYYMMDD)
        const limited = digits.slice(0, 8);
        
        // Agregar guiones en las posiciones correctas
        if (limited.length <= 4) {
            return limited;
        } else if (limited.length <= 6) {
            return `${limited.slice(0, 4)}-${limited.slice(4)}`;
        } else {
            return `${limited.slice(0, 4)}-${limited.slice(4, 6)}-${limited.slice(6)}`;
        }
    }, []);

    // Validación del input de nueva fecha
    const newHolidayInputError = useMemo(() => {
        if (!newHolidayInput.trim()) return null;
        
        // Solo mostrar error si el formato está completo (10 caracteres) o si se intentó guardar
        const isComplete = newHolidayInput.trim().length === 10;
        if (!isComplete && !showHolidayInputError) {
            return null;
        }
        
        // Verificar formato YYYY-MM-DD
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(newHolidayInput.trim())) {
            return 'Formato inválido. Usa YYYY-MM-DD (ej: 2025-01-15)';
        }
        
        // Verificar que sea una fecha válida
        const parsed = parseISO(newHolidayInput.trim());
        if (!isValid(parsed)) {
            return 'Fecha inválida. Verifica que el día y mes sean correctos.';
        }
        
        // Verificar que no esté ya agregada
        const currentDates = holidaysInput
            .split(',')
            .map((token) => token.trim())
            .filter(Boolean);
        
        if (currentDates.includes(newHolidayInput.trim())) {
            return 'Esta fecha ya está agregada.';
        }
        
        return null;
    }, [newHolidayInput, holidaysInput, showHolidayInputError]);

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

    // Notificar cuando se procesen las tareas
    const hasProcessedRef = useRef(false);
    useEffect(() => {
        if (processedTasks.length > 0 && tasks.length > 0 && !hasProcessedRef.current) {
            hasProcessedRef.current = true;
            toast.success('Tareas procesadas exitosamente', {
                description: `Se calcularon las fechas para ${processedTasks.length} tareas.`,
            });
        } else if (processedTasks.length === 0 && tasks.length === 0) {
            hasProcessedRef.current = false;
        }
    }, [processedTasks.length, tasks.length]);

    // Export Handler
    const handleExport = async () => {
        if (processedTasks.length === 0 || !workbookRef.current) {
            return;
        }

        const workbook = workbookRef.current;
        const worksheet = workbook.getWorksheet(sheetName);
        if (!worksheet) {
            console.error('No se encontró la hoja original para escribir los datos.');
            return;
        }

        const headerRowIndex = (extractedDataset.headerIndex ?? 0) + 1; // ExcelJS es 1-based
        const baseHeaderRow = extractedDataset.headerRow.length > 0
            ? [...extractedDataset.headerRow]
            : (rawTableRows[headerRowIndex - 1]?.map((value) => String(value ?? '').trim()) ?? []);
        const headerRow = [...baseHeaderRow];

        const formatDateValue = (value?: Date | string) => {
            if (!value) return '';
            const dateValue = value instanceof Date ? value : new Date(value);
            return isValid(dateValue) ? format(dateValue, 'yyyy-MM-dd') : '';
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
            worksheet.getRow(headerRowIndex).getCell(index + 1).value = label;
            return index;
        };

        const fechaInicioIndex = ensureColumnIndex('Fecha Inicio');
        const fechaFinIndex = ensureColumnIndex('Fecha Fin');

        processedTasks.forEach((task, taskIndex) => {
            const sourceRowIndex = adjustedDataset.rowMappings[taskIndex] ?? (adjustedDataset.dataStartIndex + taskIndex);
            const excelRowIndex = sourceRowIndex + 1;
            const row = worksheet.getRow(excelRowIndex);
            const fechaInicioValue = formatDateValue(task['Fecha Inicio'] as Date | string | undefined);
            const fechaFinValue = formatDateValue(task['Fecha Fin'] as Date | string | undefined);
            row.getCell(fechaInicioIndex + 1).value = fechaInicioValue || null;
            row.getCell(fechaFinIndex + 1).value = fechaFinValue || null;
            row.commit?.();
        });

        const exportFileName = `Cronograma_${fileName || 'export.xlsx'}`;
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = exportFileName;
        link.click();
        URL.revokeObjectURL(url);
        
        toast.success('Archivo descargado exitosamente', {
            description: `El archivo "${exportFileName}" se ha descargado correctamente.`,
        });
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
                            Zisiny
                        </h1>
                    </div>
                    <div className="text-sm text-slate-500 text-right">
                        {fileName ? (
                            <div>
                                <p className="font-semibold text-slate-700">{fileName}</p>
                                <p className="text-xs text-slate-500">Hoja activa: {sheetName}</p>
                            </div>
                        ) : (
                            <span>Planificador inteligente desde Excel</span>
                        )}
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
                                        <Coffee className="w-4 h-4" /> Asuetos
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setIsHolidaysModalOpen(true)}
                                        className="w-full px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-indigo-700 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Configurar Asuetos
                                        {configuredHolidayCount > 0 && (
                                            <span className="ml-2 px-2 py-0.5 bg-indigo-200 rounded-full text-xs">
                                                {configuredHolidayCount} configurados
                                            </span>
                                        )}
                                    </button>
                                    <p className="text-xs text-slate-500">Define los días no laborables del proyecto</p>
                                </div>

                                {/* Weekends Toggle */}
                                <div className="space-y-1 pt-2">
                                    <div className="flex items-center justify-between">
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
                                    <p className="text-xs text-slate-500">Actívalo si tu equipo trabaja sábados o domingos.</p>
                                </div>

                                {/* Skip Last Row Toggle */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-slate-700">Ignorar última fila (totales)</label>
                                        <button
                                            onClick={() => setSkipLastRow(!skipLastRow)}
                                            className={cn(
                                                "w-11 h-6 rounded-full transition-colors relative",
                                                skipLastRow ? "bg-indigo-600" : "bg-slate-200"
                                            )}
                                        >
                                            <span className={cn(
                                                "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform",
                                                skipLastRow ? "translate-x-5" : "translate-x-0"
                                            )} />
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Útil cuando la última fila del Excel corresponde a totales o sumatorias.
                                    </p>
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
                            <p className="text-xs text-indigo-600 mt-3">
                                Para mantener estilos y formatos, sube archivos en formato <code className="bg-white/50 px-1 rounded">.xlsx</code>.
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
                                "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ease-in-out group",
                                isDragActive
                                    ? "border-indigo-500 bg-indigo-50 scale-[1.02]"
                                    : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50 bg-white"
                            )}
                        >
                            <input {...getInputProps()} />
                            {fileName ? (
                                <div className="space-y-3">
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Archivo cargado</p>
                                    <p className="text-lg font-semibold text-slate-800">{fileName}</p>
                                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 justify-center">
                                        <span>Hoja: <strong className="text-slate-700">{sheetName}</strong></span>
                                        <span>Tareas detectadas: <strong className="text-slate-700">{tasks.length || '0'}</strong></span>
                                        <span>Ignorar última fila: <strong className="text-slate-700">{skipLastRow ? 'Sí' : 'No'}</strong></span>
                                    </div>
                                    <p className="text-xs text-slate-400">Arrastra otro .xlsx para reemplazarlo o haz clic para seleccionar.</p>
                                </div>
                            ) : (
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
                            )}
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
                                        onClick={() => { void handleExport(); }}
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
                                            {processedTasks.map((task, index) => (
                                                <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-6 py-3 font-medium text-slate-900">{task['Nombre Tarea'] || 'Sin Nombre'}</td>
                                                    <td className="px-6 py-3 text-slate-600">
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-xs font-medium">
                                                            {task['Esfuerzo']}h
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-slate-600">
                                                        {task['Fecha Inicio'] ? format(task['Fecha Inicio'], 'dd MMM yyyy', { locale: es }) : '-'}
                                                    </td>
                                                    <td className="px-6 py-3 text-slate-600">
                                                        {task['Fecha Fin'] ? format(task['Fecha Fin'], 'dd MMM yyyy', { locale: es }) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
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

            {/* Holidays Modal */}
            {isHolidaysModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => {
                    setIsHolidaysModalOpen(false);
                    setNewHolidayInput('');
                    setNewHolidayLabel('');
                    setShowHolidayInputError(false);
                }}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <Coffee className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900">Configurar Asuetos</h2>
                                    <p className="text-sm text-slate-500">Define los días no laborables del proyecto</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setIsHolidaysModalOpen(false);
                                    setNewHolidayInput('');
                                    setNewHolidayLabel('');
                                    setShowHolidayInputError(false);
                                }}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                aria-label="Cerrar"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="space-y-4">
                                {/* Input para agregar nueva fecha */}
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 block mb-2">
                                            Agregar fecha de asueto (YYYY-MM-DD)
                                        </label>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={newHolidayInput}
                                                    onChange={(e) => {
                                                        const formatted = formatDateInput(e.target.value);
                                                        setNewHolidayInput(formatted);
                                                        // Resetear el error cuando el usuario empiece a escribir
                                                        if (showHolidayInputError && formatted.length < 10) {
                                                            setShowHolidayInputError(false);
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !newHolidayInputError && newHolidayInput.trim().length === 10) {
                                                            e.preventDefault();
                                                            addHoliday(newHolidayInput, newHolidayLabel);
                                                        } else if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            setShowHolidayInputError(true);
                                                        }
                                                    }}
                                                    placeholder="YYYY-MM-DD"
                                                    className={cn(
                                                        "w-full px-4 py-2.5 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-mono",
                                                        newHolidayInputError
                                                            ? "border-red-400 focus:ring-red-500 focus:border-red-500"
                                                            : "border-slate-200"
                                                    )}
                                                />
                                                {newHolidayInputError && (
                                                    <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                        {newHolidayInputError}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (newHolidayInput.trim().length === 10) {
                                                        setShowHolidayInputError(true);
                                                    }
                                                    addHoliday(newHolidayInput, newHolidayLabel);
                                                }}
                                                disabled={!newHolidayInput.trim()}
                                                className={cn(
                                                    "px-6 py-2.5 rounded-lg transition-colors text-sm font-medium",
                                                    !newHolidayInput.trim()
                                                        ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                                                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                                                )}
                                            >
                                                Agregar
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 block mb-2">
                                            Nombre del asueto (opcional)
                                        </label>
                                        <input
                                            type="text"
                                            value={newHolidayLabel}
                                            onChange={(e) => setNewHolidayLabel(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !newHolidayInputError && newHolidayInput.trim().length === 10) {
                                                    e.preventDefault();
                                                    addHoliday(newHolidayInput, newHolidayLabel);
                                                }
                                            }}
                                            placeholder="Ej: Día de la Independencia"
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                                        />
                                    </div>
                                    {!newHolidayInputError && (
                                        <p className="text-xs text-slate-500">Presiona Enter o haz clic en "Agregar" para añadir la fecha</p>
                                    )}
                                </div>

                                {/* Tags de feriados activos */}
                                {holidaysEntries.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium text-slate-700 mb-3">
                                            Asuetos configurados ({holidaysEntries.length}):
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {holidaysEntries.map((entry) => {
                                                const date = parseISO(entry.dateString);
                                                const defaultLabel = defaultHolidayLabelMap.get(entry.dateString);
                                                const isDefault = defaultLabel !== undefined;
                                                const displayLabel = entry.label || defaultLabel || '';
                                                const isEditing = editingHoliday === entry.dateString;
                                                
                                                return (
                                                    <div
                                                        key={`holiday-${entry.dateString}`}
                                                        className="group relative"
                                                    >
                                                        {isEditing ? (
                                                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-300">
                                                                <input
                                                                    type="text"
                                                                    defaultValue={entry.label || ''}
                                                                    onBlur={(e) => updateHolidayLabel(entry.dateString, e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            updateHolidayLabel(entry.dateString, e.currentTarget.value);
                                                                        } else if (e.key === 'Escape') {
                                                                            setEditingHoliday(null);
                                                                        }
                                                                    }}
                                                                    autoFocus
                                                                    className="bg-white px-2 py-1 rounded text-sm outline-none border border-indigo-400 min-w-[120px]"
                                                                    placeholder="Nombre del asueto"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span
                                                                className={cn(
                                                                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                                                    isDefault
                                                                        ? "bg-indigo-100 text-indigo-800 cursor-help"
                                                                        : "bg-slate-100 text-slate-700"
                                                                )}
                                                                title={displayLabel}
                                                            >
                                                                <span>{format(date, 'dd MMM yyyy', { locale: es })}</span>
                                                                {displayLabel && (
                                                                    <span className="text-xs opacity-75">({displayLabel})</span>
                                                                )}
                                                                {!isDefault && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingHoliday(entry.dateString)}
                                                                        className="ml-0.5 hover:bg-black/10 rounded px-1 text-xs"
                                                                        aria-label="Editar nombre"
                                                                        title="Editar nombre"
                                                                    >
                                                                        ✏️
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeHoliday(entry.dateString)}
                                                                    className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors"
                                                                    aria-label="Eliminar feriado"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </span>
                                                        )}
                                                        {isDefault && !isEditing && (
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                                                                {defaultLabel}
                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Feriados por defecto de El Salvador (referencia) */}
                                {(() => {
                                    const currentDateStrings = new Set(holidaysEntries.map(e => e.dateString));
                                    const missingDefaults = defaultHolidayEntries.filter(
                                        (holiday) => !currentDateStrings.has(holiday.dateString)
                                    );
                                    if (missingDefaults.length === 0) return null;
                                    
                                    return (
                                        <div className="pt-4 border-t border-slate-200">
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-sm font-medium text-slate-700">
                                                    Feriados de El Salvador {effectiveYear} (no incluidos):
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newEntries: HolidayEntry[] = missingDefaults.map(holiday => ({
                                                            dateString: holiday.dateString,
                                                            label: holiday.label,
                                                        }));
                                                        setHolidaysEntries([...holidaysEntries, ...newEntries].sort((a, b) => 
                                                            a.dateString.localeCompare(b.dateString)
                                                        ));
                                                    }}
                                                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                                                >
                                                    Agregar todos
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {missingDefaults.map((holiday) => (
                                                    <div
                                                        key={`holiday-default-${holiday.dateString}`}
                                                        className="group relative"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => addHoliday(holiday.dateString, typeof holiday.label === 'string' ? holiday.label : undefined)}
                                                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-800 cursor-pointer transition-colors"
                                                            title={`Click para agregar: ${holiday.label || ''}`}
                                                        >
                                                            {holiday.date ? format(holiday.date, 'dd MMM yyyy', { locale: es }) : format(parseISO(holiday.dateString), 'dd MMM yyyy', { locale: es })}
                                                        </button>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                                                            {holiday.label}
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Invalid Holidays Display */}
                                {invalidHolidayTokens.length > 0 && (
                                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4">
                                        <p className="font-medium mb-2">Fechas inválidas ({invalidHolidayTokens.length}):</p>
                                        <ul className="list-disc pl-4 space-y-1">
                                            {invalidHolidayTokens.map((token, index) => (
                                                <li key={`invalid-holiday-${token}-${index}`} className="font-mono">{token}</li>
                                            ))}
                                        </ul>
                                        <p className="mt-2">Usa el formato YYYY-MM-DD.</p>
                                    </div>
                                )}

                                {/* Info Box */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm text-blue-800">
                                        <strong>Tip:</strong> Los asuetos se excluyen del cálculo del cronograma. 
                                        Pasa el cursor sobre los feriados por defecto para ver su nombre.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => {
                                    setHolidaysEntries([]);
                                    setNewHolidayInput('');
                                    setNewHolidayLabel('');
                                    setShowHolidayInputError(false);
                                    setIsHolidaysModalOpen(false);
                                }}
                                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                            >
                                Limpiar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setNewHolidayInput('');
                                    setNewHolidayLabel('');
                                    setShowHolidayInputError(false);
                                    setIsHolidaysModalOpen(false);
                                    toast.success('Configuración guardada', {
                                        description: `Se han guardado ${holidaysEntries.length} asuetos correctamente.`,
                                    });
                                }}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <Toaster position="top-right" richColors />
        </div>
    );
}
