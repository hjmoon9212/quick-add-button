import { App, Modal, Notice } from "obsidian";
import { QuickAddButtonSettings, RuleDef } from "../settings/Settings";
import { appendTask, targetLabel } from "../core/appendTask";
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
	private prioSel!: HTMLSelectElement;
	private startIn!: HTMLInputElement;
	private dueIn!: HTMLInputElement;
	private posSel!: HTMLSelectElement;
	private idChk!: HTMLInputElement;
	private createdChk!: HTMLInputElement;
	private preview!: HTMLElement;

	constructor(
		app: App,
		private rule: RuleDef,
		private settings: QuickAddButtonSettings
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("qab-modal");
		contentEl.createEl("h3", { text: this.rule.label });
		contentEl.createEl("div", {
			cls: "qab-hint",
			text: `→ ${targetLabel(this.rule)}`,
		});

		const d = this.rule.defaults;
		const form = contentEl.createEl("div", { cls: "qab-form" });

		// 1행 — 내용 · 태그 · 우선순위
		const row1 = form.createEl("div", { cls: "qab-row" });
		this.title = row1.createEl("input", { cls: "qab-title" });
		this.title.type = "text";
		this.title.placeholder = "할 일 내용 (Enter = 추가)";
		this.tagSel = mkSelect(
			row1,
			this.settings.taskTags.map((t) => [t, t] as [string, string]),
			d.tag
		);
		this.prioSel = mkSelect(row1, PRIORITIES, d.priority);

		// 2행 — 날짜
		const row2 = form.createEl("div", { cls: "qab-row" });
		row2.createEl("span", { text: "🛫 시작", cls: "qab-lbl" });
		this.startIn = mkDate(row2, resolveDateToken(d.start));
		row2.createEl("span", { text: "📅 마감", cls: "qab-lbl" });
		this.dueIn = mkDate(row2, resolveDateToken(d.due));

		const today = todayISO();
		mkChip(row2, "오늘", () => this.setDue(today));
		mkChip(row2, "내일", () => this.setDue(addDays(today, 1)));
		mkChip(row2, "+7일", () => this.setDue(addDays(today, 7)));
		mkChip(row2, "날짜 지우기", () => {
			this.startIn.value = "";
			this.dueIn.value = "";
			this.refresh();
		});

		// 3행 — 위치 · 옵션
		const row3 = form.createEl("div", { cls: "qab-row" });
		row3.createEl("span", { text: "위치", cls: "qab-lbl" });
		this.posSel = mkSelect(
			row3,
			[
				["섹션 끝", "end"],
				["헤딩 바로 밑", "top"],
			],
			d.position
		);
		this.idChk = mkChk(row3, "🆔 아이디", d.id);
		this.createdChk = mkChk(row3, "➕ 생성일", d.created);

		this.preview = form.createEl("div", { cls: "qab-preview" });

		const actions = form.createEl("div", { cls: "qab-row qab-actions" });
		const addBtn = actions.createEl("button", { text: "➕ 추가", cls: "mod-cta" });
		addBtn.onclick = () => void this.submit();

		for (const el of [
			this.title,
			this.tagSel,
			this.prioSel,
			this.startIn,
			this.dueIn,
			this.idChk,
			this.createdChk,
		]) {
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
		const parts = [`- [ ] ${this.tagSel.value} ${this.title.value.trim() || "내용"}`];
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
			if (
				await appendTask(
					this.app,
					this.rule,
					this.buildLine(id),
					this.posSel.value === "top"
				)
			) {
				// 연달아 넣는 경우가 많으므로 닫지 않고 내용만 비운다.
				this.title.value = "";
				this.refresh();
				this.title.focus();
			}
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
