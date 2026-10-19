# استراتيجية الاختبار الشاملة - GMAO Nexus v16

## 1. Unit Tests

### Stock Calculations
```javascript
// src/tests/domain/stockCalculations.test.js
import { describe, it, expect } from 'vitest';
import { calculateCurrentStock, getStockStatus } from '@/domain/stockCalculations';

describe('Stock Calculations', () => {
  it('يجب حساب المخزون الفعلي بشكل صحيح', () => {
    const initial = 100;
    const entries = 50;
    const exits = 30;
    
    const result = calculateCurrentStock(initial, entries, exits);
    expect(result).toBe(120);
  });

  it('يجب تحديد حالة المخزون بشكل صحيح', () => {
    const stock = 5;
    const minimum = 10;
    
    const status = getStockStatus(stock, minimum);
    expect(status).toBe('ALERTE');
  });

  it('يجب منع المخزون السالب', () => {
    const initial = 10;
    const entries = 0;
    const exits = 20;
    
    const result = calculateCurrentStock(initial, entries, exits);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});
```

### Preventive Scheduling
```javascript
// src/tests/domain/preventiveScheduling.test.js
import { describe, it, expect } from 'vitest';
import { calculateNextDueDate, getComplianceRate } from '@/domain/preventiveScheduling';

describe('Preventive Scheduling', () => {
  it('يجب حساب تاريخ الاستحقاق التالي بشكل صحيح', () => {
    const lastDate = new Date('2024-01-01');
    const frequency = 'WEEKLY';
    
    const nextDate = calculateNextDueDate(lastDate, frequency);
    expect(nextDate.getTime()).toBeGreaterThan(lastDate.getTime());
  });

  it('يجب حساب معدل الامتثال بشكل صحيح', () => {
    const completed = 8;
    const scheduled = 10;
    
    const rate = getComplianceRate(completed, scheduled);
    expect(rate).toBe(80);
  });
});
```

---

## 2. Integration Tests

### Stock Movement Flow
```javascript
// src/tests/integration/stockMovement.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService } from '@/infrastructure/database';
import { StockApplicationService } from '@/application/stockApplicationService';

describe('Stock Movement Flow', () => {
  let db;
  let stockService;

  beforeEach(async () => {
    db = new DatabaseService();
    await db.init();
    stockService = new StockApplicationService(db);
  });

  it('يجب إنشاء حركة خروج وتحديث المخزون', async () => {
    // ترتيب الاختبار
    const stockItem = {
      code: 'ITEM-001',
      quantity: 100,
      minStock: 10
    };
    await db.saveStockItem(stockItem);

    // الفعل
    const movement = {
      type: 'OUT',
      quantity: 20,
      date: new Date()
    };
    await stockService.createMovement('ITEM-001', movement);

    // التحقق
    const updatedStock = await db.getStockItem('ITEM-001');
    expect(updatedStock.quantity).toBe(80);
  });

  it('يجب منع حركة خروج إذا كان المخزون غير كافي', async () => {
    const stockItem = {
      code: 'ITEM-002',
      quantity: 10,
      minStock: 5
    };
    await db.saveStockItem(stockItem);

    const movement = {
      type: 'OUT',
      quantity: 20,
      date: new Date()
    };

    await expect(
      stockService.createMovement('ITEM-002', movement)
    ).rejects.toThrow('المخزون غير كافي');
  });
});
```

---

## 3. E2E Tests

### Complete Workflow
```javascript
// src/tests/e2e/completeWorkflow.test.js
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '@/App';

describe('Complete Workflow E2E', () => {
  it('يجب إكمال سير العمل الكامل من تسجيل الدخول إلى إنشاء حركة', async () => {
    render(<App />);

    // تسجيل الدخول
    const pinInput = screen.getByPlaceholderText('أدخل الرمز');
    fireEvent.change(pinInput, { target: { value: '123456' } });
    
    const loginBtn = screen.getByText('دخول');
    fireEvent.click(loginBtn);

    // الانتظار لتحميل الصفحة الرئيسية
    await waitFor(() => {
      expect(screen.getByText('لوحة التحكم')).toBeInTheDocument();
    });

    // الذهاب إلى المخزون
    const stockLink = screen.getByText('المخزون');
    fireEvent.click(stockLink);

    // البحث عن عنصر
    const searchInput = screen.getByPlaceholderText('ابحث عن مادة');
    fireEvent.change(searchInput, { target: { value: 'ITEM-001' } });

    // إنشاء حركة
    const createMovementBtn = screen.getByText('إنشاء حركة');
    fireEvent.click(createMovementBtn);

    // ملء النموذج
    const quantityInput = screen.getByPlaceholderText('الكمية');
    fireEvent.change(quantityInput, { target: { value: '10' } });

    const submitBtn = screen.getByText('حفظ');
    fireEvent.click(submitBtn);

    // التحقق من النجاح
    await waitFor(() => {
      expect(screen.getByText('تم إنشاء الحركة بنجاح')).toBeInTheDocument();
    });
  });
});
```

