"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiRequest, setStoredToken } from "@/lib/api";

type Variant = "signin" | "signup";

export default function GoogleSignInButton({ variant = "signin" }: { variant?: Variant }) {
  const t = useTranslations("auth.v2");
  const router = useRouter();
  const [error, setError] = useState("");

  const label =
    variant === "signup" ? t("register.googleButton") : t("login.googleButton");

  const handleSuccess = async (credential: string) => {
    setError("");
    const res = await apiRequest<{ access_token: string; token_type: string; user: unknown }>(
      "/api/v1/auth/google",
      {
        method: "POST",
        body: JSON.stringify({ token: credential }),
      },
    );
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
        className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-[10px] border border-border bg-card text-[14px] font-medium text-muted-foreground"
      >
        <GoogleIcon />
        {label} (not configured)
      </button>
    );
  }

  return (
    <div className="w-full">
      {error && (
        <div className="mb-2.5 rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex w-full justify-center">
        <GoogleLogin
          onSuccess={({ credential }) => {
            if (credential) handleSuccess(credential);
          }}
          onError={() => setError("Google sign-in was cancelled or failed.")}
          theme="outline"
          size="large"
          text={variant === "signup" ? "signup_with" : "signin_with"}
          shape="rectangular"
          width="400"
        />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.71-1.57 2.7-3.89 2.7-6.61z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96L3.97 7.3C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
