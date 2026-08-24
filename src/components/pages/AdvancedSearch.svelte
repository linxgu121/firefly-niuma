<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { SearchResult } from "@/global";
import { url as formatUrl } from "@/utils/url-utils";

let keyword = "";
let results: SearchResult[] = [];
let isSearching = false;
let isInitializing = true;
let initialized = false;
let loadError = false;
let initialKeywordApplied = false;
let debounceTimer: ReturnType<typeof setTimeout>;

const fakeResult: SearchResult[] = [
	{
		url: formatUrl("/"),
		meta: { title: "Dev Mode Search Result 1" },
		excerpt: "This is a <mark>mock</mark> result for development.",
	},
	{
		url: formatUrl("/"),
		meta: { title: "Dev Mode Search Result 2" },
		excerpt: "Pagefind only works in <mark>production</mark> build.",
	},
];

const updateQueryString = () => {
	if (typeof window === "undefined") return;
	const currentUrl = new URL(window.location.href);
	const trimmedKeyword = keyword.trim();
	if (trimmedKeyword) {
		currentUrl.searchParams.set("q", trimmedKeyword);
	} else {
		currentUrl.searchParams.delete("q");
	}
	window.history.replaceState(window.history.state, "", currentUrl);
};

const search = async () => {
	const trimmedKeyword = keyword.trim();
	if (!initialized || !trimmedKeyword) {
		results = [];
		isSearching = false;
		return;
	}

	isSearching = true;
	loadError = false;

	try {
		if (import.meta.env.PROD && window.pagefind) {
			const response = await window.pagefind.search(trimmedKeyword);
			results = await Promise.all(response.results.map((item) => item.data()));
		} else if (import.meta.env.DEV) {
			results = fakeResult.filter(
				(item) =>
					item.excerpt.toLowerCase().includes(trimmedKeyword.toLowerCase()) ||
					item.meta.title.toLowerCase().includes(trimmedKeyword.toLowerCase()),
			);
		}
	} catch (error) {
		console.error("Search error:", error);
		results = [];
		loadError = true;
	} finally {
		isSearching = false;
	}
};

const initialize = async () => {
	if (initialized) return;
	initialized = true;
	isInitializing = false;
	loadError = false;

	if (!initialKeywordApplied && typeof window !== "undefined") {
		keyword = new URLSearchParams(window.location.search).get("q") || "";
		initialKeywordApplied = true;
	}

	if (keyword.trim()) await search();
};

const markLoadError = () => {
	initialized = false;
	isInitializing = false;
	isSearching = false;
	loadError = true;
	results = [];
};

const preparePagefind = async () => {
	isInitializing = true;
	loadError = false;

	if (import.meta.env.DEV || window.pagefind) {
		await initialize();
		return;
	}

	if (!window.__loadPagefind) {
		markLoadError();
		return;
	}

	await window.__loadPagefind();
	if (window.pagefind && !window.__pagefindLoadError) {
		await initialize();
	} else {
		markLoadError();
	}
};

const retryLoad = () => {
	if (window.pagefind) {
		loadError = false;
		void search();
		return;
	}
	window.__pagefindLoading = undefined;
	window.__pagefindLoadError = false;
	void preparePagefind();
};

const handleInput = () => {
	updateQueryString();
	clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		void search();
	}, 260);
};

onMount(() => {
	const handleReady = () => {
		void initialize();
	};
	const handleError = () => {
		markLoadError();
	};

	document.addEventListener("pagefindready", handleReady);
	document.addEventListener("pagefindloaderror", handleError);
	void preparePagefind();

	return () => {
		clearTimeout(debounceTimer);
		document.removeEventListener("pagefindready", handleReady);
		document.removeEventListener("pagefindloaderror", handleError);
	};
});
</script>

