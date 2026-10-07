import { AppError } from '../auth';
import { validMachine } from '../maintenance/repository';
import { planningMachines } from './routines-client';
export async function validatePlanningMachines(input: any): Promise<string[]> {
    const selected = planningMachines(input);
    if (!Array.isArray(selected) || !selected.length || selected.length > 1000 || selected.some(id => typeof id !== 'string' || !id)) throw new AppError('Choisissez au moins une machine.');
    const machines = [...new Set(selected)];
    for (const id of machines) await validMachine(id, input.site);
    return machines;
}
