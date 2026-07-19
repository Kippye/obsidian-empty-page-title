import { App, PluginSettingTab, Setting } from 'obsidian';
import EmptyFileNamePlugin from './main';

export interface EmptyFileNameSettings {
	italicNames: boolean;
	asterisk: boolean;
	whitespaceIsEmpty: boolean;
}

export const DEFAULT_SETTINGS: EmptyFileNameSettings = {
	italicNames: true,
	asterisk: false,
	whitespaceIsEmpty: false,
};

export class EmptyFileNameSettingTab extends PluginSettingTab {
	plugin: EmptyFileNamePlugin;

	constructor(app: App, plugin: EmptyFileNamePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// TODO: Use declarative settings API when i actually get Obsidian 1.13.0
		new Setting(containerEl)
			.setName('Italic names')
			.setDesc('Display empty file names as italic.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.italicNames)
					.onChange(async (value) => {
						this.plugin.settings.italicNames = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName('Asterisk')
			.setDesc('Display an asterisk (*) at the end of empty file names.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.asterisk)
					.onChange(async (value) => {
						this.plugin.settings.asterisk = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName('Whitespace is empty')
			.setDesc(
				'Treat files which only contain whitespace as empty. Requires all files to be read.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.whitespaceIsEmpty)
					.onChange(async (value) => {
						this.plugin.settings.whitespaceIsEmpty = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
