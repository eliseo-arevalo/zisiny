import { isSaturday, isSunday, addDays, isSameDay } from 'date-fns';

export const isWeekend = (date: Date): boolean => {
    return isSaturday(date) || isSunday(date);
};

export const isHoliday = (date: Date, holidays: Date[]): boolean => {
    return holidays.some(holiday => isSameDay(date, holiday));
};

export const isWorkingDay = (date: Date, holidays: Date[], includeWeekends: boolean): boolean => {
    if (!includeWeekends && isWeekend(date)) {
        return false;
    }
    if (isHoliday(date, holidays)) {
        return false;
    }
    return true;
};

export const getNextWorkingDay = (
    date: Date,
    holidays: Date[],
    includeWeekends: boolean
): Date => {
    let nextDate = addDays(date, 1);
    let iterations = 0;
    const MAX_ITERATIONS = 365; // Prevent infinite loop if all days are holidays

    while (!isWorkingDay(nextDate, holidays, includeWeekends)) {
        iterations++;
        if (iterations > MAX_ITERATIONS) {
            throw new Error(
                'No se encontró un día laboral válido después de 365 intentos. ' +
                'Verifica que no todos los días del año sean asuetos.'
            );
        }
        nextDate = addDays(nextDate, 1);
    }
    return nextDate;
};
