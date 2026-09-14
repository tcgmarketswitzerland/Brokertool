import { z } from 'zod';
import { TASK_OWNERS, TASK_PRIORITIES, TASK_STATUSES } from '@/domain/task/types';

export const taskSchema = z.object({
  customerId: z.union([z.uuid(), z.literal('')]).optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  sessionId: z.union([z.uuid(), z.literal('')]).optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  sessionTopicId: z.union([z.uuid(), z.literal('')]).optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  ownerType: z.enum(TASK_OWNERS),
  title: z.string().trim().min(1, 'Titel fehlt').max(300),
  description: z.string().trim().max(2000).optional()
    .transform((v) => (v === '' ? undefined : v)),
  priority: z.enum(TASK_PRIORITIES).default('NORMAL'),
  dueDate: z.string().optional().transform((v) => (v === '' ? undefined : v)),
});

export const taskStatusSchema = z.object({
  taskId: z.uuid(),
  status: z.enum(TASK_STATUSES),
});

export type TaskActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string };
