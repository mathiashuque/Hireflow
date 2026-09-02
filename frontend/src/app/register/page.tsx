import { PublicShell } from "@/components/shell/PublicShell";
import { Reveal } from "@/components/motion/Reveal";
import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <PublicShell maxWidth="md">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 py-16">
        <Reveal className="flex w-full max-w-sm flex-col items-center gap-8">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Create your account</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Start organizing openings and candidates in one place.
            </p>
          </div>
          <RegisterForm />
        </Reveal>
      </div>
    </PublicShell>
  );
}
