// PreventiveService - INDEX
import initialTasks from '../../../data/preventive/seedPreventiveTasks.json';

export const INITIAL_TASKS = Array.isArray(initialTasks) ? initialTasks : [];
export const INITIAL_PLANS = [];

// Re-export standard references
export { INITIAL_ACTIONS } from './INITIAL_ACTIONS';
export { INITIAL_GUIDES } from './INITIAL_GUIDES';

// Modular Preventive Domain Services
export { ActionService } from './ActionService';
export { GuideService } from './GuideService';
export { PlanService } from './PlanService';
export { TaskService } from './TaskService';
export { ExecutionService } from './ExecutionService';


