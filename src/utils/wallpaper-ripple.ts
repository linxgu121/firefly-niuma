import type { WallpaperRippleConfig } from "@/types/backgroundWallpaper";

type WallpaperMode = "banner" | "fullscreen" | "overlay";
type RendererKind = "fallback" | "webgl";

interface ResolvedRippleConfig {
	enabled: boolean;
	desktop: boolean;
	mobile: boolean;
	modes: WallpaperMode[];
	cellSize: number;
	rippleDamping: number;
	trailDamping: number;
	refractionStrength: number;
	pointerRadius: number;
	pointerStrength: number;
	clickRadius: number;
	clickStrength: number;
	reboundDelayMs: number;
	reboundStrength: number;
	maxDpr: number;
	idleAfterMs: number;
}

interface RippleRenderer {
	readonly kind: RendererKind;
	resize(
		cssWidth: number,
		cssHeight: number,
		gridWidth: number,
		gridHeight: number,
	): void;
	render(field: Float32Array): void;
	destroy(): void;
}

const FIXED_STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 4;
const QUIET_ENERGY = 0.0008;

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

export const resolveWallpaperRippleConfig = (
	config: WallpaperRippleConfig,
): ResolvedRippleConfig => ({
	enabled: config.enabled,
	desktop: config.desktop ?? true,
	mobile: config.mobile ?? false,
	modes: config.modes ?? ["overlay", "fullscreen"],
	cellSize: clamp(config.cellSize ?? 5, 4, 12),
	rippleDamping: clamp(config.rippleDamping ?? 0.988, 0.9, 0.9995),
	trailDamping: clamp(config.trailDamping ?? 0.92, 0.82, 0.98),
	refractionStrength: clamp(config.refractionStrength ?? 0.032, 0.004, 0.08),
	pointerRadius: clamp(config.pointerRadius ?? 16, 8, 48),
	pointerStrength: clamp(config.pointerStrength ?? -0.2, -1, 1),
	clickRadius: clamp(config.clickRadius ?? 42, 18, 96),
	clickStrength: clamp(config.clickStrength ?? -1.1, -2.5, 2.5),
	reboundDelayMs: clamp(config.reboundDelayMs ?? 400, 120, 900),
	reboundStrength: clamp(config.reboundStrength ?? 0.32, -1.5, 1.5),
	maxDpr: clamp(config.maxDpr ?? 1.5, 1, 2),
	idleAfterMs: clamp(config.idleAfterMs ?? 1200, 500, 5000),
});

class WaveLayer {
	width = 0;
	height = 0;
	current = new Float32Array(0);
	previous = new Float32Array(0);

	constructor(private readonly damping: number) {}

	resize(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.current = new Float32Array(width * height);
		this.previous = new Float32Array(width * height);
	}

	disturb(x: number, y: number, radius: number, strength: number) {
		if (this.width < 3 || this.height < 3 || radius <= 0) return;

		const minX = Math.max(1, Math.floor(x - radius));
		const maxX = Math.min(this.width - 2, Math.ceil(x + radius));
		const minY = Math.max(1, Math.floor(y - radius));
		const maxY = Math.min(this.height - 2, Math.ceil(y + radius));
		const radiusSquared = radius * radius;
		const gaussianScale = Math.max(radiusSquared * 0.38, 0.001);

		for (let row = minY; row <= maxY; row += 1) {
			for (let column = minX; column <= maxX; column += 1) {
				const dx = column - x;
				const dy = row - y;
				const distanceSquared = dx * dx + dy * dy;
				if (distanceSquared > radiusSquared) continue;
				const weight = Math.exp(-distanceSquared / gaussianScale);
				this.current[row * this.width + column] += strength * weight;
			}
		}
	}

