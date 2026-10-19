import React, { useState, useMemo } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import AddArticleModal from '../../presentation/pages/stock/AddArticleModal.jsx';
import { ValidationService } from '../../core/validation/ValidationService.ts';
import { StockCalculationService } from '../../domain/pdr/services/StockCalculationService';

/**
 * Interactive E2E User Flow Harness for Stock Management (Add, Search, Validation)
 * Simulates real DOM rendering, user input events, form submissions, and validation errors.
 */
function StockE2EHarness({ initialItems = [] }: { initialItems?: any[] }) {
  const [items, setItems] = useState<any[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Quick inline form state for testing direct validation & arabic/french UI feedback
  const [codeInput, setCodeInput] = useState('');
  const [designationInput, setDesignationInput] = useState('');
  const [qtyInput, setQtyInput] = useState('');

  const handleOpenAdd = () => {
    setValidationError(null);
    setIsAddModalOpen(true);
  };

  const handleInlineAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!designationInput.trim()) {
      setValidationError('وصف المادة مطلوب');
      return;
    }
    const cleanCode = codeInput.trim() || 'AUTO-001';
    const validation = ValidationService.validateStockItem({
      ref: cleanCode,
      designation: designationInput.trim(),
      stockInitial: Number(qtyInput) || 0,
    });
    if (!validation.isValid) {
      setValidationError(validation.error || 'بيانات غير صالحة');
      return;
    }
    setValidationError(null);
    setItems((prev) => [
      ...prev,
      {
        ref: codeInput.trim() || 'AUTO-001',
        code: codeInput.trim() || 'AUTO-001',
        designation: designationInput.trim(),
        stockInitial: Number(qtyInput) || 0,
        quantity: Number(qtyInput) || 0,
        seuil: 5,
      },
    ]);
    setCodeInput('');
    setDesignationInput('');
    setQtyInput('');
  };

  const handleModalAddArticle = (newArt: any) => {
    setItems((prev) => [...prev, newArt]);
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        String(item.ref || item.code || '').toLowerCase().includes(q) ||
        String(item.designation || '').toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  return (
    <div data-testid="stock-e2e-view">
      {/* Toolbar */}
      <div className="toolbar">
        <input
          type="text"
          aria-label="ابحث عن مادة..."
          placeholder="ابحث عن مادة..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="button" onClick={handleOpenAdd}>
          إضافة مادة
        </button>
      </div>

      {/* Inline Quick Creation & Validation Form */}
      <form data-testid="quick-add-form" onSubmit={handleInlineAddSubmit}>
        <input
          type="text"
          name="code"
          placeholder="كود المادة"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
        />
        <input
          type="text"
          name="designation"
          placeholder="وصف المادة"
          value={designationInput}
          onChange={(e) => setDesignationInput(e.target.value)}
        />
        <input
          type="number"
          name="quantity"
          placeholder="الكمية"
          value={qtyInput}
          onChange={(e) => setQtyInput(e.target.value)}
        />
        <button type="submit">حفظ</button>
      </form>

      {/* Validation Error Alert */}
      {validationError && (
        <div role="alert" data-testid="validation-error">
          {validationError}
        </div>
      )}

      {/* Stock List */}
      <ul data-testid="stock-items-list">
        {filteredItems.map((item, idx) => (
          <li key={item.ref || item.code || idx} data-testid="stock-item-row">
            <span className="item-code">{item.ref || item.code}</span>
            <span className="item-designation">{item.designation}</span>
            <span className="item-qty">
              {StockCalculationService.calculateStockActuel(item, [])}
            </span>
          </li>
        ))}
      </ul>

      {/* Real Production AddArticleModal */}
      <AddArticleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        types={[{ id_type: 'Roulement', libelle: 'Roulement' }]}
        stockItems={items}
        onAddArticle={handleModalAddArticle}
        onOpenAddTypeModal={() => {}}
      />
    </div>
  );
}

