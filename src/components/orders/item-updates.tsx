"use client";

import { Ban, Camera, CheckCircle2, Clock, ImagePlus, Loader2, MessageSquareText, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Modal, SHEET_CLASS } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getItemUpdatesAction, postItemUpdateAction, requestScreenshotsAction, requestWithdrawAction } from "@/lib/order-updates/actions";
import {
  ITEM_UPDATE_IMAGE_ACCEPT,
  ITEM_UPDATE_MAX_DIMENSION,
  ITEM_UPDATE_MAX_IMAGES,
  ITEM_UPDATE_MAX_TEXT,
  isEmptyUpdate,
  parseCount,
  signedChange,
} from "@/lib/order-updates/rules";
import type { ItemUpdatesThread, ItemUpdateView } from "@/lib/order-updates/service";
import { cn } from "@/lib/utils";

/**
 * The updates thread on an order item (2026-11-11, owner request): "the
 * updates should be like a chat system… an input for the number update like
 * watch hours… then he can put screenshot and custom text there". A clear
 * button opens it as a bottom sheet on phones and a panel on larger screens.
 */

const numberFormat = new Intl.NumberFormat("en-US");
const ACCEPTED_TYPES = new Set(ITEM_UPDATE_IMAGE_ACCEPT.split(","));
/** "watch hours" → "Watch hours". */
const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const timeFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The prominent button that opens an item's updates; the sheet is rendered by the caller. */
export function UpdatesTrigger({
  count,
  canPost,
  onClick,
  className,
}: {
  /** Posts so far. */
  count: number;
  /** Shows "Post update" instead of "Updates". */
  canPost: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex h-9 items-center justify-center gap-2 rounded-[8px] px-3.5 text-[13px] font-semibold transition",
          canPost
            ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100"
            : "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50",
          className,
        )}
      >
        <MessageSquareText aria-hidden="true" className="size-4" />
        {canPost ? "Post update" : "Updates"}
        {count > 0 ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold leading-5 text-white">{count}</span>
        ) : null}
      </button>
  );
}

/**
 * Drops `?updates=` from the address once the sheet it opened is closed, so a
 * refresh doesn't open it again.
 */
export function clearUpdatesParam(replace: (href: string, options: { scroll: boolean }) => void) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("updates")) return;
  url.searchParams.delete("updates");
  replace(`${url.pathname}${url.search}`, { scroll: false });
}

