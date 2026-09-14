export const TASK_OWNERS = ['CUSTOMER', 'ADVISOR'] as const;
export type TaskOwner = (typeof TASK_OWNERS)[number];

export const TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_OWNER_LABEL: Record<TaskOwner, string> = {
  CUSTOMER: 'Kunde',
  ADVISOR: 'Ich',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  OPEN: 'Offen',
  IN_PROGRESS: 'In Bearbeitung',
  DONE: 'Erledigt',
  CANCELLED: 'Storniert',
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Niedrig', NORMAL: 'Normal', HIGH: 'Hoch',
};

export function isOpen(status: TaskStatus): boolean {
  return status === 'OPEN' || status === 'IN_PROGRESS';
}

/** Ueberfaellig ist eine offene Aufgabe mit Faelligkeit in der Vergangenheit. */
export function isOverdue(status: TaskStatus, dueDate: string | null, today: string): boolean {
  return isOpen(status) && dueDate !== null && dueDate < today;
}
