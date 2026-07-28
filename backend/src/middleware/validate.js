import { z } from 'zod';

export const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      error: 'Some fields need attention',
      fields: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join('.'), i.message])
      ),
    });
  }
  req.body = parsed.data;
  next();
};

export const schemas = {
  register: z.object({
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/\d/, 'Include a number'),
    displayName: z.string().min(1, 'What should we call you?').max(80),
    timezone: z.string().optional(),
  }),
  login: z.object({
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(1, 'Enter your password'),
  }),
  createTask: z.object({
    title: z.string().min(1, 'Give the task a name').max(200),
    description: z.string().max(5000).nullish(),
    dueDate: z.string().datetime().nullish(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    category: z.string().max(60).nullish(),
    tags: z.array(z.string().max(30)).max(20).optional(),
    calendarSync: z.boolean().optional(),
    // An RFC 5545 RRULE. Validated for real in the controller via parseRRule —
    // a regex here would either reject valid rules or admit nonsense.
    recurrence: z.string().max(400).nullish(),
  }),
  updateTask: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).nullish(),
    dueDate: z.string().datetime().nullish(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    category: z.string().max(60).nullish(),
    tags: z.array(z.string().max(30)).max(20).optional(),
    completed: z.boolean().optional(),
    calendarSync: z.boolean().optional(),
    recurrence: z.string().max(400).nullish(),
    // Which part of a series an edit or delete applies to.
    scope: z.enum(['this', 'future', 'all']).optional(),
  }),
};
