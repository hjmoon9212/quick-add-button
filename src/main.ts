import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
	Plugin,
	TFile,
} from "obsidian";
import { QuickAddButtonSettings, RuleDef } from "./settings/Settings";
import { normalizeSettings } from "./settings/validate";
import { QuickAddButtonSettingTab } from "./settings/SettingsTab";
import { openForm, renderBlock } from "./block/render";
import { RulePickerModal } from "./ui/RulePickerModal";
import { ConfirmModal } from "./ui/ConfirmModal";
import { parseRules, withExtension, wrapRules } from "./core/rulesFile";

export default class QuickAddButtonPlugin extends Plugin {
	settings!: QuickAddButtonSettings;

	/** 화면에 살아 있는 코드블록들의 재렌더 콜백. */
	private live = new Set<() => void>();
	private commandIds = new Set<string>();

	/**
	 * 마지막으로 확인한 data.json 의 내용. 저장 전에 이 값과 파일을 대조한다.
	 * 파일이 없던 상태면 null.
	 */
	private diskStamp: string | null = null;

	/** 충돌 시 화면을 다시 그리려고 들고 있는다. */
	private tab?: QuickAddButtonSettingTab;

	/** 마지막으로 읽거나 쓴 규칙 파일의 내용. 우리 저장에 우리가 반응하지 않으려고 둔다. */
	private rulesStamp: string | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerMarkdownCodeBlockProcessor(
			"quick-add-button",
			(source, el, ctx) => renderBlock(this, source, el, ctx)
		);

		this.tab = new QuickAddButtonSettingTab(this.app, this);
		this.addSettingTab(this.tab);
		this.registerRuleCommands();

		// 리본과 같은 통로를 커맨드로도 연다 — 단축키를 걸 수 있게.
		// 규칙별 커맨드와 달리 규칙 목록에 매이지 않으니 registerRuleCommands 의
		// 정리 루프 밖, 여기서 한 번만 등록한다.
		this.addCommand({
			id: "open-picker",
			name: "Open picker",
			callback: () => this.openPicker(),
		});

		this.addRibbonIcon("list-plus", "Quick Add Button", () => this.openPicker());

		// 규칙 파일이 밖에서 바뀌면(다른 기기의 동기화, 손편집) 그 자리에서 다시
		// 읽는다. `.obsidian` 안에서는 이게 안 되어 2026-08-23 에 조용히 잃었다.
		const watch = (f: { path: string }): void => {
			if (!this.settings.rulesFile || f.path !== this.settings.rulesFile) return;
			void this.onRulesFileChanged();
		};
		this.registerEvent(this.app.vault.on("modify", watch));
		this.registerEvent(this.app.vault.on("create", watch));

