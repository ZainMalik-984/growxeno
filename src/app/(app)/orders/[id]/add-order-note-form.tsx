"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { addOrderNoteAction } from "@/lib/orders/actions";

export function AddOrderNoteForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | undefined>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await addOrderNoteAction({ orderId, body });
      if (result.ok) {
        toast.success(result.message);
        setBody("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="mb-4 max-w-xl space-y-2">
      <label htmlFor="order-note-body" className="sr-only">
        Add a note
      </label>
      <Textarea
        id="order-note-body"
        rows={2}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add an internal note…"
      />
      {error ? (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" size="sm" disabled={pending || !body.trim()}>
        {pending ? "Saving…" : "Add note"}
      </Button>
    </form>
  );
}
