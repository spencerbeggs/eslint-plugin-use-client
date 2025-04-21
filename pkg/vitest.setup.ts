import { RuleTester } from "@typescript-eslint/rule-tester";
import { it, describe } from "vitest";

// Configure RuleTester to use vitest
RuleTester.afterAll = function () {
	// empty
};
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

// Configure timeout for CI environment
if (process.env.GITHUB_ACTIONS) {
	// Create a proxy for the it function to add timeout
	RuleTester.it = function (title, test) {
		it(title, test, 15000);
	};
	RuleTester.itOnly = function (title, test) {
		it.only(title, test, 15000);
	};
}

// Define global variables for testing
// @ts-expect-error - defining globals for tests
global.__PACKAGE_NAME__ = "eslint-plugin-react-use-client";
// @ts-expect-error - defining globals for tests
global.__PACKAGE_VERSION__ = "0.0.0-test";
