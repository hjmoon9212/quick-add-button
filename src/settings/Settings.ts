export type HubAction = "create-note" | "append-task";

/** append-task 액션의 삽입 대상 한 곳. */
export interface TaskTarget {
	/** 볼트 절대경로 | "@current"(블록이 있는 노트) | "@hub/…"(허브 폴더 기준 상대) */
	file: string;
	/** 삽입할 헤딩 텍스트. "" 이면 파일 끝에 append */
	heading?: string;
	/** 헤딩 레벨(1~6). 0/미지정이면 텍스트만으로 매칭 */
	level?: number;
	/** "h1-h3" → 클릭 시점에 해당 파일의 H1~H3를 드롭다운으로 전개 */
	headings?: "h1-h3";
	/** 드롭다운 표시 라벨. 없으면 파일명 + 헤딩으로 자동 생성 */
	label?: string;
	/** 대상 파일이 없을 때 이 템플릿으로 생성 */
	createFrom?: string;
}

export interface TaskDefaults {
	tag: string;
	/** "" | "today" | "tomorrow" | "+7" */
	due: string;
	start: string;
	/** Tasks 우선순위 이모지. "" = 보통 */
	priority: string;
	created: boolean;
	id: boolean;
	/** "end" = 섹션 끝, "top" = 섹션 맨 위 */
	position: "end" | "top";
}

export interface HubTypeDef {
	name: string;
	label: string;
	action: HubAction;
	enabled: boolean;

	/** create-note 전용 */
	folder?: string;
	template?: string;

	/** append-task 전용 */
	targets?: TaskTarget[];
	defaults?: TaskDefaults;
}

export interface HubButtonSettings {
	version: number;
	/** 버튼 클릭 시 요구할 허브 frontmatter Type 값. "" 이면 검증하지 않음 */
	requireHubType: string;
	/** 생성 노트에 허브 백링크를 넣을 frontmatter 키 */
	linkField: string;
	runTemplater: boolean;
	/** 폼 태그 드롭다운 후보 */
	taskTags: string[];
	types: HubTypeDef[];
}

export const DEFAULT_TASK_DEFAULTS: TaskDefaults = {
	tag: "#task",
	due: "today",
	start: "",
	priority: "",
	created: true,
	id: false,
	position: "end",
};

export const DEFAULT_SETTINGS: HubButtonSettings = {
	version: 1,
	requireHubType: "Project-Hub",
	linkField: "Project",
	runTemplater: true,
	taskTags: ["#task", "#task/ISSUE", "#task/Deploy"],
	types: [
		{
			name: "Meeting",
			label: "📅 회의록 추가",
			action: "create-note",
			enabled: true,
			folder: "회의록",
			template: "Template/Meeting.md",
		},
		{
			name: "Issue",
			label: "⚠️ 이슈 추가",
			action: "create-note",
			enabled: true,
			folder: "이슈",
			template: "Template/Issue.md",
		},
		{
			name: "Module",
			label: "🧩 모듈 추가",
			action: "create-note",
			enabled: true,
			folder: "모듈",
			template: "Template/Module.md",
		},
		{
			name: "Deliverable",
			label: "📑 문서/보고 추가",
			action: "create-note",
			enabled: true,
			folder: "문서작업",
			template: "Template/Deliverable.md",
		},
		{
			name: "Doc",
			label: "📚 자료/메모 추가",
			action: "create-note",
			enabled: true,
			folder: "자료",
			template: "Template/Doc.md",
		},
		{
			name: "Requirement",
			label: "📋 요구사항 추가",
			action: "create-note",
			enabled: true,
			folder: "요구사항",
			template: "Template/Requirement.md",
		},
		{
			name: "TempTask",
			label: "⚡ 임시 할일",
			action: "append-task",
			enabled: true,
			targets: [
				{
					file: "0. Note/0. Inbox/Temp Tasks.md",
					heading: "Quick Add",
					level: 1,
					label: "임시(Inbox)",
				},
				{ file: "@current", headings: "h1-h3", label: "현재 노트" },
			],
			defaults: { ...DEFAULT_TASK_DEFAULTS },
		},
		{
			name: "Maint",
			label: "🛠 유지보수사항 추가",
			action: "append-task",
			enabled: false,
			targets: [
				{
					file: "@hub/유지보수/유지보수.md",
					heading: "",
					createFrom: "Template/유지보수.md",
					label: "유지보수 시트",
				},
			],
			defaults: {
				...DEFAULT_TASK_DEFAULTS,
				tag: "#task/sheet/to_add",
				id: false,
			},
		},
	],
};

/** 새 규칙의 초기값. */
export function blankType(action: HubAction): HubTypeDef {
	return action === "create-note"
		? {
				name: "",
				label: "",
				action,
				enabled: true,
				folder: "",
				template: "",
		  }
		: {
				name: "",
				label: "",
				action,
				enabled: true,
				targets: [{ file: "@current", headings: "h1-h3", label: "현재 노트" }],
				defaults: { ...DEFAULT_TASK_DEFAULTS },
		  };
}
