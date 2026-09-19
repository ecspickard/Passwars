import { useMemo, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { FormError, FormField } from "../components/FormField";
import { PasswordInput } from "../components/PasswordInput";
import { PasswordStrengthMeter } from "../components/PasswordStrengthMeter";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../lib/api";
import {
  EMAIL_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  validateEmail,
  validateNewPassword,
  validateUsername,
} from "../lib/validation";
import { AuthLayout } from "./AuthLayout";

type Field = "username" | "email" | "password";
const FIELD_ORDER: Field[] = ["username", "email", "password"];
const isField = (key: string): key is Field => (FIELD_ORDER as string[]).includes(key);

type FieldMap<T> = Record<Field, T>;

export default function Signup() {
  const { user, signup } = useAuth();
  const { showToast } = useToast();

  const [values, setValues] = useState<FieldMap<string>>({ username: "", email: "", password: "" });
  const [touched, setTouched] = useState<FieldMap<boolean>>({
    username: false,
    email: false,
    password: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<FieldMap<string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clientErrors = useMemo<FieldMap<string | null>>(
    () => ({
      username: validateUsername(values.username),
      email: validateEmail(values.email),
      password: validateNewPassword(values.password),
    }),
    [values],
  );

  // Already signed in (including right after a successful signup): move on.
  if (user) return <Navigate to="/dashboard" replace />;

  // Client-side errors appear once a field has been visited (or on submit);
  // server-side errors appear as soon as they arrive, until the field is edited.
  const errorFor = (field: Field): string | null => {
    const showClient = touched[field] || submitAttempted;
    return (showClient ? clientErrors[field] : null) ?? serverErrors[field] ?? null;
  };

  const update = (field: Field, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setServerErrors((s) => {
      if (!(field in s)) return s;
      const next = { ...s };
      delete next[field];
      return next;
    });
    setFormError(null);
  };

  const markTouched = (field: Field) => setTouched((t) => ({ ...t, [field]: true }));

  const describedBy = (field: Field, hasHint: boolean) => {
    const id = `signup-${field}`;
    if (errorFor(field)) return `${id}-error`;
    return hasHint ? `${id}-hint` : undefined;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setFormError(null);

    const firstInvalid = FIELD_ORDER.find((f) => clientErrors[f]);
    if (firstInvalid) {
      document.getElementById(`signup-${firstInvalid}`)?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(values.username.trim(), values.email.trim(), values.password);
      showToast("Welcome to Passwars — your vault is open.", "success");
      // AuthContext now has a user, so the <Navigate> above takes over.
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped: Partial<FieldMap<string>> = {};
        let hasUnmatched = false;
        for (const [key, msg] of Object.entries(err.fieldErrors)) {
          if (isField(key)) mapped[key] = msg;
          else hasUnmatched = true;
        }
        setServerErrors(mapped);
        // Anything that isn't tied to a visible field (e.g. the 400 "Username
        // or email already exists", or a network failure) goes in the banner.
        if (hasUnmatched || Object.keys(mapped).length === 0) setFormError(err.message);
      } else {
        setFormError("Couldn't create your account. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Stake your services. Defend them on the board."
      footer={
        <>
          Already playing?{" "}
          <Link to="/login" className="text-gold-400 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError && <FormError message={formError} />}

        <FormField id="signup-username" label="Username" error={errorFor("username")}>
          <input
            id="signup-username"
            className={`input-field ${errorFor("username") ? "border-signal-500" : ""}`}
            value={values.username}
            onChange={(e) => update("username", e.target.value)}
            onBlur={() => markTouched("username")}
            autoComplete="username"
            maxLength={USERNAME_MAX}
            aria-invalid={errorFor("username") ? true : undefined}
            aria-describedby={describedBy("username", false)}
            disabled={isSubmitting}
          />
        </FormField>

        <FormField id="signup-email" label="Email" error={errorFor("email")}>
          <input
            id="signup-email"
            className={`input-field ${errorFor("email") ? "border-signal-500" : ""}`}
            type="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            onBlur={() => markTouched("email")}
            autoComplete="email"
            maxLength={EMAIL_MAX}
            aria-invalid={errorFor("email") ? true : undefined}
            aria-describedby={describedBy("email", false)}
            disabled={isSubmitting}
          />
        </FormField>

        <FormField
          id="signup-password"
          label="Password"
          error={errorFor("password")}
          hint={`At least ${PASSWORD_MIN} characters.`}
        >
          <PasswordInput
            id="signup-password"
            value={values.password}
            onChange={(v) => update("password", v)}
            onBlur={() => markTouched("password")}
            autoComplete="new-password"
            invalid={Boolean(errorFor("password"))}
            describedBy={describedBy("password", true)}
            disabled={isSubmitting}
          />
          <PasswordStrengthMeter password={values.password} />
        </FormField>

        <button type="submit" className="btn-gold mt-2" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
