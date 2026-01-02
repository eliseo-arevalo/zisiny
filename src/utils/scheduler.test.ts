import { describe, it, expect } from 'vitest';
import { calculateSchedule, type Task, type SchedulerConfig } from './scheduler';

describe('scheduler', () => {
    describe('calculateSchedule - Validations', () => {
        it('should throw error when workHoursPerDay is 0', () => {
            const tasks: Task[] = [{ 'Nombre Tarea': 'Task 1', 'Esfuerzo': 8 }];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2), // Tuesday
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 0,
            };

            expect(() => calculateSchedule(tasks, config)).toThrow(
                'Las horas de trabajo por día deben ser mayores a 0'
            );
        });

        it('should throw error when workHoursPerDay is negative', () => {
            const tasks: Task[] = [{ 'Nombre Tarea': 'Task 1', 'Esfuerzo': 8 }];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2),
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: -5,
            };

            expect(() => calculateSchedule(tasks, config)).toThrow(
                'Las horas de trabajo por día deben ser mayores a 0'
            );
        });

        it('should throw error when projectStartDate is invalid', () => {
            const tasks: Task[] = [{ 'Nombre Tarea': 'Task 1', 'Esfuerzo': 8 }];
            const config: SchedulerConfig = {
                projectStartDate: new Date('invalid'),
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            expect(() => calculateSchedule(tasks, config)).toThrow(
                'La fecha de inicio del proyecto no es válida'
            );
        });
    });

    describe('calculateSchedule - Hour Accumulation', () => {
        it('should accumulate multiple tasks in the same day', () => {
            const tasks: Task[] = [
                { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 4 },
                { 'Nombre Tarea': 'Task 2', 'Esfuerzo': 4 },
            ];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2), // Tuesday
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // Both tasks should start and end on the same day
            expect(result[0]['Fecha Inicio']).toEqual(new Date(2024, 0, 2));
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 2));
            expect(result[1]['Fecha Inicio']).toEqual(new Date(2024, 0, 2));
            expect(result[1]['Fecha Fin']).toEqual(new Date(2024, 0, 2));
        });

        it('should move to next day when current day is full', () => {
            const tasks: Task[] = [
                { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 8 },
                { 'Nombre Tarea': 'Task 2', 'Esfuerzo': 4 },
            ];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2), // Tuesday
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // Task 1 should be on Tuesday
            expect(result[0]['Fecha Inicio']).toEqual(new Date(2024, 0, 2));
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 2));

            // Task 2 should be on Wednesday
            expect(result[1]['Fecha Inicio']).toEqual(new Date(2024, 0, 3));
            expect(result[1]['Fecha Fin']).toEqual(new Date(2024, 0, 3));
        });

        it('should handle partial day usage', () => {
            const tasks: Task[] = [
                { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 3 },
                { 'Nombre Tarea': 'Task 2', 'Esfuerzo': 2 },
                { 'Nombre Tarea': 'Task 3', 'Esfuerzo': 3 },
                { 'Nombre Tarea': 'Task 4', 'Esfuerzo': 1 },
            ];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2), // Tuesday
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // Tasks 1, 2, 3 should be on Tuesday (3+2+3=8 hours)
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 2));
            expect(result[1]['Fecha Fin']).toEqual(new Date(2024, 0, 2));
            expect(result[2]['Fecha Fin']).toEqual(new Date(2024, 0, 2));

            // Task 4 should be on Wednesday
            expect(result[3]['Fecha Inicio']).toEqual(new Date(2024, 0, 3));
            expect(result[3]['Fecha Fin']).toEqual(new Date(2024, 0, 3));
        });
    });

    describe('calculateSchedule - Multi-day Tasks', () => {
        it('should handle task spanning multiple days', () => {
            const tasks: Task[] = [{ 'Nombre Tarea': 'Long Task', 'Esfuerzo': 20 }];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2), // Tuesday
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // Task should start on Tuesday
            expect(result[0]['Fecha Inicio']).toEqual(new Date(2024, 0, 2));

            // Task should end on Thursday (8+8+4 = 20 hours)
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 4));
        });

        it('should handle task starting mid-day and spanning to next day', () => {
            const tasks: Task[] = [
                { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 5 },
                { 'Nombre Tarea': 'Task 2', 'Esfuerzo': 10 },
            ];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2), // Tuesday
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // Task 1: 5 hours on Tuesday
            expect(result[0]['Fecha Inicio']).toEqual(new Date(2024, 0, 2));
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 2));

            // Task 2: starts on Tuesday (3 remaining hours), continues Wed (7h remaining), ends Wed
            // Calculation: 3h on Tue + 7h on Wed = 10h total
            expect(result[1]['Fecha Inicio']).toEqual(new Date(2024, 0, 2));
            expect(result[1]['Fecha Fin']).toEqual(new Date(2024, 0, 3)); // Wednesday
        });
    });

    describe('calculateSchedule - Edge Cases', () => {
        it('should handle task with 0 effort', () => {
            const tasks: Task[] = [{ 'Nombre Tarea': 'Zero Task', 'Esfuerzo': 0 }];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2),
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // Task should start and end on same day
            expect(result[0]['Fecha Inicio']).toEqual(new Date(2024, 0, 2));
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 2));
        });

        it('should handle missing effort (undefined)', () => {
            const tasks: Task[] = [{ 'Nombre Tarea': 'No Effort Task' }];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2),
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            expect(result[0]['Fecha Inicio']).toEqual(new Date(2024, 0, 2));
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 2));
        });

        it('should handle empty task list', () => {
            const tasks: Task[] = [];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2),
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            expect(result).toEqual([]);
        });

        it('should preserve original task properties', () => {
            const tasks: Task[] = [
                {
                    'Nombre Tarea': 'Task 1',
                    'Esfuerzo': 4,
                    __rowNum__: 5,
                    'Custom Field': 'Custom Value',
                },
            ];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2),
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            expect(result[0].__rowNum__).toBe(5);
            expect(result[0]['Custom Field']).toBe('Custom Value');
            expect(result[0]['Nombre Tarea']).toBe('Task 1');
        });
    });

    describe('calculateSchedule - Weekend Handling', () => {
        it('should skip weekends when includeWeekends is false', () => {
            const tasks: Task[] = [
                { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 8 },
                { 'Nombre Tarea': 'Task 2', 'Esfuerzo': 8 },
            ];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 5), // Friday
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // Task 1 should be on Friday
            expect(result[0]['Fecha Inicio']).toEqual(new Date(2024, 0, 5));
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 5));

            // Task 2 should skip weekend and be on Monday
            expect(result[1]['Fecha Inicio']).toEqual(new Date(2024, 0, 8)); // Monday
            expect(result[1]['Fecha Fin']).toEqual(new Date(2024, 0, 8));
        });

        it('should work on weekends when includeWeekends is true', () => {
            const tasks: Task[] = [
                { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 8 },
                { 'Nombre Tarea': 'Task 2', 'Esfuerzo': 8 },
            ];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 5), // Friday
                holidays: [],
                includeWeekends: true,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // Task 1 on Friday
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 5));
            // Task 2 on Saturday
            expect(result[1]['Fecha Inicio']).toEqual(new Date(2024, 0, 6));
            expect(result[1]['Fecha Fin']).toEqual(new Date(2024, 0, 6));
        });

        it('should move start date to Monday if project starts on weekend', () => {
            const tasks: Task[] = [{ 'Nombre Tarea': 'Task 1', 'Esfuerzo': 8 }];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 6), // Saturday
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // Should start on Monday
            expect(result[0]['Fecha Inicio']).toEqual(new Date(2024, 0, 8));
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 8));
        });
    });

    describe('calculateSchedule - Holiday Handling', () => {
        it('should skip holidays', () => {
            const tasks: Task[] = [
                { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 8 },
                { 'Nombre Tarea': 'Task 2', 'Esfuerzo': 8 },
            ];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2), // Tuesday
                holidays: [new Date(2024, 0, 3)], // Wednesday is holiday
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // Task 1 on Tuesday
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 2));

            // Task 2 should skip Wednesday (holiday) and be on Thursday
            expect(result[1]['Fecha Inicio']).toEqual(new Date(2024, 0, 4)); // Thursday
            expect(result[1]['Fecha Fin']).toEqual(new Date(2024, 0, 4));
        });

        it('should skip multiple consecutive holidays', () => {
            const tasks: Task[] = [
                { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 8 },
                { 'Nombre Tarea': 'Task 2', 'Esfuerzo': 8 },
            ];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2), // Tuesday
                holidays: [
                    new Date(2024, 0, 3), // Wednesday
                    new Date(2024, 0, 4), // Thursday
                    new Date(2024, 0, 5), // Friday
                ],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // Task 1 on Tuesday
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 2));

            // Task 2 should skip Wed-Fri (holidays) and weekend, be on next Monday
            expect(result[1]['Fecha Inicio']).toEqual(new Date(2024, 0, 8)); // Next Monday
            expect(result[1]['Fecha Fin']).toEqual(new Date(2024, 0, 8));
        });

        it('should move start date to next working day if starts on holiday', () => {
            const tasks: Task[] = [{ 'Nombre Tarea': 'Task 1', 'Esfuerzo': 8 }];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 1), // Monday (New Year)
                holidays: [new Date(2024, 0, 1)],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // Should start on Tuesday
            expect(result[0]['Fecha Inicio']).toEqual(new Date(2024, 0, 2));
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 2));
        });
    });

    describe('calculateSchedule - Complex Scenarios', () => {
        it('should handle complex scenario with holidays, weekends, and multi-day tasks', () => {
            const tasks: Task[] = [
                { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 6 },
                { 'Nombre Tarea': 'Task 2', 'Esfuerzo': 10 },
                { 'Nombre Tarea': 'Task 3', 'Esfuerzo': 4 },
            ];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 4), // Thursday
                holidays: [new Date(2024, 0, 5)], // Friday is holiday
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // Task 1: 6 hours on Thursday
            expect(result[0]['Fecha Inicio']).toEqual(new Date(2024, 0, 4));
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 4));

            // Task 2: 2h on Thu, skip Fri (holiday) + weekend, 8h on Mon, ends Mon
            // Calculation: 2h on Thu + 8h on Mon = 10h total
            expect(result[1]['Fecha Inicio']).toEqual(new Date(2024, 0, 4)); // Thursday
            expect(result[1]['Fecha Fin']).toEqual(new Date(2024, 0, 8)); // Monday

            // Task 3: 4 hours on Tuesday (after Task 2 completes Monday)
            expect(result[2]['Fecha Inicio']).toEqual(new Date(2024, 0, 9)); // Tuesday
            expect(result[2]['Fecha Fin']).toEqual(new Date(2024, 0, 9));
        });

        it('should handle different work hours per day', () => {
            const tasks: Task[] = [
                { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 4 },
                { 'Nombre Tarea': 'Task 2', 'Esfuerzo': 4 },
            ];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2), // Tuesday
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 4, // Only 4 hours per day
            };

            const result = calculateSchedule(tasks, config);

            // Task 1 on Tuesday
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 2));

            // Task 2 on Wednesday (can't fit in same day with 4h limit)
            expect(result[1]['Fecha Inicio']).toEqual(new Date(2024, 0, 3));
            expect(result[1]['Fecha Fin']).toEqual(new Date(2024, 0, 3));
        });

        it('should handle very large effort spanning many days', () => {
            const tasks: Task[] = [{ 'Nombre Tarea': 'Huge Task', 'Esfuerzo': 80 }];
            const config: SchedulerConfig = {
                projectStartDate: new Date(2024, 0, 2), // Tuesday
                holidays: [],
                includeWeekends: false,
                workHoursPerDay: 8,
            };

            const result = calculateSchedule(tasks, config);

            // 80 hours / 8 hours per day = 10 working days
            // Starting Tuesday Jan 2: Tue-Fri (4 days) + Mon-Fri (5 days) + Mon (1 day)
            expect(result[0]['Fecha Inicio']).toEqual(new Date(2024, 0, 2)); // Jan 2
            expect(result[0]['Fecha Fin']).toEqual(new Date(2024, 0, 15)); // Jan 15 (Monday)
        });
    });
});
