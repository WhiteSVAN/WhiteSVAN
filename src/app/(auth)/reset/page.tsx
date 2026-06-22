import Link from "next/link";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-100">Set a new password</h1>

      {token ? (
        <>
          <p className="mt-1 text-sm text-slate-500">Choose a new password for your account.</p>
          <ResetForm token={token} />
        </>
      ) : (
        <div className="mt-6 rounded-lg border border-red-900/60 bg-red-950/60 px-3 py-2 text-sm text-red-200">
          This reset link is missing its token.{" "}
          <Link href="/forgot" className="font-medium underline hover:text-red-100">
            Request a new one
          </Link>
          .
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="font-medium text-blue-700 hover:text-blue-800">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
