import { App, Modal, Notice } from "obsidian";
import { RuleDef } from "../settings/Settings";
import { appendTask, revealInserted, targetLabel } from "../core/appendTask";
import { resolveTargetFile } from "../core/resolveFile";
import { addDays, resolveDateToken, todayISO } from "../core/dates";
import { newTaskId } from "../core/taskId";

const PRIORITIES: [string, string][] = [
	["우선순위 없음", ""],
	["🔺 최고", "🔺"],
	["⏫ 높음", "⏫"],
	["🔼 중간", "🔼"],
	["🔽 낮음", "🔽"],
	["⏬ 최저", "⏬"],
];

/**
 * 버튼을 누르면 뜨는 미니 폼. 여기서 조립한 한 줄이 고른 노트의 고른 헤딩
 * 아래로 들어간다.
 */
export class TaskFormModal extends Modal {
	private busy = false;

	private title!: HTMLInputElement;
	private tagSel!: HTMLSelectElement;
	/** 규칙에 gcal 태그가 없으면 만들지 않는다 */
	private gcalSel?: HTMLSelectElement;
	private prioSel!: HTMLSelectElement;
	private startIn!: HTMLInputElement;
	private dueIn!: HTMLInputElement;
	private posSel!: HTMLSelectElement;
	private idChk!: HTMLInputElement;
	private createdChk!: HTMLInputElement;
	private openChk!: HTMLInputElement;
	private preview!: HTMLElement;

