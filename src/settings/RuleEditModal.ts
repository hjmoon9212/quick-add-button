import { AbstractInputSuggest, App, Modal, Setting, TFile } from "obsidian";
import { RuleDef, TaskTarget } from "./Settings";
import { validateRule } from "./validate";

/** 볼트의 마크다운 파일 경로 자동완성. */
class FileSuggest extends AbstractInputSuggest<string> {
	constructor(
		app: App,
		private input: HTMLInputElement,
		private onPick: (v: string) => void
	) {
		super(app, input);
	}
	getSuggestions(query: string): string[] {
		const q = query.toLowerCase();
		return this.app.vault
			.getMarkdownFiles()
			.map((f) => f.path)
			.filter((p) => p.toLowerCase().includes(q))
			.slice(0, 20);
	}
	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}
	selectSuggestion(value: string): void {
		this.input.value = value;
		this.onPick(value);
		this.close();
	}
}

/** 규칙 하나(= 버튼 하나)를 편집한다. */
export class RuleEditModal extends Modal {
	private draft: RuleDef;

	constructor(
		app: App,
		def: RuleDef,
		private all: RuleDef[],
		private selfIndex: number,
		private onSave: (def: RuleDef) => void
	) {
		super(app);
		this.draft = JSON.parse(JSON.stringify(def)) as RuleDef;
	}

	onOpen(): void {
		this.contentEl.addClass("qab-modal");
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", {
			text:
				this.selfIndex < 0
					? "규칙 추가"
					: `규칙 편집 — ${this.draft.name || "(이름 없음)"}`,
		});

		new Setting(contentEl)
			.setName("규칙 이름")
			.setDesc("코드블록에서 이 이름으로 부릅니다. 예: rules: TempTask")
			.addText((t) =>
				t
					.setPlaceholder("TempTask")
					.setValue(this.draft.name)
					.onChange((v) => (this.draft.name = v))
			);

		new Setting(contentEl)
			.setName("버튼 라벨")
			.setDesc("버튼에 찍히는 글자. 이모지 + 짧은 한글을 권장합니다.")
			.addText((t) =>
				t
					.setPlaceholder("⚡ 임시 할일")
					.setValue(this.draft.label)
					.onChange((v) => (this.draft.label = v))
			);

		contentEl.createEl("h4", { text: "삽입 대상" });
		contentEl.createEl("div", {
			cls: "qab-hint",
			text:
				"버튼을 누르면 이 목록이 폼의 대상 드롭다운에 이 순서로 뜹니다. " +
				"파일 자리에 @current 를 적으면 버튼이 있는 노트, @folder/… 는 그 노트가 있는 폴더 기준입니다.",
		});

		const list = contentEl.createEl("div");
		this.draft.targets.forEach((t, i) => this.renderTargetRow(list, t, i));

		new Setting(contentEl).addButton((b) =>
			b.setButtonText("＋ 대상 추가").onClick(() => {
				this.draft.targets.push({ file: "", heading: "" });
				this.render();
			})
		);

		contentEl.createEl("h4", { text: "폼 기본값" });
		const d = this.draft.defaults;

		new Setting(contentEl)
			.setName("기본 태그")
			.addText((t) =>
				t.setPlaceholder("#task").setValue(d.tag).onChange((v) => (d.tag = v))
			);
		new Setting(contentEl).setName("기본 마감일").addDropdown((dd) =>
			dd
				.addOption("", "없음")
				.addOption("today", "오늘")
				.addOption("tomorrow", "내일")
				.addOption("+7", "+7일")
				.setValue(d.due)
				.onChange((v) => (d.due = v))
		);
		new Setting(contentEl)
			.setName("기본 삽입 위치")
			.setDesc("선택한 헤딩 섹션의 어디에 넣을지.")
			.addDropdown((dd) =>
				dd
					.addOption("end", "섹션 끝")
					.addOption("top", "섹션 맨 위")
					.setValue(d.position)
					.onChange((v) => (d.position = v as "end" | "top"))
			);
		new Setting(contentEl)
			.setName("➕ 생성일 기본 체크")
			.addToggle((t) => t.setValue(d.created).onChange((v) => (d.created = v)));
		new Setting(contentEl)
			.setName("🆔 아이디 기본 체크")
			.setDesc("켜면 추가할 때마다 볼트 전역에서 미사용인 6자리를 붙입니다.")
			.addToggle((t) => t.setValue(d.id).onChange((v) => (d.id = v)));

		const errBox = contentEl.createEl("div", { cls: "qab-errors" });

		new Setting(contentEl)
			.addButton((b) => b.setButtonText("취소").onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText("저장")
					.setCta()
					.onClick(() => {
						this.draft.name = this.draft.name.trim();
						if (!this.draft.label.trim()) this.draft.label = this.draft.name;
						const errs = validateRule(this.draft, this.all, this.selfIndex);
						errBox.empty();
						if (errs.length) {
							for (const e of errs) {
								errBox.createEl("div", { text: `⚠️ ${e}`, cls: "qab-hint-error" });
							}
							return;
						}
						this.onSave(this.draft);
						this.close();
					})
			);
	}

	private renderTargetRow(root: HTMLElement, t: TaskTarget, i: number): void {
		const s = new Setting(root).setClass("qab-target-row");

		s.addText((c) => {
			c.setPlaceholder("파일 경로 또는 @current")
				.setValue(t.file)
				.onChange((v) => (t.file = v));
			new FileSuggest(this.app, c.inputEl, (v) => {
				t.file = v;
				t.heading = "";
				t.level = 0;
				this.render();
			});
		});

		if (t.file === "@current") {
			t.headings = "h1-h3";
		} else {
			delete t.headings;
			s.addDropdown((dd) => {
				dd.addOption("", "(파일 끝)");
				for (const h of this.headingsOf(t.file)) {
					dd.addOption(
						`${h.level}:${h.heading}`,
						`${"·".repeat(h.level - 1)}${h.heading}`
					);
				}
				dd.setValue(t.heading ? `${t.level ?? 1}:${t.heading}` : "");
				dd.onChange((v) => {
					if (!v) {
						t.heading = "";
						t.level = 0;
						return;
					}
					const at = v.indexOf(":");
					t.level = Number(v.slice(0, at));
					t.heading = v.slice(at + 1);
				});
			});
		}

		s.addText((c) =>
			c
				.setPlaceholder("표시 라벨")
				.setValue(t.label ?? "")
				.onChange((v) => (t.label = v))
		);

		s.addExtraButton((b) =>
			b
				.setIcon("trash")
				.setTooltip("이 대상 삭제")
				.onClick(() => {
					this.draft.targets.splice(i, 1);
					this.render();
				})
		);
	}

	/** 대상 파일의 H1~H3. 코드펜스 안의 "#" 은 헤딩으로 보지 않는다. */
	private headingsOf(path: string): { heading: string; level: number }[] {
		const f = this.app.vault.getAbstractFileByPath(path);
		if (!(f instanceof TFile)) return [];
		const cache = this.app.metadataCache.getFileCache(f);
		if (!cache) return [];

		const fences = (cache.sections ?? [])
			.filter((s) => s.type === "code")
			.map((s) => [s.position.start.line, s.position.end.line] as const);

		return (cache.headings ?? [])
			.filter((h) => h.level <= 3)
			.filter(
				(h) =>
					!fences.some(
						([a, b]) => h.position.start.line >= a && h.position.start.line <= b
					)
			)
			.map((h) => ({ heading: h.heading, level: h.level }));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
