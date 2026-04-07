/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_APPS_SCRIPT_WEB_APP_URL?: string;
	readonly VITE_APPS_SCRIPT_API_TOKEN?: string;
	readonly VITE_BEHAVIORAL_APPS_SCRIPT_WEB_APP_URL?: string;
	readonly VITE_BEHAVIORAL_APPS_SCRIPT_API_TOKEN?: string;
	readonly VITE_PRESENTATION_APPS_SCRIPT_WEB_APP_URL?: string;
	readonly VITE_PRESENTATION_APPS_SCRIPT_API_TOKEN?: string;
	readonly VITE_ONE_ON_ONE_APPS_SCRIPT_WEB_APP_URL?: string;
	readonly VITE_ONE_ON_ONE_APPS_SCRIPT_API_TOKEN?: string;
	readonly VITE_SCORES_APPS_SCRIPT_WEB_APP_URL?: string;
	readonly VITE_SCORES_APPS_SCRIPT_API_TOKEN?: string;
	readonly VITE_EVALUATORS_APPS_SCRIPT_WEB_APP_URL?: string;
	readonly VITE_EVALUATORS_APPS_SCRIPT_API_TOKEN?: string;
	readonly VITE_AI_EVALUATION_API_URL?: string;
	readonly VITE_AI_EVALUATION_API_TOKEN?: string;
	readonly VITE_AI_EVALUATION_SHEET_ID?: string;
	readonly VITE_AI_EVALUATION_APPS_SCRIPT_WEB_APP_URL?: string;
	readonly VITE_AI_EVALUATION_APPS_SCRIPT_API_TOKEN?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
