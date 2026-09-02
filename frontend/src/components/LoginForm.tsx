"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { FormField } from "@/components/FormField";
import { Button } from "@/components/ui/Button";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();

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
      router.push("/dashboard");
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setFormError(error.message);
      } else if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-sm flex-col gap-4">
      <AnimatedStatus id={formError}>
        <StatusBanner tone="danger" role="alert">
          {formError}
        </StatusBanner>
      </AnimatedStatus>

      <FormField
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        disabled={isSubmitting}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        disabled={isSubmitting}
      />

      <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "Logging in…" : "Log in"}
      </Button>

      <p className="text-sm text-text-secondary">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
