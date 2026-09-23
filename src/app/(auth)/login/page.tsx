import Link from "next/link";
import { googleEnabled } from "@/auth";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "./login-form";

// NextAuth may redirect a failed credentials sign-in back here with `?error=`
// rather than returning through the Server Action, so map those to a message.
const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
  Configuration: "Sign-in is temporarily unavailable. Try again shortly.",
  AccessDenied: "That Google account's email isn't verified, so we can't sign you in with it.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  const initialMessage = sp.error
    ? (ERROR_MESSAGES[sp.error] ?? "We couldn't sign you in. Check your details and try again.")
    : undefined;
  const notice = sp.reset ? "Password updated — sign in with your new password." : undefined;

  return (
    <div>
      <h1 className="text-lg font-semibold text-zinc-100">Sign in</h1>
      <p className="mt-1 text-sm text-zinc-500">Return to TrustSVAN.</p>

      <LoginForm initialMessage={initialMessage} notice={notice} />

      {googleEnabled && (
        <>
          <AuthDivider />
          <GoogleButton />
        </>
      )}

      <p className="mt-6 text-center text-sm text-zinc-500">
        New here?{" "}
        <Link href="/signup" className="font-medium text-zinc-200 hover:text-zinc-100">
          Create an account
        </Link>
      </p>
    </div>
  );
}
