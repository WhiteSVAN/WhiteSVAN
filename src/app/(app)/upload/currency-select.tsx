/** Account currency picker (server-safe, no hooks). Posts `currency`. */
import { inputClass, labelClass } from "@/components/form";
import { CURRENCIES, CURRENCY_LABELS, type CurrencyCode } from "@/lib/format";

export function CurrencySelect({
  id = "currency",
  defaultValue,
  showLabel = true,
}: {
  id?: string;
  defaultValue: CurrencyCode;
  showLabel?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={showLabel ? labelClass : "sr-only"}>
        Account currency
      </label>
      <select id={id} name="currency" defaultValue={defaultValue} className={inputClass}>
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {CURRENCY_LABELS[c]}
          </option>
        ))}
      </select>
    </div>
  );
}
