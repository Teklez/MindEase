"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiRequest, setStoredToken } from "@/lib/api";

type Variant = "signin" | "signup";

export default function GoogleSignInButton({ variant = "signin" }: { variant?: Variant }) {
  const t = useTranslations("auth.login");
  const tReg = useTranslations("auth.register");
  const router = useRouter();
  const [error, setError] = useState("");

  const handleSuccess = async (credential: string) => {
    setError("");
    const res = await apiRequest<{ access_token: string; token_type: string; user: unknown }>("/api/v1/auth/google", {
      method: "POST",
      body: JSON.stringify({ token: credential }),
    });
    if (!res.ok) {
      setError(res.error ?? "Google sign-in failed");
      return;
    }
    if (res.ok && "access_token" in res.data) {
      setStoredToken(res.data.access_token);
      router.replace("/dashboard");
    }
  };

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return (
      <button
        type="button"
        disabled
        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 font-medium text-muted-foreground"
      >
        <GoogleIcon />
        {variant === "signup" ? tReg("signUpGoogle") : t("signInGoogle")} (not configured)
      </button>
    );
  }

  return (
    <div className="w-full">
      {error && (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="w-full min-w-0 [&>div]:!w-full [&>div]:!min-w-0 [&_.g_id_signin]:!w-full [&_.g_id_signin]:!max-w-full [&_.g_id_signin]>div:!w-full">
        <GoogleLogin
          onSuccess={({ credential }) => {
            if (credential) handleSuccess(credential);
          }}
          onError={() => setError("Google sign-in was cancelled or failed.")}
          theme="outline"
          size="large"
          text={variant === "signup" ? "signup_with" : "signin_with"}
          shape="rectangular"
          width="100%"
        />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
