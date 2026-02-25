import * as React from "react";

export interface InputProps
	extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className = "", type = "text", ...props }, ref) => {
		return (
			<input
				type={type}
				suppressHydrationWarning
				className={`
          flex h-10 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200
          disabled:cursor-not-allowed disabled:opacity-50
          hover:border-gray-400
          ${className}
        `}
				ref={ref}
				{...props}
			/>
		);
	},
);
Input.displayName = "Input";
