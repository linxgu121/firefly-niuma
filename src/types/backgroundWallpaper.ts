export type BackgroundWallpaperConfig = {
	mode: "banner" | "fullscreen" | "overlay" | "none"; // 壁纸模式：banner横幅模式、fullscreen全屏壁纸、overlay全屏透明覆盖模式或none纯色背景
	playerEnable?: boolean; // 是否启用背景视频播放，默认false
	src:
		| string
		| string[]
		| {
				desktop?: string | string[];
				mobile?: string | string[];
				playerUrl?: string | string[]; // 背景视频播放地址，支持单个视频路径或数组（多视频列表循环）
		  }; // 支持单个图片、图片数组或分别设置桌面端和移动端图片
	/** 根据当前可见壁纸的 cover 裁剪区域生成主题色。 */
	adaptivePalette?: {
		enabled: boolean;
		fallbackHue?: number;
		sampleSize?: number;
		cache?: "session" | "local" | "none";
		transitionMs?: number;
		respectManualHue?: boolean;
	};
	/** 后续动效阶段统一读取的能力开关；阶段 1 只建立配置接口。 */
	ambientEffects?: {
		cardSheen?: boolean;
		routeTransition?: boolean;
		/** 交互式壁纸水波：CPU 高度场模拟，WebGL 仅负责折射渲染。 */
		rippleRefraction?: WallpaperRippleConfig;
		particles?: {
			enabled: boolean;
			count?: number;
			mobile?: boolean;
		};
		respectReducedMotion?: boolean;
	};
	// 横幅壁纸和全屏壁纸共享配置
	common?: {
		dimOpacity?: number; // 横幅文字遮罩暗度，0-1之间，值越大越暗，默认0.15
		playerMode?: "order" | "random"; // 多视频播放模式："order" 顺序循环（默认），"random" 随机切换
		homeText?: {
			enable: boolean; // 是否在首页显示自定义文字（全局开关）
			title?: string; // 主标题
			subtitle?: string | string[]; // 副标题，支持单个字符串或字符串数组
			titleSize?: string; // 主标题字体大小，如 "3.5rem"
			subtitleSize?: string; // 副标题字体大小，如 "1.5rem"
			typewriter?: {
				enable: boolean; // 是否启用打字机效果
				speed: number; // 打字速度（毫秒）
				deleteSpeed: number; // 删除速度（毫秒）
				pauseTime: number; // 完整显示后的暂停时间（毫秒）
			};
		};
		postInfo?: {
			mode: "description" | "meta";
		};
		navbar?: {
			transparentMode?: "semi" | "full" | "semifull"; // 导航栏透明模式
			blur?: number; // 毛玻璃模糊度，0 即关闭导航栏毛玻璃
		};
		waves?: {
			enable:
				| boolean
				| {
						desktop: boolean; // 桌面端是否启用水波纹动画效果
						mobile: boolean; // 移动端是否启用水波纹动画效果
				  }; // 是否启用水波纹动画效果，支持布尔值或分别设置桌面端和移动端
		};
		// 渐变过渡效果配置，当水波纹关闭时自动启用，提供壁纸底部到背景色的平滑过渡
		gradient?: {
			enable:
				| boolean
				| {
						desktop: boolean; // 桌面端是否启用渐变过渡
						mobile: boolean; // 移动端是否启用渐变过渡
				  }; // 是否启用渐变过渡，支持布尔值或分别设置桌面端和移动端，默认true（水波纹关闭时自动生效）
			height?: string; // 渐变高度，默认 "30vh"
		};
		// 壁纸轮播配置，横幅壁纸和全屏壁纸共享
		carousel?: {
			enable: boolean; // 是否启用壁纸轮播
			interval?: number; // 轮播间隔时间，单位毫秒
			transitionEffect?: "fade" | "zoom" | "slide" | "kenburns"; // 过渡效果: 'fade' 渐变 | 'zoom' 缩放 | 'slide' 滑动 | 'kenburns' 旋转木马
		};
	};

	// Banner模式特有配置
	banner?: {
		position?:
			| "top"
			| "center"
			| "bottom"
			| "top left"
			| "top center"
			| "top right"
			| "center left"
			| "center center"
			| "center right"
			| "bottom left"
			| "bottom center"
			| "bottom right"
			| "left top"
			| "left center"
			| "left bottom"
			| "right top"
			| "right center"
			| "right bottom"
			| string; // 壁纸位置，支持CSS object-position的所有值，包括百分比和像素值
	};
	// 全屏透明覆盖模式特有配置
	overlay?: {
		zIndex?: number; // 层级，确保壁纸在合适的层级显示
		opacity?: number; // 壁纸透明度，0-1之间
		blur?: number; // 背景模糊程度，单位px
		cardOpacity?: number; // 兼容旧配置：未配置 glassMaterials 时的通用卡片透明度
		glassMaterials?: {
			/** 主内容区：Hero、分类条、文章卡片与正文面板。 */
			content?: GlassSurfaceConfig;
			/** 桌面左侧栏组件。 */
			leftSidebar?: GlassSurfaceConfig;
			/** 桌面右侧栏组件。 */
			rightSidebar?: GlassSurfaceConfig;
			/** 768px 以下主内容区的轻量材质，侧栏在移动端隐藏。 */
			mobile?: GlassSurfaceConfig;
		};
	};
	// 全屏壁纸模式特有配置
	fullscreen?: {
		position?: string; // 壁纸位置，支持CSS object-position的所有值
	};
};

