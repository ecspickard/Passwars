import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { FormError, FormField } from "../components/FormField";
import { PasswordInput } from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { AuthLayout } from "./AuthLayout";

const INVALID_CREDENTIALS = "Invalid username or password";

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requested = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const from = requested && requested !== "/login" && requested !== "/signup" ? requested : "/dashboard";

  // Already signed in (including right after a successful login): move on.
  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!username.trim() || !password) {
      setFormError("Enter your username and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
      // AuthContext now has a user, so the <Navigate> above takes over.
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.status === 401 ? INVALID_CREDENTIALS : err.message);
      } else {
        setFormError("Couldn't log in. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearError = () => setFormError(null);
  const hasError = formError !== null;

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to defend your vault."
      footer={
        <>
          New to Passwars?{" "}
          <Link to="/signup" className="text-gold-400 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError && <FormError message={formError} />}

        <FormField id="login-username" label="Username">
          <input
            id="login-username"
            className={`input-field ${hasError ? "border-signal-500" : ""}`}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              clearError();
            }}
            autoComplete="username"
            aria-invalid={hasError || undefined}
            disabled={isSubmitting}
          />
        </FormField>

        <FormField id="login-password" label="Password">
          <PasswordInput
            id="login-password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              clearError();
            }}
            autoComplete="current-password"
            invalid={hasError}
            disabled={isSubmitting}
          />
        </FormField>

        <button type="submit" className="btn-gold mt-2" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
