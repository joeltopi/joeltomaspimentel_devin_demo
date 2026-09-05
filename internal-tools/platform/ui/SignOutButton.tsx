import { signOut } from "@platform/auth/config";
import { Button } from "./primitives";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <Button type="submit">Sign out</Button>
    </form>
  );
}
