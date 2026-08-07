import { MarkdownPostProcessorContext, Notice, setIcon } from "obsidian";
import type HubButtonPlugin from "../main";
import { HubTypeDef } from "../settings/Settings";
import { parseBlock, resolveButtons } from "./parse";
import { createNote } from "../core/createNote";
import { hubFolder, joinPath, resolveHub } from "../core/resolve";
import { NamePromptModal } from "../ui/NamePromptModal";
import { TaskFormModal } from "../ui/TaskFormModal";

/**
 * ```hub-button 블록 하나를 그린다.
 *
 * 설정이 바뀌면 plugin.refreshAll() 이 여기 등록된 draw 를 다시 부르므로,
 * 열려 있는 모든 허브(템플릿과 인스턴스 양쪽)가 Ctrl+R 없이 같이 갱신된다.
 */
export function renderBlock(
	plugin: HubButtonPlugin,
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext
): void {
	const draw = () => {
		el.empty();
		el.addClass("hub-button-block");

		const parsed = parseBlock(source, plugin.settings);
		if (!parsed.ok) {
			renderError(plugin, el, parsed.message);
			return;
		}

		const row = el.createEl("div", { cls: "hub-button-row" });
		for (const b of resolveButtons(parsed.spec, plugin.settings)) {
			if (!b.ok) {
				renderError(plugin, el, `⚠️ ${b.message}`, b.typeName);
				continue;
			}
			const btn = row.createEl("button", {
				text: b.def.label,
				cls: "hub-button",
			});
			btn.onclick = () =>
				void run(plugin, b.def, ctx.sourcePath, parsed.spec.requireType);
		}
	};

	plugin.registerBlock(el, ctx, draw);
	draw();
}

async function run(
	plugin: HubButtonPlugin,
	def: HubTypeDef,
	sourcePath: string,
	requireType: string | false
): Promise<void> {
	const hub = resolveHub(plugin.app, sourcePath, requireType);
	if (!hub.ok) {
		new Notice(`⚠️ ${hub.message}`);
		return;
	}

	if (def.action === "append-task") {
		new TaskFormModal(plugin.app, def, plugin.settings, hub.value).open();
		return;
	}

	const folder = joinPath(hubFolder(hub.value), def.folder ?? "");
	new NamePromptModal(plugin.app, def.label, folder, (name) => {
		if (!name) return;
		void createNote(plugin.app, hub.value, def, plugin.settings, name);
	}).open();
}

function renderError(
	plugin: HubButtonPlugin,
	el: HTMLElement,
	message: string,
	typeName?: string
): void {
	const box = el.createEl("div", { cls: "hub-button-error" });
	const icon = box.createEl("span", { cls: "hub-button-error-icon" });
	setIcon(icon, "alert-triangle");
	box.createEl("span", { text: message });

	const fix = box.createEl("button", {
		text: typeName ? "설정에서 추가" : "설정 열기",
		cls: "hub-button-chip",
	});
	fix.onclick = () => plugin.openSettings();
}
