import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
	Plugin,
} from "obsidian";
import { QuickAddButtonSettings, RuleDef } from "./settings/Settings";
import { normalizeSettings } from "./settings/validate";
import { QuickAddButtonSettingTab } from "./settings/SettingsTab";
import { openForm, renderBlock } from "./block/render";

export default class QuickAddButtonPlugin extends Plugin {
	settings!: QuickAddButtonSettings;

	/** 화면에 살아 있는 코드블록들의 재렌더 콜백. */
	private live = new Set<() => void>();
	private commandIds = new Set<string>();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerMarkdownCodeBlockProcessor(
			"quick-add-button",
			(source, el, ctx) => renderBlock(this, source, el, ctx)
		);

		this.addSettingTab(new QuickAddButtonSettingTab(this.app, this));
		this.registerRuleCommands();
	}

	onunload(): void {
		this.live.clear();
	}

	/**
	 * 블록을 수명주기에 묶고 재렌더 대상으로 등록한다.
	 *
	 * registerMarkdownCodeBlockProcessor 는 자동 재렌더가 없으므로, 설정이 바뀌면
	 * 여기 모아둔 콜백을 다시 부른다. 규칙을 고치고 설정창을 닫으면 열려 있던
	 * 노트의 버튼이 이미 바뀌어 있다.
	 */
	registerBlock(
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
		draw: () => void
	): void {
		const child = new MarkdownRenderChild(el);
		child.register(() => this.live.delete(draw));
		ctx.addChild(child);
		this.live.add(draw);
	}

	refreshAll(): void {
		for (const draw of this.live) {
			try {
				draw();
			} catch {
				/* 블록 하나가 실패해도 나머지는 갱신한다 */
			}
		}
	}

	async loadSettings(): Promise<void> {
		const { settings, issues } = normalizeSettings(await this.loadData());
		this.settings = settings;
		if (issues.length) console.warn("[quick-add-button] 설정 경고", issues);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.refreshAll();
		this.registerRuleCommands();
	}

	openSettings(): void {
		const setting = (this.app as unknown as {
			setting?: { open?: () => void; openTabById?: (id: string) => void };
		}).setting;
		setting?.open?.();
		setting?.openTabById?.(this.manifest.id);
	}

	/**
	 * 규칙마다 커맨드를 등록해 커맨드 팔레트·모바일 툴바에서도 부를 수 있게 한다.
	 * 규칙을 지우거나 끄면 커맨드도 같이 거둔다 — 안 그러면 지운 규칙의 커맨드가
	 * 재시작 전까지 남아서 실제로 동작해 버린다.
	 */
	private registerRuleCommands(): void {
		const wanted = new Set<string>();

		for (const rule of this.settings.rules) {
			if (!rule.enabled) continue;
			const id = `add-${rule.name}`;
			wanted.add(id);
			this.addCommand({
				id,
				name: rule.label,
				callback: () => this.openRule(rule),
			});
		}

		for (const id of this.commandIds) {
			if (!wanted.has(id)) this.removeCommandById(`${this.manifest.id}:${id}`);
		}
		this.commandIds = wanted;
	}

	private openRule(rule: RuleDef): void {
		try {
			openForm(this, rule);
		} catch (e) {
			new Notice(`폼을 열지 못했습니다: ${e instanceof Error ? e.message : e}`);
		}
	}

	private removeCommandById(fullId: string): void {
		const commands = (this.app as unknown as {
			commands?: { removeCommand?: (id: string) => void };
		}).commands;
		try {
			commands?.removeCommand?.(fullId);
		} catch {
			/* 비공개 API 라 형태가 바뀔 수 있다. 실패해도 나머지는 계속 간다 */
		}
	}
}
