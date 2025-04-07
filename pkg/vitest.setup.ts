import { RuleTester } from "@typescript-eslint/rule-tester";
import { it, describe } from "vitest";

// Configure RuleTester to use vitest
RuleTester.afterAll = function () {
	// empty
};
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

// Define global variables for testing
// @ts-expect-error - defining globals for tests
global.__PACKAGE_NAME__ = "eslint-plugin-react-use-client";
// @ts-expect-error - defining globals for tests
global.__PACKAGE_VERSION__ = "0.0.0-test";
