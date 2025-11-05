export function Badge({ children, className = "", variant="default" }) {
  const variants = {
    default: "bg-black text-white",
    secondary: "bg-gray-200 text-gray-900",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${variants[variant]} ${className}`}>{children}</span>;
}
