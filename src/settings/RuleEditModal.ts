import {
	AbstractInputSuggest,
	App,
	DropdownComponent,
	Modal,
	Setting,
	TextComponent,
	TFile,
} from "obsidian";
import { canonicalGcal, GCAL_TAGS, RuleDef } from "./Settings";
import { headingsOf } from "../core/headings";
import { CURRENT, isDynamicTarget } from "../core/paths";
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
		const paths = this.app.vault
			.getMarkdownFiles()
			.map((f) => f.path)
			.filter((p) => p.toLowerCase().includes(q))
			.slice(0, 50);
		// 고정 경로 목록에 섞이지 않게 맨 위에 둔다. 안 그러면 이런 값을 적을 수
		// 있다는 걸 알 방법이 없다.
		return CURRENT.includes(q) ? [CURRENT, ...paths] : paths;
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

/** 규칙 하나(= 버튼 하나)를 편집한다. */
export class RuleEditModal extends Modal {
	private draft: RuleDef;
	private headingSel!: HTMLSelectElement;
	/** 파일이 그때그때 달라지는 규칙(`@current` 등)은 헤딩을 직접 적는다 */
	private headingText!: TextComponent;
	/** 직접 적을 때 몇 단계 헤딩인지. 목록에서 고를 때는 고른 헤딩이 정한다 */
	private headingLevel!: DropdownComponent;
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
			.setDesc("코드블록에서 이 버튼을 지목할 때 쓰는 이름입니다. 영문으로 짓습니다.")
			.addText((t) =>
				t
					.setPlaceholder("TempTask")
					.setValue(this.draft.name)
					.onChange((v) => (this.draft.name = v))
			);

		new Setting(contentEl)
			.setName("버튼 라벨")
			.setDesc("노트에 보이는 버튼 글자입니다.")
			.addText((t) =>
				t
					.setPlaceholder("⚡ 임시 할일")
					.setValue(this.draft.label)
					.onChange((v) => (this.draft.label = v))
			);

		new Setting(contentEl)
			.setName("리본 목록에 넣기")
			.setDesc(
				"왼쪽 리본 아이콘을 눌렀을 때 나오는 목록에 이 버튼을 넣습니다. 꺼도 노트의 코드블록과 커맨드로는 그대로 쓸 수 있습니다."
			)
			.addToggle((t) =>
				t.setValue(this.draft.ribbon).onChange((v) => (this.draft.ribbon = v))
			);

		new Setting(contentEl).setName("이 버튼이 넣을 곳").setHeading();

		new Setting(contentEl)
			.setName("파일")
			.setDesc(
				"할일을 넣을 노트. 입력하면 볼트에서 검색됩니다. @current 는 버튼을 누른 노트 자신, ./ 와 ../ 는 그 노트의 폴더 기준입니다."
			)
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
			.addDropdown((dd) => {
				this.headingSel = dd.selectEl;
				dd.onChange((v) => {
					const at = v.indexOf(":");
					this.draft.level = Number(v.slice(0, at));
					this.draft.heading = v.slice(at + 1);
				});
			})
			.addDropdown((dd) => {
				this.headingLevel = dd;
				// 0 = 이름만 대조. 노트마다 단계가 다르면 이쪽이고, 단계까지
				// 똑같이 쓰는 볼트라면 골라 두는 편이 정확하다.
				dd.addOption("0", "아무 단계");
				for (let n = 1; n <= 6; n++) dd.addOption(String(n), "#".repeat(n));
				dd.onChange((v) => (this.draft.level = Number(v)));
			})
			.addText((t) => {
				this.headingText = t;
				t.setPlaceholder("할 일").onChange(
					(v) => (this.draft.heading = v.trim())
				);
			});
		this.headingDesc = headingSetting.descEl;
		this.refreshHeadings();

		new Setting(contentEl)
			.setName("태그")
			.setDesc("이 버튼이 쓸 태그입니다. 콤마로 여러 개 적으면 폼에서 고를 수 있고, 맨 앞이 기본값입니다.")
			.addText((t) =>
				t
					.setPlaceholder("#task, #task/ISSUE")
					.setValue(this.draft.tags.join(", "))
					.onChange((v) => (this.draft.tags = splitTags(v)))
			);