	step() {
		if (this.width < 3 || this.height < 3) return;
		const current = this.current;
		const next = this.previous;
		const width = this.width;
		const height = this.height;

		next.fill(0, 0, width);
		next.fill(0, (height - 1) * width);
		for (let row = 1; row < height - 1; row += 1) {
			const rowOffset = row * width;
			next[rowOffset] = 0;
			next[rowOffset + width - 1] = 0;
			for (let column = 1; column < width - 1; column += 1) {
				const index = rowOffset + column;
				next[index] =
					((current[index - 1] +
						current[index + 1] +
						current[index - width] +
						current[index + width]) *
						0.5 -
						next[index]) *
					this.damping;
			}
		}

		this.previous = current;
		this.current = next;
	}

	clear() {
		this.current.fill(0);
		this.previous.fill(0);
	}
}

class RippleSimulation {
	readonly ripple: WaveLayer;
	readonly trail: WaveLayer;
	width = 0;
	height = 0;
	output = new Float32Array(0);

	constructor(rippleDamping: number, trailDamping: number) {
		this.ripple = new WaveLayer(rippleDamping);
		this.trail = new WaveLayer(trailDamping);
	}

	resize(width: number, height: number) {
		if (width === this.width && height === this.height) return;
		this.width = width;
		this.height = height;
		this.ripple.resize(width, height);
		this.trail.resize(width, height);
		this.output = new Float32Array(width * height);
	}

	injectTrail(x: number, y: number, radius: number, strength: number) {
		this.ripple.disturb(x, y, radius * 0.72, strength * 0.42);
		this.trail.disturb(x, y, radius, strength);
	}

	injectRipple(x: number, y: number, radius: number, strength: number) {
		this.ripple.disturb(x, y, radius, strength);
		this.trail.disturb(x, y, radius * 0.55, strength * 0.3);
	}

	step() {
		this.ripple.step();
		this.trail.step();
	}

	compose(): Float32Array {
		const slow = this.ripple.current;
		const fast = this.trail.current;
		for (let index = 0; index < this.output.length; index += 1) {
			this.output[index] = slow[index] + fast[index] * 0.48;
		}
		return this.output;
	}

	energy(): number {
		if (this.output.length === 0) return 0;
		let sum = 0;
		let samples = 0;
		for (let index = 0; index < this.output.length; index += 16) {
			sum += Math.abs(this.output[index]);
			samples += 1;
		}
		return samples > 0 ? sum / samples : 0;
	}

	clear() {
		this.ripple.clear();
		this.trail.clear();
		this.output.fill(0);
	}
}

const createShader = (
	gl: WebGL2RenderingContext,
	type: number,
	source: string,
) => {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("无法创建水波着色器");
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader) ?? "未知着色器错误";
		gl.deleteShader(shader);
		throw new Error(message);
	}
	return shader;
};

