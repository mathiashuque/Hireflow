import { PublicShell } from "@/components/shell/PublicShell";
import { Reveal } from "@/components/motion/Reveal";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <PublicShell maxWidth="md">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 py-16">
        <Reveal className="flex w-full max-w-sm flex-col items-center gap-8">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Welcome back</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Log in to see your candidates and job openings.
            </p>
          </div>
          <LoginForm />
        </Reveal>
      </div>
    </PublicShell>
  );
}
