import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
	Plugin,
} from "obsidian";
import { HubButtonSettings, HubTypeDef } from "./settings/Settings";
import { normalizeSettings } from "./settings/validate";
import { HubButtonSettingTab } from "./settings/SettingsTab";
import { renderBlock } from "./block/render";
import { resolveHub, hubFolder, joinPath } from "./core/resolve";
import { createNote } from "./core/createNote";
import { NamePromptModal } from "./ui/NamePromptModal";
import { TaskFormModal } from "./ui/TaskFormModal";

export default class HubButtonPlugin extends Plugin {
	settings!: HubButtonSettings;

	/** 화면에 살아 있는 hub-button 블록들의 재렌더 콜백. */
	private live = new Set<() => void>();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerMarkdownCodeBlockProcessor(
			"hub-button",
			(source, el, ctx) => renderBlock(this, source, el, ctx)
		);

		this.addSettingTab(new HubButtonSettingTab(this.app, this));
		this.registerTypeCommands();
	}

	onunload(): void {
		this.live.clear();
	}

	/**
	 * 블록을 수명주기에 묶고 재렌더 대상으로 등록한다.
	 *
	 * registerMarkdownCodeBlockProcessor 는 자동 재렌더가 없으므로, 설정이 바뀌면
	 * 여기 모아둔 콜백을 다시 부른다. 덕분에 템플릿과 인스턴스 노트가 항상 같은
	 * 버튼을 보여준다 — 지금까지 손으로 동기화하던 부분이다.
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
		if (issues.length) {
			console.warn("[hub-button] 설정 경고", issues);
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.refreshAll();
		this.registerTypeCommands();
	}

	openSettings(): void {
		const setting = (this.app as unknown as {
			setting?: {
				open?: () => void;
				openTabById?: (id: string) => void;
			};
		}).setting;
		setting?.open?.();
		setting?.openTabById?.(this.manifest.id);
	}

	/**
	 * 규칙마다 커맨드를 등록해 커맨드 팔레트/모바일 툴바에서도 부를 수 있게 한다.
	 * QuickAdd choice 를 등록하려고 옵시디언을 끄고 data.json 을 고칠 필요가 없다.
	 *
	 * 규칙을 지우거나 끄면 커맨드도 같이 거둔다. 안 그러면 삭제한 규칙의 커맨드가
	 * 재시작 전까지 남아서 실제로 동작해 버린다.
	 */
	private registerTypeCommands(): void {
		const wanted = new Set<string>();

		for (const def of this.settings.types) {
			if (!def.enabled) continue;
			const id = `hub-${def.name}`;
			wanted.add(id);
			this.addCommand({
				id,
				name: def.label,
				checkCallback: (checking) => {
					const file = this.app.workspace.getActiveFile();
					if (!file) return false;
					if (checking) return true;
					void this.runFromCommand(def, file.path);
					return true;
				},
			});
		}

		for (const id of this.commandIds) {
			if (!wanted.has(id)) this.removeCommandById(`${this.manifest.id}:${id}`);
		}
		this.commandIds = wanted;
	}

	private commandIds = new Set<string>();

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

	private async runFromCommand(def: HubTypeDef, sourcePath: string): Promise<void> {
		const hub = resolveHub(this.app, sourcePath, this.settings.requireHubType || false);
		if (!hub.ok) {
			new Notice(`⚠️ ${hub.message}`);
			return;
		}
		if (def.action === "append-task") {
			new TaskFormModal(this.app, def, this.settings, hub.value).open();
			return;
		}
		const folder = joinPath(hubFolder(hub.value), def.folder ?? "");
		new NamePromptModal(this.app, def.label, folder, (name) => {
			if (!name) return;
			void createNote(this.app, hub.value, def, this.settings, name);
		}).open();
	}
}
