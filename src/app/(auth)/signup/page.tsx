import Link from "next/link";
import { googleEnabled } from "@/auth";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; ref?: string }>;
}) {
  const sp = await searchParams;
  const initialRole = sp.as === "client" ? "CLIENT" : "TRADER";
  const referral = sp.ref?.slice(0, 16);

  return (
    <div>
      <h1 className="text-lg font-semibold text-zinc-100">Create your account</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Traders build a source-linked record. Clients discover and review traders.
      </p>

      <SignupForm initialRole={initialRole} referral={referral} />

      {googleEnabled && (
        <>
          <AuthDivider />
          <GoogleButton referral={referral} />
          <p className="mt-2 text-center text-xs text-zinc-500">
            With Google you&apos;ll choose trader or client on the next screen.
          </p>
        </>
      )}

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-zinc-200 hover:text-zinc-100">
          Sign in
        </Link>
      </p>
    </div>
  );
}
