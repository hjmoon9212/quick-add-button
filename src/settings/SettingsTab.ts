import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type HubButtonPlugin from "../main";
import { HubAction, HubTypeDef, blankType } from "./Settings";
import { RuleEditModal } from "./RuleEditModal";
import { normalizeSettings } from "./validate";

/**
 * 타입 규칙을 설정창에서 직접 추가·편집·정렬한다.
 *
 * data.json 을 손으로 고치는 건 예외 경로여야 한다 — 파일을 손으로 고치게
 * 만드는 순간 지금 문제(허브 파일 4개를 손으로 동기화)가 그대로 재발한다.
 */
export class HubButtonSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: HubButtonPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("hub-button-settings");

		new Setting(containerEl)
			.setName("허브 Type 검증")
			.setDesc(
				"버튼을 쓸 수 있는 노트의 frontmatter `Type` 값. 비우면 아무 노트에서나 동작합니다."
			)
			.addText((t) =>
				t
					.setPlaceholder("Project-Hub")
					.setValue(this.plugin.settings.requireHubType)
					.onChange(async (v) => {
						this.plugin.settings.requireHubType = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("백링크 필드")
			.setDesc("생성한 노트의 frontmatter 에 허브 링크를 넣을 키. 비우면 넣지 않습니다.")
			.addText((t) =>
				t
					.setPlaceholder("Project")
					.setValue(this.plugin.settings.linkField)
					.onChange(async (v) => {
						this.plugin.settings.linkField = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Templater 실행")
			.setDesc("노트 생성 직후 <% … %> 를 치환합니다. 실패해도 노트는 남습니다.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.runTemplater).onChange(async (v) => {
					this.plugin.settings.runTemplater = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("할일 태그 후보")
			.setDesc("할일 폼의 태그 드롭다운에 넣을 목록 (콤마 구분).")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.taskTags.join(", "))
					.onChange(async (v) => {
						const tags = v
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean);
						this.plugin.settings.taskTags = tags.length ? tags : ["#task"];
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("타입 규칙").setHeading();

		const list = containerEl.createEl("div", { cls: "hub-button-rules" });
		this.plugin.settings.types.forEach((def, i) => this.renderRule(list, def, i));

		if (!this.plugin.settings.types.length) {
			list.createEl("div", {
				cls: "hub-button-hint",
				text: "규칙이 없습니다. 아래에서 추가하세요.",
			});
		}

		new Setting(containerEl)
			.addButton((b) =>
				b
					.setButtonText("＋ 규칙 추가 (노트 생성)")
					.setCta()
					.onClick(() => this.addRule("create-note"))
			)
			.addButton((b) =>
				b.setButtonText("＋ 규칙 추가 (할일)").onClick(() => this.addRule("append-task"))
			);

		this.renderPortability(containerEl);
	}

	private renderRule(root: HTMLElement, def: HubTypeDef, i: number): void {
		const total = this.plugin.settings.types.length;
		const where =
			def.action === "create-note"
				? `${def.folder ?? ""}/`
				: `${def.targets?.length ?? 0}개 대상`;

		const s = new Setting(root)
			.setName(def.label || def.name)
			.setDesc(`${def.name} · ${def.action === "create-note" ? "노트" : "할일"} · ${where}`)
			.setClass("hub-button-rule");

		s.addToggle((t) =>
			t
				.setTooltip("사용")
				.setValue(def.enabled)
				.onChange(async (v) => {
					def.enabled = v;
					await this.plugin.saveSettings();
					this.display();
				})
		);

		s.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip("위로")
				.setDisabled(i === 0)
				.onClick(() => void this.move(i, -1))
		);
		s.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip("아래로")
				.setDisabled(i === total - 1)
				.onClick(() => void this.move(i, 1))
		);
		s.addExtraButton((b) =>
			b
				.setIcon("pencil")
				.setTooltip("편집")
				.onClick(() =>
					new RuleEditModal(
						this.app,
						def,
						this.plugin.settings.types,
						i,
						async (next) => {
							this.plugin.settings.types[i] = next;
							await this.plugin.saveSettings();
							this.display();
						}
					).open()
				)
		);
		s.addExtraButton((b) =>
			b
				.setIcon("trash")
				.setTooltip("삭제")
				.onClick(async () => {
					this.plugin.settings.types.splice(i, 1);
					await this.plugin.saveSettings();
					this.display();
				})
		);
	}

	private addRule(action: HubAction): void {
		new RuleEditModal(
			this.app,
			blankType(action),
			this.plugin.settings.types,
			-1,
			async (next) => {
				this.plugin.settings.types.push(next);
				await this.plugin.saveSettings();
				this.display();
			}
		).open();
	}

	private async move(i: number, delta: number): Promise<void> {
		const types = this.plugin.settings.types;
		const j = i + delta;
		if (j < 0 || j >= types.length) return;
		[types[i], types[j]] = [types[j], types[i]];
		await this.plugin.saveSettings();
		this.display();
	}

	/** 볼트 2개(업무/개인) 사이 복사와 실험 전 백업용. */
	private renderPortability(root: HTMLElement): void {
		const details = root.createEl("details", { cls: "hub-button-io" });
		details.createEl("summary", { text: "JSON 내보내기 / 가져오기" });

		const ta = details.createEl("textarea", { cls: "hub-button-json" });
		ta.rows = 10;
		ta.value = JSON.stringify(this.plugin.settings, null, 2);

		new Setting(details)
			.addButton((b) =>
				b.setButtonText("현재 설정 불러오기").onClick(() => {
					ta.value = JSON.stringify(this.plugin.settings, null, 2);
				})
			)
			.addButton((b) =>
				b
					.setButtonText("이 JSON 적용")
					.setWarning()
					.onClick(async () => {
						let parsed: unknown;
						try {
							parsed = JSON.parse(ta.value);
						} catch (e) {
							new Notice(`JSON 파싱 실패: ${e instanceof Error ? e.message : e}`);
							return;
						}
						const { settings, issues } = normalizeSettings(parsed);
						this.plugin.settings = settings;
						await this.plugin.saveSettings();
						this.display();
						new Notice(
							issues.length
								? `적용됨 (경고 ${issues.length}건: ${issues[0].message})`
								: "적용됨"
						);
					})
			);
	}
}
