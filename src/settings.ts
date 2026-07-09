import { App, PluginSettingTab, Setting } from 'obsidian';
import EmptyPageTitlePlugin from './main';

export interface EmptyPageTitleSettings {
	italicTitles: boolean;
}

export const DEFAULT_SETTINGS: EmptyPageTitleSettings = {
	italicTitles: true,
};

export class EmptyPageTitleSettingTab extends PluginSettingTab {
	plugin: EmptyPageTitlePlugin;

	constructor(app: App, plugin: EmptyPageTitlePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// TODO: Use declarative settings API when i actually get Obsidian 1.13.0
		new Setting(containerEl)
			.setName('Italic titles')
			.setDesc('Display empty page titles as italic.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.italicTitles)
					.onChange(async (value) => {
						this.plugin.settings.italicTitles = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
