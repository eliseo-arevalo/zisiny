import { startOfDay } from 'date-fns';
import { isWorkingDay, getNextWorkingDay } from './dateUtils';

export interface Task {
    [key: string]: unknown; // Allow other properties from Excel
    __rowNum__?: number;
    'Nombre Tarea'?: string; // Adjust based on actual Excel headers
    'Esfuerzo'?: number; // Hours
    'Fecha Inicio'?: Date | string;
    'Fecha Fin'?: Date | string;
}

export interface SchedulerConfig {
    projectStartDate: Date;
    holidays: Date[];
    includeWeekends: boolean;
    workHoursPerDay: number;
}

export const calculateSchedule = (tasks: Task[], config: SchedulerConfig): Task[] => {
    const { projectStartDate, holidays, includeWeekends, workHoursPerDay } = config;

    // Validation: workHoursPerDay must be positive
    if (workHoursPerDay <= 0) {
        throw new Error('Work hours per day must be greater than 0');
    }

    // Validation: projectStartDate must be a valid date
    if (!(projectStartDate instanceof Date) || isNaN(projectStartDate.getTime())) {
        throw new Error('The project start date is not valid');
    }

    let currentDate = startOfDay(projectStartDate);
    let hoursUsedToday = 0;

    // Ensure start date is a working day
    if (!isWorkingDay(currentDate, holidays, includeWeekends)) {
        currentDate = getNextWorkingDay(currentDate, holidays, includeWeekends);
        hoursUsedToday = 0;
    }

    return tasks.map(task => {
        // Normalize effort. If missing, assume 0 to avoid infinite loops, or handle as error.
        // Assuming 'Esfuerzo' is the column name for effort in hours.
        const effort = Number(task['Esfuerzo']) || 0;

        if (effort <= 0) {
            return {
                ...task,
                'Fecha Inicio': currentDate,
                'Fecha Fin': currentDate,
            };
        }

        // Task starts on the current day (or what remains of it)
        const taskStartDate = new Date(currentDate);

        let remainingEffort = effort;

        while (remainingEffort > 0) {
            // Check if we need to move to the next day because current day is full
            if (hoursUsedToday >= workHoursPerDay) {
                currentDate = getNextWorkingDay(currentDate, holidays, includeWeekends);
                hoursUsedToday = 0;
            }

            const availableHours = workHoursPerDay - hoursUsedToday;
            const hoursToBill = Math.min(remainingEffort, availableHours);

            remainingEffort -= hoursToBill;
            hoursUsedToday += hoursToBill;
        }

        const taskEndDate = new Date(currentDate);

        // If the current day is now full, move to the next working day for the next task
        if (hoursUsedToday >= workHoursPerDay) {
            currentDate = getNextWorkingDay(currentDate, holidays, includeWeekends);
            hoursUsedToday = 0;
        }

        return {
            ...task,
            'Fecha Inicio': taskStartDate,
            'Fecha Fin': taskEndDate,
        };
    });
};
