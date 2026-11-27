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
	 * 추가한 뒤 뒤에 있는 노트를 넣은 줄로 옮길지. 폼은 그대로 열려 있다.
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

/** 헤딩 하나. level 0 = 아무 단계(이름만 대조), 1~6 = 그 단계만. */
export interface HeadingRef {
	heading: string;
	level: number;
}

/** 버튼 하나 = 규칙 하나. 넣을 자리와 태그가 버튼에 고정된다. */
export interface RuleDef {
	/** 코드블록에서 부르는 이름 */
	name: string;
	/** 버튼에 찍히는 글자 */
	label: string;
	enabled: boolean;
	/**
	 * 리본 아이콘을 눌렀을 때 나오는 목록에 이 버튼을 넣을지.
	 *
	 * 켠 규칙이 늘어나면 리본 목록이 길어져 자주 쓰는 것을 고르기 어려워진다.
	 * 노트에 코드블록으로 박아 둔 버튼은 그 노트에서 누르면 되므로 리본까지
	 * 차지할 이유가 없다. `enabled` 와 별개다 — 여기서 빼도 코드블록과 커맨드로는
	 * 그대로 쓴다.
	 */
	ribbon: boolean;
	/** 삽입할 노트의 볼트 경로 */
	file: string;
	/**
	 * 넣을 수 있는 헤딩들. 여러 개면 폼에서 고르고 첫 번째가 기본 — 태그와 같은 규칙이다.
	 * v11 에서 생겼다. 비어 있지 않게 정규화한다(헤딩 없는 규칙은 꺼진다).
	 */
	headings: HeadingRef[];
	/**
	 * `headings[0]` 의 사본. 0.16.x 이하 플러그인은 이 둘만 읽으므로, 아직 갱신 안 된
	 * 기기가 규칙 파일을 읽어도 기본 헤딩으로는 동작하게 남겨 둔다.
	 * 코드에서는 읽지 말고 `headings` 를 쓴다.
	 */
	heading: string;
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
	/**
	 * 규칙을 둘 볼트 파일. 비어 있으면 예전처럼 이 파일(data.json) 안에 둔다.
	 *
	 * v11: 규칙마다 헤딩 여러 개(`headings`).
	 * v10: `.obsidian` 안은 Obsidian Sync 의 「설치된 커뮤니티 플러그인」 토글로만
	 * 오간다 — 그걸 켜면 `main.js` 까지 같이 다녀서 잠들었던 기기가 옛 코드를
	 * 밀어 올린다. 규칙만 볼트 파일에 두면 그 토글을 끈 채로 규칙은 공유된다.
	 * 경로는 기기마다 같아야 의미가 있으므로 규칙 파일 자체에도 함께 적어 둔다.
	 */
	rulesFile: string;
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
	version: 11,
	rulesFile: "",
	rules: [
		{
			name: "TempTask",
			label: "⚡ 임시 할일",
			enabled: true,
			ribbon: true,
			file: "0. Note/0. Inbox/Temp Tasks.md",
			headings: [{ heading: "Quick Add", level: 1 }],
			heading: "Quick Add",
			level: 1,
			tags: ["#task"],
			gcals: [],
			defaults: { ...DEFAULT_TASK_DEFAULTS },
		},
	],
};

/**
 * 새 규칙에 미리 채워 둘 태그. 맨 앞이 폼의 기본값이다.
 * 업무 볼트의 task 유형 태그(`Guide/작업 구조 규칙.md` §태그)에 맞췄다 — 규칙마다
 * 안 쓰는 것을 지우는 편이 매번 적는 것보다 빠르다.
 */
export const DEFAULT_RULE_TAGS = [
	"#task",
	"#task/Deploy",
	"#task/Hold",
	"#task/found",
	"#task/Issue",
	"#task/Test",
	"#task/Doc",
	"#task/Analysis",
	"#task/Q",
];

/** 새 규칙의 초기값. */
export function blankRule(): RuleDef {
	return {
		name: "",
		label: "",
		enabled: true,
		ribbon: true,
		file: "",
		headings: [],
		heading: "",
		level: 0,
		tags: [...DEFAULT_RULE_TAGS],
		gcals: [],
		defaults: { ...DEFAULT_TASK_DEFAULTS },
	};
}