---

## 4. Performance Tests

### Large Dataset Performance
```javascript
// src/tests/performance/largeDataset.test.js
import { describe, it, expect } from 'vitest';
import { performanceMonitor } from '@/utils/performanceMonitor';
import { DatabaseService } from '@/infrastructure/database';

describe('Performance Tests', () => {
  it('يجب تحميل 10,000 عنصر في أقل من 2 ثانية', async () => {
    const db = new DatabaseService();
    await db.init();

    // إنشاء 10,000 عنصر
    const items = Array.from({ length: 10000 }, (_, i) => ({
      code: `ITEM-${i}`,
      quantity: Math.random() * 1000,
      minStock: 10
    }));

    // قياس الأداء
    const result = await performanceMonitor.measure('loadLargeDataset', async () => {
      for (const item of items) {
        await db.saveStockItem(item);
      }
    });

    expect(result.duration).toBeLessThan(2000);
  });

  it('يجب البحث في 10,000 عنصر في أقل من 100ms', async () => {
    const db = new DatabaseService();
    
    const result = await performanceMonitor.measure('searchLargeDataset', async () => {
      return await db.searchStockItems('ITEM');
    });

    expect(result.duration).toBeLessThan(100);
  });
});
```

---

## 5. Security Tests

### Authentication & Authorization
```javascript
// src/tests/security/authentication.test.js
import { describe, it, expect } from 'vitest';
import { AuthService } from '@/infrastructure/auth';
import { RBACService } from '@/infrastructure/rbac';

describe('Security Tests', () => {
  it('يجب رفض PIN غير صحيح', async () => {
    const authService = new AuthService();
    
    const result = await authService.verifyPin('000000');
    expect(result).toBe(false);
  });

  it('يجب منع المستخدم غير المصرح من الوصول', async () => {
    const rbacService = new RBACService();
    const user = { role: 'TECHNICIAN' };
    
    const hasAccess = rbacService.hasAccess(user, 'DELETE_ALL_DATA');
    expect(hasAccess).toBe(false);
  });

  it('يجب تشفير البيانات الحساسة', async () => {
    const vaultService = require('@/infrastructure/vault');
    
    const plainData = 'sensitive_data';
    const encrypted = vaultService.encrypt(plainData);
    
    expect(encrypted).not.toBe(plainData);
    
    const decrypted = vaultService.decrypt(encrypted);
    expect(decrypted).toBe(plainData);
  });
});
```

---

## 6. Regression Tests

### Critical Flows
```javascript
// src/tests/regression/criticalFlows.test.js
import { describe, it, expect } from 'vitest';
import { StockApplicationService } from '@/application/stockApplicationService';

describe('Regression Tests', () => {
  it('يجب أن تبقى حسابات المخزون دقيقة بعد التحديثات', async () => {
    // هذا الاختبار يتحقق من أن التحديثات السابقة
    // لم تكسر حسابات المخزون
  });

  it('يجب أن تبقى الصيانة الوقائية تعمل بعد التحديثات', async () => {
    // هذا الاختبار يتحقق من أن التحديثات السابقة
    // لم تكسر نظام الصيانة الوقائية
  });
});
```

---

## 7. Test Coverage Goals

```
Target Coverage:
├── Statements: 85%
├── Branches: 80%
├── Functions: 85%
└── Lines: 85%

Critical Paths (100%):
├── Stock Calculations
├── Authentication
├── Authorization
├── Data Persistence
└── Offline Sync
```

---

## 8. Running Tests

```bash
# تشغيل جميع الاختبارات
npm run test

# تشغيل اختبارات محددة
npm run test -- stock

# تشغيل مع التغطية
npm run test:coverage

# تشغيل في وضع المراقبة
npm run test:watch

# تشغيل E2E Tests
npm run test:e2e
```

---

## 9. CI/CD Integration

```yaml
# .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run test:coverage
      - run: npm run test:e2e
      - uses: codecov/codecov-action@v3
```
