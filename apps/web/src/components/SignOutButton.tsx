"use client";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/";
      }}
    >
      {label}
    </button>
  );
}
