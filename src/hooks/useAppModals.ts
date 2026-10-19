import { useState } from 'react';

/**
 * Custom hook to manage modal dialog states and user modal types in CIOB GMAO.
 */
export function useAppModals() {
  const [showAddArticleModal, setShowAddArticleModal] = useState(false);
  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserModalType, setAddUserModalType] = useState('TECHNICIEN');
  const [showAddZoneModal, setShowAddZoneModal] = useState(false);

  const openAddTech = () => {
    setAddUserModalType('TECHNICIEN');
    setShowAddUserModal(true);
  };

  const openAddChef = () => {
    setAddUserModalType('RESPONSABLE');
    setShowAddUserModal(true);
  };

  const openAddOperator = () => {
    setAddUserModalType('OPERATEUR');
    setShowAddUserModal(true);
  };

  return {
    showAddArticleModal,
    setShowAddArticleModal,
    showAddMachineModal,
    setShowAddMachineModal,
    showAddUserModal,
    setShowAddUserModal,
    addUserModalType,
    setAddUserModalType,
    showAddZoneModal,
    setShowAddZoneModal,
    openAddTech,
    openAddChef,
    openAddOperator,
  };
}
