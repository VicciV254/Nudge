import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/authController.js';
import { callback as googleCallback } from '../controllers/calendarController.js';
import { validate, schemas } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap } from '../middleware/errorHandler.js';

const router = Router();

// Credential endpoints get their own tighter limit than the global /api one.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

router.post('/register', authLimiter, validate(schemas.register), wrap(ctrl.register));
router.post('/login', authLimiter, validate(schemas.login), wrap(ctrl.login));
router.post('/refresh', wrap(ctrl.refresh));
router.post('/logout', wrap(ctrl.logout));
router.get('/me', requireAuth, wrap(ctrl.me));

// Google redirects the browser here after consent. No bearer token is present —
// the signed `state` parameter carries (and proves) the user identity.
router.get('/google/callback', wrap(googleCallback));

export default router;
