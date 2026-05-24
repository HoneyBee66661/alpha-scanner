import { useState } from "react";
import { supabase } from "../../lib/supabase";

interface Props {
  onClose: () => void;
}

export default function AuthModal({ onClose }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);

    const { error: err } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (err) {
      setError(err.message);
      setSubmitting(false);
    }
    // on success, the onAuthStateChange listener will fire and parent can close
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-surface-card p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-brand text-text-primary">
              <span className="text-signal-blue">A</span>SCAN
            </span>
            <p className="text-label text-text-muted">Crypto Alpha Scanner</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-lg leading-none"
          >
            x
          </button>
        </div>

        <div className="flex mb-5 border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => { setMode("signin"); setError(""); }}
            className={`flex-1 py-1.5 text-cell transition-colors ${
              mode === "signin"
                ? "bg-surface-row text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode("signup"); setError(""); }}
            className={`flex-1 py-1.5 text-cell transition-colors ${
              mode === "signup"
                ? "bg-surface-row text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text-secondary">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              className="w-full rounded border border-border bg-surface-input px-3 py-2 text-cell text-text-primary outline-none focus:border-border-focus"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-label text-text-secondary">Password</span>
            <input
              type="password"
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full rounded border border-border bg-surface-input px-3 py-2 text-cell text-text-primary outline-none focus:border-border-focus"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {mode === "signup" && (
            <label className="flex flex-col gap-1">
              <span className="text-label text-text-secondary">Confirm Password</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                className="w-full rounded border border-border bg-surface-input px-3 py-2 text-cell text-text-primary outline-none focus:border-border-focus"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
          )}

          {error && (
            <p className="text-cell text-signal-red">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-signal-blue py-2 text-cell font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting
              ? mode === "signin" ? "Signing in..." : "Creating account..."
              : mode === "signin" ? "Sign In" : "Create Account"
            }
          </button>
        </form>
      </div>
    </div>
  );
}
