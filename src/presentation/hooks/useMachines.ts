import { useGmaoStore } from '../../store/useGmaoStore';

export function useMachines() {
  const machines = useGmaoStore((state) => state.machines);
  const generalSystemTypes = useGmaoStore((state) => state.generalSystemTypes);
  const handleAddGeneralSystemType = useGmaoStore((state) => state.handleAddGeneralSystemType);
  const handleToggleGeneralSystemType = useGmaoStore((state) => state.handleToggleGeneralSystemType);
  const handleUpdateMachine = useGmaoStore((state) => state.handleUpdateMachine);
  const handleDeleteMachine = useGmaoStore((state) => state.handleDeleteMachine);

  const updateMachine = async (id: string, data: any) => {
    if (typeof handleUpdateMachine === 'function') {
      handleUpdateMachine(id, data);
    }
  };

  const deleteMachine = async (id: string) => {
    if (typeof handleDeleteMachine === 'function') {
      handleDeleteMachine(id);
    }
  };

  return {
    machines: Array.isArray(machines) ? machines : [],
    generalSystemTypes: Array.isArray(generalSystemTypes) ? generalSystemTypes : [],
    addGeneralSystemType: handleAddGeneralSystemType,
    toggleGeneralSystemType: handleToggleGeneralSystemType,
    updateMachine,
    deleteMachine,
  };
}

export default useMachines;
