/**
 * Helper function to dedent a template string by removing the minimum common whitespace from each line
 */
export function dedent(strings: TemplateStringsArray, ...values: (string | undefined)[]): string {
	// Combine the template string with its values
	const str = strings.reduce((result, string, i) => {
		return result + string + (values[i] ?? "");
	}, "");

	// Split into lines and remove empty lines
	const lines = str.split("\n").filter((line) => line.trim());

	// Find the minimum indentation level
	const minIndent = Math.min(
		...lines
			.filter((line) => line.trim()) // Skip empty lines
			.map((line) => /^[ \t]*/.exec(line)?.[0].length ?? Infinity)
	);

	// Remove the common indentation from each line
	return lines.map((line) => line.slice(minIndent)).join("\n");
}
