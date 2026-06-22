import Link from "next/link";
import { LoginForm } from "./login-form";

// NextAuth may redirect a failed credentials sign-in back here with `?error=`
// rather than returning through the Server Action, so map those to a message.
const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
  Configuration: "Sign-in is temporarily unavailable. Try again shortly.",
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
      <h1 className="text-lg font-semibold text-slate-100">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Return to Quantidive.</p>

      <LoginForm initialMessage={initialMessage} notice={notice} />

      <p className="mt-6 text-center text-sm text-slate-500">
        New here?{" "}
        <Link href="/signup" className="font-medium text-blue-700 hover:text-blue-800">
          Create an account
        </Link>
      </p>
    </div>
  );
}
