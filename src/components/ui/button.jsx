export function Button({ children, className = "", variant = "default", size="md", ...props }) {
  const base = "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition";
  const variants = {
    default: "bg-black text-white hover:bg-gray-800",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    outline: "border border-gray-300 bg-white hover:bg-gray-50",
    ghost: "hover:bg-gray-100",
  };
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "", lg: "px-5 py-3 text-base", icon: "p-2" };
  return <button className={`${base} ${variants[variant]} ${sizes[size]||""} ${className}`} {...props}>{children}</button>;
}
