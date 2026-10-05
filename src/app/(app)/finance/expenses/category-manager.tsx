"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createExpenseCategoryAction } from "@/lib/finance/actions";

export function CategoryManager() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");

  const submit = () => {
    startTransition(async () => {
      const result = await createExpenseCategoryAction({ name });
      if (result.ok) {
        toast.success(result.message);
        setName("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="mt-4 flex items-center gap-2">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="New category name"
        className="h-8 max-w-xs"
      />
      <Button variant="secondary" size="sm" onClick={submit} disabled={pending || !name.trim()}>
        Add category
      </Button>
    </div>
  );
}
