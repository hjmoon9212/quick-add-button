export interface TaskDefaults {
	/** "" | "today" | "tomorrow" | "+7" */
	due: string;
	start: string;
	/** Tasks 우선순위 이모지. "" = 보통 */
	priority: string;
	created: boolean;
	id: boolean;
	/** 헤딩 아래 어디에 넣을지. "end" = 목록 끝, "top" = 헤딩 바로 밑 */
	position: "end" | "top";
	/**
	 * 추가한 뒤 그 노트로 이동해 넣은 줄에 커서를 둘지. 켜면 폼이 닫힌다 —
	 * 이동과 "폼 열어 두고 연속 추가"는 같이 갈 수 없다.
	 */
	openAfter: boolean;
}

/**
 * tasks-gcal-sync 의 캘린더 라우팅 태그(`#gcal/<캘린더명>`) 후보.
 * 볼트의 기존 할일이 전부 소문자이므로 표기를 거기에 맞춘다. tasks-gcal-sync 는
 * 캘린더 이름을 대소문자 무시하고 대조하지만, 태그 표기가 섞이면 Tasks 쿼리와
 * 태그 패널에서 눈으로 갈린다.
 * 여기 없는 캘린더도 규칙에 직접 적으면 그대로 쓰인다 — 목록은 편의용 예시일 뿐.
 */
export const GCAL_TAGS = [
	"#gcal/work",
	"#gcal/personal",
	"#gcal/event",
	"#gcal/growth",
	"#gcal/hobby",
	"#gcal/routine",
	"#gcal/non-core",
];

/**
 * 아는 캘린더면 표준 표기(소문자)로 되돌린다. 모르는 이름은 손대지 않는다 —
 * 사용자가 대문자 캘린더를 실제로 쓰고 있을 수 있다.
 */
export function canonicalGcal(tag: string): string {
	const hit = GCAL_TAGS.find((g) => g.toLowerCase() === tag.toLowerCase());
	return hit ?? tag;
}

/** 버튼 하나 = 규칙 하나. 넣을 자리와 태그가 버튼에 고정된다. */
export interface RuleDef {
	/** 코드블록에서 부르는 이름 */
	name: string;
	/** 버튼에 찍히는 글자 */
	label: string;
	enabled: boolean;
	/** 삽입할 노트의 볼트 경로 */
	file: string;
	/** 삽입할 헤딩 텍스트 */
	heading: string;
	/** 헤딩 레벨(1~6). 같은 이름의 헤딩이 여러 개일 때 구분한다 */
	level: number;
	/** 이 버튼이 쓰는 태그. 여러 개면 폼에서 고른다. 첫 번째가 기본 */
	tags: string[];
	/**
	 * 이 버튼이 쓰는 `#gcal/…` 라우팅 태그. 비어 있으면 폼에 칸이 안 뜨고 줄에도 안 붙는다.
	 * 여러 개면 폼에서 고르고 첫 번째가 기본 — 태그와 같은 규칙이다.
	 */
	gcals: string[];
	defaults: TaskDefaults;
}

export interface QuickAddButtonSettings {
	version: number;
	rules: RuleDef[];
}

export const DEFAULT_TASK_DEFAULTS: TaskDefaults = {
	due: "today",
	start: "",
	priority: "",
	created: true,
	id: true,
	position: "end",
	openAfter: false,
};

export const DEFAULT_SETTINGS: QuickAddButtonSettings = {
	version: 8,
	rules: [
		{
			name: "TempTask",
			label: "⚡ 임시 할일",
			enabled: true,
			file: "0. Note/0. Inbox/Temp Tasks.md",
			heading: "Quick Add",
			level: 1,
			tags: ["#task"],
			gcals: [],
			defaults: { ...DEFAULT_TASK_DEFAULTS },
		},
	],
};

/** 새 규칙의 초기값. */
export function blankRule(): RuleDef {
	return {
		name: "",
		label: "",
		enabled: true,
		file: "",
		heading: "",
		level: 0,
		tags: ["#task"],
		gcals: [],
		defaults: { ...DEFAULT_TASK_DEFAULTS },
	};
}