const createProgram = (gl: WebGL2RenderingContext) => {
	const vertexShader = createShader(
		gl,
		gl.VERTEX_SHADER,
		`#version 300 es
		in vec2 a_position;
		out vec2 v_uv;
		void main() {
			v_uv = a_position * 0.5 + 0.5;
			gl_Position = vec4(a_position, 0.0, 1.0);
		}`,
	);
	const fragmentShader = createShader(
		gl,
		gl.FRAGMENT_SHADER,
		`#version 300 es
		precision highp float;
		uniform sampler2D u_wallpaper;
		uniform sampler2D u_height;
		uniform vec2 u_viewport_size;
		uniform vec2 u_image_size;
		uniform vec2 u_height_texel;
		uniform float u_refraction;
		uniform float u_wallpaper_scale;
		uniform bool u_manual_height_filter;
		in vec2 v_uv;
		out vec4 out_color;

		vec2 cover_uv(vec2 uv) {
			float viewport_aspect = u_viewport_size.x / max(u_viewport_size.y, 1.0);
			float image_aspect = u_image_size.x / max(u_image_size.y, 1.0);
			vec2 covered = uv;
			if (viewport_aspect > image_aspect) {
				float visible_height = image_aspect / viewport_aspect;
				covered.y = (uv.y - 0.5) * visible_height + 0.5;
			} else {
				float visible_width = viewport_aspect / image_aspect;
				covered.x = (uv.x - 0.5) * visible_width + 0.5;
			}
			return (covered - 0.5) / u_wallpaper_scale + 0.5;
		}

		float read_height_texel(vec2 texel_position) {
			vec2 texture_size = 1.0 / u_height_texel;
			vec2 clamped_texel = clamp(
				texel_position,
				vec2(0.0),
				texture_size - 1.0
			);
			return texture(
				u_height,
				(clamped_texel + 0.5) * u_height_texel
			).r;
		}

		float sample_height(vec2 field_uv) {
			vec2 clamped_uv = clamp(field_uv, vec2(0.0), vec2(1.0));
			if (!u_manual_height_filter) {
				return texture(u_height, clamped_uv).r;
			}
			vec2 texture_size = 1.0 / u_height_texel;
			vec2 texel_position = clamped_uv * texture_size - 0.5;
			vec2 base_texel = floor(texel_position);
			vec2 blend = fract(texel_position);
			float top_left = read_height_texel(base_texel);
			float top_right = read_height_texel(base_texel + vec2(1.0, 0.0));
			float bottom_left = read_height_texel(base_texel + vec2(0.0, 1.0));
			float bottom_right = read_height_texel(base_texel + vec2(1.0, 1.0));
			return mix(
				mix(top_left, top_right, blend.x),
				mix(bottom_left, bottom_right, blend.x),
				blend.y
			);
		}

		vec2 viewport_to_field(vec2 viewport_uv) {
			vec2 field_inset = u_height_texel * 1.5;
			vec2 field_span = vec2(1.0) - field_inset * 2.0;
			return field_inset + vec2(viewport_uv.x, 1.0 - viewport_uv.y) * field_span;
		}

		void main() {
			vec2 field_uv = viewport_to_field(v_uv);
			float left_h = sample_height(field_uv - vec2(u_height_texel.x, 0.0));
			float right_h = sample_height(field_uv + vec2(u_height_texel.x, 0.0));
			float top_h = sample_height(field_uv - vec2(0.0, u_height_texel.y));
			float bottom_h = sample_height(field_uv + vec2(0.0, u_height_texel.y));
			float center_h = sample_height(field_uv);
			vec2 gradient = vec2(right_h - left_h, bottom_h - top_h);
			vec2 smooth_gradient = gradient / (1.0 + length(gradient) * 0.85);
			vec2 displaced = clamp(
				v_uv + smooth_gradient * u_refraction * vec2(1.0, 0.72),
				vec2(0.0),
				vec2(1.0)
			);
			vec3 color = texture(u_wallpaper, cover_uv(displaced)).rgb;
			float curvature = abs(left_h + right_h + top_h + bottom_h - 4.0 * center_h);
			float highlight = smoothstep(0.025, 0.34, length(gradient)) * 0.07;
			highlight += smoothstep(0.035, 0.45, curvature) * 0.045;
			color += vec3(0.78, 0.9, 1.0) * highlight;
			out_color = vec4(color, 1.0);
		}`,
	);

	const program = gl.createProgram();
	if (!program) throw new Error("无法创建水波渲染程序");
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program) ?? "未知链接错误";
		gl.deleteProgram(program);
		throw new Error(message);
	}
	return program;
};

class WebGLRippleRenderer implements RippleRenderer {
	readonly kind = "webgl" as const;
	private readonly gl: WebGL2RenderingContext;
	private readonly program: WebGLProgram;
	private readonly positionBuffer: WebGLBuffer;
	private readonly wallpaperTexture: WebGLTexture;
	private readonly heightTexture: WebGLTexture;
	private readonly uniforms: {
		viewportSize: WebGLUniformLocation;
		imageSize: WebGLUniformLocation;
		heightTexel: WebGLUniformLocation;
		refraction: WebGLUniformLocation;
		wallpaperScale: WebGLUniformLocation;
		manualHeightFilter: WebGLUniformLocation;
	};
	private imageWidth = 1;
	private imageHeight = 1;
	private gridWidth = 0;
	private gridHeight = 0;

