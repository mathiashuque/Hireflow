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

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();
  const { dict, href } = useI18n();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await register({ displayName, email, password });
      router.push(href("/dashboard"));
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setFormError(dict.common.apiUnavailable);
      } else if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        setFormError(Object.keys(error.fieldErrors).length === 0 ? dict.errors.validation_error : null);
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
        id="displayName"
        label={dict.auth.fieldDisplayName}
        type="text"
        value={displayName}
        onChange={setDisplayName}
        autoComplete="name"
        disabled={isSubmitting}
        error={fieldErrors.DisplayName?.[0]}
      />
      <FormField
        id="email"
        label={dict.auth.fieldEmail}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        disabled={isSubmitting}
        error={fieldErrors.Email?.[0]}
      />
      <FormField
        id="password"
        label={dict.auth.fieldPassword}
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        disabled={isSubmitting}
        error={fieldErrors.Password?.[0]}
      />

      <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? dict.auth.registerPending : dict.auth.registerCta}
      </Button>

      <p className="text-sm text-text-secondary">
        {dict.auth.registerHasAccount}{" "}
        <Link href={href("/login")} className="font-medium text-brand hover:underline">
          {dict.auth.logInLink}
        </Link>
      </p>
    </form>
  );
}
