import { App, Modal, Setting } from "obsidian";

/**
 * create-note 용 파일명 입력.
 *
 * QuickAdd 의 inputPrompt 를 대체한다. 현행은 이름을 다 치고 Enter 를 누른
 * 뒤에야 "이미 존재" 토스트가 떴는데, 여기서는 입력 중에 경로와 충돌을 보여준다.
 */
export class NamePromptModal extends Modal {
	private value = "";
	private resolved = false;

	constructor(
		app: App,
		private title: string,
		private folder: string,
		private onSubmit: (name: string | null) => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("hub-button-modal");
		contentEl.createEl("h3", { text: this.title });

		const hint = contentEl.createEl("div", { cls: "hub-button-hint" });
		const submit = () => this.finish(this.value.trim());

		let input: HTMLInputElement;
		new Setting(contentEl).setName("파일명").addText((t) => {
			input = t.inputEl;
			t.setPlaceholder("파일명 (Enter = 만들기)").onChange((v) => {
				this.value = v;
				this.updateHint(hint, v.trim());
			});
			t.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					submit();
				}
			});
		});

		new Setting(contentEl)
			.addButton((b) => b.setButtonText("취소").onClick(() => this.finish(null)))
			.addButton((b) =>
				b.setButtonText("만들기").setCta().onClick(submit)
			);

		this.updateHint(hint, "");
		window.setTimeout(() => input?.focus(), 0);
	}

	private updateHint(el: HTMLElement, name: string): void {
		el.empty();
		if (!name) {
			el.setText(`위치: ${this.folder}/`);
			el.removeClass("hub-button-hint-error");
			return;
		}
		const path = `${this.folder}/${name}.md`;
		const clash = !!this.app.vault.getAbstractFileByPath(path);
		el.setText(clash ? `⚠️ 이미 존재합니다: ${path}` : path);
		el.toggleClass("hub-button-hint-error", clash);
	}

	private finish(name: string | null): void {
		if (this.resolved) return;
		if (name !== null) {
			if (!name) return; // 빈 이름으로는 닫지 않는다
			const path = `${this.folder}/${name}.md`;
			if (this.app.vault.getAbstractFileByPath(path)) return; // 충돌 시 닫지 않는다
		}
		this.resolved = true;
		this.close();
		this.onSubmit(name);
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) {
			this.resolved = true;
			this.onSubmit(null);
		}
	}
}
