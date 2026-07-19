import { Plugin, TFile, TAbstractFile, FileView, TFolder } from 'obsidian';
import EmptyPageTitlePlugin from './main';

export const EMPTY_PAGE_CLASS = 'empty-page';
export const EMPTY_PAGE_CLASS_ITALIC = 'empty-page-italic';

type RefreshSettings = {
	files?: boolean;
	folders?: boolean;
};

/**
 * Returns true when the given file or folder is considered empty.
 *
 * A file is empty when it has no content at all. We use `stat.size === 0` as
 * the primary, performant signal. For files that have a non-zero size but only
 * whitespace content, we fall back to reading the cached content.
 * A folder is empty when it has no child files.
 */
async function isFileEmpty(
	plugin: Plugin,
	file: TAbstractFile,
): Promise<boolean> {
	if (file instanceof TFile) {
		if (file.stat.size === 0) {
			return true;
		}

		try {
			const content = await plugin.app.vault.cachedRead(file);
			return content.trim().length === 0;
		} catch {
			// If we cannot read the content, fall back to the size check only.
			return false;
		}
	} else if (file instanceof TFolder) {
		return file.children.length === 0;
	} else {
		console.warn('Unsupported file type in isFileEmpty');
		return false;
	}
}

/**
 * Applies or removes the empty-page class on a single file's explorer title
 * and any open tab titles for that file.
 */
async function updateFileStyling(
	plugin: Plugin,
	file: TAbstractFile,
): Promise<void> {
	const empty = await isFileEmpty(plugin, file);
	const settings = (plugin as EmptyPageTitlePlugin).settings;
	const emptyPageStyle = settings.italicTitles
		? EMPTY_PAGE_CLASS_ITALIC
		: EMPTY_PAGE_CLASS;
	const otherEmptyPageStyle = settings.italicTitles
		? EMPTY_PAGE_CLASS
		: EMPTY_PAGE_CLASS_ITALIC;

	if (file instanceof TFolder) {
		const explorerFolderTitles = plugin.app.workspace
			.getLeavesOfType('file-explorer')
			.map((leaf) => leaf.view.containerEl)
			.flatMap((container) =>
				Array.from(
					container.querySelectorAll<HTMLElement>(
						`.nav-folder-title[data-path="${CSS.escape(file.path)}"]`,
					),
				),
			);
		for (const folderTitleEl of explorerFolderTitles) {
			const titleContentEl = folderTitleEl.querySelector<HTMLElement>(
				`.nav-folder-title-content`,
			);

			titleContentEl?.toggleClass(emptyPageStyle, empty);
			titleContentEl?.removeClass(otherEmptyPageStyle);
		}
	} else if (file instanceof TFile) {
		// File explorer items: match by data-path attribute.
		const explorerTitles = plugin.app.workspace
			.getLeavesOfType('file-explorer')
			.map((leaf) => leaf.view.containerEl)
			.flatMap((container) =>
				Array.from(
					container.querySelectorAll<HTMLElement>(
						`.nav-file-title[data-path="${CSS.escape(file.path)}"]`,
					),
				),
			);

		for (const titleEl of explorerTitles) {
			titleEl.toggleClass(emptyPageStyle, empty);
			titleEl.removeClass(otherEmptyPageStyle);
		}

		// Open tab titles: match by the leaf that actually displays this file
		// and navigate to the corresponding tab header by sibling index.
		const tabTitles = plugin.app.workspace
			.getLeavesOfType('markdown')
			.filter((leaf) => {
				return leaf.view instanceof FileView && leaf.view.file === file;
			})
			.map((leaf) => {
				const leafEl = leaf.view.containerEl // Leaf content
					.closest('.workspace-leaf');
				if (!leafEl) {
					console.error(
						'Workspace leaf element not found for leaf: ',
						leaf.getDisplayText(),
					);
					return null;
				}
				// Sibling index of leaf / tab
				const siblingIndex = leafEl.parentElement!.indexOf(leafEl);
				// Move up the tree and to previous sibling to get workspace-tab-header-container
				// And get its first child for workspace-tab-header-container-inner (contains tabs)
				const tabHeaderContainerEl = leafEl?.closest(
					'.workspace-tab-container',
				)?.previousSibling?.firstChild;
				if (!tabHeaderContainerEl) {
					console.error(
						'Tab header container inner element not found for leaf: ',
						leaf,
					);
					return null;
				}
				// List of tab header elements
				const tabHeaders = (tabHeaderContainerEl as HTMLElement)
					.children;
				if (siblingIndex >= tabHeaders.length) {
					console.error(
						`Tab sibling index ${siblingIndex} out of range for leaf: ${leaf.getDisplayText()}`,
					);
					return null;
				}

				// Get inner tab header by sibling index
				return tabHeaders.item(siblingIndex)!.firstChild;
			})
			.filter((el): el is HTMLElement => el !== null);

		for (const titleEl of tabTitles) {
			titleEl.toggleClass(emptyPageStyle, empty);
			titleEl.removeClass(otherEmptyPageStyle);
		}
	} else {
		console.warn('Unsupported file type in updateFileStyling');
	}
}