	constructor(
		private readonly canvas: HTMLCanvasElement,
		image: HTMLImageElement,
		private readonly config: ResolvedRippleConfig,
	) {
		const gl = canvas.getContext("webgl2", {
			alpha: false,
			antialias: false,
			depth: false,
			stencil: false,
			preserveDrawingBuffer: false,
			powerPreference: "low-power",
		});
		if (!gl) throw new Error("WebGL2 不可用");
		this.gl = gl;
		this.program = createProgram(gl);

		const positionBuffer = gl.createBuffer();
		const wallpaperTexture = gl.createTexture();
		const heightTexture = gl.createTexture();
		if (!positionBuffer || !wallpaperTexture || !heightTexture) {
			throw new Error("无法分配水波 GPU 资源");
		}
		this.positionBuffer = positionBuffer;
		this.wallpaperTexture = wallpaperTexture;
		this.heightTexture = heightTexture;

		const uniform = (name: string) => {
			const location = gl.getUniformLocation(this.program, name);
			if (!location) throw new Error(`缺少水波 uniform: ${name}`);
			return location;
		};
		this.uniforms = {
			viewportSize: uniform("u_viewport_size"),
			imageSize: uniform("u_image_size"),
			heightTexel: uniform("u_height_texel"),
			refraction: uniform("u_refraction"),
			wallpaperScale: uniform("u_wallpaper_scale"),
			manualHeightFilter: uniform("u_manual_height_filter"),
		};

		gl.useProgram(this.program);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 3, -1, -1, 3]),
			gl.STATIC_DRAW,
		);
		const positionLocation = gl.getAttribLocation(this.program, "a_position");
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.wallpaperTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		// DOM 壁纸需要翻转，高度数组则保持 CPU 的从上到下行序。
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		this.imageWidth = image.naturalWidth || 1;
		this.imageHeight = image.naturalHeight || 1;

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.heightTexture);
		const supportsFloatLinear = Boolean(
			gl.getExtension("OES_texture_float_linear"),
		);
		const heightFilter = supportsFloatLinear ? gl.LINEAR : gl.NEAREST;
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, heightFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, heightFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		gl.uniform1i(gl.getUniformLocation(this.program, "u_wallpaper"), 0);
		gl.uniform1i(gl.getUniformLocation(this.program, "u_height"), 1);
		gl.uniform1f(this.uniforms.refraction, config.refractionStrength);
		gl.uniform1f(this.uniforms.wallpaperScale, 1.05);
		gl.uniform1i(this.uniforms.manualHeightFilter, supportsFloatLinear ? 0 : 1);
	}

	resize(
		cssWidth: number,
		cssHeight: number,
		gridWidth: number,
		gridHeight: number,
	) {
		const dpr = Math.min(window.devicePixelRatio || 1, this.config.maxDpr);
		const renderWidth = Math.max(1, Math.round(cssWidth * dpr));
		const renderHeight = Math.max(1, Math.round(cssHeight * dpr));
		if (
			this.canvas.width !== renderWidth ||
			this.canvas.height !== renderHeight
		) {
			this.canvas.width = renderWidth;
			this.canvas.height = renderHeight;
		}
		this.gl.viewport(0, 0, renderWidth, renderHeight);
		this.gl.useProgram(this.program);
		this.gl.uniform2f(this.uniforms.viewportSize, cssWidth, cssHeight);
		this.gl.uniform2f(
			this.uniforms.imageSize,
			this.imageWidth,
			this.imageHeight,
		);

		if (gridWidth !== this.gridWidth || gridHeight !== this.gridHeight) {
			this.gridWidth = gridWidth;
			this.gridHeight = gridHeight;
			this.gl.activeTexture(this.gl.TEXTURE1);
			this.gl.bindTexture(this.gl.TEXTURE_2D, this.heightTexture);
			this.gl.texImage2D(
				this.gl.TEXTURE_2D,
				0,
				this.gl.R32F,
				gridWidth,
				gridHeight,
				0,
				this.gl.RED,
				this.gl.FLOAT,
				null,
			);
			this.gl.uniform2f(
				this.uniforms.heightTexel,
				1 / Math.max(1, gridWidth),
				1 / Math.max(1, gridHeight),
			);
		}
	}

	render(field: Float32Array) {
		const gl = this.gl;
		gl.useProgram(this.program);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.heightTexture);
		gl.texSubImage2D(
			gl.TEXTURE_2D,
			0,
			0,
			0,
			this.gridWidth,
			this.gridHeight,
			gl.RED,
			gl.FLOAT,
			field,
		);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	destroy() {
		const gl = this.gl;
		gl.deleteBuffer(this.positionBuffer);
		gl.deleteTexture(this.wallpaperTexture);
		gl.deleteTexture(this.heightTexture);
		gl.deleteProgram(this.program);
	}
}

