import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@fontsource/cal-sans";
import "./globals.css";

const fontSans = Inter({
	subsets: ["latin"],
	variable: "--font-sans",
});

export const metadata: Metadata = {
	title: "LekhaFlow | Collaborative Canvas",
	description: "Real-time visual collaboration for teams",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${fontSans.variable} font-sans antialiased`}
				suppressHydrationWarning
			>
				{children}
			</body>
		</html>
	);
}
