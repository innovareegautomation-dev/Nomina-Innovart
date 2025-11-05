import React from 'react'
export function Modal({ open, onClose, title, children, footer, className="" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className={`max-h-[85vh] w-[90vw] max-w-2xl overflow-auto rounded-2xl border bg-white p-4 ${className}`}>
        <div className="mb-2"><h3 className="text-lg font-semibold">{title}</h3></div>
        <div>{children}</div>
        <div className="mt-4 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}