class CanvasRippleRenderer implements RippleRenderer {
	readonly kind = "fallback" as const;
	private readonly context: CanvasRenderingContext2D;
	private gridWidth = 0;
	private gridHeight = 0;
	private cssWidth = 0;
	private cssHeight = 0;

	constructor(
		private readonly canvas: HTMLCanvasElement,
		private readonly config: ResolvedRippleConfig,
	) {
		const context = canvas.getContext("2d", { alpha: true });
		if (!context) throw new Error("Canvas 2D 不可用");
		this.context = context;
	}

	resize(
		cssWidth: number,
		cssHeight: number,
		gridWidth: number,
		gridHeight: number,
	) {
		const dpr = Math.min(window.devicePixelRatio || 1, this.config.maxDpr);
		this.cssWidth = cssWidth;
		this.cssHeight = cssHeight;
		this.gridWidth = gridWidth;
		this.gridHeight = gridHeight;
		this.canvas.width = Math.max(1, Math.round(cssWidth * dpr));
		this.canvas.height = Math.max(1, Math.round(cssHeight * dpr));
		this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	render(field: Float32Array) {
		const context = this.context;
		context.clearRect(0, 0, this.cssWidth, this.cssHeight);
		context.save();
		context.globalCompositeOperation = "screen";
		context.lineWidth = 1;
		context.lineCap = "round";
		const xScale = this.cssWidth / Math.max(1, this.gridWidth - 3);
		const yScale = this.cssHeight / Math.max(1, this.gridHeight - 3);

		for (let row = 2; row < this.gridHeight - 2; row += 3) {
			for (let column = 2; column < this.gridWidth - 2; column += 3) {
				const index = row * this.gridWidth + column;
				const dx = field[index + 1] - field[index - 1];
				const dy =
					field[index + this.gridWidth] - field[index - this.gridWidth];
				const magnitude = Math.hypot(dx, dy);
				if (magnitude < 0.025) continue;
				const alpha = Math.min(0.2, magnitude * 0.24);
				const length = Math.min(7, 2 + magnitude * 6);
				const centerX = (column - 1) * xScale;
				const centerY = (row - 1) * yScale;
				const inverse = 1 / Math.max(magnitude, 0.0001);
				const normalX = -dy * inverse;
				const normalY = dx * inverse;
				context.strokeStyle = `rgba(222, 242, 255, ${alpha})`;
				context.beginPath();
				context.moveTo(centerX - normalX * length, centerY - normalY * length);
				context.lineTo(centerX + normalX * length, centerY + normalY * length);
				context.stroke();
			}
		}
		context.restore();
	}

	destroy() {
		this.context.clearRect(0, 0, this.cssWidth, this.cssHeight);
	}
}

const waitForWallpaperImage = (
	wrapper: HTMLElement,
	timeoutMs = 5000,
): Promise<HTMLImageElement | null> => {
	const findLoaded = () => {
		const images = Array.from(
			wrapper.querySelectorAll<HTMLImageElement>(
				"#banner-images-container img",
			),
		);
		return (
			images.find((image) => image.complete && image.naturalWidth > 0) ?? null
		);
	};
	const immediate = findLoaded();
	if (immediate) return Promise.resolve(immediate);

	return new Promise((resolve) => {
		let settled = false;
		const finish = (image: HTMLImageElement | null) => {
			if (settled) return;
			settled = true;
			observer.disconnect();
			window.clearTimeout(timeout);
			wrapper.removeEventListener("load", onLoad, true);
			resolve(image);
		};
		const onLoad = (event: Event) => {
			if (!(event.target instanceof HTMLImageElement)) return;
			if (!event.target.closest("#banner-images-container")) return;
			finish(event.target);
		};
		const observer = new MutationObserver(() => {
			const image = findLoaded();
			if (image) finish(image);
		});
		const timeout = window.setTimeout(() => finish(findLoaded()), timeoutMs);
		wrapper.addEventListener("load", onLoad, true);
		observer.observe(wrapper, { childList: true, subtree: true });
	});
};

export class WallpaperRippleController {
	private canvas: HTMLCanvasElement;
	private readonly wrapper: HTMLElement;
	private readonly config: ResolvedRippleConfig;
	private readonly simulation: RippleSimulation;
	private renderer: RippleRenderer | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private animationFrame = 0;
	private lastFrameTime = 0;
	private accumulator = 0;
	private lastInputTime = 0;
	private energyFrame = 0;
	private lastPointerX = Number.NaN;
	private lastPointerY = Number.NaN;
	private lastPointerTime = 0;
	private gridWidth = 0;
	private gridHeight = 0;
	private active = false;
	private destroyed = false;
	private initialization: Promise<void> | null = null;
	private reboundTimers = new Set<number>();
	private readonly desktopQuery = window.matchMedia("(min-width: 1024px)");
	private readonly reducedMotionQuery = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	);