	constructor(
		app: App,
		private rule: RuleDef,
		/** `@current` · 상대경로 · 링크 해석의 기준이 되는 노트 */
		private sourcePath: string
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("qab-modal");

		contentEl.createEl("h3", { text: this.rule.label });

		// 넣을 자리는 **연 시점에 푼 것**을 보여준다. `@current` 라고 적혀 있으면
		// 지금 그게 어느 노트인지가 폼에서 바로 보여야 한다.
		const file = resolveTargetFile(this.app, this.rule.file, this.sourcePath);
		const dest = contentEl.createEl("div", { cls: "qab-dest" });
		dest.createEl("span", { text: "→", cls: "qab-arrow" });
		dest.createEl("span", { text: targetLabel(this.rule, file) });
		if (!file) {
			dest.createEl("span", {
				cls: "qab-dest-warn",
				text: "⚠️ 가리키는 노트를 찾지 못했습니다",
			});
		}

		const d = this.rule.defaults;
		const form = contentEl.createEl("div", { cls: "qab-form" });

		// 내용 — 한 줄 통째로
		this.title = form.createEl("input", { cls: "qab-title" });
		this.title.type = "text";
		this.title.placeholder = "할 일 내용";

		// 라벨 | 입력 2열 그리드. 날짜 칩은 날짜 입력과 같은 열에 놓여 왼쪽이 맞는다.
		const grid = form.createEl("div", { cls: "qab-grid" });

		const field = (label: string): HTMLElement => {
			grid.createEl("div", { text: label, cls: "qab-lbl" });
			return grid.createEl("div", { cls: "qab-val" });
		};

		this.tagSel = mkSelect(
			field("태그"),
			this.rule.tags.map((t) => [t, t] as [string, string]),
			this.rule.tags[0] ?? "#task"
		);

		// GCal 라우팅 태그. 규칙에 후보가 있을 때만 칸이 뜬다.
		// "없음"을 끝에 둬서 기본은 첫 후보가 붙고, 필요할 때만 뺄 수 있게 한다.
		if (this.rule.gcals.length) {
			const pairs = this.rule.gcals.map((g) => [g, g] as [string, string]);
			pairs.push(["없음", ""]);
			this.gcalSel = mkSelect(field("GCal"), pairs, this.rule.gcals[0]);
		}

		this.startIn = mkDate(field("🛫 시작"), resolveDateToken(d.start));
		this.dueIn = mkDate(field("📅 마감"), resolveDateToken(d.due));

		const chips = field("");
		chips.addClass("qab-chips");
		const today = todayISO();
		mkChip(chips, "오늘", () => this.setDue(today));
		mkChip(chips, "내일", () => this.setDue(addDays(today, 1)));
		mkChip(chips, "+7일", () => this.setDue(addDays(today, 7)));
		mkChip(chips, "지우기", () => {
			this.startIn.value = "";
			this.dueIn.value = "";
			this.refresh();
		});

		this.prioSel = mkSelect(field("우선순위"), PRIORITIES, d.priority);
		this.posSel = mkSelect(
			field("위치"),
			[
				["목록 끝", "end"],
				["헤딩 바로 밑", "top"],
			],
			d.position
		);

		const opts = field("");
		opts.addClass("qab-opts");
		this.createdChk = mkChk(opts, "➕ 생성일", d.created);
		this.idChk = mkChk(opts, "🆔 아이디", d.id);
		this.openChk = mkChk(opts, "↪ 추가 후 이동", d.openAfter);
		this.openChk.parentElement?.setAttr(
			"title",
			"뒤에 있는 노트를 넣은 줄로 옮깁니다. 이미 그 노트를 보고 있으면 그대로 둡니다. 폼은 닫히지 않습니다."
		);

		this.preview = form.createEl("div", { cls: "qab-preview" });

		const actions = form.createEl("div", { cls: "qab-actions" });
		actions.createEl("span", { text: "Enter 로도 추가됩니다", cls: "qab-kbd" });
		const addBtn = actions.createEl("button", { text: "추가", cls: "mod-cta" });
		addBtn.onclick = () => void this.submit();

		const watched: HTMLElement[] = [
			this.title,
			this.tagSel,
			this.prioSel,
			this.startIn,
			this.dueIn,
			this.idChk,
			this.createdChk,
		];
		if (this.gcalSel) watched.push(this.gcalSel);
		for (const el of watched) {
			el.addEventListener("input", () => this.refresh());
			el.addEventListener("change", () => this.refresh());
		}
		this.title.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				void this.submit();
			}
		});

		this.refresh();
		window.setTimeout(() => this.title.focus(), 0);
	}

	private setDue(iso: string): void {
		this.dueIn.value = iso;
		this.refresh();
	}

	private buildLine(id: string): string {
		// 태그 → gcal 라우팅 → 내용 순. tasks-gcal-sync 가 제목에서 #gcal/… 를 떼므로
		// 이벤트 제목은 내용만 남는다.
		const gcal = this.gcalSel?.value ? `${this.gcalSel.value} ` : "";
		const parts = [
			`- [ ] ${this.tagSel.value} ${gcal}${this.title.value.trim() || "내용"}`,
		];
		if (this.prioSel.value) parts.push(this.prioSel.value);
		if (this.idChk.checked) parts.push(`🆔 ${id}`);
		if (this.createdChk.checked) parts.push(`➕ ${todayISO()}`);
		if (this.startIn.value) parts.push(`🛫 ${this.startIn.value}`);
		if (this.dueIn.value) parts.push(`📅 ${this.dueIn.value}`);
		return parts.join(" ");
	}

	private refresh(): void {
		this.preview.setText(`미리보기  ${this.buildLine("??????")}`);
	}

	private async submit(): Promise<void> {
		if (this.busy) return;

		const text = this.title.value.trim();
		if (!text) {
			new Notice("할 일 내용을 입력하세요");
			this.title.focus();
			return;
		}
		if (
			this.startIn.value &&
			this.dueIn.value &&
			this.startIn.value > this.dueIn.value
		) {
			new Notice("시작일이 마감일보다 뒤일 수 없습니다");
			return;
		}
		this.busy = true;
		try {
			const id = this.idChk.checked ? await newTaskId(this.app) : "";
			const at = await appendTask(
				this.app,
				this.rule,
				this.buildLine(id),
				this.posSel.value === "top",
				this.sourcePath
			);
			if (!at) return;

			// 연달아 넣는 경우가 많으므로 닫지 않고 내용만 비운다.
			this.title.value = "";
			this.refresh();

			// 폼은 그대로 두고 뒤에 있는 노트만 그 줄로 옮긴다. 폼을 닫으면
			// 바로 그 자리가 보인다.
			if (this.openChk.checked) await revealInserted(this.app, at);

			this.title.focus();
		} finally {
			this.busy = false;
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

function mkSelect(
	parent: HTMLElement,
	pairs: [string, string][],
	selected: string
): HTMLSelectElement {
	const s = parent.createEl("select");
	for (const [label, value] of pairs) {
		const o = s.createEl("option", { text: label });
		o.value = value;
	}
	if (pairs.some(([, v]) => v === selected)) s.value = selected;
	return s;
}

function mkDate(parent: HTMLElement, value: string): HTMLInputElement {
	const d = parent.createEl("input");
	d.type = "date";
	d.value = value;
	return d;
}

function mkChip(parent: HTMLElement, label: string, onClick: () => void): void {
	const b = parent.createEl("button", { text: label, cls: "qab-chip" });
	b.onclick = onClick;
}

function mkChk(parent: HTMLElement, label: string, on: boolean): HTMLInputElement {
	const w = parent.createEl("label", { cls: "qab-chk" });
	const c = w.createEl("input");
	c.type = "checkbox";
	c.checked = on;
	w.createEl("span", { text: label });
	return c;
}
