import { Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	EmptyPageTitleSettings,
	EmptyPageTitleSettingTab,
} from './settings';
import { refreshAll, registerEmptyPageStyling } from './empty-page';

export default class EmptyPageTitlePlugin extends Plugin {
	settings!: EmptyPageTitleSettings;
	onSettingsChange: (() => void) | null = null;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new EmptyPageTitleSettingTab(this.app, this));

		// Keep empty-page styling in sync across the file explorer and tabs.
		registerEmptyPageStyling(this);

		this.onSettingsChange = () => {
			void refreshAll(this);
		};
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<EmptyPageTitleSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.onSettingsChange?.();
	}
}
