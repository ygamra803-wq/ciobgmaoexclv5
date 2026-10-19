import { z } from 'zod';

export const StockItemSchema = z.object({
  id: z.any().optional(),
  ref: z.string().min(1, 'La référence est obligatoire'),
  designation: z.string().optional(),
  type: z.string().optional(),
  id_type: z.string().optional(),
  stockInitial: z.coerce.number().min(0).default(0),
  seuil: z.coerce.number().min(0).default(5),
  emplacement: z.string().optional(),
}).passthrough();

export const MovementSchema = z.object({
  id: z.any().optional(),
  code_bon: z.string().optional(),
  ref: z.string().min(1, 'La référence est obligatoire'),
  quantite: z.coerce.number().min(1, 'Quantité invalide').default(1),
  type: z.enum(['Entrée', 'Sortie', 'IN', 'OUT'], { errorMap: () => ({ message: 'Type invalide' }) }).default('Sortie'),
  date: z.string().optional(),
  machine: z.string().optional(),
  demandeur: z.string().optional(),
  commentaire: z.string().optional(),
}).passthrough();

export const MachineSchema = z.object({
  id_machine_registered: z.string().min(1, 'Code machine obligatoire'),
  nom: z.string().optional(),
  family_id: z.string().optional(),
  template_id: z.string().optional(),
  zone_id: z.string().optional(),
  statut: z.string().optional(),
}).passthrough();

export const UserSchema = z.object({
  id: z.any().optional(),
  nom: z.string().optional(),
  username: z.string().min(3, 'Username trop court').optional(),
  email: z.string().email('Email invalide').optional(),
  password: z.string().min(6, 'Mot de passe trop court').optional(),
  prenom: z.string().optional(),
  role: z.enum(['ADMIN', 'TECHNICIEN', 'RESPONSABLE', 'USER'], { errorMap: () => ({ message: 'Rôle invalide' }) }).optional(),
  telephone: z.string().optional(),
}).passthrough();

export const TaskSchema = z.object({
  id: z.any().optional(),
  titre: z.string().optional(),
  description: z.string().optional(),
  id_machine_registered: z.string().optional(),
  periodicite: z.string().optional(),
  statut: z.string().optional(),
}).passthrough();

export function validateImportedData(importedData: Record<string, any> = {}) {
  const errors: { stock: string[]; movements: string[]; general: string[] } = {
    stock: [],
    movements: [],
    general: [],
  };

  if (!importedData || typeof importedData !== 'object') {
    errors.general.push('Données importées invalides');
    return { valid: false, errors };
  }

  return {
    valid: errors.stock.length === 0 && errors.movements.length === 0 && errors.general.length === 0,
    errors,
  };
}

export default {
  StockItemSchema,
  MovementSchema,
  MachineSchema,
  UserSchema,
  TaskSchema,
  validateImportedData,
};
