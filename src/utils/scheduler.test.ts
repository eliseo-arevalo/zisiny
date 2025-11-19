import { describe, it, expect } from 'vitest';
import { calculateSchedule, Task } from './scheduler';
import { parseISO, format } from 'date-fns';

describe('calculateSchedule', () => {
  const baseConfig = {
    projectStartDate: parseISO('2023-10-02'), // Monday
    holidays: [],
    includeWeekends: false,
    workHoursPerDay: 8,
  };

  it('should schedule a single task correctly', () => {
    const tasks: Task[] = [{ 'Nombre Tarea': 'Task 1', 'Esfuerzo': 8 }];
    const result = calculateSchedule(tasks, baseConfig);
    
    expect(result[0]['Fecha Inicio']).toEqual(parseISO('2023-10-02'));
    expect(result[0]['Fecha Fin']).toEqual(parseISO('2023-10-02'));
  });

  it('should accumulate hours for small tasks', () => {
    const tasks: Task[] = [
      { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 4 },
      { 'Nombre Tarea': 'Task 2', 'Esfuerzo': 4 },
    ];
    const result = calculateSchedule(tasks, baseConfig);

    // Task 1: Mon morning
    expect(result[0]['Fecha Inicio']).toEqual(parseISO('2023-10-02'));
    expect(result[0]['Fecha Fin']).toEqual(parseISO('2023-10-02'));

    // Task 2: Mon afternoon (starts same day)
    expect(result[1]['Fecha Inicio']).toEqual(parseISO('2023-10-02'));
    expect(result[1]['Fecha Fin']).toEqual(parseISO('2023-10-02'));
  });

  it('should overflow to next day correctly', () => {
    const tasks: Task[] = [
      { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 12 }, // 8h Mon + 4h Tue
    ];
    const result = calculateSchedule(tasks, baseConfig);

    expect(result[0]['Fecha Inicio']).toEqual(parseISO('2023-10-02'));
    expect(result[0]['Fecha Fin']).toEqual(parseISO('2023-10-03'));
  });

  it('should skip weekends', () => {
    // Start Friday, 16h effort (8h Fri + 8h Mon)
    const config = { ...baseConfig, projectStartDate: parseISO('2023-10-06') }; // Friday
    const tasks: Task[] = [{ 'Nombre Tarea': 'Task 1', 'Esfuerzo': 16 }];
    
    const result = calculateSchedule(tasks, config);

    expect(result[0]['Fecha Inicio']).toEqual(parseISO('2023-10-06'));
    expect(result[0]['Fecha Fin']).toEqual(parseISO('2023-10-09')); // Monday
  });

  it('should skip holidays', () => {
    // Start Mon, 8h. Tue is holiday. Next task 8h (should be Wed).
    const config = { 
      ...baseConfig, 
      holidays: [parseISO('2023-10-03')] // Tuesday
    };
    const tasks: Task[] = [
      { 'Nombre Tarea': 'Task 1', 'Esfuerzo': 8 },
      { 'Nombre Tarea': 'Task 2', 'Esfuerzo': 8 },
    ];
    
    const result = calculateSchedule(tasks, config);

    // Task 1: Mon
    expect(result[0]['Fecha Fin']).toEqual(parseISO('2023-10-02'));
    
    // Task 2: Wed (Tue skipped)
    expect(result[1]['Fecha Inicio']).toEqual(parseISO('2023-10-04'));
    expect(result[1]['Fecha Fin']).toEqual(parseISO('2023-10-04'));
  });
});