export type WallpaperRippleConfig = {
	/** 总开关。 */
	enabled: boolean;
	/** 桌面端是否启用，默认 true。 */
	desktop?: boolean;
	/** 移动端是否启用，默认 false。 */
	mobile?: boolean;
	/** 生效的壁纸模式，默认 overlay 与 fullscreen。 */
	modes?: Array<"banner" | "fullscreen" | "overlay">;
	/** 一个模拟格点对应的 CSS 像素数。 */
	cellSize?: number;
	/** 慢速涟漪层阻尼。 */
	rippleDamping?: number;
	/** 快速鼠标尾迹层阻尼。 */
	trailDamping?: number;
	/** 折射纹理坐标偏移强度。 */
	refractionStrength?: number;
	/** 指针移动扰动半径，单位 CSS px。 */
	pointerRadius?: number;
	/** 指针移动扰动强度。 */
	pointerStrength?: number;
	/** 点击扰动半径，单位 CSS px。 */
	clickRadius?: number;
	/** 点击扰动强度。 */
	clickStrength?: number;
	/** 点击后回弹脉冲延迟，单位 ms。 */
	reboundDelayMs?: number;
	/** 回弹脉冲强度。 */
	reboundStrength?: number;
	/** 樱花落入水面时产生的轻量波纹。 */
	petalImpacts?: SakuraWaterImpactConfig;
	/** Canvas 最大设备像素比，限制 GPU 填充压力。 */
	maxDpr?: number;
	/** 无输入且波场平静后停止逐帧更新的等待时间。 */
	idleAfterMs?: number;
};

export type SakuraWaterImpactConfig = {
	/** 樱花与水面联动开关。 */
	enabled: boolean;
	/** 水面在视口中的垂直位置，0-1。 */
	waterline?: number;
	/** 单片樱花落水的波纹半径，单位 CSS px。 */
	radius?: number;
	/** 单片樱花落水的扰动强度。 */
	strength?: number;
	/** 两次落水波纹的最小间隔，单位 ms。 */
	minIntervalMs?: number;
};

export type GlassSurfaceConfig = {
	/** 表面不透明度，0-1。 */
	opacity?: number;
	/** 背景毛玻璃模糊度，单位 px。 */
	blur?: number;
	/** 背景饱和度，100 为原始色彩。 */
	saturation?: number;
	/** 玻璃边缘高光透明度，0-1。 */
	borderOpacity?: number;
	/** 与主题色联动的投影透明度，0-1。 */
	shadowOpacity?: number;
};
