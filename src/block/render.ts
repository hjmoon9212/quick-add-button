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
			btn.onclick = () => openForm(plugin, b.rule);
		}
	};

	plugin.registerBlock(el, ctx, draw);
	draw();
}

export function openForm(plugin: QuickAddButtonPlugin, rule: RuleDef): void {
	new TaskFormModal(plugin.app, rule, plugin.settings).open();
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
