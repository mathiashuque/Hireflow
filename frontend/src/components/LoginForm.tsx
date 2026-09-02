"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { FormField } from "@/components/FormField";
import { Button } from "@/components/ui/Button";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { useI18n } from "@/i18n/LocaleProvider";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const { dict, href } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      router.push(href("/dashboard"));
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setFormError(dict.common.apiUnavailable);
      } else if (error instanceof ApiError) {
        // Login failures never distinguish "wrong email" from "wrong password" (avoids
        // account enumeration) and never render the backend's raw English message.
        setFormError(dict.auth.invalidCredentials);
      } else {
        setFormError(dict.common.genericError);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-4">
      <AnimatedStatus id={formError}>
        <StatusBanner tone="danger" role="alert">
          {formError}
        </StatusBanner>
      </AnimatedStatus>

      <FormField
        id="email"
        label={dict.auth.fieldEmail}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        disabled={isSubmitting}
      />
      <FormField
        id="password"
        label={dict.auth.fieldPassword}
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        disabled={isSubmitting}
      />

      <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? dict.auth.loginPending : dict.auth.loginCta}
      </Button>

      <p className="text-sm text-text-secondary">
        {dict.auth.loginNoAccount}{" "}
        <Link href={href("/register")} className="font-medium text-brand hover:underline">
          {dict.auth.signUpLink}
        </Link>
      </p>
    </form>
  );
}
