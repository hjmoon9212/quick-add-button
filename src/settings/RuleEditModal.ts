import {
	AbstractInputSuggest,
	App,
	Modal,
	Notice,
	Setting,
	TFile,
	TFolder,
} from "obsidian";
import { HubTypeDef, TaskTarget, DEFAULT_TASK_DEFAULTS } from "./Settings";
import { validateType } from "./validate";

const TEMPLATE_SKELETON = (type: string) => `---
Type: ${type}
Status: Planning
Project: "[[ ]]"
created: <% tp.file.creation_date("YYYY-MM-DD HH:mm:ss") %>
tags:
  - ${type.toLowerCase()}
---

# <% tp.file.title %>

## 내용

`;

/** 볼트 파일 경로 자동완성. */
class FileSuggest extends AbstractInputSuggest<string> {
	constructor(app: App, private input: HTMLInputElement, private onPick: (v: string) => void) {
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

/** 규칙 하나를 편집한다. create-note / append-task 에 따라 폼이 달라진다. */
export class RuleEditModal extends Modal {
	private draft: HubTypeDef;

	constructor(
		app: App,
		def: HubTypeDef,
		private all: HubTypeDef[],
		private selfIndex: number,
		private onSave: (def: HubTypeDef) => void
	) {
		super(app);
		this.draft = JSON.parse(JSON.stringify(def)) as HubTypeDef;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("hub-button-modal");
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", {
			text: this.selfIndex < 0 ? "규칙 추가" : `규칙 편집 — ${this.draft.name || "(이름 없음)"}`,
		});

		new Setting(contentEl)
			.setName("동작")
			.setDesc(
				this.draft.action === "create-note"
					? "템플릿으로 하위 노트를 만들고 허브로 백링크를 겁니다."
					: "지정한 노트의 특정 헤딩 아래에 할일 한 줄을 넣습니다."
			)
			.addDropdown((d) =>
				d
					.addOption("create-note", "노트 생성")
					.addOption("append-task", "할일 추가")
					.setValue(this.draft.action)
					.onChange((v) => {
						this.draft.action = v as HubTypeDef["action"];
						if (this.draft.action === "append-task") {
							this.draft.targets ??= [
								{ file: "@current", headings: "h1-h3", label: "현재 노트" },
							];
							this.draft.defaults ??= { ...DEFAULT_TASK_DEFAULTS };
						} else {
							this.draft.folder ??= "";
							this.draft.template ??= "";
						}
						this.render();
					})
			);

		new Setting(contentEl)
			.setName("타입 이름")
			.setDesc("생성 노트의 frontmatter `Type` 값이자 코드블록에서 부르는 이름입니다.")
			.addText((t) =>
				t
					.setPlaceholder("Doc")
					.setValue(this.draft.name)
					.onChange((v) => (this.draft.name = v))
			);

		new Setting(contentEl)
			.setName("버튼 라벨")
			.setDesc("이모지 + 짧은 한글을 권장합니다.")
			.addText((t) =>
				t
					.setPlaceholder("📚 자료/메모 추가")
					.setValue(this.draft.label)
					.onChange((v) => (this.draft.label = v))
			);

		if (this.draft.action === "create-note") this.renderCreateNote(contentEl);
		else this.renderAppendTask(contentEl);

		const errBox = contentEl.createEl("div", { cls: "hub-button-errors" });

		new Setting(contentEl)
			.addButton((b) => b.setButtonText("취소").onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText("저장")
					.setCta()
					.onClick(() => {
						this.draft.name = this.draft.name.trim();
						if (!this.draft.label.trim()) this.draft.label = this.draft.name;
						const errs = validateType(this.draft, this.all, this.selfIndex);
						errBox.empty();
						if (errs.length) {
							for (const e of errs) {
								errBox.createEl("div", { text: `⚠️ ${e}`, cls: "hub-button-hint-error" });
							}
							return;
						}
						this.onSave(this.draft);
						this.close();
					})
			);
	}

	private renderCreateNote(root: HTMLElement): void {
		new Setting(root)
			.setName("하위 폴더")
			.setDesc("허브 노트가 있는 폴더 기준 상대 경로입니다.")
			.addText((t) =>
				t
					.setPlaceholder("자료")
					.setValue(this.draft.folder ?? "")
					.onChange((v) => (this.draft.folder = v))
			);

		const tplSetting = new Setting(root)
			.setName("템플릿")
			.setDesc("볼트 절대경로. 없는 파일을 적으면 여기서 바로 만들 수 있습니다.");

		tplSetting.addText((t) => {
			t.setPlaceholder("Template/Doc.md")
				.setValue(this.draft.template ?? "")
				.onChange((v) => {
					this.draft.template = v;
					this.updateTemplateButton(tplSetting);
				});
			new FileSuggest(this.app, t.inputEl, (v) => {
				this.draft.template = v;
				this.updateTemplateButton(tplSetting);
			});
		});

		tplSetting.addButton((b) =>
			b
				.setButtonText("템플릿 생성")
				.setClass("hub-button-mk-template")
				.onClick(async () => {
					const path = (this.draft.template ?? "").trim();
					const name = this.draft.name.trim();
					if (!path || !name) {
						new Notice("타입 이름과 템플릿 경로를 먼저 입력하세요");
						return;
					}
					if (this.app.vault.getAbstractFileByPath(path)) {
						new Notice("이미 존재하는 템플릿입니다");
						return;
					}
					const parent = path.slice(0, path.lastIndexOf("/"));
					if (parent && !(this.app.vault.getAbstractFileByPath(parent) instanceof TFolder)) {
						await this.app.vault.createFolder(parent);
					}
					await this.app.vault.create(path, TEMPLATE_SKELETON(name));
					new Notice(`✅ 템플릿 생성: ${path}`);
					this.updateTemplateButton(tplSetting);
				})
		);

		this.updateTemplateButton(tplSetting);
	}

