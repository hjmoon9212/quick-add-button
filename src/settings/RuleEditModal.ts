import { AbstractInputSuggest, App, Modal, Setting, TFile } from "obsidian";
import { RuleDef } from "./Settings";
import { validateRule } from "./validate";

/** 볼트의 마크다운 파일 경로를 입력하면서 검색한다. */
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
			.slice(0, 50);
	}
	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}
	selectSuggestion(value: string): void {
		this.input.value = value;
		this.setValue(value);
		this.onPick(value);
		this.close();
	}
}

interface HeadingOption {
	heading: string;
	level: number;
}

/** 규칙 하나(= 버튼 하나)를 편집한다. */
export class RuleEditModal extends Modal {
	private draft: RuleDef;
	private headingSel!: HTMLSelectElement;
	private headingDesc!: HTMLElement;

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

		new Setting(contentEl).setName("삽입 대상").setHeading();

		new Setting(contentEl)
			.setName("파일")
			.setDesc("입력하면 볼트의 노트를 검색합니다.")
			.addText((t) => {
				t.setPlaceholder("0. Note/0. Inbox/Temp Tasks.md")
					.setValue(this.draft.file)
					.onChange((v) => {
						this.draft.file = v.trim();
						this.draft.heading = "";
						this.draft.level = 0;
						this.refreshHeadings();
					});
				t.inputEl.addClass("qab-wide");
				new FileSuggest(this.app, t.inputEl, (v) => {
					this.draft.file = v;
					this.draft.heading = "";
					this.draft.level = 0;
					this.refreshHeadings();
				});
			});

		const headingSetting = new Setting(contentEl)
			.setName("헤딩")
			.setDesc("이 헤딩 아래에 할일이 들어갑니다.")
			.addDropdown((dd) => {
				this.headingSel = dd.selectEl;
				dd.onChange((v) => {
					const at = v.indexOf(":");
					this.draft.level = Number(v.slice(0, at));
					this.draft.heading = v.slice(at + 1);
				});
			});
		this.headingDesc = headingSetting.descEl;
		this.refreshHeadings();

		new Setting(contentEl).setName("폼 기본값").setHeading();
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
			.setName("헤딩 아래 어디에")
			.addDropdown((dd) =>
				dd
					.addOption("end", "섹션 끝")
					.addOption("top", "헤딩 바로 밑")
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

	/**
	 * 파일이 바뀌면 헤딩 목록을 그 자리에서 다시 채운다.
	 * 여기서 render() 를 다시 부르면 타이핑 도중 입력칸이 새로 그려져 포커스를
	 * 잃으므로, option 만 갈아끼운다.
	 */
	private refreshHeadings(): void {
		if (!this.headingSel) return;
		this.headingSel.empty();

		const file = this.app.vault.getAbstractFileByPath(this.draft.file);
		if (!(file instanceof TFile)) {
			this.setHeadingState("파일을 먼저 선택하세요.", true);
			return;
		}

		const options = this.headingsOf(file);
		if (!options.length) {
			this.setHeadingState("이 노트에는 헤딩이 없습니다. 헤딩을 만든 뒤 다시 고르세요.", true);
			return;
		}

		for (const h of options) {
			const o = this.headingSel.createEl("option", {
				text: `${"#".repeat(h.level)} ${h.heading}`,
			});
			o.value = `${h.level}:${h.heading}`;
		}
		this.headingSel.disabled = false;
		this.headingDesc?.setText("이 헤딩 아래에 할일이 들어갑니다.");

		const want = `${this.draft.level}:${this.draft.heading}`;
		if (this.draft.heading && options.some((h) => `${h.level}:${h.heading}` === want)) {
			this.headingSel.value = want;
		} else {
			// 첫 헤딩을 기본으로 잡아 둔다 — 안 고르고 저장하면 검증에 걸린다.
			this.headingSel.selectedIndex = 0;
			this.draft.level = options[0].level;
			this.draft.heading = options[0].heading;
		}
	}

	private setHeadingState(message: string, empty: boolean): void {
		const o = this.headingSel.createEl("option", { text: "—" });
		o.value = "";
		this.headingSel.disabled = true;
		this.headingDesc?.setText(message);
		if (empty) {
			this.draft.heading = "";
			this.draft.level = 0;
		}
	}

	/** 대상 파일의 헤딩. 삽입 로직과 같은 규칙(코드펜스 무시)으로 읽는다. */
	private headingsOf(file: TFile): HeadingOption[] {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return [];

		const fences = (cache.sections ?? [])
			.filter((s) => s.type === "code")
			.map((s) => [s.position.start.line, s.position.end.line] as const);

		const fromCache = (cache.headings ?? [])
			.filter(
				(h) =>
					!fences.some(
						([a, b]) => h.position.start.line >= a && h.position.start.line <= b
					)
			)
			.map((h) => ({ heading: h.heading, level: h.level }));

		return fromCache.length ? fromCache : [];
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

