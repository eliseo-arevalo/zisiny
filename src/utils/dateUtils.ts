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
    while (!isWorkingDay(nextDate, holidays, includeWeekends)) {
        nextDate = addDays(nextDate, 1);
    }
    return nextDate;
};
