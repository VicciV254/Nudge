import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/calendarController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { wrap } from '../middleware/errorHandler.js';

const router = Router();

// The webhook is called by Google, not the browser: no bearer token, and it
// must be registered BEFORE requireAuth.
router.post('/webhook', wrap(ctrl.webhook));

router.use(requireAuth);

router.get('/status', wrap(ctrl.status));
router.get('/connect', wrap(ctrl.connect));
router.get('/calendars', wrap(ctrl.calendars));
router.post('/disconnect', wrap(ctrl.disconnect));
router.post('/sync', wrap(ctrl.syncNow));
router.post('/tasks/:id/push', wrap(ctrl.pushOne));

router.patch(
  '/settings',
  validate(
    z.object({
      calendarId: z.string().max(200).optional(),
      direction: z.enum(['both', 'push', 'pull']).optional(),
      reminderMinutes: z.number().int().min(0).max(40320).optional(),
      enabled: z.boolean().optional(),
    })
  ),
  wrap(ctrl.updateSettings)
);

router.post(
  '/tasks/:id/resolve',
  validate(z.object({ keep: z.enum(['google', 'nudge']) })),
  wrap(ctrl.resolveConflict)
);

export default router;
