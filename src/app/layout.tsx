import type { Metadata } from "next";
import { Toaster } from "sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Business Manager",
    template: "%s · Business Manager",
  },
  description: "Internal business operations management platform.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        {children}
        {/*
          Sonner carries TRANSIENT feedback only ("Saved", "Role updated").
          Anything the user must be able to come back to is a persistent
          in-app notification, not a toast (specification Section 112).
        */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!rounded-[3px] !border !border-line !bg-canvas !text-ink !shadow-sm",
              description: "!text-ink-muted",
            },
          }}
        />
      </body>
    </html>
  );
}
