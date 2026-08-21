export type HomeStatKey = "posts" | "categories" | "tags";

export interface HomeCtaConfig {
	text: string;
	url: string;
	icon: string;
	external?: boolean;
}

export interface HomePageConfig {
	hero: {
		enable: boolean;
		title: string;
		typewriterTexts: string[];
		description: string;
		primaryCta: HomeCtaConfig;
		secondaryCta: HomeCtaConfig;
	};
	statistics: Array<{
		key: HomeStatKey;
		label: string;
		icon: string;
	}>;
	pinned: {
		title: string;
		limit: number;
	};
	recent: {
		title: string;
		description: string;
		defaultLayout: "list" | "grid";
		storageKey: string;
	};
}
