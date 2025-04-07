import React from "react";

export default function EventHandlers() {
	return (
		<div>
			<button
				onClick={() => {
					console.log("click");
				}}
			>
				Click
			</button>
			<input
				onChange={(e) => {
					console.log(e.target.value);
				}}
			/>
			<form
				onSubmit={(e) => {
					e.preventDefault();
				}}
			>
				Submit
			</form>
		</div>
	);
}
