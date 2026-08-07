import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type QuickAddButtonPlugin from "../main";
import { RuleDef, blankRule } from "./Settings";
import { RuleEditModal } from "./RuleEditModal";
import { normalizeSettings } from "./validate";

/**
 * 규칙(= 버튼)을 설정창에서 직접 추가·편집·정렬한다.
 *
 * data.json 을 손으로 고치는 건 예외 경로여야 한다 — 파일을 손으로 고치게
 * 만드는 순간, 정의가 흩어지고 동기화를 사람이 떠맡는 문제가 되돌아온다.
 */
export class QuickAddButtonSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: QuickAddButtonPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("qab-settings");

		containerEl.createEl("div", {
			cls: "qab-hint",
			text:
				"노트에 ```quick-add-button 코드블록을 넣으면 아래 규칙들이 버튼으로 뜹니다. " +
				"빈 블록이면 켜져 있는 규칙 전부, `rules: TempTask` 처럼 적으면 그 규칙만 나옵니다.",
		});

		new Setting(containerEl)
			.setName("할일 태그 후보")
			.setDesc("폼의 태그 드롭다운에 넣을 목록 (콤마 구분).")
			.addText((t) =>
				t.setValue(this.plugin.settings.taskTags.join(", ")).onChange(async (v) => {
					const tags = v
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean);
					this.plugin.settings.taskTags = tags.length ? tags : ["#task"];
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("규칙").setHeading();

		const list = containerEl.createEl("div", { cls: "qab-rules" });
		this.plugin.settings.rules.forEach((rule, i) => this.renderRule(list, rule, i));

		if (!this.plugin.settings.rules.length) {
			list.createEl("div", {
				cls: "qab-hint",
				text: "규칙이 없습니다. 아래에서 추가하세요.",
			});
		}

		new Setting(containerEl).addButton((b) =>
			b
				.setButtonText("＋ 규칙 추가")
				.setCta()
				.onClick(() =>
					new RuleEditModal(
						this.app,
						blankRule(),
						this.plugin.settings.rules,
						-1,
						async (next) => {
							this.plugin.settings.rules.push(next);
							await this.plugin.saveSettings();
							this.display();
						}
					).open()
				)
		);

		this.renderPortability(containerEl);
	}

	private renderRule(root: HTMLElement, rule: RuleDef, i: number): void {
		const total = this.plugin.settings.rules.length;
		const s = new Setting(root)
			.setName(rule.label || rule.name)
			.setDesc(`${rule.name} → ${short(rule.file)} › ${rule.heading}`)
			.setClass("qab-rule");

		s.addToggle((t) =>
			t
				.setTooltip("사용")
				.setValue(rule.enabled)
				.onChange(async (v) => {
					rule.enabled = v;
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
						rule,
						this.plugin.settings.rules,
						i,
						async (next) => {
							this.plugin.settings.rules[i] = next;
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
					this.plugin.settings.rules.splice(i, 1);
					await this.plugin.saveSettings();
					this.display();
				})
		);
	}

	private async move(i: number, delta: number): Promise<void> {
		const rules = this.plugin.settings.rules;
		const j = i + delta;
		if (j < 0 || j >= rules.length) return;
		[rules[i], rules[j]] = [rules[j], rules[i]];
		await this.plugin.saveSettings();
		this.display();
	}

	/** 볼트 사이 복사와 실험 전 백업용. */
	private renderPortability(root: HTMLElement): void {
		const details = root.createEl("details", { cls: "qab-io" });
		details.createEl("summary", { text: "JSON 내보내기 / 가져오기" });

		const ta = details.createEl("textarea", { cls: "qab-json" });
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

function short(path: string): string {
	const f = path.slice(path.lastIndexOf("/") + 1);
	return f.endsWith(".md") ? f.slice(0, -3) : f;
}
