interface SharedButtonProps {
	onClick: () => void;
	children: React.ReactNode;
}

interface SharedInputProps {
	value: string;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SharedButton({ onClick, children }: SharedButtonProps) {
	return <button onClick={onClick}>{children}</button>;
}

export function SharedInput({ value, onChange }: SharedInputProps) {
	return <input value={value} onChange={onChange} />;
}
