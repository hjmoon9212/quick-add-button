import { App, Modal, Notice, TFile } from "obsidian";
import { HubButtonSettings, HubTypeDef } from "../settings/Settings";
import { ResolvedTarget, appendTask, expandTargets } from "../core/appendTask";
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
 * append-task 용 미니 폼.
 *
 * 허브 노트에 있던 219줄짜리 "할일 추가 폼" dataviewjs 를 흡수한 것이며,
 * 대상이 현재 노트로 고정이던 것을 규칙의 targets[] 로 확장했다.
 */
export class TaskFormModal extends Modal {
	private targets: ResolvedTarget[] = [];
	private busy = false;

	private title!: HTMLInputElement;
	private tagSel!: HTMLSelectElement;
	private prioSel!: HTMLSelectElement;
	private startIn!: HTMLInputElement;
	private dueIn!: HTMLInputElement;
	private targetSel!: HTMLSelectElement;
	private posSel!: HTMLSelectElement;
	private idChk!: HTMLInputElement;
	private createdChk!: HTMLInputElement;
	private preview!: HTMLElement;

	constructor(
		app: App,
		private def: HubTypeDef,
		private settings: HubButtonSettings,
		private hub: TFile
	) {
		super(app);
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.addClass("hub-button-modal");
		contentEl.createEl("h3", { text: this.def.label });

		this.targets = await expandTargets(this.app, this.def, this.hub);
		if (!this.targets.length) {
			contentEl.createEl("div", {
				cls: "hub-button-hint hub-button-hint-error",
				text: "⚠️ 삽입할 대상이 없습니다. 설정에서 이 규칙의 대상을 확인하세요.",
			});
			return;
		}

		const d = this.def.defaults!;
		const form = contentEl.createEl("div", { cls: "hub-button-form" });

		// 1행 — 내용 · 태그 · 우선순위
		const row1 = form.createEl("div", { cls: "hub-button-row" });
		this.title = row1.createEl("input", { cls: "hub-button-title" });
		this.title.type = "text";
		this.title.placeholder = "할 일 내용 (Enter = 추가)";
		this.tagSel = mkSelect(
			row1,
			this.settings.taskTags.map((t) => [t, t] as [string, string]),
			d.tag
		);
		this.prioSel = mkSelect(row1, PRIORITIES, d.priority);

		// 2행 — 날짜
		const row2 = form.createEl("div", { cls: "hub-button-row" });
		row2.createEl("span", { text: "🛫 시작", cls: "hub-button-lbl" });
		this.startIn = mkDate(row2, resolveDateToken(d.start));
		row2.createEl("span", { text: "📅 마감", cls: "hub-button-lbl" });
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

		// 3행 — 대상 · 위치 · 옵션
		const row3 = form.createEl("div", { cls: "hub-button-row" });
		row3.createEl("span", { text: "대상", cls: "hub-button-lbl" });
		this.targetSel = mkSelect(
			row3,
			this.targets.map((t, i) => [t.label, String(i)] as [string, string]),
			"0"
		);
		this.posSel = mkSelect(
			row3,
			[
				["섹션 끝", "end"],
				["섹션 맨 위", "top"],
			],
			d.position
		);
		this.idChk = mkChk(row3, "🆔 아이디", d.id);
		this.createdChk = mkChk(row3, "➕ 생성일", d.created);

		this.preview = form.createEl("div", { cls: "hub-button-preview" });

		const actions = form.createEl("div", { cls: "hub-button-row hub-button-actions" });
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
		const parts = [
			`- [ ] ${this.tagSel.value} ${this.title.value.trim() || "내용"}`,
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
		const target = this.targets[Number(this.targetSel.value)];
		if (!target) {
			new Notice("삽입 대상을 선택하세요");
			return;
		}

		this.busy = true;
		try {
			const id = this.idChk.checked ? await newTaskId(this.app) : "";
			const ok = await appendTask(
				this.app,
				target,
				this.buildLine(id),
				this.posSel.value === "top"
			);
			if (ok) {
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
	const b = parent.createEl("button", { text: label, cls: "hub-button-chip" });
	b.onclick = onClick;
}

function mkChk(
	parent: HTMLElement,
	label: string,
	on: boolean
): HTMLInputElement {
	const w = parent.createEl("label", { cls: "hub-button-chk" });
	const c = w.createEl("input");
	c.type = "checkbox";
	c.checked = on;
	w.createEl("span", { text: label });
	return c;
}