describe('6.B — E2E Interactive UI Tests (Stock Add, Search & Validation Flows)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const setNativeInputValue = (input: HTMLInputElement, value: string) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    nativeInputValueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('User can add new stock item and see it rendered in the list', async () => {
    await act(async () => {
      root.render(<StockE2EHarness initialItems={[]} />);
    });

    const codeInput = container.querySelector('input[name="code"]') as HTMLInputElement;
    const desigInput = container.querySelector('input[name="designation"]') as HTMLInputElement;
    const qtyInput = container.querySelector('input[name="quantity"]') as HTMLInputElement;
    const form = container.querySelector('[data-testid="quick-add-form"]') as HTMLFormElement;

    await act(async () => {
      setNativeInputValue(codeInput, 'STK-001');
      setNativeInputValue(desigInput, 'مسمار 10مم');
      setNativeInputValue(qtyInput, '100');
    });

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('STK-001');
    expect(container.textContent).toContain('مسمار 10مم');
    expect(container.textContent).toContain('100');
  });

  it('User can search for stock items and filter the displayed rows in real time', async () => {
    const seedItems = [
      { ref: 'STK-001', designation: 'مسمار 10مم', stockInitial: 100 },
      { ref: 'ROUL-202', designation: 'رولمان بلي SKF', stockInitial: 25 },
      { ref: 'COUR-999', designation: 'سير ناقل مطاطي', stockInitial: 10 },
    ];

    await act(async () => {
      root.render(<StockE2EHarness initialItems={seedItems} />);
    });

    const searchInput = container.querySelector('input[placeholder="ابحث عن مادة..."]') as HTMLInputElement;
    expect(container.querySelectorAll('[data-testid="stock-item-row"]').length).toBe(3);

    // Search for "مسمار"
    await act(async () => {
      setNativeInputValue(searchInput, 'مسمار');
    });

    const rowsAfterSearch = container.querySelectorAll('[data-testid="stock-item-row"]');
    expect(rowsAfterSearch.length).toBe(1);
    expect(container.textContent).toContain('مسمار 10مم');
    expect(container.textContent).not.toContain('سير ناقل مطاطي');
  });

  it('Shows validation error when adding invalid item (missing designation)', async () => {
    await act(async () => {
      root.render(<StockE2EHarness initialItems={[]} />);
    });

    const codeInput = container.querySelector('input[name="code"]') as HTMLInputElement;
    const form = container.querySelector('[data-testid="quick-add-form"]') as HTMLFormElement;

    // Fill code only, leave designation empty
    await act(async () => {
      setNativeInputValue(codeInput, 'STK-001');
    });

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const alertBox = container.querySelector('[data-testid="validation-error"]');
    expect(alertBox).not.toBeNull();
    expect(alertBox?.textContent).toContain('وصف المادة مطلوب');
  });

  it('User can open the production AddArticleModal, auto-generate a reference, and submit a new spare part', async () => {
    await act(async () => {
      root.render(
        <StockE2EHarness
          initialItems={[{ ref: 'Roulement1', type: 'Roulement', designation: '6204-2RS', stockInitial: 12 }]}
        />
      );
    });

    const openBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('إضافة مادة')
    ) as HTMLButtonElement;

    await act(async () => {
      openBtn.click();
    });

    // Verify AddArticleModal opened and auto-generated "Roulement2"
    expect(container.textContent).toContain('Nouvel Article (Stock PDR)');
    const modalRefInput = container.querySelector('input[placeholder="ex: Courroie1"]') as HTMLInputElement;
    const modalDesigInput = container.querySelector(
      'input[placeholder="ex: 6PK925, Ø12x150, etc."]'
    ) as HTMLInputElement;

    expect(modalRefInput.value).toBe('Roulement2');

    await act(async () => {
      setNativeInputValue(modalDesigInput, '6305-ZZ Haute Vitesse');
    });

    const modalForm = modalDesigInput.closest('form') as HTMLFormElement;
    await act(async () => {
      modalForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // Modal should close and new item Roulement2 should appear in the list
    expect(container.textContent).toContain('Roulement2');
    expect(container.textContent).toContain('6305-ZZ Haute Vitesse');
  });
});