		// 시작 직후에는 볼트 색인이 아직 없어 getAbstractFileByPath 가 null 을 준다.
		// 그때 규칙 파일을 읽으려 하면 조용히 실패하고 data.json 사본이 남는다.
		this.app.workspace.onLayoutReady(() => void this.syncRulesFile());
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
		for (const draw of [...this.live]) {
			try {
				draw();
			} catch {
				/* 블록 하나가 실패해도 나머지는 갱신한다 */
			}
		}
	}

	async loadSettings(): Promise<void> {
		const raw = await this.loadData();
		const { settings, issues } = normalizeSettings(raw);
		this.settings = settings;
		this.diskStamp = stamp(raw);
		if (issues.length) console.warn("[quick-add-button] 설정 경고", issues);
	}

	/**
	 * 규칙 파일을 쓰기로 했다면 그쪽이 진실이다 — 시작할 때 한 번 읽어 맞춘다.
	 * data.json 의 규칙은 사본으로만 남는다.
	 */
	private async syncRulesFile(): Promise<void> {
		if (!this.settings.rulesFile) return;

		// 확장자 없이 적힌 경로를 스스로 고친다. 그대로 두면 볼트에 그 파일이
		// 없으므로 확장자 없는 파일을 새로 만들어 노트가 둘로 갈린다.
		const fixed = withExtension(this.settings.rulesFile);
		if (
			fixed !== this.settings.rulesFile &&
			this.app.vault.getAbstractFileByPath(fixed) instanceof TFile
		) {
			this.settings.rulesFile = fixed;
			await this.saveData(this.settings);
			this.diskStamp = stamp(this.settings);
			new Notice(`규칙 파일 경로를 ${fixed} 로 고쳤습니다.`);
		}

		if (!(await this.pullRules(true))) return;
		this.refreshAll();
		this.registerRuleCommands();
		this.tab?.display();
	}

	/**
	 * 규칙 파일을 읽어 규칙만 갈아 끼운다.
	 *
	 * 파일이 없거나 못 읽으면 지금 규칙을 그대로 둔다 — 동기화가 아직 파일을
	 * 못 가져왔을 뿐일 수 있고, 그때 목록을 비워 버리면 사용자가 잃는다.
	 */
	private async pullRules(quiet = false): Promise<boolean> {
		const path = this.settings.rulesFile;
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			if (!quiet) new Notice(`⚠️ 규칙 파일이 없습니다: ${path}`);
			return false;
		}
		const text = await this.app.vault.read(file);
		const body = parseRules(text);
		if (!body) {
			if (!quiet) new Notice(`⚠️ 규칙 파일을 읽지 못했습니다: ${path}`);
			return false;
		}
		const { settings, issues } = normalizeSettings({
			version: this.settings.version,
			rules: body.rules,
		});
		this.settings.rules = settings.rules;
		this.rulesStamp = text;
		if (issues.length) console.warn("[quick-add-button] 규칙 파일 경고", issues);
		return true;
	}

	/** 규칙을 볼트 파일에 쓴다. 파일이 없으면 만든다. */
	private async pushRules(): Promise<void> {
		const path = this.settings.rulesFile;
		const json = JSON.stringify({ rules: this.settings.rules }, null, 2);
		const file = this.app.vault.getAbstractFileByPath(path);
		try {
			if (file instanceof TFile) {
				let out = "";
				await this.app.vault.process(file, (prev) => (out = wrapRules(json, path, prev)));
				this.rulesStamp = out;
			} else {
				const out = wrapRules(json, path);
				await this.app.vault.create(path, out);
				this.rulesStamp = out;
			}
		} catch (e) {
			new Notice(`⚠️ 규칙 파일에 쓰지 못했습니다: ${path}`);
			console.error("[quick-add-button] 규칙 파일 쓰기 실패", e);
		}
	}

	private async onRulesFileChanged(): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.settings.rulesFile);
		if (!(file instanceof TFile)) return;
		const text = await this.app.vault.read(file);
		if (text === this.rulesStamp) return; // 우리가 쓴 것

		// 내용이 같은데 줄바꿈만 다를 수 있다(다른 기기가 같은 규칙을 다시 쓴 경우).
		// 그때까지 알림을 띄우면 저장할 때마다 시끄러워진다.
		const body = parseRules(text);
		const same =
			body &&
			JSON.stringify(
				normalizeSettings({ version: this.settings.version, rules: body.rules }).settings.rules
			) === JSON.stringify(this.settings.rules);
		if (same) {
			this.rulesStamp = text;
			return;
		}

		if (!(await this.pullRules(true))) return;
		this.refreshAll();
		this.registerRuleCommands();
		this.tab?.display();
		new Notice(`규칙 파일이 바뀌어 다시 읽었습니다 — 규칙 ${this.settings.rules.length}개`);
	}

	/** 설정탭에서 규칙 파일 경로를 바꿨을 때. */
	async setRulesFile(path: string): Promise<void> {
		const next = withExtension(path);
		if (next === this.settings.rulesFile) return;

		if (!next) {
			this.settings.rulesFile = "";
			this.rulesStamp = null;
			await this.saveSettings();
			this.tab?.display();
			new Notice("규칙을 다시 data.json 에서 관리합니다.");
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(next);
		if (!(file instanceof TFile)) {
			this.settings.rulesFile = next;
			await this.saveSettings();
			this.tab?.display();
			new Notice(`규칙을 ${next} 로 옮겼습니다.`);
			return;
		}

		// 이미 있는 파일이면 어느 쪽 규칙을 남길지 묻는다. 말없이 한쪽을 버리지 않는다.
		const text = await this.app.vault.read(file);
		const body = parseRules(text);
		if (!body) {
			new Notice(`⚠️ 그 파일에서 규칙을 읽지 못했습니다: ${next}`);
			return;
		}
		const incoming = normalizeSettings({
			version: this.settings.version,
			rules: body.rules,
		}).settings.rules;

		new ConfirmModal(this.app, {
			title: "이미 규칙이 들어 있는 파일입니다",
			body:
				`${next} 에 규칙 ${incoming.length}개가 있습니다. ` +
				`지금 화면에는 ${this.settings.rules.length}개 있습니다.`,
			cta: "화면 것으로 덮어쓰기",
			onConfirm: async () => {
				this.settings.rulesFile = next;
				await this.saveSettings();
				this.tab?.display();
			},
			cancelText: "파일 것 쓰기",
			onCancel: async () => {
				this.settings.rulesFile = next;
				this.settings.rules = incoming;
				this.rulesStamp = text;
				await this.saveSettings();
				this.tab?.display();
			},
		}).open();
	}

	/**
	 * 저장 전에 디스크를 다시 본다.
	 *
	 * data.json 은 우리만 쓰는 파일이 아니다. Obsidian Sync 의 「설치된 커뮤니티
	 * 플러그인」이 켜진 기기끼리는 이 파일이 통째로 오가고, 그렇게 들어온 내용을
	 * 플러그인은 모른다. 그 상태에서 저장하면 saveData 가 파일을 통째로 갈아
	 * 끼우므로 방금 들어온 규칙이 메모리에 있던 옛 목록에 덮여 사라진다.
	 * 실제로 그렇게 규칙을 여러 개 잃었다(2026-08-23).
	 *
	 * 그래서 조용히 이기지 않고 어느 쪽을 남길지 묻는다.
	 */
	async saveSettings(): Promise<void> {
		const raw = await this.loadData();
		const now = stamp(raw);
		if (this.diskStamp !== null && now !== this.diskStamp) {
			this.askOnConflict(raw);
			return;
		}
		await this.write();
	}

	/** 실제로 파일을 쓰는 곳. 쓴 내용을 그대로 기준값으로 삼는다. */
	private async write(): Promise<void> {
		if (this.settings.rulesFile) await this.pushRules();
		await this.saveData(this.settings);
		this.diskStamp = stamp(this.settings);
		this.refreshAll();
		this.registerRuleCommands();
	}

	private askOnConflict(raw: unknown): void {
		const incoming = normalizeSettings(raw).settings;
		new ConfirmModal(this.app, {
			title: "설정이 이 창 밖에서 바뀌었습니다",
			body:
				`data.json 이 다른 기기나 동기화로 바뀌었습니다. ` +
				`파일에는 규칙 ${incoming.rules.length}개, 지금 화면에는 ` +
				`${this.settings.rules.length}개 있습니다. ` +
				`덮어쓰면 파일 쪽 규칙은 사라집니다.`,
			cta: "화면 것으로 덮어쓰기",
			onConfirm: () => this.write(),
			cancelText: "파일 것으로 되돌리기",
			onCancel: () => this.adopt(incoming, raw),
		}).open();
	}

	/** 파일 쪽을 받아들인다. 화면에서 하던 편집은 버린다. */
	private adopt(incoming: QuickAddButtonSettings, raw: unknown): void {
		this.settings = incoming;
		this.diskStamp = stamp(raw);
		this.refreshAll();
		this.registerRuleCommands();
		this.tab?.display();
		new Notice(`파일 쪽 설정을 불러왔습니다 — 규칙 ${incoming.rules.length}개`);
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

	/**
	 * 리본 → 버튼 목록 → 고른 버튼의 폼. 코드블록을 놓은 노트에 가 있지 않아도
	 * 버튼을 쓸 수 있는 통로다.
	 *
	 * 리본 아이콘 자체를 숨기고 싶으면 옵시디언 기본 기능(리본 우클릭 → 관리)을
	 * 쓴다 — 플러그인이 따로 설정을 둘 이유가 없다.
	 */
	private openPicker(): void {
		const enabled = this.settings.rules.filter((r) => r.enabled);
		const rules = enabled.filter((r) => r.ribbon);
		if (!rules.length) {
			// 규칙은 있는데 아무도 리본에 안 들어간 경우와 규칙 자체가 없는 경우는
			// 고쳐야 할 곳이 다르다. 같은 문구로 뭉뚱그리면 설정에서 헤맨다.
			new Notice(
				enabled.length
					? "리본 목록에 넣도록 체크된 버튼이 없습니다. 규칙 편집에서 「리본 목록에 넣기」를 켜세요."
					: "켜져 있는 버튼이 없습니다. 설정에서 규칙을 추가하세요."
			);
			this.openSettings();
			return;
		}
		new RulePickerModal(this.app, rules, (rule) => this.openRule(rule)).open();
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

/**
 * 파일 내용을 비교용 문자열 하나로 만든다. 파일이 없으면 null.
 *
 * saveData 는 우리가 준 객체를 그대로 직렬화하므로, 방금 쓴 `this.settings` 와
 * 다시 읽어들인 값은 키 순서까지 같은 문자열이 된다. 그래서 이 값이 다르면
 * "우리가 아닌 누군가가 파일을 건드렸다" 가 성립한다.
 */
function stamp(raw: unknown): string | null {
	return raw === null || raw === undefined ? null : JSON.stringify(raw);
}