	constructor(canvas: HTMLCanvasElement, config: WallpaperRippleConfig) {
		const wrapper = canvas.closest<HTMLElement>("#wallpaper-wrapper");
		if (!wrapper) throw new Error("水波 Canvas 必须位于壁纸容器内");
		this.canvas = canvas;
		this.wrapper = wrapper;
		this.config = resolveWallpaperRippleConfig(config);
		this.simulation = new RippleSimulation(
			this.config.rippleDamping,
			this.config.trailDamping,
		);
	}

	start(): void {
		if (this.destroyed || this.resizeObserver) return;
		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(this.wrapper);
		window.addEventListener("pointermove", this.onPointerMove, {
			passive: true,
		});
		window.addEventListener("pointerdown", this.onPointerDown, {
			passive: true,
		});
		window.addEventListener("wallpaperModeChange", this.onStateChange);
		document.addEventListener("visibilitychange", this.onStateChange);
		this.desktopQuery.addEventListener("change", this.onStateChange);
		this.reducedMotionQuery.addEventListener("change", this.onStateChange);
		this.canvas.addEventListener("webglcontextlost", this.onContextLost);
		void this.applyState();
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.active = false;
		window.cancelAnimationFrame(this.animationFrame);
		this.animationFrame = 0;
		this.resizeObserver?.disconnect();
		window.removeEventListener("pointermove", this.onPointerMove);
		window.removeEventListener("pointerdown", this.onPointerDown);
		window.removeEventListener("wallpaperModeChange", this.onStateChange);
		document.removeEventListener("visibilitychange", this.onStateChange);
		this.desktopQuery.removeEventListener("change", this.onStateChange);
		this.reducedMotionQuery.removeEventListener("change", this.onStateChange);
		this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
		for (const timer of this.reboundTimers) window.clearTimeout(timer);
		this.reboundTimers.clear();
		this.renderer?.destroy();
		this.renderer = null;
		this.clearPresentation();
	}

