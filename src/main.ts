import { Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	EmptyFileNameSettings,
	EmptyFileNameSettingTab,
} from './settings';
import { refreshAll, registerEmptyFileStyling } from './empty-file';

export default class EmptyFileNamePlugin extends Plugin {
	settings!: EmptyFileNameSettings;
	onSettingsChange: (() => void) | null = null;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new EmptyFileNameSettingTab(this.app, this));

		// Keep empty-page styling in sync across the file explorer and tabs.
		registerEmptyFileStyling(this);

		this.onSettingsChange = () => {
			void refreshAll(this);
		};
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<EmptyFileNameSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.onSettingsChange?.();
	}
}
