import { App, Notice, PluginSettingTab, Setting, TFile } from "obsidian";
import type QuickAddButtonPlugin from "../main";
import { targetLabel } from "../core/appendTask";
import { hasHeading, headingsOf } from "../core/headings";
import { isDynamicTarget } from "../core/paths";
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

		this.renderUsage(containerEl);

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

	/** 버튼을 어떻게 넣는지 — 붙여넣을 것 하나만 보여준다. */
	private renderUsage(root: HTMLElement): void {
		const fence = "`".repeat(3);
		const snippet = [fence + "quick-add-button", fence].join("\n");

		root.createEl("p", {
			cls: "qab-usage-lead",
			text: "노트에 아래 블록을 붙여넣으면 켜져 있는 버튼이 모두 나옵니다.",
		});

		const box = root.createEl("div", { cls: "qab-usage" });
		box.createEl("pre", { cls: "qab-code", text: snippet });
		const copy = box.createEl("button", { text: "복사" });
		copy.onclick = async () => {
			await navigator.clipboard.writeText(snippet);
			copy.setText("복사됨");
			window.setTimeout(() => copy.setText("복사"), 1200);
		};

		const more = root.createEl("div", { cls: "qab-usage-more" });
		more.createEl("div", { text: "일부만 넣으려면 블록 안에 한 줄 더:" });
		const dl = more.createEl("dl");
		dl.createEl("dt", { text: "rules: TempTask, ProjIssue" });
		dl.createEl("dd", { text: "적은 것만, 적은 순서대로" });
		dl.createEl("dt", { text: "exclude: TempTask" });
		dl.createEl("dd", { text: "그것만 빼고 전부" });
	}

	private renderRule(root: HTMLElement, rule: RuleDef, i: number): void {
		const total = this.plugin.settings.rules.length;
		const where = targetLabel(rule);
		const problem = this.ruleProblem(rule);

		const s = new Setting(root)
			.setName(rule.label || rule.name)
			.setDesc(
				problem
					? `⚠️ ${problem} — ${rule.tags.join(" · ")}  →  ${where}`
					: `${rule.tags.join(" · ")}  →  ${where}`
			)
			.setClass("qab-rule");
		if (problem) s.settingEl.addClass("qab-rule-broken");

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

	/**
	 * 규칙이 가리키는 자리가 아직 있는지. 없으면 그 이유를 돌려준다.
	 *
	 * 저장을 막지는 않는다 — 파일을 나중에 만들 수도 있고, 다른 볼트에서 가져온
	 * 설정일 수도 있다. 다만 눌러 보기 전에 알려는 준다. 지금은 폼을 다 채우고
	 * 추가를 누른 뒤에야 Notice 가 뜬다.
	 */
	private ruleProblem(rule: RuleDef): string {
		if (!rule.file || !rule.heading) return "";
		// 누를 때마다 가리키는 노트가 달라지는 규칙은 지금 검사할 대상이 없다.
		// 없는 것을 "없다"고 못 하니 조용히 넘긴다 — 실제로 못 찾으면 누를 때 알린다.
		if (isDynamicTarget(rule.file)) return "";
		const file = this.app.vault.getAbstractFileByPath(rule.file);
		if (!(file instanceof TFile)) return "파일이 없습니다";
		if (!hasHeading(headingsOf(this.app, file), rule.heading, rule.level)) {
			return "헤딩이 없습니다";
		}
		return "";
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
