import { CheckCircle2, CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormMessage({ status, message }: { status: "idle" | "success" | "error"; message?: string }) {
  if (!message || status === "idle") return null;
  const isError = status === "error";
  return (
    <Alert variant={isError ? "destructive" : "default"} role={isError ? "alert" : "status"}>
      {isError ? <CircleAlert /> : <CheckCircle2 />}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
