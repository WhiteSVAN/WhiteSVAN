/** Trader / Client radio cards. Server-safe (no hooks); the value posts as `role`. */
const ROLES = [
  { value: "TRADER", title: "Trader", body: "Import history, publish a record, share research." },
  { value: "CLIENT", title: "Client", body: "Discover traders, review records, request conversations." },
] as const;

export function RolePicker({ defaultRole }: { defaultRole?: "TRADER" | "CLIENT" }) {
  return (
    <fieldset>
      <legend className="block font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-400">
        I am joining as
      </legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {ROLES.map((role) => (
          <label
            key={role.value}
            className="flex cursor-pointer gap-3 rounded-md border border-zinc-700 bg-zinc-950 p-3 transition has-[:checked]:border-[#baf277] has-[:checked]:bg-[#141c16]"
          >
            <input type="radio" name="role" value={role.value} defaultChecked={defaultRole === role.value} required className="mt-1" />
            <span>
              <span className="block text-sm font-medium text-zinc-100">{role.title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-zinc-400">{role.body}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
