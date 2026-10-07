export type Assignment = { mode: 'any' | 'all' | 'named'; users: string[] };
export type Teammate = { id: string; name: string; role: string; planning_create?: number };
export type Requirement = {
    part: string | null;
    order: string | null;
    quantity: number;
};
export type Plan = {
    notifyEmail?: boolean;
    assignment?: Assignment;
    instructions?: string;
    id: string;
    site: string;
    name: string;
    machine: string;
    machines?: string[];
    date: string;
    time: string;
    work: string;
    requirements: Requirement[];
    equipment: string;
    equipmentReady: boolean;
    status: 'planned' | 'done';
    revision: number;
    createdAt: string;
    reportId?: string | null;
    completedAt?: string | null;
};
export type PlanView = Plan & {
    ready: boolean;
    blockers: string[];
    machineName: string;
    parts: {
        part: string;
        name: string;
        reference: string;
        quantity: number;
    }[];
};
export type Routine = {
    emailReminder?: 'none' | 'same' | 'before' | 'both';
    assignment?: Assignment;
    instructions?: string;
    id: string;
    site: string;
    name: string;
    machine: string;
    machines?: string[];
    start: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    revision: number;
};
export type RoutineDone = {
    routine: string;
    date: string;
    actor: string;
    completedAt: string;
};
