"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { apiRequest, setStoredToken } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import Logo from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PASSWORD_REQUIREMENT_KEYS = ["minChars", "uppercase", "lowercase", "number"] as const;
const PASSWORD_TESTS = [
  (p: string) => p.length >= 8,
  (p: string) => /[A-Z]/.test(p),
  (p: string) => /[a-z]/.test(p),
  (p: string) => /\d/.test(p),
] as const;

function validatePassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
}

export default function RegisterForm() {
  const t = useTranslations("auth.register");
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordMatch = confirmPassword === "" ? null : password === confirmPassword;
  const passwordReqs = PASSWORD_REQUIREMENT_KEYS.map((key, i) => ({
    key,
    label: t(`requirements.${key}`),
    met: PASSWORD_TESTS[i](password),
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!agreeToTerms) {
      setError(t("agreeTerms"));
      return;
    }
    if (!validatePassword(password)) {
      setError(t("errors.passwordWeak"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("errors.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ access_token: string; token_type: string; user: unknown }>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, display_name: displayName }),
      });
      if (!res.ok) {
        const msg = res.error ?? t("errors.passwordWeak");
        setError(msg);
        toast({ title: t("errors.emailExists"), description: msg, variant: "destructive" });
        return;
      }
      if (res.ok && "access_token" in res.data) {
        setStoredToken(res.data.access_token);
        router.replace("/dashboard");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("errors.passwordWeak");
      setError(msg);
      toast({ title: t("errors.emailExists"), description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-[440px] border-border shadow-lg">
      <CardHeader className="space-y-3 text-center">
        <div className="flex justify-center">
          <Logo size="lg" asLink={false} />
        </div>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GoogleSignInButton variant="signup" />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <span className="relative flex justify-center text-xs uppercase text-muted-foreground">
            {t("orContinueWith")}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <label htmlFor="reg-displayName" className="text-sm font-medium text-foreground">
              {t("displayName")}
            </label>
            <Input
              id="reg-displayName"
              type="text"
              placeholder={t("displayName")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              disabled={loading}
              className="h-10"
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="reg-email" className="text-sm font-medium text-foreground">
              {t("email")}
            </label>
            <Input
              id="reg-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="h-10"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="reg-password" className="text-sm font-medium text-foreground">
              {t("password")}
            </label>
            <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                placeholder={t("password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className={cn("h-10 pr-10", password && !passwordReqs.every((r) => r.met) && "border-destructive/50")}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {passwordReqs.map((r) => (
                  <li
                    key={r.key}
                    className={cn("flex items-center gap-1", r.met ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}
                  >
                    {r.met ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-current shrink-0" />}
                    {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="reg-confirmPassword" className="text-sm font-medium text-foreground">
              {t("confirmPassword")}
            </label>
            <div className="relative">
              <Input
                id="reg-confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder={t("confirmPassword")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className={cn(
                  "h-10 pr-10",
                  confirmPassword && !passwordMatch && "border-destructive/50"
                )}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && (
              <p className={cn("text-xs", passwordMatch ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                {passwordMatch ? t("passwordsMatch") : t("errors.passwordMismatch")}
              </p>
            )}
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              disabled={loading}
              className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring/20"
            />
            <span className="text-sm text-muted-foreground">{t("agreeTerms")}</span>
          </label>
          <Button
            type="submit"
            className="w-full h-10"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("creatingAccount")}
              </>
            ) : (
              t("createAccount")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
