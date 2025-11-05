export function Alert({ className = "", children }) {
  return <div className={`rounded-2xl border bg-white ${className}`}>{children}</div>;
}
export function AlertTitle({ children }) { return <div className="px-4 pt-4 text-sm font-semibold"> {children} </div>; }
export function AlertDescription({ children }) { return <div className="px-4 pb-4 text-sm text-gray-600"> {children} </div>; }
