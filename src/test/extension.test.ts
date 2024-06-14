import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { generateFriendlyPromptName } from '../utils/runbookFilename';
import { parseGitHubRef, parseGitHubURL } from '../utils/promptPicker';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('generateFriendlyPromptName', () => {
		assert.strictEqual(generateFriendlyPromptName("github:docker/labs-make-runbook?ref=main&path=prompts/git_smoosh"), "gh-docker-labs-make-runbook-prompts-git_smoosh");
		assert.strictEqual(generateFriendlyPromptName("npm"), "npm");
	});

	test('parseRefs', () => {
		const urls = [
			"https://github.com/docker/labs-make-runbook/tree/main/prompts/docker",
			"https://github.com/docker/labs-make-runbook/tree/main/prompts/npm_setup",
		];

		const refs = [
			"github:docker/labs-make-runbook?ref=main&path=prompts/docker",
			"github:docker/labs-make-runbook?ref=main&path=prompts/npm_setup",
		];

		urls.forEach((url, i) => {
			const ref = refs[i];
			const parsed = parseGitHubURL(url)!;
			assert.notStrictEqual(parsed, undefined);
			assert.strictEqual(parsed.owner, "docker");
			assert.strictEqual(parsed.repo, "labs-make-runbook");
			assert.strictEqual(parsed.ref, "main");
			assert.strictEqual(parsed.args.path.length > 0, true);
			assert.strictEqual(parsed.toRef(), ref);
		});

		refs.forEach((ref, i) => {
			const url = urls[i];
			const parsed = parseGitHubRef(ref)!;
			assert.notStrictEqual(parsed, undefined);
			assert.strictEqual(parsed.owner, "docker");
			assert.strictEqual(parsed.repo, "labs-make-runbook");
			assert.strictEqual(parsed.ref, "main");
			assert.strictEqual(parsed.args.path.length > 0, true);
			assert.strictEqual(parsed.toURL(), url);
		});
	});

	test('refToRefString', () => {
		const urls = [
			"https://github.com/docker/labs-make-runbook/tree/main/prompts/docker",
			"https://github.com/docker/labs-make-runbook/tree/main/prompts/npm_setup",
			"https://github.com/docker/labs-make-runbook/tree/main/",
		];

		const refs = [
			"github:docker/labs-make-runbook?ref=main&path=prompts/docker",
			"github:docker/labs-make-runbook?ref=main&path=prompts/npm_setup",
			"github:docker/labs-make-runbook?ref=main",
		];

		urls.forEach((url, i) => {
			const ref = refs[i];
			const parsedURL = parseGitHubURL(url)!;
			const parsedRef = parseGitHubRef(ref)!;
			assert.strictEqual(parsedURL.toRef(), parsedRef.toRef());
		});
	});

	test('refToURL', () => {

	});

	test('refToString', () => {

	});
});
