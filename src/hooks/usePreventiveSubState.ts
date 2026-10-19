import {
  useGmaoStore,
  usePreventiveSlice,
} from '../store/useGmaoStore';

/**
 * Legacy-compatible hook for Preventive Maintenance state.
 * Delegates 100% of state and actions to the single authoritative Zustand store (useGmaoStore)
 * to eliminate split-brain state, duplicate useEffect storage writes, and resurrection of cleared tasks.
 */
export function usePreventiveSubState(_groupedState: Record<string, any> = {}) {
  const slice = usePreventiveSlice();

  return {
    tasks: slice.preventiveTasks,
    setTasks: slice.setPreventiveTasks,
    actions: slice.preventiveActions,
    setActions: slice.setPreventiveActions,
    guides: slice.preventiveGuides,
    setGuides: slice.setPreventiveGuides,
    plans: slice.preventivePlans,
    setPlans: slice.setPreventivePlans,
    handleUpdateTask: slice.handleUpdateTask,
    handleDeleteTask: slice.handleDeleteTask,
    handleUpdateTaskCounter: slice.handleUpdateTaskCounter,
    handleMarkTaskDone: slice.handleMarkTaskDone,
    handleCreatePlanWithTasks: slice.handleCreatePlanWithTasks,
    handleAddAction: slice.handleAddAction,
    handleUpdateAction: slice.handleUpdateAction,
    handleDeleteAction: slice.handleDeleteAction,
    handleAddGuide: slice.handleAddGuide,
    handleUpdateGuide: slice.handleUpdateGuide,
    handleDeleteGuide: slice.handleDeleteGuide,
    handleResetPreventiveToBaseline: slice.handleResetPreventiveToBaseline,
    handleClearPreventiveForRealFactory: slice.handleClearPreventiveForRealFactory,
  };
}

export { useGmaoStore, usePreventiveSlice };
export default usePreventiveSubState;