	private updateTemplateButton(setting: Setting): void {
		const path = (this.draft.template ?? "").trim();
		const exists = !!path && this.app.vault.getAbstractFileByPath(path) instanceof TFile;
		const btn = setting.controlEl.querySelector(".hub-button-mk-template");
		if (btn instanceof HTMLElement) btn.toggleClass("hub-button-hidden", exists);
	}

	private renderAppendTask(root: HTMLElement): void {
		root.createEl("h4", { text: "삽입 대상" });
		root.createEl("div", {
			cls: "hub-button-hint",
			text: "클릭 시 폼의 대상 드롭다운을 이 순서로 채웁니다. `@current` = 버튼이 있는 노트, `@hub/…` = 허브 폴더 기준.",
		});

		const list = root.createEl("div");
		this.draft.targets?.forEach((t, i) => this.renderTargetRow(list, t, i));

		new Setting(root).addButton((b) =>
			b.setButtonText("＋ 대상 추가").onClick(() => {
				this.draft.targets?.push({ file: "", heading: "" });
				this.render();
			})
		);

		root.createEl("h4", { text: "기본값" });
		const d = this.draft.defaults!;

		new Setting(root).setName("기본 태그").addText((t) =>
			t.setPlaceholder("#task").setValue(d.tag).onChange((v) => (d.tag = v))
		);
		new Setting(root).setName("기본 마감일").addDropdown((dd) =>
			dd
				.addOption("", "없음")
				.addOption("today", "오늘")
				.addOption("tomorrow", "내일")
				.addOption("+7", "+7일")
				.setValue(d.due)
				.onChange((v) => (d.due = v))
		);
		new Setting(root).setName("기본 삽입 위치").addDropdown((dd) =>
			dd
				.addOption("end", "섹션 끝")
				.addOption("top", "섹션 맨 위")
				.setValue(d.position)
				.onChange((v) => (d.position = v as "end" | "top"))
		);
		new Setting(root)
			.setName("➕ 생성일 기본 체크")
			.addToggle((t) => t.setValue(d.created).onChange((v) => (d.created = v)));
		new Setting(root)
			.setName("🆔 아이디 기본 체크")
			.setDesc("켜면 추가할 때마다 볼트 전역에서 미사용인 6자리를 붙입니다.")
			.addToggle((t) => t.setValue(d.id).onChange((v) => (d.id = v)));
	}

	private renderTargetRow(root: HTMLElement, t: TaskTarget, i: number): void {
		const s = new Setting(root).setClass("hub-button-target-row");

		s.addText((c) => {
			c.setPlaceholder("파일 경로 또는 @current")
				.setValue(t.file)
				.onChange((v) => {
					t.file = v;
				});
			new FileSuggest(this.app, c.inputEl, (v) => {
				t.file = v;
				this.render();
			});
		});

		if (t.file === "@current") {
			s.setDesc("클릭 시점에 그 노트의 H1~H3 를 자동으로 펼칩니다.");
			t.headings = "h1-h3";
		} else {
			delete t.headings;
			s.addDropdown((dd) => {
				dd.addOption("", "(파일 끝)");
				for (const h of this.headingsOf(t.file)) {
					dd.addOption(`${h.level}:${h.heading}`, `${"·".repeat(h.level - 1)}${h.heading}`);
				}
				const cur = t.heading ? `${t.level ?? 1}:${t.heading}` : "";
				dd.setValue(cur);
				dd.onChange((v) => {
					if (!v) {
						t.heading = "";
						t.level = 0;
					} else {
						const idx = v.indexOf(":");
						t.level = Number(v.slice(0, idx));
						t.heading = v.slice(idx + 1);
					}
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
					this.draft.targets?.splice(i, 1);
					this.render();
				})
		);
	}

	/** 대상 파일의 헤딩을 삽입 로직과 같은 규칙(코드펜스 무시)으로 읽는다. */
	private headingsOf(path: string): { heading: string; level: number }[] {
		const f = this.app.vault.getAbstractFileByPath(path);
		if (!(f instanceof TFile)) return [];
		const cache = this.app.metadataCache.getFileCache(f);
		if (!cache?.sections) return [];
		// 캐시의 headings 를 쓰되, 코드블록 섹션 범위에 걸친 것은 버린다.
		const fences = cache.sections
			.filter((s) => s.type === "code")
			.map((s) => [s.position.start.line, s.position.end.line] as const);
		return (cache.headings ?? [])
			.filter((h) => h.level <= 3)
			.filter((h) => !fences.some(([a, b]) => h.position.start.line >= a && h.position.start.line <= b))
			.map((h) => ({ heading: h.heading, level: h.level }));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
