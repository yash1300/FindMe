import type { ComponentProps } from "react";
import { Label } from "@/components/ui/label";

type Props = ComponentProps<"select"> & {
  label: string;
  id: string;
  options: readonly { value: string; label: string }[];
};

/** A native select: fully accessible and familiar on phones, with no extra client code. */
export function SelectField({ label, id, options, ...props }: Props) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
