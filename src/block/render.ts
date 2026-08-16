import { MarkdownPostProcessorContext, Notice, setIcon } from "obsidian";
import type QuickAddButtonPlugin from "../main";
import { RuleDef } from "../settings/Settings";
import { parseBlock, resolveButtons } from "./parse";
import { TaskFormModal } from "../ui/TaskFormModal";

/**
 * ```quick-add-button 블록 하나를 그린다.
 *
 * 설정이 바뀌면 plugin.refreshAll() 이 여기 등록된 draw 를 다시 부르므로,
 * 열려 있는 모든 노트가 Ctrl+R 없이 같이 갱신된다.
 */
export function renderBlock(
	plugin: QuickAddButtonPlugin,
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext
): void {
	const draw = () => {
		el.empty();
		el.addClass("qab-block");

		const parsed = parseBlock(source);
		if (!parsed.ok) {
			renderError(plugin, el, parsed.message);
			return;
		}

		const buttons = resolveButtons(parsed.spec, plugin.settings);
		if (!buttons.length) {
			renderError(plugin, el, "표시할 규칙이 없습니다. 설정에서 규칙을 추가하세요.");
			return;
		}

		const row = el.createEl("div", { cls: "qab-row" });
		for (const b of buttons) {
			if (!b.ok) {
				renderError(plugin, el, `⚠️ ${b.message}`, b.name);
				continue;
			}
			const btn = row.createEl("button", { text: b.rule.label, cls: "qab-btn" });
			// 기준 노트는 **블록이 놓인 노트**다. 활성 노트를 쓰면 분할 화면에서
			// 옆 창을 보고 있을 때 엉뚱한 노트가 기준이 된다.
			btn.onclick = () => openForm(plugin, b.rule, ctx.sourcePath);
		}
	};

	plugin.registerBlock(el, ctx, draw);
	draw();
}

/**
 * sourcePath 를 안 주면 그때 보고 있던 노트를 기준으로 삼는다 — 리본과 커맨드가
 * 그렇다. 블록에서 부를 때만 블록이 놓인 노트를 명시한다.
 */
export function openForm(
	plugin: QuickAddButtonPlugin,
	rule: RuleDef,
	sourcePath?: string
): void {
	const base = sourcePath ?? plugin.app.workspace.getActiveFile()?.path ?? "";
	new TaskFormModal(plugin.app, rule, base).open();
}

function renderError(
	plugin: QuickAddButtonPlugin,
	el: HTMLElement,
	message: string,
	name?: string
): void {
	const box = el.createEl("div", { cls: "qab-error" });
	const icon = box.createEl("span", { cls: "qab-error-icon" });
	setIcon(icon, "alert-triangle");
	box.createEl("span", { text: message });

	const fix = box.createEl("button", {
		text: name ? "설정에서 추가" : "설정 열기",
		cls: "qab-chip",
	});
	fix.onclick = () => plugin.openSettings();
}
