import { type FormEvent, startTransition } from "react";

// Sends a form to its server action without letting React empty the
// fields afterwards, so what the user chose stays when the server sends
// the form back with a message. Used as onSubmit next to action={...}:
// without JavaScript the browser still sends the form the usual way.
export function submitKeepingFields(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };
}
