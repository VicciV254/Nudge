import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import * as ctrl from '../controllers/authController.js';
import { callback as calendarCallback } from '../controllers/calendarController.js';
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

// "Sign in with Google" — separate from calendar linking (see calendarRoutes'
// /calendar/connect). Redirects straight to Google's consent screen.
router.get('/google', ctrl.googleStart);

// Google redirects the browser here after consent, for BOTH the sign-in flow
// above and the calendar-connect flow in calendarRoutes — they share one
// redirect_uri because that's what's registered with Google. We peek at the
// (still-signed, still-to-be-verified) state's `purpose` claim to route to
// the right handler; each handler independently verifies the signature.
router.get(
  '/google/callback',
  wrap((req, res, next) => {
    const decoded = req.query.state ? jwt.decode(req.query.state) : null;
    if (decoded?.typ === 'oauth_state' && decoded?.purpose === 'login') {
      return ctrl.googleLoginCallback(req, res, next);
    }
    return calendarCallback(req, res, next);
  })
);

export default router;