/**
 * Re-evaluates styling for every markdown file in the vault and for all open
 * tabs. Used on initial load and on layout changes.
 */
export async function refreshAll(
	plugin: Plugin,
	refreshSettings: RefreshSettings = { files: true, folders: true },
): Promise<void> {
	if (refreshSettings.folders) {
		const folders = plugin.app.vault.getAllFolders();
		await Promise.all(
			folders.map((folder) => {
				return updateFileStyling(plugin, folder);
			}),
		);
	}
	if (refreshSettings.files) {
		const files = plugin.app.vault.getMarkdownFiles();
		await Promise.all(files.map((file) => updateFileStyling(plugin, file)));
	}
}

/**
 * Registers all listeners required to keep empty-page styling in sync.
 * All registrations use plugin.register* helpers so they are cleaned up on
 * unload automatically.
 */
export function registerEmptyPageStyling(plugin: Plugin): void {
	// Initial pass once the layout is ready.
	plugin.app.workspace.onLayoutReady(() => {
		void refreshAll(plugin);
	});

	// Re-apply when the layout changes (new tabs/explorer items appear).
	plugin.registerEvent(
		plugin.app.workspace.on('layout-change', () => {
			void refreshAll(plugin);
		}),
	);

	// Re-evaluate when a file is modified (content may become empty/non-empty).
	plugin.registerEvent(
		plugin.app.vault.on('modify', (file: TAbstractFile) => {
			if (file instanceof TFile && file.extension === 'md') {
				void updateFileStyling(plugin, file);
			}
		}),
	);

	plugin.registerEvent(
		plugin.app.vault.on('create', (file: TAbstractFile) => {
			// Re-evaluate newly created files.
			if (file instanceof TFile && file.extension === 'md') {
				void updateFileStyling(plugin, file);
			}
			// Re-evaluate newly created folders.
			else if (file instanceof TFolder) {
				void updateFileStyling(plugin, file);
				if (file.parent != null) {
					void updateFileStyling(plugin, file.parent);
				}
			}
		}),
	);

	// Re-evaluate deleted files and folders (their DOM nodes are removed by Obsidian, but
	// we refresh to be safe in case of stale state).
	plugin.registerEvent(
		plugin.app.vault.on('delete', (file: TAbstractFile) => {
			if (file instanceof TFile && file.extension === 'md') {
				void refreshAll(plugin);
			}
			// Re-evaluate newly created folders.
			else if (file instanceof TFolder) {
				// For some reason, we can't get the parent of the folder anymore
				// So we have to refresh all folders
				void refreshAll(plugin, { folders: true });
			}
		}),
	);

	// Re-evaluate renamed files (path changes affect data-path matching).
	plugin.registerEvent(
		plugin.app.vault.on(
			'rename',
			(file: TAbstractFile, oldPath: string) => {
				if (file instanceof TFile && file.extension === 'md') {
					// Clear styling on any explorer element still using the old path.
					const oldTitles = Array.from(
						document.querySelectorAll<HTMLElement>(
							`.nav-file-title[data-path="${CSS.escape(oldPath)}"]`,
						),
					);
					for (const el of oldTitles) {
						el.removeClass(EMPTY_PAGE_CLASS);
						el.removeClass(EMPTY_PAGE_CLASS_ITALIC);
					}
					void updateFileStyling(plugin, file);
				}
			},
		),
	);
}
