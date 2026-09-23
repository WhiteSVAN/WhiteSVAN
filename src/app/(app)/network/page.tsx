import { redirect } from "next/navigation";

/** Trader discovery lives in one canonical directory. */
export default function NetworkPage() {
  redirect("/explore");
}