/** The thread and the composer. Loads when opened. */
export function ItemUpdatesSheet({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const [thread, setThread] = useState<ItemUpdatesThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getItemUpdatesAction({ itemId })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setThread(result.thread);
        else setError(result.error);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the updates. Try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  // Newest at the bottom, like a chat: keep the view there.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [thread?.updates.length]);

  return (
    <Modal open onClose={onClose} labelledBy="item-updates-title" className={cn(SHEET_CLASS, "flex flex-col overflow-hidden sm:max-w-xl")}>
      <div className="shrink-0 border-b border-zinc-100 px-5 py-4">
        <span aria-hidden="true" className="mx-auto mb-2 block h-1 w-10 rounded-full bg-zinc-200 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium tabular-nums text-zinc-500">{thread ? `Order #${thread.orderNumber}` : "Updates"}</p>
            <h2 id="item-updates-title" className="truncate text-[15px] font-semibold text-zinc-900">
              {thread?.serviceName ?? "Loading…"}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close updates" className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        {thread ? <ThreadProgress thread={thread} /> : null}
      </div>

      <div ref={listRef} className="min-h-[200px] flex-1 overflow-y-auto bg-zinc-50/70 px-4 py-4 sm:px-5">
        {error ? (
          <p role="alert" className="py-10 text-center text-[13px] text-red-600">
            {error}
          </p>
        ) : !thread ? (
          <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-zinc-500">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Loading updates…
          </p>
        ) : thread.updates.length === 0 ? (
          <div className="py-10 text-center">
            <MessageSquareText aria-hidden="true" className="mx-auto size-6 text-zinc-300" />
            <p className="mt-2 text-sm font-medium text-zinc-700">No updates yet</p>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              {thread.canPost ? "Share where it stands: the new count, a screenshot, a note." : "Updates from the worker will appear here."}
            </p>
          </div>
        ) : (
          <ol className="space-y-4" aria-label="Updates">
            {thread.updates.map((update) => (
              <UpdateBubble key={update.id} update={update} metricLabel={thread.metricLabel} />
            ))}
          </ol>
        )}
      </div>

      {thread?.canAsk ? (
        <div className="shrink-0 border-t border-zinc-100 bg-white px-4 pt-3 sm:px-5">
          {asking ? (
            <AskScreenshotsInline
              itemId={thread.itemId}
              autoFocus
              onSent={() => {
                setAsking(false);
                getItemUpdatesAction({ itemId: thread.itemId })
                  .then((result) => {
                    if (result.ok) setThread(result.thread);
                  })
                  .catch(() => undefined);
              }}
            />
          ) : (
            <AskScreenshotsTrigger waiting={false} onClick={() => setAsking(true)} className="h-8 w-full" />
          )}
        </div>
      ) : null}
      {thread?.canPost ? <Composer thread={thread} onPosted={setThread} /> : null}
    </Modal>
  );
}

function ThreadProgress({ thread }: { thread: ItemUpdatesThread }) {
  if (!thread.metricLabel || thread.targetCount === null) return null;
  const start = Math.max(0, thread.startingCount ?? 0);
  const required = Math.max(0, thread.targetCount - start);
  const delivered = Math.max(0, (thread.currentCount ?? start) - start);
  const percent = required > 0 ? Math.min(100, Math.round((delivered / required) * 100)) : 0;
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2.5">
        <ProgressBar percent={percent} className="flex-1" />
        <span className="tabular text-xs font-semibold text-zinc-700">{percent}%</span>
      </div>
      <p className="mt-1 text-xs tabular-nums text-zinc-500">
        <span className="font-semibold text-zinc-800">{numberFormat.format(delivered)}</span> / {numberFormat.format(required)} {thread.metricLabel}{" "}
        delivered · now {numberFormat.format(thread.currentCount ?? start)}
      </p>
    </div>
  );
}