	private shouldBeActive() {
		if (!this.config.enabled || document.visibilityState === "hidden") {
			return false;
		}
		const isDesktop = this.desktopQuery.matches;
		if (
			(isDesktop && !this.config.desktop) ||
			(!isDesktop && !this.config.mobile)
		) {
			return false;
		}
		if (this.reducedMotionQuery.matches) return false;
		const mode = document.documentElement.dataset.wallpaperMode as
			| WallpaperMode
			| "none"
			| undefined;
		return !!mode && mode !== "none" && this.config.modes.includes(mode);
	}

	private readonly onStateChange = () => {
		void this.applyState();
	};

	private async applyState() {
		if (this.destroyed) return;
		if (!this.shouldBeActive()) {
			this.active = false;
			window.cancelAnimationFrame(this.animationFrame);
			this.animationFrame = 0;
			this.clearPresentation();
			return;
		}

		if (!this.renderer) {
			this.initialization ??= this.initializeRenderer().finally(() => {
				this.initialization = null;
			});
			await this.initialization;
		}
		if (this.destroyed || !this.renderer || !this.shouldBeActive()) return;

		this.active = true;
		this.resize();
		this.renderer.render(this.simulation.compose());
		this.canvas.classList.add("is-ready");
		document.documentElement.dataset.wallpaperRipple = this.renderer.kind;
	}

	private async initializeRenderer() {
		const image = await waitForWallpaperImage(this.wrapper);
		if (this.destroyed) return;

		if (image) {
			try {
				this.renderer = new WebGLRippleRenderer(
					this.canvas,
					image,
					this.config,
				);
				return;
			} catch (error) {
				console.info(
					"[WallpaperRipple] WebGL 折射不可用，使用 Canvas 高光回退。",
					error,
				);
			}
		}

		this.replaceCanvasForFallback();
		try {
			this.renderer = new CanvasRippleRenderer(this.canvas, this.config);
		} catch (error) {
			console.info(
				"[WallpaperRipple] Canvas 回退不可用，保留静态壁纸。",
				error,
			);
			this.renderer = null;
		}
	}

	private replaceCanvasForFallback() {
		const replacement = document.createElement("canvas");
		replacement.id = this.canvas.id;
		replacement.className = this.canvas.className;
		replacement.setAttribute("aria-hidden", "true");
		this.canvas.replaceWith(replacement);
		this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
		this.canvas = replacement;
	}

	private readonly onContextLost = (event: Event) => {
		event.preventDefault();
		this.renderer?.destroy();
		this.renderer = null;
		this.clearPresentation();
		this.replaceCanvasForFallback();
		try {
			this.renderer = new CanvasRippleRenderer(this.canvas, this.config);
			this.resize();
			this.canvas.classList.add("is-ready");
			document.documentElement.dataset.wallpaperRipple = "fallback";
			this.wake();
		} catch {
			this.renderer = null;
		}
	};

	private resize() {
		if (!this.renderer) return;
		const rect = this.wrapper.getBoundingClientRect();
		const width = Math.max(1, Math.round(rect.width || window.innerWidth));
		const height = Math.max(1, Math.round(rect.height || window.innerHeight));
		const gridWidth = Math.max(3, Math.ceil(width / this.config.cellSize) + 2);
		const gridHeight = Math.max(
			3,
			Math.ceil(height / this.config.cellSize) + 2,
		);
		if (gridWidth !== this.gridWidth || gridHeight !== this.gridHeight) {
			this.gridWidth = gridWidth;
			this.gridHeight = gridHeight;
			this.simulation.resize(gridWidth, gridHeight);
		}
		this.renderer.resize(width, height, gridWidth, gridHeight);
		this.renderer.render(this.simulation.compose());
	}

