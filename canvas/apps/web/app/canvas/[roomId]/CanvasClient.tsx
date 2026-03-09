"use client";

import { useCallback, useEffect, useState } from "react";

export function CanvasClient({ roomId }: { roomId: string }) {
	const [canvasData, setCanvasData] = useState<string>("");
	const [status, setStatus] = useState<"saved" | "saving" | "unsaved">("saved");

	const saveCanvas = useCallback(
		async (data: string) => {
			setStatus("saving");
			try {
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_HTTP_URL || "https://lekhaflow.rishiikesh.me"}/api/v1/canvas/${roomId}`,
					{
						method: "PUT",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ data }),
					},
				);

				if (!response.ok) {
					throw new Error("Failed to save");
				}
				setStatus("saved");
			} catch (error) {
				console.error(error);
				setStatus("unsaved");
			}
		},
		[roomId],
	);

	// Debounce logic
	useEffect(() => {
		const timer = setTimeout(() => {
			if (canvasData) {
				saveCanvas(canvasData);
			}
		}, 1000); // 1 second debounce

		return () => clearTimeout(timer);
	}, [canvasData, saveCanvas]);

	return (
		<div style={{ padding: 20 }}>
			<h1>Canvas Room: {roomId}</h1>
			<p>Status: {status}</p>
			<textarea
				value={canvasData}
				onChange={(e) => setCanvasData(e.target.value)}
				placeholder="Type here to simulate drawing..."
				style={{ width: "100%", height: "400px", padding: 10 }}
			/>
		</div>
	);
}
