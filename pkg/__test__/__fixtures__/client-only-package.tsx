import { DialogTitle, Dialog, Description } from "@headlessui/react";
import { useState } from "react";

export default function WithDialog() {
	const [isOpen, setIsOpen] = useState(true);
	return (
		<Dialog open={isOpen} onClose={setIsOpen}>
			<DialogTitle>Dialog Title</DialogTitle>
			<Description>Dialog Content</Description>
		</Dialog>
	);
}
