"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Mail, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import {
  clearGmailAppPasswordAction,
  revealGmailAppPasswordAction,
  setEmailMonitoringAction,
  setGmailAppPasswordAction,
  testFetchEmailsAction,
  type TestFetchResult,
} from "@/lib/fiverr-accounts/actions";

export function GmailMonitoringSection({
  accountId,
  hasGmailAppPassword,
  emailMonitoringEnabled,
  emailMonitoringSince,
  canRevealCredentials,
}: {
  accountId: string;
  hasGmailAppPassword: boolean;
  emailMonitoringEnabled: boolean;
  emailMonitoringSince: Date | null;
  canRevealCredentials: boolean;
}) {
  const [pending, startTransition] = useTransition();

  // Password state
  const [hasPassword, setHasPassword] = useState(hasGmailAppPassword);
  const [passwordInput, setPasswordInput] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  // Monitoring toggle state
  const [monitoringEnabled, setMonitoringEnabled] = useState(emailMonitoringEnabled);
  const [monitoringSince, setMonitoringSince] = useState<Date | null>(emailMonitoringSince);

  // Test fetch state
  const [testFrom, setTestFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [testTo, setTestTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [testResult, setTestResult] = useState<TestFetchResult | null>(null);
  const [testing, setTesting] = useState(false);

  const savePassword = () => {
    if (!passwordInput.trim()) return;
    setSavingPassword(true);
    startTransition(async () => {
      const result = await setGmailAppPasswordAction({ accountId, appPassword: passwordInput.trim() });
      setSavingPassword(false);
      if (result.ok) {
        toast.success(result.message);
        setHasPassword(true);
        setPasswordInput("");
        setRevealedPassword(null);
      } else {
        toast.error(result.error);
      }
    });
  };

  const clearPassword = () => {
    startTransition(async () => {
      const result = await clearGmailAppPasswordAction({ accountId });
      if (result.ok) {
        toast.success(result.message);
        setHasPassword(false);
        setMonitoringEnabled(false);
        setRevealedPassword(null);
      } else {
        toast.error(result.error);
      }
    });
  };

  const reveal = () => {
    setRevealing(true);
    startTransition(async () => {
      const result = await revealGmailAppPasswordAction({ accountId });
      setRevealing(false);
      if (result.ok) setRevealedPassword(result.password);
      else toast.error(result.error);
    });
  };

  const toggleMonitoring = () => {
    const newEnabled = !monitoringEnabled;
    startTransition(async () => {
      const result = await setEmailMonitoringAction({ accountId, enabled: newEnabled });
      if (result.ok) {
        toast.success(result.message);
        setMonitoringEnabled(newEnabled);
        if (newEnabled && !monitoringSince) setMonitoringSince(new Date());
      } else {
        toast.error(result.error);
      }
    });
  };

  const runTestFetch = () => {
    setTesting(true);
    setTestResult(null);
    startTransition(async () => {
      const result = await testFetchEmailsAction({ accountId, from: testFrom, to: testTo });
      setTesting(false);
      setTestResult(result);
    });
  };

  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* App Password */}
      <div className="space-y-3">
        <h3 className="text-[13px] font-semibold text-zinc-800">Gmail App Password</h3>
        <p className="text-[12px] text-zinc-500">
          Generate an App Password at{" "}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-700">
            myaccount.google.com/apppasswords
          </a>{" "}
          (requires 2-Step Verification). Select &ldquo;Other&rdquo; and name it &ldquo;Business Manager&rdquo;.
        </p>

        {hasPassword ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <span className="text-[13px] text-zinc-500">App Password saved</span>
              <span className="ml-auto flex gap-2">
                {canRevealCredentials && (
                  revealedPassword !== null ? (
                    <span className="flex items-center gap-2 text-[12px]">
                      <span className="font-mono text-zinc-700">{revealedPassword}</span>
                      <button type="button" onClick={() => setRevealedPassword(null)} className="text-zinc-400 underline hover:text-zinc-700">Hide</button>
                    </span>
                  ) : (
                    <button type="button" onClick={reveal} disabled={revealing || pending} className="text-[12px] text-zinc-500 underline hover:text-zinc-700">
                      {revealing ? "Revealing…" : "Reveal"}
                    </button>
                  )
                )}
                <button type="button" onClick={clearPassword} disabled={pending} className="text-[12px] text-red-500 underline hover:text-red-700">
                  Remove
                </button>
              </span>
            </div>
            {/* Replace password */}
            <div className="flex gap-2">
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Enter new App Password to replace…"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="flex-1 text-[13px]"
              />
              <Button type="button" variant="secondary" onClick={savePassword} disabled={savingPassword || pending || !passwordInput.trim()}>
                {savingPassword ? "Saving…" : "Replace"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Paste App Password (xxxx xxxx xxxx xxxx)"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="flex-1 text-[13px]"
            />
            <Button type="button" variant="primary" onClick={savePassword} disabled={savingPassword || pending || !passwordInput.trim()}>
              {savingPassword ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>

      {/* Monitoring toggle */}
      {hasPassword && (
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-zinc-800">Automatic order import</p>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              {monitoringEnabled && monitoringSince
                ? `Active · importing emails since ${fmt.format(monitoringSince)}`
                : "Checks Gmail every 10 minutes for new Fiverr order emails"}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleMonitoring}
            disabled={pending}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${monitoringEnabled ? "bg-zinc-900" : "bg-zinc-200"}`}
            role="switch"
            aria-checked={monitoringEnabled}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${monitoringEnabled ? "translate-x-4" : "translate-x-0"}`}
            />
          </button>
        </div>
      )}

      {/* Test fetch */}
      {hasPassword && (
        <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
          <h3 className="text-[13px] font-semibold text-zinc-800">Test fetch</h3>
          <p className="text-[12px] text-zinc-500">
            Fetch emails from Gmail for a date range and preview what the parser extracts. No orders are created.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[120px]">
              <Field label="From" htmlFor="test-from">
                <Input id="test-from" type="date" value={testFrom} onChange={(e) => setTestFrom(e.target.value)} />
              </Field>
            </div>
            <div className="flex-1 min-w-[120px]">
              <Field label="To" htmlFor="test-to">
                <Input id="test-to" type="date" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              </Field>
            </div>
            <Button type="button" variant="secondary" onClick={runTestFetch} disabled={testing || pending || !testFrom || !testTo}>
              {testing ? (
                <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" />Fetching…</span>
              ) : (
                <span className="flex items-center gap-1.5"><Mail className="size-3.5" />Fetch emails</span>
              )}
            </Button>
          </div>

          {testResult && (
            <div className="mt-3 space-y-2">
              {!testResult.ok ? (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{testResult.error}</span>
                </div>
              ) : testResult.emails.length === 0 ? (
                <p className="text-[12px] text-zinc-500">No Fiverr emails found in that date range.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-[12px] text-zinc-500">{testResult.emails.length} email{testResult.emails.length !== 1 ? "s" : ""} found</p>
                  {testResult.emails.map((email) => (
                    <div key={email.messageId} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[12px]">
                      <div className="flex items-start gap-2">
                        {email.parsed ? (
                          <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-green-600" />
                        ) : (
                          <XCircle className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="font-medium text-zinc-800 truncate">{email.subject}</p>
                          <p className="text-zinc-500">{new Date(email.date).toLocaleString()}</p>
                          {email.parsed ? (
                            <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-zinc-700">
                              <span><span className="text-zinc-400">Order ID</span> {email.parsed.orderId}</span>
                              <span><span className="text-zinc-400">Buyer</span> {email.parsed.buyerName || "—"}</span>
                              <span><span className="text-zinc-400">Gig</span> {email.parsed.gigTitle || "—"}</span>
                              <span><span className="text-zinc-400">Amount</span> ${email.parsed.amount.toFixed(2)}</span>
                              {email.parsed.deliveryDays > 0 && (
                                <span><span className="text-zinc-400">Delivery</span> {email.parsed.deliveryDays}d</span>
                              )}
                            </div>
                          ) : (
                            <p className="text-zinc-400 italic">Not an order email — will be skipped</p>
                          )}
                          {email.textSnippet && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-zinc-400 hover:text-zinc-600">Raw text snippet</summary>
                              <p className="mt-1 font-mono text-[11px] text-zinc-500 whitespace-pre-wrap">{email.textSnippet}</p>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
