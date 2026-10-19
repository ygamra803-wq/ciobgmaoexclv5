import { startTransition } from 'react';
import Toast from '../components/common/Toast';
import AddArticleModal from '../pages/stock/AddArticleModal';
import AddMachineModal from '../pages/machines/AddMachineModal';
import AddUserModal from '../pages/utilisateurs/AddUserModal';
import AddZoneModal from '../pages/referentiel/AddZoneModal';

export default function AppModals({
  showAddArticleModal, setShowAddArticleModal,
  showAddMachineModal, setShowAddMachineModal,
  showAddUserModal, setShowAddUserModal, addUserModalType, setAddUserModalType,
  showAddZoneModal, setShowAddZoneModal,
  types, stockItems, effectiveFamilies, effectiveTemplates, blueprints = [], zones, technicians, machines, operations,
  handleAddArticle, handleAddMachine, handleUpdateMachine, handleDeleteMachine,
  handleAddTechnician, handleAddOperation, handleAddZone,
  setCurrentTab,
  toast, setToast
}) {
  return (
    <>
      <AddArticleModal
        isOpen={showAddArticleModal}
        onClose={() => setShowAddArticleModal(false)}
        types={types}
        stockItems={stockItems}
        onAddArticle={handleAddArticle}
        onOpenAddTypeModal={() => {
          setShowAddArticleModal(false);
          startTransition(() => setCurrentTab('types'));
        }}
      />

      <AddMachineModal
        isOpen={showAddMachineModal}
        onClose={() => setShowAddMachineModal(false)}
        families={effectiveFamilies}
        templates={effectiveTemplates}
        blueprints={blueprints}
        zones={zones}
        technicians={technicians}
        machines={machines}
        onAddMachine={handleAddMachine}
        onUpdateMachine={handleUpdateMachine}
        onDeleteMachine={handleDeleteMachine}
        onOpenAddFamilyModal={() => {
          setShowAddMachineModal(false);
          startTransition(() => setCurrentTab('families'));
        }}
        onOpenAddTemplateModal={() => {
          setShowAddMachineModal(false);
          startTransition(() => setCurrentTab('templates'));
        }}
        onOpenAddBlueprintModal={() => {
          setShowAddMachineModal(false);
          startTransition(() => setCurrentTab('blueprints'));
        }}
        onOpenAddZoneModal={() => {
          setShowAddMachineModal(false);
          setShowAddZoneModal(true);
        }}
        onOpenAddTechModal={() => {
          setShowAddMachineModal(false);
          setAddUserModalType('TECHNICIEN');
          setShowAddUserModal(true);
        }}
      />

      <AddUserModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        zones={zones}
        technicians={technicians}
        operations={operations}
        initialType={addUserModalType}
        onAddTechnician={handleAddTechnician}
        onAddOperation={handleAddOperation}
        onOpenAddZoneModal={() => {
          setShowAddUserModal(false);
          setShowAddZoneModal(true);
        }}
      />

      <AddZoneModal
        isOpen={showAddZoneModal}
        onClose={() => setShowAddZoneModal(false)}
        zones={zones}
        onAddZone={handleAddZone}
      />

      {/* Global Notification Toast */}
      {toast?.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'success' })}
        />
      )}
    </>
  );
}
