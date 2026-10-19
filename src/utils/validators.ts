import { z } from 'zod';

export const articleSchema = z.object({
  ref: z.string().min(1, 'Reference is required'),
  designation: z.string().min(1, 'Designation is required'),
  stockInitial: z.number().min(0, 'Stock cannot be negative'),
  seuil: z.number().min(0, 'Threshold cannot be negative'),
});

export const movementSchema = z.object({
  code_bon: z.string().min(1, 'Bon code is required'),
  ref: z.string().min(1, 'Reference is required'),
  quantite: z.number().positive('Quantity must be greater than zero'),
  type: z.string().min(1, 'Type is required'),
});

export class Validators {
  static validateArticle(data) {
    return articleSchema.safeParse(data);
  }

  static validateMovement(data) {
    return movementSchema.safeParse(data);
  }
}
