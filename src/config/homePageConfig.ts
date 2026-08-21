import type { HomePageConfig } from "../types/homePageConfig";

export const homePageConfig: HomePageConfig = {
	hero: {
		enable: true,
		title: "Play & Build",
		typewriterTexts: [
			"UE / Unity 游戏开发学习与实战笔记",
			"从玩法原型到渲染管线，记录每一步",
			"C++、蓝图、Shader 与引擎源码",
			"热爱游戏，所以创造游戏",
		],
		description: "喜欢玩游戏，也热爱游戏开发。这里记录学习、实践和踩坑后的答案。",
		primaryCta: {
			text: "浏览文章",
			url: "#recent-posts",
			icon: "material-symbols:article-outline-rounded",
		},
		secondaryCta: {
			text: "关于我",
			url: "/about/",
			icon: "material-symbols:person-outline-rounded",
		},
	},
	statistics: [
		{
			key: "posts",
			label: "文章",
			icon: "material-symbols:article-outline",
		},
		{
			key: "categories",
			label: "分类",
			icon: "material-symbols:folder-outline",
		},
		{
			key: "tags",
			label: "标签",
			icon: "material-symbols:label-outline",
		},
	],
	pinned: {
		title: "置顶文章",
		limit: 3,
	},
	recent: {
		title: "最近文章",
		description: "持续记录游戏开发中的学习、实践与复盘。",
		defaultLayout: "list",
		storageKey: "homeRecentLayout",
	},
};
