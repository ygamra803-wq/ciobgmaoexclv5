import { describe, it, expect } from 'vitest';
import { normalizeMovement } from '../../hooks/useMovementSubState';

describe('Movement Normalization & Smart OT Detection', () => {
  it('should normalize basic movement structure', () => {
    const raw = {
      id: 10,
      code_bon: 'Bon-010',
      ref: 'ROUL-6204-2RS',
      quantite: 5,
      type: 'Sortie',
      action_id: 'CORRECTIVE',
      technicien: 'Rachid',
    };

    const normalized = normalizeMovement(raw, 0);
    expect(normalized.id).toBe(10);
    expect(normalized.code_bon).toBe('Bon-010');
    expect(normalized.ref).toBe('ROUL-6204-2RS');
    expect(normalized.quantite).toBe(5);
    expect(normalized.type).toBe('Sortie Interne');
    expect(normalized.action_id).toBe('CORRECTIVE');
  });

  it('should extract OT code from commentary if not explicitly provided', () => {
    const raw = {
      code_bon: 'Bon-011',
      ref: 'ROUL-6204',
      quantite: 2,
      type: 'Sortie',
      commentaire: 'Remplacement roulement suite à OT-9042',
    };

    const normalized = normalizeMovement(raw, 0);
    expect(normalized.num_commande).toBe('OT-9042');
  });

  it('should extract CMD code from commentary', () => {
    const raw = {
      code_bon: 'Bon-012',
      ref: 'COUR-SPA-1250',
      quantite: 1,
      type: 'COMMANDE',
      commentaire: 'Achat urgent CMD-8812 pour compresseur',
    };

    const normalized = normalizeMovement(raw, 0);
    expect(normalized.num_commande).toBe('CMD-8812');
  });

  it('should fallback num_commande to INCONNU when no OT/CMD is found', () => {
    const raw = {
      code_bon: 'Bon-015',
      ref: 'VIS-M8',
      quantite: 10,
      type: 'Sortie Interne',
      commentaire: 'Entretien simple',
    };

    const normalized = normalizeMovement(raw, 0);
    expect(normalized.num_commande).toBe('INCONNU');
  });

  it('should correctly classify Entrée Externe with fournisseur or REAPPRO', () => {
    const rawWithSupplier = {
      code_bon: 'Bon-020',
      ref: 'ROUL-6204',
      quantite: 20,
      type: 'Entrée',
      fournisseur: 'SKF Maroc',
    };

    const norm1 = normalizeMovement(rawWithSupplier, 0);
    expect(norm1.type).toBe('Entrée Externe');

    const rawReappro = {
      code_bon: 'Bon-021',
      ref: 'ROUL-6204',
      quantite: 20,
      type: 'Entrée',
      action_id: 'REAPPRO',
    };

    const norm2 = normalizeMovement(rawReappro, 0);
    expect(norm2.type).toBe('Entrée Externe');
  });
});