function UpdateBubble({ update, metricLabel }: { update: ItemUpdateView; metricLabel: string | null }) {
  if (update.isRequest) return <RequestBubble update={update} />;
  return (
    <li className={cn("flex flex-col", update.mine ? "items-end" : "items-start")}>
      <p className="mb-1 px-1 text-[11px] text-zinc-500">
        <span className="font-medium text-zinc-700">{update.mine ? "You" : update.authorLabel}</span>
        {!update.mine ? <span>{update.fromWorker ? " · Worker" : " · Team"}</span> : null}
        <span> · {timeFormat.format(new Date(update.createdAt))}</span>
        {update.isAnswer ? (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-px font-medium text-emerald-700">
            <CheckCircle2 aria-hidden="true" className="size-3" />
            Answer to the screenshot request
          </span>
        ) : null}
      </p>
      <div
        className={cn(
          "max-w-[88%] space-y-2 rounded-[14px] px-3.5 py-2.5 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
          update.mine ? "rounded-tr-[4px] bg-indigo-600 text-white" : "rounded-tl-[4px] bg-white text-zinc-800 ring-1 ring-inset ring-zinc-200",
        )}
      >
        {update.countValue !== null ? (
          <p
            className={cn(
              "inline-flex flex-wrap items-baseline gap-x-1.5 rounded-[8px] px-2 py-1 text-xs tabular-nums",
              update.mine ? "bg-white/15 text-white" : "bg-indigo-50 text-indigo-800",
            )}
          >
            <span>{metricLabel ? sentenceCase(metricLabel) : "Count"}</span>
            <span className="font-semibold">{numberFormat.format(update.countValue)}</span>
            <span className={update.mine ? "text-white/80" : "text-indigo-600"}>({signedChange(update.previousCount, update.countValue)})</span>
          </p>
        ) : null}
        {update.body ? <p className="whitespace-pre-wrap break-words">{update.body}</p> : null}
        {update.images.length > 0 ? (
          <div className={cn("grid gap-1.5", update.images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {update.images.map((src, index) => (
              <a key={src} href={src} target="_blank" rel="noreferrer noopener" className="block overflow-hidden rounded-[8px] bg-zinc-100">
                {/* Signed, short-lived links to a private bucket: a plain <img>, not next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Screenshot ${index + 1}`} className="max-h-64 w-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** A worker's screenshot request, shown across the thread so nobody misses it. */
function RequestBubble({ update }: { update: ItemUpdateView }) {
  if (update.requestType === "WITHDRAW") return <WithdrawBubble update={update} />;
  const answered = update.resolvedAt !== null;
  return (
    <li>
      <div
        className={cn(
          "rounded-[12px] px-3.5 py-3 text-sm ring-1 ring-inset",
          answered ? "bg-white ring-zinc-200" : "bg-amber-50 ring-amber-200",
        )}
      >
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Camera aria-hidden="true" className={cn("size-4", answered ? "text-zinc-400" : "text-amber-600")} />
          <span className="font-semibold text-zinc-900">{update.mine ? "You asked for screenshots" : `${update.authorLabel} asked for screenshots`}</span>
          <span className="text-xs text-zinc-500">{timeFormat.format(new Date(update.createdAt))}</span>
        </p>
        {update.body ? <p className="mt-1.5 whitespace-pre-wrap break-words text-zinc-700">{update.body}</p> : null}
        <p className={cn("mt-2 inline-flex items-center gap-1.5 text-xs font-medium", answered ? "text-emerald-700" : "text-amber-800")}>
          {answered ? <CheckCircle2 aria-hidden="true" className="size-3.5" /> : <Clock aria-hidden="true" className="size-3.5" />}
          {answered
            ? `Answered${update.resolvedByLabel ? ` by ${update.resolvedByLabel}` : ""} · ${timeFormat.format(new Date(update.resolvedAt!))}`
            : "Waiting for the team"}
        </p>
      </div>
    </li>
  );
}

/** "Can't continue" in the thread: who, why, and what the team did about it. */
function WithdrawBubble({ update }: { update: ItemUpdateView }) {
  const handled = update.resolvedAt !== null;
  return (
    <li>
      <div className={cn("rounded-[12px] px-3.5 py-3 text-sm ring-1 ring-inset", handled ? "bg-white ring-zinc-200" : "bg-red-50 ring-red-200")}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Ban aria-hidden="true" className={cn("size-4", handled ? "text-zinc-400" : "text-red-600")} />
          <span className="font-semibold text-zinc-900">{update.mine ? "You said you can't continue" : `${update.authorLabel} can't continue`}</span>
          <span className="text-xs text-zinc-500">{timeFormat.format(new Date(update.createdAt))}</span>
        </p>
        {update.body ? <p className="mt-1.5 whitespace-pre-wrap break-words text-zinc-700">{update.body}</p> : null}
        <p className={cn("mt-2 inline-flex items-center gap-1.5 text-xs font-medium", handled ? "text-emerald-700" : "text-red-700")}>
          {handled ? <CheckCircle2 aria-hidden="true" className="size-3.5" /> : <Clock aria-hidden="true" className="size-3.5" />}
          {handled
            ? `${update.resolutionNote ?? "Handled"}${update.resolvedByLabel ? ` · by ${update.resolvedByLabel}` : ""}`
            : "Waiting for the team to reassign"}
        </p>
      </div>
    </li>
  );
}

type Picked = { file: File; preview: string };

function Composer({ thread, onPosted }: { thread: ItemUpdatesThread; onPosted: (thread: ItemUpdatesThread) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [count, setCount] = useState("");
  const [images, setImages] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // The team's reply answers the waiting screenshot request unless they untick it (2026-11-11).
  const [answering, setAnswering] = useState(true);
  const answerId = thread.canAnswer && thread.openRequest && answering ? thread.openRequest.id : null;

  // Free the preview images when the composer closes (not on every change: those previews are still shown).
  const previews = useRef<Picked[]>([]);
  useEffect(() => {
    previews.current = images;
  }, [images]);
  useEffect(() => () => previews.current.forEach((image) => URL.revokeObjectURL(image.preview)), []);

  const parsed = parseCount(count);
  const countValue = parsed.ok ? parsed.value : null;
  const empty = isEmptyUpdate({ body, count: countValue, imageCount: images.length });

  const [dragging, setDragging] = useState(false);

  /** From the picker, a paste or a drop. Anything that isn't a PNG, JPEG or WebP image is ignored. */
  const addFiles = async (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []).filter((file) => ACCEPTED_TYPES.has(file.type));
    if (files.length === 0) return;
    const room = ITEM_UPDATE_MAX_IMAGES - images.length;
    if (room <= 0) {
      toast.error(`Up to ${ITEM_UPDATE_MAX_IMAGES} screenshots per update.`);
      return;
    }
    const chosen = files.slice(0, room);
    if (files.length > room) toast.error(`Up to ${ITEM_UPDATE_MAX_IMAGES} screenshots per update.`);
    const shrunk = await Promise.all(chosen.map(shrinkImage));
    setImages((current) => [...current, ...shrunk.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (empty || pending) return;
    setError(null);
    const form = new FormData();
    form.set("itemId", thread.itemId);
    form.set("body", body);
    form.set("count", count);
    if (answerId) form.set("answersRequestId", answerId);
    for (const image of images) form.append("images", image.file);
    startTransition(async () => {
      try {
        const result = await postItemUpdateAction(form);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(result.message);
        setBody("");
        setCount("");
        images.forEach((image) => URL.revokeObjectURL(image.preview));
        setImages([]);
        if (result.thread) onPosted(result.thread);
        router.refresh();
      } catch {
        setError("Couldn't send the update. Check your connection and try again.");
      }
    });
  };

  return (
    <form
      onSubmit={submit}
      aria-busy={pending}
      // Drop screenshots anywhere on the composer (2026-11-11).
      onDragOver={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (event.dataTransfer.files.length === 0) return;
        event.preventDefault();
        setDragging(false);
        void addFiles(event.dataTransfer.files);
      }}
      className={cn(
        "relative shrink-0 space-y-2.5 border-t border-zinc-100 bg-white px-4 py-3 sm:px-5",
        dragging && "bg-indigo-50/60 ring-2 ring-inset ring-indigo-300",
      )}
    >
      {dragging ? (
        <p className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-sm font-medium text-indigo-700">Drop screenshots to attach</p>
      ) : null}
      {thread.canAnswer && thread.openRequest ? (
        <label className="flex items-start gap-2.5 rounded-[10px] bg-amber-50 px-3 py-2 text-[13px] text-amber-900 ring-1 ring-inset ring-amber-200">
          <input
            type="checkbox"
            checked={answering}
            onChange={(event) => setAnswering(event.target.checked)}
            className="mt-0.5 size-4 accent-amber-600"
          />
          <span>
            <span className="font-medium">Answer {thread.openRequest.authorLabel}&apos;s screenshot request</span>
            <span className="block text-xs text-amber-800/80">Paste or attach the screenshots below. Sending closes the request.</span>
          </span>
        </label>
      ) : null}
      {thread.canSetCount && thread.metricLabel ? (
        <div className="flex items-center gap-2">
          <label htmlFor="update-count" className="shrink-0 text-[13px] font-medium text-zinc-700">
            {sentenceCase(thread.metricLabel)} now
          </label>
          <input
            id="update-count"
            inputMode="numeric"
            value={count}
            onChange={(event) => setCount(event.target.value)}
            placeholder={thread.currentCount !== null ? numberFormat.format(thread.currentCount) : "0"}
            className="h-10 w-full min-w-0 flex-1 rounded-[8px] border border-zinc-200 px-3 text-sm tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          />
          {countValue !== null ? (
            <span className="shrink-0 text-xs font-medium tabular-nums text-indigo-700">{signedChange(thread.currentCount, countValue)}</span>
          ) : null}
        </div>
      ) : null}

      {images.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Screenshots to send">
          {images.map((image, index) => (
            <li key={image.preview} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.preview} alt={`Screenshot ${index + 1} to send`} className="size-16 rounded-[8px] object-cover ring-1 ring-zinc-200" />
              <button
                type="button"
                aria-label={`Remove screenshot ${index + 1}`}
                onClick={() => {
                  URL.revokeObjectURL(image.preview);
                  setImages((current) => current.filter((item) => item !== image));
                }}
                className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-zinc-900 text-white"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-end gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={ITEM_UPDATE_IMAGE_ACCEPT}
          multiple
          className="sr-only"
          id="update-images"
          onChange={(event) => void addFiles(event.target.files)}
        />
        <label
          htmlFor="update-images"
          aria-disabled={images.length >= ITEM_UPDATE_MAX_IMAGES}
          className={cn(
            "grid size-10 shrink-0 cursor-pointer place-items-center rounded-[10px] text-zinc-500 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-800",
            images.length >= ITEM_UPDATE_MAX_IMAGES && "pointer-events-none opacity-40",
          )}
          title="Add screenshots"
        >
          <ImagePlus aria-hidden="true" className="size-[18px]" />
          <span className="sr-only">Add screenshots</span>
        </label>
        <label htmlFor="update-body" className="sr-only">
          Message
        </label>
        <textarea
          id="update-body"
          rows={1}
          value={body}
          maxLength={ITEM_UPDATE_MAX_TEXT}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit(event);
          }}
          // Paste a screenshot straight into the message, like a chat app (2026-11-11). Pasted text still pastes as text.
          onPaste={(event) => {
            const pasted = Array.from(event.clipboardData.files).filter((file) => ACCEPTED_TYPES.has(file.type));
            if (pasted.length === 0) return;
            event.preventDefault();
            void addFiles(pasted.map((file, index) => (file.name && file.name !== "image.png" ? file : new File([file], `pasted-${Date.now()}-${index + 1}.png`, { type: file.type }))));
          }}
          placeholder="Write an update, or paste a screenshot…"
          className="max-h-32 min-h-10 w-full flex-1 resize-none rounded-[10px] border border-zinc-200 px-3 py-2.5 text-sm [field-sizing:content] focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
        />
        <button
          type="submit"
          disabled={empty || pending}
          aria-label="Send update"
          className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
        >
          {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Send aria-hidden="true" className="size-4" />}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Shrinks a big screenshot in the browser before upload (to 1600px, JPEG), so
 * four phone screenshots fit in one request. The server checks and
 * re-compresses whatever arrives. Falls back to the original file.
 */
async function shrinkImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, ITEM_UPDATE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/** "Ask for screenshots" (2026-11-11): the worker on a task asks the team, e.g. for a channel's analytics they can't open. */
export function AskScreenshotsTrigger({
  waiting,
  onClick,
  className,
}: {
  /** A request is already waiting: show that instead of asking again. */
  waiting: boolean;
  onClick: () => void;
  className?: string;
}) {
  if (waiting) {
    return (
      <span
        className={cn(
          "inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-amber-50 px-3 text-[13px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200",
          className,
        )}
      >
        <Clock aria-hidden="true" className="size-4" />
        Screenshots requested
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-white px-3 text-[13px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50",
        className,
      )}
    >
      <Camera aria-hidden="true" className="size-4" />
      Ask for screenshots
    </button>
  );
}

/** The popup: an optional message, then send. Without a message the request is just the notification. */
export function AskScreenshotsDialog({ itemId, serviceName, onClose }: { itemId: string; serviceName: string; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} labelledBy="ask-screenshots-title" className={cn(SHEET_CLASS, "sm:max-w-md")}>
      <div className="px-5 py-5">
        <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-zinc-200 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-amber-50 text-amber-600">
              <Camera aria-hidden="true" className="size-[18px]" />
            </span>
            <div>
              <h2 id="ask-screenshots-title" className="text-[15px] font-semibold text-zinc-900">
                Ask for screenshots
              </h2>
              <p className="mt-0.5 text-[13px] text-zinc-500">{serviceName}. The team is notified and answers in the updates.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="mt-4">
          <AskScreenshotsInline itemId={itemId} onSent={onClose} autoFocus />
        </div>
      </div>
    </Modal>
  );
}

function AskScreenshotsInline({ itemId, onSent, autoFocus = false }: { itemId: string; onSent: () => void; autoFocus?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await requestScreenshotsAction({ itemId, message });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(result.message);
        setMessage("");
        router.refresh();
        onSent();
      } catch {
        setError("Couldn't send the request. Check your connection and try again.");
      }
    });
  };

  return (
    <div className="space-y-2.5">
      <label htmlFor={`ask-message-${itemId}`} className="block text-[13px] font-medium text-zinc-700">
        What do you need? <span className="font-normal text-zinc-400">(optional)</span>
      </label>
      <textarea
        id={`ask-message-${itemId}`}
        rows={2}
        autoFocus={autoFocus}
        value={message}
        maxLength={ITEM_UPDATE_MAX_TEXT}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="e.g. Studio → Analytics, watch hours for the last 28 days"
        className="w-full resize-none rounded-[10px] border border-zinc-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
      />
      {error ? (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={send}
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-amber-500 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
      >
        {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Camera aria-hidden="true" className="size-4" />}
        {message.trim() ? "Send request" : "Just notify the team"}
      </button>
    </div>
  );
}

/** "Can't continue" (2026-11-11): the worker on a task gives what's left back to the team. Shows the state once sent. */
export function CantContinueTrigger({ sent, onClick, className }: { sent: boolean; onClick: () => void; className?: string }) {
  if (sent) {
    return (
      <span
        className={cn(
          "inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-red-50 px-3 text-[13px] font-medium text-red-700 ring-1 ring-inset ring-red-200",
          className,
        )}
      >
        <Clock aria-hidden="true" className="size-4" />
        Waiting for reassignment
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium text-red-600 transition hover:bg-red-50",
        className,
      )}
    >
      <Ban aria-hidden="true" className="size-4" />
      Can&apos;t continue
    </button>
  );
}

/** The popup: why (optional), then tell the team. What's done so far stays theirs and is paid. */
export function CantContinueDialog({
  itemId,
  serviceName,
  progress,
  onClose,
}: {
  itemId: string;
  serviceName: string;
  /** "400 of 1,000 subscribers done", when the task has a count. */
  progress: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await requestWithdrawAction({ itemId, reason });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(result.message);
        router.refresh();
        onClose();
      } catch {
        setError("Couldn't send it. Check your connection and try again.");
      }
    });
  };

  return (
    <Modal open onClose={onClose} labelledBy="cant-continue-title" className={cn(SHEET_CLASS, "sm:max-w-md")}>
      <div className="px-5 py-5">
        <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-zinc-200 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-red-50 text-red-600">
              <Ban aria-hidden="true" className="size-[18px]" />
            </span>
            <div>
              <h2 id="cant-continue-title" className="text-[15px] font-semibold text-zinc-900">
                Can&apos;t continue this task?
              </h2>
              <p className="mt-0.5 text-[13px] text-zinc-500">{serviceName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <p className="mt-4 rounded-[10px] bg-zinc-50 px-3.5 py-3 text-[13px] text-zinc-700 ring-1 ring-inset ring-zinc-200/70">
          {progress ? <span className="font-medium text-zinc-900">{progress}. </span> : null}
          Your part is marked completed and paid. The team gives what&apos;s left to someone else.
        </p>

        <label htmlFor={`cant-continue-${itemId}`} className="mt-4 block text-[13px] font-medium text-zinc-700">
          Why? <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id={`cant-continue-${itemId}`}
          rows={2}
          autoFocus
          value={reason}
          maxLength={ITEM_UPDATE_MAX_TEXT}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. The channel's niche isn't working with my traffic"
          className="mt-1.5 w-full resize-none rounded-[10px] border border-zinc-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
        />
        {error ? (
          <p role="alert" className="mt-2 text-[13px] text-red-600">
            {error}
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-[10px] text-sm font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50">
            Keep working
          </button>
          <button
            type="button"
            onClick={send}
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            Tell the team
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** "400 of 1,000 subscribers done" for a task with a count, else null. */
export function progressSentence(item: { startingCount: number | null; currentCount: number | null; targetCount: number | null }, unit: string | null): string | null {
  if (!unit || item.targetCount === null) return null;
  const start = Math.max(0, item.startingCount ?? 0);
  const done = Math.max(0, (item.currentCount ?? start) - start);
  const asked = Math.max(0, item.targetCount - start);
  return `${numberFormat.format(done)} of ${numberFormat.format(asked)} ${unit} done`;
}
