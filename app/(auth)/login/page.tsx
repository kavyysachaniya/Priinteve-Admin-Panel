"use client";

import { useState, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type LoginValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setAuthError(null);
    startTransition(async () => {
      const result = await signIn("credentials", {
        email: values.email.toLowerCase().trim(),
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        setAuthError("Invalid email or password. Please try again.");
        form.setValue("password", "");
        return;
      }

      // Successful login — navigate to destination
      toast.success("Welcome back!");
      window.location.href = callbackUrl;
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@priinteve.com"
          autoComplete="email"
          autoFocus
          {...form.register("email")}
          aria-invalid={!!form.formState.errors.email}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            className="pr-10"
            {...form.register("password")}
            aria-invalid={!!form.formState.errors.password}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>

      {/* Auth Error */}
      {authError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive" role="alert">
          {authError}
        </div>
      )}

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      {/* Logo / Brand */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-4">
          P
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Priinteve Business OS</h1>
        <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
      </div>

      {/* Card */}
      <div className="border rounded-xl bg-card p-8 shadow-sm">
        <Suspense fallback={
          <div className="space-y-4">
            <div className="h-10 bg-muted animate-pulse rounded-md" />
            <div className="h-10 bg-muted animate-pulse rounded-md" />
            <div className="h-10 bg-primary/20 animate-pulse rounded-md" />
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Contact your administrator if you need access.
      </p>
    </div>
  );
}