<section id="advanced-search" class="utility-search-panel card-base onload-animation" aria-label={i18n(I18nKey.search)}>
	<div class="utility-search-field">
		<label class="sr-only" for="utility-search-input">{i18n(I18nKey.search)}</label>
		<Icon icon="material-symbols:search" class="utility-search-icon" />
		<input
			id="utility-search-input"
			type="search"
			placeholder={i18n(I18nKey.search)}
			autocomplete="off"
			bind:value={keyword}
			on:input={handleInput}
		/>
	</div>

	<div class="utility-search-status" aria-live="polite" aria-atomic="true">
		{#if isInitializing || isSearching}
			{i18n(I18nKey.searchLoading)}
		{:else if keyword.trim() && results.length > 0}
			{results.length} {i18n(results.length === 1 ? I18nKey.postCount : I18nKey.postsCount)}
		{/if}
	</div>

	{#if isInitializing || isSearching}
		<div class="utility-search-skeletons" aria-hidden="true">
			<div class="utility-search-skeleton"><span></span><span></span></div>
			<div class="utility-search-skeleton"><span></span><span></span></div>
			<div class="utility-search-skeleton"><span></span><span></span></div>
		</div>
	{:else if loadError}
		<div class="utility-search-empty" role="alert">
			<Icon icon="material-symbols:error-outline" class="utility-search-state-icon" />
			<p>{i18n(I18nKey.searchLoadError)}</p>
			<button type="button" class="utility-action utility-action-secondary" on:click={retryLoad}>
				<Icon icon="material-symbols:sync-rounded" />
				<span>{i18n(I18nKey.retry)}</span>
			</button>
		</div>
	{:else if results.length > 0}
		<ol class="utility-search-results">
			{#each results as result}
				<li>
					<a href={result.url} class="utility-search-result">
						<h2>{@html result.meta.title}</h2>
						<p>{@html result.excerpt}</p>
						<Icon icon="material-symbols:chevron-right-rounded" class="utility-search-chevron" />
					</a>
				</li>
			{/each}
		</ol>
	{:else}
		<div class="utility-search-empty">
			<Icon
				icon={keyword.trim() ? "material-symbols:search-off" : "material-symbols:search"}
				class="utility-search-state-icon"
			/>
			<p>{keyword.trim() ? i18n(I18nKey.searchNoResults) : i18n(I18nKey.searchTypeSomething)}</p>
		</div>
	{/if}
</section>

<style>
	.utility-search-panel {
		min-height: 18rem;
		padding: 1.5rem 1.75rem;
	}

	.utility-search-field {
		position: relative;
	}

	.utility-search-icon {
		position: absolute;
		top: 50%;
		left: 0.95rem;
		color: var(--text-tertiary);
		font-size: 1.35rem;
		pointer-events: none;
		transform: translateY(-50%);
	}

	.utility-search-field input {
		width: 100%;
		height: 3.15rem;
		padding: 0 1rem 0 2.9rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.75rem;
		background: color-mix(in oklab, var(--card-bg) 68%, transparent);
		color: var(--text-primary);
		font-size: 0.95rem;
		outline: none;
		transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
	}

	.utility-search-field input:hover {
		border-color: var(--border-strong);
	}

	.utility-search-field input:focus {
		border-color: var(--primary);
		background: var(--card-bg);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 24%, transparent);
	}

	.utility-search-status {
		min-height: 2.35rem;
		padding: 0.8rem 0.15rem 0.45rem;
		color: var(--text-tertiary);
		font-size: 0.78rem;
	}

	.utility-search-results {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.utility-search-results li + li {
		border-top: 1px solid var(--line-divider);
	}

	.utility-search-result {
		display: grid;
		min-width: 0;
		grid-template-columns: minmax(0, 1fr) 1.5rem;
		gap: 0.35rem 1rem;
		padding: 1.05rem 0.75rem;
		border-radius: 0.75rem;
		outline: none;
		transition: background-color 180ms ease;
	}

	.utility-search-result:hover,
	.utility-search-result:focus-visible {
		background: color-mix(in oklab, var(--primary) 8%, transparent);
	}

	.utility-search-result:focus-visible {
		box-shadow: inset 0 0 0 2px var(--primary);
	}

	.utility-search-result h2,
	.utility-search-result p {
		min-width: 0;
	}

	.utility-search-result h2 {
		grid-column: 1;
		margin: 0;
		color: var(--text-primary);
		font-size: 1.05rem;
		font-weight: 720;
		line-height: 1.45;
	}

	.utility-search-result p {
		grid-column: 1;
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.84rem;
		line-height: 1.65;
	}

	.utility-search-chevron {
		grid-column: 2;
		grid-row: 1 / span 2;
		align-self: center;
		color: var(--text-tertiary);
		font-size: 1.3rem;
	}

	.utility-search-empty {
		display: flex;
		min-height: 10rem;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		color: var(--text-secondary);
		text-align: center;
	}

	.utility-search-empty p {
		margin: 0;
		line-height: 1.6;
	}

	.utility-search-state-icon {
		color: var(--primary);
		font-size: 2.25rem;
		opacity: 0.72;
	}

	.utility-search-skeletons {
		display: grid;
		gap: 0;
	}

	.utility-search-skeleton {
		display: grid;
		gap: 0.7rem;
		padding: 1.05rem 0.75rem;
		border-top: 1px solid var(--line-divider);
	}

	.utility-search-skeleton span {
		display: block;
		height: 0.75rem;
		width: min(72%, 25rem);
		border-radius: 0.4rem;
		background: color-mix(in oklab, var(--text-tertiary) 18%, transparent);
		animation: utility-search-pulse 1.2s ease-in-out infinite alternate;
	}

	.utility-search-skeleton span:first-child {
		height: 0.95rem;
		width: min(48%, 16rem);
	}

	:global(mark) {
		padding: 0 0.1em;
		background: transparent;
		color: var(--primary);
		font-weight: 650;
	}

	@keyframes utility-search-pulse {
		from { opacity: 0.45; }
		to { opacity: 0.9; }
	}

	@media (max-width: 639px) {
		.utility-search-panel {
			min-height: 16rem;
			padding: 1rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.utility-search-field input,
		.utility-search-result {
			transition: none;
		}

		.utility-search-skeleton span {
			animation: none;
			opacity: 0.72;
		}
	}

	@media (prefers-reduced-transparency: reduce) {
		.utility-search-field input {
			background: var(--card-bg);
		}
	}
</style>