	private pointerToGrid(clientX: number, clientY: number) {
		const rect = this.wrapper.getBoundingClientRect();
		if (
			clientX < rect.left ||
			clientX > rect.right ||
			clientY < rect.top ||
			clientY > rect.bottom
		) {
			return null;
		}
		const normalizedX = clamp(
			(clientX - rect.left) / Math.max(1, rect.width),
			0,
			1,
		);
		const normalizedY = clamp(
			(clientY - rect.top) / Math.max(1, rect.height),
			0,
			1,
		);
		return {
			x: 1 + normalizedX * (this.gridWidth - 3),
			y: 1 + normalizedY * (this.gridHeight - 3),
		};
	}

	private readonly onPointerMove = (event: PointerEvent) => {
		if (!this.active || !this.renderer || event.pointerType === "touch") return;
		const now = performance.now();
		const distance = Math.hypot(
			event.clientX - this.lastPointerX,
			event.clientY - this.lastPointerY,
		);
		if (now - this.lastPointerTime < 12 && distance < 5) return;
		const point = this.pointerToGrid(event.clientX, event.clientY);
		if (!point) return;
		this.lastPointerX = event.clientX;
		this.lastPointerY = event.clientY;
		this.lastPointerTime = now;
		this.lastInputTime = now;
		this.simulation.injectTrail(
			point.x,
			point.y,
			this.config.pointerRadius / this.config.cellSize,
			this.config.pointerStrength,
		);
		this.wake();
	};

	private readonly onPointerDown = (event: PointerEvent) => {
		if (
			!this.active ||
			!this.renderer ||
			event.pointerType === "touch" ||
			(event.button !== 0 && event.pointerType === "mouse")
		) {
			return;
		}
		const point = this.pointerToGrid(event.clientX, event.clientY);
		if (!point) return;
		this.lastInputTime = performance.now();
		this.simulation.injectRipple(
			point.x,
			point.y,
			this.config.clickRadius / this.config.cellSize,
			this.config.clickStrength,
		);
		this.wake();

		const clientX = event.clientX;
		const clientY = event.clientY;
		const timer = window.setTimeout(() => {
			this.reboundTimers.delete(timer);
			if (!this.active || !this.renderer) return;
			const reboundPoint = this.pointerToGrid(clientX, clientY);
			if (!reboundPoint) return;
			this.lastInputTime = performance.now();
			this.simulation.injectRipple(
				reboundPoint.x,
				reboundPoint.y,
				(this.config.clickRadius * 0.72) / this.config.cellSize,
				this.config.reboundStrength,
			);
			this.wake();
		}, this.config.reboundDelayMs);
		this.reboundTimers.add(timer);
	};

	private wake() {
		if (!this.active || !this.renderer || this.animationFrame) return;
		this.lastFrameTime = performance.now();
		this.animationFrame = window.requestAnimationFrame(this.tick);
	}

	private readonly tick = (now: number) => {
		this.animationFrame = 0;
		if (!this.active || !this.renderer) return;

		const elapsed = Math.min(100, Math.max(0, now - this.lastFrameTime));
		this.lastFrameTime = now;
		this.accumulator += elapsed;
		let steps = 0;
		while (this.accumulator >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
			this.simulation.step();
			this.accumulator -= FIXED_STEP_MS;
			steps += 1;
		}
		if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;

		const field = this.simulation.compose();
		try {
			this.renderer.render(field);
		} catch (error) {
			console.info("[WallpaperRipple] 水波渲染停止，恢复静态壁纸。", error);
			this.active = false;
			this.clearPresentation();
			return;
		}

		this.energyFrame += 1;
		if (
			this.energyFrame % 12 === 0 &&
			now - this.lastInputTime > this.config.idleAfterMs &&
			this.simulation.energy() < QUIET_ENERGY
		) {
			this.simulation.clear();
			this.renderer.render(this.simulation.output);
			this.accumulator = 0;
			return;
		}

		this.animationFrame = window.requestAnimationFrame(this.tick);
	};

	private clearPresentation() {
		this.canvas.classList.remove("is-ready");
		delete document.documentElement.dataset.wallpaperRipple;
	}
}
