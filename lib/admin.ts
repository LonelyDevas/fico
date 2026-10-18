// Cosmetic gate only: the admin_* database functions re-check the caller server-side (is_app_admin).
export const ADMIN_EMAIL = 'joshuadg511@gmail.com'

export const isAdminEmail = (email?: string | null) => email?.trim().toLowerCase() === ADMIN_EMAIL
