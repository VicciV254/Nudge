import { Router } from 'express';
import * as ctrl from '../controllers/taskController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { wrap } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

router.get('/', wrap(ctrl.list));
router.get('/stats', wrap(ctrl.stats));   // before /:id so "stats" isn't read as an id
router.get('/:id', wrap(ctrl.getOne));
router.post('/', validate(schemas.createTask), wrap(ctrl.create));
router.patch('/:id', validate(schemas.updateTask), wrap(ctrl.update));
router.delete('/:id', wrap(ctrl.remove));

export default router;
