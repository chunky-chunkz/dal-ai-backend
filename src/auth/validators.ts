import { z } from 'zod';

/**
 * Email validation schema
 */
const emailSchema = z
  .string()
  .email('Invalid email format')
  .toLowerCase()
  .trim();

/**
 * Password validation schema
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .refine(
    (password) => /[a-zA-Z]/.test(password),
    'Password must contain at least one letter'
  )
  .refine(
    (password) => /[0-9]/.test(password),
    'Password must contain at least one digit'
  );

/**
 * Display name validation schema
 */
const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Display name cannot be empty')
  .max(100, 'Display name cannot exceed 100 characters')
  .optional();

/**
 * Registration request schema
 */
export const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});

/**
 * Login request schema
 */
export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Password change schema
 */
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

/**
 * Password reset request schema
 */
export const PasswordResetRequestSchema = z.object({
  email: emailSchema,
});

/**
 * Password reset confirmation schema
 */
export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
});

/**
 * Update profile schema
 */
export const UpdateProfileSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema.optional(),
});

// Export types for TypeScript
export type RegisterRequest = z.infer<typeof RegisterSchema>;
export type LoginRequest = z.infer<typeof LoginSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordSchema>;
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileSchema>;

/**
 * Validate email format helper
 */
export function isValidEmail(email: string): boolean {
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate password strength helper
 */
export function isValidPassword(password: string): boolean {
  try {
    passwordSchema.parse(password);
    return true;
  } catch {
    return false;
  }
}
