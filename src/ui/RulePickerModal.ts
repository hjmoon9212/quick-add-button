import { App, FuzzyMatch, FuzzySuggestModal } from "obsidian";
import { RuleDef } from "../settings/Settings";
import { targetLabel } from "../core/appendTask";

/**
 * 리본에서 부르는 버튼 고르기.
 *
 * 코드블록이 놓인 노트로 가지 않고도 아무 데서나 버튼을 쓸 수 있게 한다.
 * 고르고 나면 코드블록의 버튼을 누른 것과 똑같이 폼이 뜬다.
 *
 * 목록·검색 대상은 **켜져 있는 규칙**뿐이다 — 꺼 둔 규칙은 코드블록에도
 * 커맨드에도 안 나오므로 여기만 다르면 "끔"의 뜻이 흐려진다.
 */
export class RulePickerModal extends FuzzySuggestModal<RuleDef> {
	constructor(
		app: App,
		private rules: RuleDef[],
		private onPick: (rule: RuleDef) => void
	) {
		super(app);
		this.setPlaceholder("Choose a button");
		this.setInstructions([
			{ command: "↑↓", purpose: "이동" },
			{ command: "↵", purpose: "열기" },
			{ command: "esc", purpose: "닫기" },
		]);
	}

	getItems(): RuleDef[] {
		return this.rules;
	}

	/** 검색 대상. 라벨뿐 아니라 규칙 이름과 넣을 자리로도 찾게 한다. */
	getItemText(rule: RuleDef): string {
		return `${rule.label} ${rule.name} ${targetLabel(rule)}`;
	}

	renderSuggestion(match: FuzzyMatch<RuleDef>, el: HTMLElement): void {
		const rule = match.item;
		el.addClass("qab-pick");
		el.createEl("div", {
			cls: "qab-pick-label",
			text: rule.label || rule.name,
		});
		el.createEl("div", { cls: "qab-pick-dest", text: targetLabel(rule) });
	}

	onChooseItem(rule: RuleDef): void {
		// 이 콜백이 끝난 **뒤에** 이 모달이 닫힌다. 여기서 바로 폼을 열면 닫히는
		// 모달이 포커스를 되돌려 입력칸에서 커서가 빠질 수 있으므로 한 틱 미룬다.
		window.setTimeout(() => this.onPick(rule), 0);
	}
}
