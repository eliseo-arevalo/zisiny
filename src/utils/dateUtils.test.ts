import { describe, it, expect } from 'vitest';
import { isWeekend, isHoliday, isWorkingDay, getNextWorkingDay } from './dateUtils';

describe('dateUtils', () => {
    describe('isWeekend', () => {
        it('should return true for Saturday', () => {
            const saturday = new Date(2024, 0, 6); // Saturday, Jan 6, 2024
            expect(isWeekend(saturday)).toBe(true);
        });

        it('should return true for Sunday', () => {
            const sunday = new Date(2024, 0, 7); // Sunday, Jan 7, 2024
            expect(isWeekend(sunday)).toBe(true);
        });

        it('should return false for weekdays', () => {
            const monday = new Date(2024, 0, 1); // Monday, Jan 1, 2024
            const tuesday = new Date(2024, 0, 2); // Tuesday, Jan 2, 2024
            const wednesday = new Date(2024, 0, 3); // Wednesday, Jan 3, 2024
            const thursday = new Date(2024, 0, 4); // Thursday, Jan 4, 2024
            const friday = new Date(2024, 0, 5); // Friday, Jan 5, 2024

            expect(isWeekend(monday)).toBe(false);
            expect(isWeekend(tuesday)).toBe(false);
            expect(isWeekend(wednesday)).toBe(false);
            expect(isWeekend(thursday)).toBe(false);
            expect(isWeekend(friday)).toBe(false);
        });
    });

    describe('isHoliday', () => {
        it('should return true if date is in holidays list', () => {
            const holidays = [
                new Date(2024, 0, 1), // Jan 1, 2024
                new Date(2024, 11, 25), // Dec 25, 2024
            ];
            const newYear = new Date(2024, 0, 1);
            expect(isHoliday(newYear, holidays)).toBe(true);
        });

        it('should return false if date is not in holidays list', () => {
            const holidays = [
                new Date(2024, 0, 1), // Jan 1, 2024
            ];
            const regularDay = new Date(2024, 0, 2);
            expect(isHoliday(regularDay, holidays)).toBe(false);
        });

        it('should return false if holidays list is empty', () => {
            const someDay = new Date(2024, 0, 15);
            expect(isHoliday(someDay, [])).toBe(false);
        });

        it('should handle same day with different times', () => {
            const holidays = [new Date(2024, 0, 1, 0, 0, 0)];
            const sameDayDifferentTime = new Date(2024, 0, 1, 14, 30, 0);
            expect(isHoliday(sameDayDifferentTime, holidays)).toBe(true);
        });
    });

    describe('isWorkingDay', () => {
        const holidays = [new Date(2024, 0, 1)]; // Jan 1, 2024 (Monday)

        it('should return false for weekends when includeWeekends is false', () => {
            const saturday = new Date(2024, 0, 6);
            const sunday = new Date(2024, 0, 7);

            expect(isWorkingDay(saturday, holidays, false)).toBe(false);
            expect(isWorkingDay(sunday, holidays, false)).toBe(false);
        });

        it('should return true for weekends when includeWeekends is true', () => {
            const saturday = new Date(2024, 0, 6);
            const sunday = new Date(2024, 0, 7);

            expect(isWorkingDay(saturday, holidays, true)).toBe(true);
            expect(isWorkingDay(sunday, holidays, true)).toBe(true);
        });

        it('should return false for holidays regardless of includeWeekends', () => {
            const holiday = new Date(2024, 0, 1);

            expect(isWorkingDay(holiday, holidays, false)).toBe(false);
            expect(isWorkingDay(holiday, holidays, true)).toBe(false);
        });

        it('should return true for regular weekdays', () => {
            const tuesday = new Date(2024, 0, 2);
            expect(isWorkingDay(tuesday, holidays, false)).toBe(true);
        });

        it('should return false for weekend holiday when includeWeekends is true', () => {
            const saturdayHoliday = new Date(2024, 0, 6);
            const holidaysWithWeekend = [saturdayHoliday];

            expect(isWorkingDay(saturdayHoliday, holidaysWithWeekend, true)).toBe(false);
        });
    });

    describe('getNextWorkingDay', () => {
        it('should return next weekday when no holidays', () => {
            const monday = new Date(2024, 0, 1);
            const nextDay = getNextWorkingDay(monday, [], false);

            expect(nextDay).toEqual(new Date(2024, 0, 2)); // Tuesday
        });

        it('should skip weekend and return Monday', () => {
            const friday = new Date(2024, 0, 5);
            const nextDay = getNextWorkingDay(friday, [], false);

            expect(nextDay).toEqual(new Date(2024, 0, 8)); // Next Monday
        });

        it('should skip holidays', () => {
            const monday = new Date(2024, 0, 1);
            const holidays = [new Date(2024, 0, 2)]; // Tuesday is holiday
            const nextDay = getNextWorkingDay(monday, holidays, false);

            expect(nextDay).toEqual(new Date(2024, 0, 3)); // Wednesday
        });

        it('should skip multiple consecutive holidays and weekends', () => {
            const thursday = new Date(2024, 0, 4);
            const holidays = [
                new Date(2024, 0, 5), // Friday
                new Date(2024, 0, 8), // Monday
            ];
            const nextDay = getNextWorkingDay(thursday, holidays, false);

            // Should skip Friday (holiday), Sat, Sun (weekend), Monday (holiday)
            expect(nextDay).toEqual(new Date(2024, 0, 9)); // Tuesday
        });

        it('should work with includeWeekends=true', () => {
            const friday = new Date(2024, 0, 5);
            const nextDay = getNextWorkingDay(friday, [], true);

            expect(nextDay).toEqual(new Date(2024, 0, 6)); // Saturday
        });

        it('should throw error when no working day found after 365 iterations', () => {
            // Create a scenario where every day for next year is a holiday
            const startDate = new Date(2024, 0, 1);
            const allDaysHolidays: Date[] = [];

            // Generate 366 consecutive holidays to ensure we exceed the 365-iteration limit
            for (let i = 1; i <= 366; i++) {
                const date = new Date(2024, 0, i);
                allDaysHolidays.push(date);
            }

            expect(() => {
                getNextWorkingDay(startDate, allDaysHolidays, false);
            }).toThrow('No valid working day was found after 365 attempts');
        });

        it('should handle edge case with 364 consecutive holidays', () => {
            const startDate = new Date(2024, 0, 1);
            const manyHolidays: Date[] = [];

            // Generate 364 consecutive holidays (just under the limit)
            for (let i = 1; i <= 364; i++) {
                const date = new Date(2024, 0, i);
                manyHolidays.push(date);
            }

            // Day 365 should be a working day
            const nextDay = getNextWorkingDay(startDate, manyHolidays, true);
            expect(nextDay).toEqual(new Date(2024, 11, 30)); // Dec 30, 2024 (day 365)
        });
    });
});
