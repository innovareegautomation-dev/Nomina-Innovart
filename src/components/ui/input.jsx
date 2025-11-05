export function Input({ className = "", ...props }) {
  return <input className={`w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 ${className}`} {...props} />;
}
