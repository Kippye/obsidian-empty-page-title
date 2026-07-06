import {
	Editor,
	MarkdownView,
	MarkdownFileInfo,
	Modal,
	Notice,
	Plugin,
	WorkspaceTabs,
	FileView,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	MyPluginSettings,
	SampleSettingTab,
} from './settings';

/* Useful stuff:
element.toggleClass('danger', status === 'error');

this.app.workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE).forEach((leaf) => {
  if (leaf.view instanceof ExampleView) {
    // Access your view instance.
  }
});
*/

/* Ok let's actually think about what we have to do
- Update file names in explorer (could be nested deep) - can't i just loop over File type leaves or smth?
	- Trigger: On file save, probably. Or maybe when the leaf is made visible?
- Update editor tab titles - can i loop over just them?
	- Trigger: For active file when file is edited

Couldn't i optimise all of this very easily by:
- Applying the style to all files on load
- Only updating specific files when they are modified either in-editor or externally (surely obsidian has events for both)

*/

export default class MyPlugin extends Plugin {
	settings!: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('dice', 'Greet', (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('Hello, Obsidian!');
		});

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status bar text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-modal-simple',
			name: 'Open modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			},
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'replace-selected',
			name: 'Replace selected content',
			editorCallback: (
				editor: Editor,
				_ctx: MarkdownView | MarkdownFileInfo,
			) => {
				editor.replaceSelection('Sample editor command');
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-modal-complex',
			name: 'Open modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(activeDocument, 'click', (_evt: MouseEvent) => {
			new Notice('Click');
			const mdLeaves = this.app.workspace.getLeavesOfType('markdown');
			const workspaceTabsEl = mdLeaves[0]?.view.containerEl.closest(
				'.workspace-tabs',
			) as HTMLElement;

			const tabsByName = new Map<string, Element>();

			if (workspaceTabsEl) {
				// Get all tab elements
				const tabElements = workspaceTabsEl.querySelectorAll(
					'.workspace-tab-header',
				);

				tabElements.forEach((tab) => {
					const tabTitle = tab.querySelector(
						'.workspace-tab-header-inner-title',
					)?.textContent;
					if (tabTitle) {
						tabsByName.set(tabTitle, tab);
					}
				});
			}

			this.app.workspace.iterateAllLeaves((leaf) => {
				const viewType = leaf.getViewState().type;
				const displayText = leaf.getDisplayText();

				// Is it a markdown file tab?
				if (viewType === 'markdown') {
					const mdView = leaf.view as MarkdownView;
					const isEmpty =
						mdView.file === null || mdView.file.stat.size === 0;

					console.log(
						'Open tab: ',
						displayText,
						'File: ',
						mdView.file?.name,
						'Empty?: ',
						isEmpty,
					);

					let tabEl = tabsByName.get(displayText);

					if (tabEl) {
						tabEl.toggleClass('title-empty', isEmpty);
					}
				}
			});

			// this.app.workspace.iterateRootLeaves((leaf) => {
			// 	const tabFile = mdFiles.find(
			// 		(file) => file.basename === leaf.getDisplayText(),
			// 	);

			// 	console.log(
			// 		leaf.getDisplayText(),
			// 		leaf.getViewState().type,
			// 		tabFile?.name,
			// 	);

			// 	if (tabFile) {
			// 		console.log(leaf.view.containerEl);
			// 		leaf.view.containerEl.toggleClass(
			// 			'title-empty',
			// 			tabFile.basename === leaf.getDisplayText(),
			// 		);
			// 	}
			// });
			// const fileExplorers =
			// 	this.app.workspace.getLeavesOfType('file-explorer');
			// fileExplorers.forEach((element) => {});
			// console.log(this.app.workspace.getActiveFile()?.stat.size);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000),
		);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MyPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
