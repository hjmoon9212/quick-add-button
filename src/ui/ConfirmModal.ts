import { App, Modal } from "obsidian";

export interface ConfirmOptions {
	title: string;
	body: string;
	/** 실행 버튼 글자 */
	cta: string;
	onConfirm: () => void | Promise<void>;
	/** 왼쪽 버튼 글자. 기본은 "취소" */
	cancelText?: string;
	/**
	 * 왼쪽 버튼을 눌렀을 때. 없으면 그냥 닫는다.
	 *
	 * Esc 나 바깥 클릭으로 닫을 때는 부르지 않는다 — 두 버튼이 각각 무언가를
	 * 한다면(덮어쓰기 / 다시 불러오기) 창을 치우는 것과 고르는 것은 다르다.
	 */
	onCancel?: () => void | Promise<void>;
}

/**
 * 되돌릴 수 없는 것을 실행하기 전에 한 번 묻는다.
 *
 * 기본 포커스를 **취소**에 둔다 — 설정탭의 아이콘 버튼들은 서로 붙어 있어
 * 잘못 누르기 쉬운데, 확인창이 떠도 Enter 가 실행으로 붙어 있으면 한 번 더
 * 미끄러진다.
 */
export class ConfirmModal extends Modal {
	constructor(app: App, private opts: ConfirmOptions) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("qab-modal");
		contentEl.createEl("h3", { text: this.opts.title });
		contentEl.createEl("p", { text: this.opts.body, cls: "qab-confirm-body" });

		const row = contentEl.createEl("div", { cls: "qab-confirm-actions" });

		const cancel = row.createEl("button", {
			text: this.opts.cancelText ?? "취소",
		});
		cancel.onclick = () => {
			this.close();
			void this.opts.onCancel?.();
		};

		const ok = row.createEl("button", { text: this.opts.cta, cls: "mod-warning" });
		ok.onclick = () => {
			this.close();
			void this.opts.onConfirm();
		};

		window.setTimeout(() => cancel.focus(), 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
