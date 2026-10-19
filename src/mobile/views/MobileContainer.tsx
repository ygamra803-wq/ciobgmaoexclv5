import { useState } from 'react';
import QuickActions from '../components/QuickActions';
import QRScannerModal from '../../presentation/components/common/QRScannerModal';

/**
 * 📱 Industrial Field Mobile Companion Container
 * Integrates field QuickActions, Camera QR & Barcode Scanner, and responsive mobile wrappers
 */
export function MobileContainer({
  children,
  currentTab: _currentTab,
  setCurrentTab,
  stockItems = [],
  machines = [],
  onAddMouvement,
  showToast,
}) {
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  const handleQuickAction = (actionId) => {
    switch (actionId) {
      case 'scan_qr':
        setIsQRScannerOpen(true);
        break;
      case 'quick_out':
        if (onAddMouvement) {
          onAddMouvement();
        } else if (setCurrentTab) {
          setCurrentTab('stock');
        }
        break;
      case 'create_di':
      case 'create_bt':
        if (setCurrentTab) {
          setCurrentTab('correctif');
        }
        break;
      default:
        break;
    }
  };

  const handleScanResult = (scannedCode) => {
    const cleanCode = (scannedCode || '').trim();
    if (!cleanCode) return;

    // Search in machines first
    const matchedMachine = machines.find(
      (m) =>
        (m.id_machine_registered && m.id_machine_registered.toLowerCase() === cleanCode.toLowerCase()) ||
        (m.nom && m.nom.toLowerCase().includes(cleanCode.toLowerCase()))
    );

    if (matchedMachine) {
      showToast?.(`✅ تم التعرف على الآلة: ${matchedMachine.nom || matchedMachine.id_machine_registered}`, 'success');
      setCurrentTab?.('machines');
      return;
    }

    // Search in stock/PDR items
    const matchedStock = stockItems.find(
      (s) =>
        (s.ref && s.ref.toLowerCase() === cleanCode.toLowerCase()) ||
        (s.designation && s.designation.toLowerCase().includes(cleanCode.toLowerCase()))
    );

    if (matchedStock) {
      showToast?.(`📦 تم التعرف على قطعة الغيار: ${matchedStock.designation || matchedStock.ref}`, 'success');
      setCurrentTab?.('stock');
      return;
    }

    showToast?.(`ℹ️ تم مسح الرمز: ${cleanCode}`, 'info');
  };

  return (
    <div className="w-full flex flex-col space-y-3 max-w-full overflow-hidden">
      {/* Field Mobile Quick Actions Bar */}
      <QuickActions onAction={handleQuickAction} />

      {/* Main Page Content */}
      <div className="w-full">
        {children}
      </div>

      {/* Camera QR & Barcode Scanner Modal */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScan={handleScanResult}
      />
    </div>
  );
}

export default MobileContainer;