		let gcalInput: TextComponent;
		const setGcals = (list: string[]): void => {
			this.draft.gcals = list;
			gcalInput.setValue(list.join(", "));
		};
		new Setting(contentEl)
			.setName("GCal 캘린더")
			.addText((t) => {
				gcalInput = t;
				t.setPlaceholder(GCAL_TAGS.slice(0, 3).join(", "))
					.setValue(this.draft.gcals.join(", "))
					.onChange((v) => (this.draft.gcals = splitTags(v)));
				// 아는 캘린더는 자동완성으로. 목록에 없는 이름도 그대로 쓸 수 있다.
				t.inputEl.setAttr("list", "qab-gcal-list");
			})
			.addButton((b) =>
				b
					.setButtonText("전체")
					.setTooltip(`아는 캘린더 ${GCAL_TAGS.length}개를 모두 넣습니다`)
					.onClick(() => setGcals([...GCAL_TAGS]))
			)
			.addButton((b) =>
				b
					.setButtonText("지우기")
					.setTooltip("이 버튼은 캘린더 라우팅을 안 씁니다")
					.onClick(() => setGcals([]))
			);
		const gcalList = contentEl.createEl("datalist");
		gcalList.id = "qab-gcal-list";
		for (const g of GCAL_TAGS) gcalList.createEl("option").value = g;

		new Setting(contentEl).setName("폼을 열었을 때 기본 상태").setHeading();
		const d = this.draft.defaults;

		new Setting(contentEl)
			.setName("마감일")
			.setDesc("폼의 📅 칸에 미리 채워 둘 값입니다. 폼에서 바꿀 수 있습니다.")
			.addDropdown((dd) =>
			dd
				.addOption("", "없음")
				.addOption("today", "오늘")
				.addOption("tomorrow", "내일")
				.addOption("+7", "+7일")
				.setValue(d.due)
				.onChange((v) => (d.due = v))
		);
		new Setting(contentEl)
			.setName("헤딩 아래 어느 위치")
			.setDesc("목록 끝 = 이 헤딩 아래 마지막 할일 뒤(시간순으로 쌓임) · 헤딩 바로 밑 = 최신이 위로.")
			.addDropdown((dd) =>
				dd
					.addOption("end", "목록 끝")
					.addOption("top", "헤딩 바로 밑")
					.setValue(d.position)
					.onChange((v) => (d.position = v as "end" | "top"))
			);
		new Setting(contentEl)
			.setName("➕ 생성일")
			.setDesc("할일에 만든 날짜를 붙입니다.")
			.addToggle((t) => t.setValue(d.created).onChange((v) => (d.created = v)));
		new Setting(contentEl)
			.setName("🆔 아이디")
			.setDesc("고유 6자리를 붙입니다. 조상 트리 뷰와 캘린더 동기화가 이걸로 할일을 추적합니다.")
			.addToggle((t) => t.setValue(d.id).onChange((v) => (d.id = v)));
		new Setting(contentEl)
			.setName("↪ 추가 후 그 노트로 이동")
			.setDesc(
				"뒤에 있는 노트를 넣은 줄로 옮깁니다. 이미 그 노트를 보고 있으면 그대로 둡니다. 폼은 그대로 열려 있어 계속 넣을 수 있고, 닫으면 바로 그 자리가 보입니다."
			)
			.addToggle((t) =>
				t.setValue(d.openAfter).onChange((v) => (d.openAfter = v))
			);

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
						// 손으로 적은 캘린더도 아는 이름이면 표준 표기로 맞춰 둔다.
						this.draft.gcals = this.draft.gcals.map(canonicalGcal);
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

		// 가리키는 노트가 누를 때마다 달라지면 헤딩 목록을 미리 못 만든다.
		// 목록을 만들 수 없다고 입력까지 막으면 이 기능 자체를 못 쓰므로
		// 이때만 직접 적게 한다.
		const dynamic = isDynamicTarget(this.draft.file);
		this.headingSel.toggle(!dynamic);
		this.headingLevel.selectEl.toggle(dynamic);
		this.headingText.inputEl.toggle(dynamic);
		if (dynamic) {
			this.headingText.setValue(this.draft.heading);
			this.headingLevel.setValue(String(this.draft.level || 0));
			this.headingDesc?.setText("");
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(this.draft.file);
		if (!(file instanceof TFile)) {
			this.setHeadingState("파일을 먼저 선택하세요.", true);
			return;
		}

		const options = headingsOf(this.app, file);
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
		// 고를 수 있는 상태에서는 설명을 비운다. descEl 은 아래의 "파일을 먼저
		// 선택하세요" 같은 **상태 알림**에만 쓴다.
		this.headingDesc?.setText("");

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

	onClose(): void {
		this.contentEl.empty();
	}
}

/** 콤마로 적은 태그 목록을 배열로. */
function splitTags(v: string): string[] {
	return v
		.split(",")
		.map((x) => x.trim())
		.filter(Boolean);
}
