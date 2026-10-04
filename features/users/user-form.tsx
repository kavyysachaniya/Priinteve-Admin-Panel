"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { userFormSchema, type UserFormValues } from "@/lib/validations/user";

interface UserFormProps {
  defaultValues?: Partial<UserFormValues>;
  customers?: Array<{ id: string; name: string }>;
  onSubmit: (values: UserFormValues) => Promise<{ success: boolean; message?: string; id?: string; fieldErrors?: Record<string, string> }>;
  submitLabel?: string;
  isEdit?: boolean;
}

export function UserForm({ defaultValues, customers, onSubmit, submitLabel = "Create User", isEdit = false }: UserFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "EMPLOYEE",
      status: "ACTIVE",
      password: "",
      customerId: "",
      ...defaultValues,
    },
  });

  function handleSubmit(values: UserFormValues) {
    startTransition(async () => {
      const result = await onSubmit(values);
      if (!result.success) {
        toast.error(result.message ?? "Failed to save user.");
        if (result.fieldErrors) {
          for (const [key, msg] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof UserFormValues, { message: msg });
          }
        }
        return;
      }
      toast.success(isEdit ? "User updated." : "User created successfully.");
      router.push("/users");
    });
  }

  const selectedRole = form.watch("role");

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input id="name" placeholder="Jane Doe" {...form.register("name")} />
          {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address *</Label>
          <Input id="email" type="email" placeholder="jane@priinteve.com" {...form.register("email")} />
          {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
        </div>

        {/* Role */}
        <div className="space-y-2">
          <Label>Role *</Label>
          <Select value={selectedRole} onValueChange={(v) => form.setValue("role", v as "ADMIN" | "EMPLOYEE" | "CLIENT")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">Admin — Full access</SelectItem>
              <SelectItem value="EMPLOYEE">Employee — Permission-based</SelectItem>
              <SelectItem value="CLIENT">Client — External customer portal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label>Status *</Label>
          <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as "ACTIVE" | "INACTIVE")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Linked Customer (for CLIENT role) */}
        {selectedRole === "CLIENT" && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customerId">Linked Customer *</Label>
            <Select
              value={form.watch("customerId") || ""}
              onValueChange={(v) => form.setValue("customerId", v)}
            >
              <SelectTrigger id="customerId">
                <SelectValue placeholder="Select customer to link to this client account…" />
              </SelectTrigger>
              <SelectContent>
                {customers && customers.length > 0 ? (
                  customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No customers found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {form.formState.errors.customerId && (
              <p className="text-sm text-destructive">{form.formState.errors.customerId.message}</p>
            )}
          </div>
        )}

        {/* Password */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="password">
            {isEdit ? "New Password (leave blank to keep current)" : "Password *"}
          </Label>
          <Input
            id="password"
            type="password"
            placeholder={isEdit ? "Leave blank to keep unchanged" : "Minimum 8 characters"}
            autoComplete="new-password"
            {...form.register("password")}
          />
          {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
