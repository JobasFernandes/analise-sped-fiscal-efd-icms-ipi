import * as DialogPrimitive from "@radix-ui/react-dialog";
import React from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogContent({ className, children, ...props }) {
  return (
    <DialogPortal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={clsx(
          "fixed left-1/2 top-1/2 z-50 flex flex-col w-[98vw] max-w-[1400px] max-h-[92vh] translate-x-[-50%] translate-y-[-50%] border bg-card text-card-foreground shadow-lg duration-200 p-0 rounded-lg overflow-hidden",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <X className="h-5 w-5" />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }) {
  return (
    <div
      className={clsx("flex items-center justify-between p-6 border-b", className)}
      {...props}
    />
  );
}
export function DialogBody({ className, ...props }) {
  return <div className={clsx("p-6", className)} {...props} />;
}
export function DialogFooter({ className, ...props }) {
  return (
    <div
      className={clsx(
        "p-4 border-t bg-muted/30 text-sm text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}
