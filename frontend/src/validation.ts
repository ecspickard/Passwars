// Client-side form validation for auth. This is a convenience layer only -
// the backend (Pydantic + email-validator) is the source of truth, and any
// error it returns is still surfaced by the forms.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 50; // users.username is String(50)
export const EMAIL_MAX = 100; // users.email is String(100)
export const PASSWORD_MIN = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateUsername(value: string): string | null {
  const v = value.trim();
  if (!v) return "Choose a username.";
  if (v.length < USERNAME_MIN) return `Username needs at least ${USERNAME_MIN} characters.`;
  if (v.length > USERNAME_MAX) return `Username can be at most ${USERNAME_MAX} characters.`;
  return null;
}

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return "Enter your email address.";
  if (v.length > EMAIL_MAX) return `Email can be at most ${EMAIL_MAX} characters.`;
  if (!EMAIL_RE.test(v)) return "Enter a valid email address, like name@example.com.";
  return null;
}

export function validateNewPassword(value: string): string | null {
  if (!value) return "Create a password.";
  if (value.length < PASSWORD_MIN) return `Password needs at least ${PASSWORD_MIN} characters.`;
  return null;
}

// --- Strength meter (cosmetic only) ---------------------------------------

export interface PasswordStrength {
  /** 0 = empty, 1-4 = number of meter segments to fill. */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyui",
  "qwertyuiop",
  "iloveyou",
  "letmein1",
  "admin123",
  "welcome1",
  "chessmaster",
]);

export function scorePassword(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "" };
  if (pw.length < PASSWORD_MIN) return { score: 1, label: "Too short" };
  if (COMMON_PASSWORDS.has(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) {
    return { score: 1, label: "Too common" };
  }

  let points = 1; // meets the minimum length
  if (pw.length >= 12) points += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) points += 1;
  if (/\d/.test(pw)) points += 1;
  if (/[^A-Za-z0-9]/.test(pw)) points += 1;

  if (points <= 1) return { score: 1, label: "Weak" };
  if (points === 2) return { score: 2, label: "Fair" };
  if (points === 3) return { score: 3, label: "Good" };
  return { score: 4, label: "Strong" };
}
