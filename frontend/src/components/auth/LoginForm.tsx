"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiRequest, setStoredToken } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import Logo from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginForm() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiRequest<{ access_token: string; token_type: string; user: unknown }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const msg = res.error ?? t("errors.invalid");
        setError(msg);
        toast({ title: t("errors.invalid"), description: msg, variant: "destructive" });
        return;
      }
      if (res.ok && "access_token" in res.data) {
        setStoredToken(res.data.access_token);
        router.replace("/dashboard");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("errors.invalid");
      setError(msg);
      toast({ title: t("errors.invalid"), description: msg, variant: "destructive" });
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
        <GoogleSignInButton variant="signin" />

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
            <label htmlFor="login-email" className="text-sm font-medium text-foreground">
              {t("email")}
            </label>
            <Input
              id="login-email"
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
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-sm font-medium text-foreground">
                {t("password")}
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                {t("forgotPassword")}
              </Link>
            </div>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder={t("password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-10 pr-10"
                autoComplete="current-password"
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
          </div>
          <Button
            type="submit"
            className="w-full h-10"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("signingIn")}
              </>
            ) : (
              t("signIn")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
