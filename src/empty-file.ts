import { Plugin, TFile, TAbstractFile, TFolder } from 'obsidian';
import EmptyFileNamePlugin from './main';

const EMPTY_FILE_CLASS = 'empty-file';
const ITALIC_CLASS = 'is-italic';
const ASTERISK_CLASS = 'has-asterisk';

const emptyFileClasses = {
	[EMPTY_FILE_CLASS]: true,
	[ITALIC_CLASS]: true,
	[ASTERISK_CLASS]: false,
};

type RefreshSettings = {
	files?: boolean;
	folders?: boolean;
};

/**
 * Update empty file styling classes based on plugin settings.
 * @param plugin
 */
function updateEmptyFileClasses(plugin: Plugin) {
	const settings = (plugin as EmptyFileNamePlugin).settings;
	emptyFileClasses[ITALIC_CLASS] = settings.italicNames;
	emptyFileClasses[ASTERISK_CLASS] = settings.asterisk;
}

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
		if ((plugin as EmptyFileNamePlugin).settings.whitespaceIsEmpty) {
			try {
				const content = await plugin.app.vault.cachedRead(file);
				return content.trim().length === 0;
			} catch {
				// If we cannot read the content, fall back to the size check only.
				return false;
			}
		} else {
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
 * Applies or removes empty file styling classes depending on file emptiness.
 * @param el the DOM element representing the file or folder name
 * @param empty whether or not the file is empty
 */
function applyEmptinessStyle(el: HTMLElement | null, empty: boolean): void {
	el?.toggleClass(EMPTY_FILE_CLASS, empty);
	el?.toggleClass(ITALIC_CLASS, empty && emptyFileClasses[ITALIC_CLASS]);
	el?.toggleClass(ASTERISK_CLASS, empty && emptyFileClasses[ASTERISK_CLASS]);
}

/**
 * Returns the DOM element representing the file or folder name in the file explorer.
 * @param plugin
 * @param file If TFile or TFolder, its path is used; if string, it is used as a **file** path.
 * @returns The DOM element representing the file or folder name, or null if not found.
 */
function getFileNameElement(
	plugin: Plugin,
	file: TAbstractFile | string,
): HTMLElement | null {
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

		return (
			explorerFolderTitles
				.first()
				?.querySelector<HTMLElement>(`.nav-folder-title-content`) ??
			null
		);
	} else if (file instanceof TFile || typeof file == 'string') {
		const explorerTitles = plugin.app.workspace
			.getLeavesOfType('file-explorer')
			.map((leaf) => leaf.view.containerEl)
			.flatMap((container) =>
				Array.from(
					container.querySelectorAll<HTMLElement>(
						`.nav-file-title[data-path="${CSS.escape(file instanceof TFile ? file.path : file)}"]`,
					),
				),
			);

		return (
			explorerTitles
				.first()
				?.querySelector<HTMLElement>(`.nav-file-title-content`) ?? null
		);
	} else {
		return null;
	}
}

function getFileTabNameElements(plugin: Plugin, file: TFile): HTMLElement[] {
	// Open tab titles: match by the leaf that actually displays this file
	// and navigate to the corresponding tab header by sibling index.
	return plugin.app.workspace
		.getLeavesOfType('markdown')
		.filter((leaf) => leaf.view.getState()?.file === file.path)
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
			const tabHeaders = (tabHeaderContainerEl as HTMLElement).children;
			if (siblingIndex >= tabHeaders.length) {
				console.error(
					`Tab sibling index ${siblingIndex} out of range for leaf: ${leaf.getDisplayText()}`,
				);
				return null;
			}

			// Get inner tab header by sibling index
			const innerHeaderEl =
				tabHeaders.item(siblingIndex)!.firstElementChild;
			// Get inner title (the element containing the actual text)
			return innerHeaderEl?.querySelector<HTMLElement>(
				`.workspace-tab-header-inner-title`,
			);
		})
		.filter((el): el is HTMLElement => el !== null);
}

/**
 * For folders, toggles empty file class on folder names in explorer.
 * For files, toggles empty file class on file names in explorer and open tab names.
 */
async function updateFileStyling(
	plugin: Plugin,
	file: TAbstractFile,
): Promise<void> {
	updateEmptyFileClasses(plugin);
	const isEmpty = await isFileEmpty(plugin, file);

	if (file instanceof TFolder) {
		const folderNameContentEl = getFileNameElement(plugin, file);
		applyEmptinessStyle(folderNameContentEl, isEmpty);
	} else if (file instanceof TFile) {
		const fileNameContentEl = getFileNameElement(plugin, file);
		applyEmptinessStyle(fileNameContentEl, isEmpty);

		const fileTabNameEls = getFileTabNameElements(plugin, file);
		for (const nameEl of fileTabNameEls) {
			applyEmptinessStyle(nameEl, isEmpty);
		}
	} else {
		console.warn('Unsupported file type in updateFileStyling');
	}
}

/**
 * Re-evaluates styling for every folder and markdown file in the vault and for all open
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
		await Promise.all(
			files.map((file) => {
				return updateFileStyling(plugin, file);
			}),
		);
	}
}

/**
 * Registers all listeners required to keep styling in sync.
 * All registrations use plugin.register* helpers so they are cleaned up on
 * unload automatically.
 */
export function registerEmptyFileStyling(plugin: Plugin): void {
	// The file explorer renders its tree in waves (root titles first, then
	// child titles get their data-path assigned later). A MutationObserver on
	// the explorer container catches every render wave and re-applies styling,
	// so we never race against Obsidian's async DOM population.
	let refreshQueued = false;
	const scheduleRefresh = () => {
		if (refreshQueued) return;
		refreshQueued = true;
		window.requestAnimationFrame(() => {
			refreshQueued = false;
			void refreshAll(plugin);
		});
	};

	// Initial pass once the layout is ready.
	plugin.app.workspace.onLayoutReady(() => {
		// Is this extra refresh required?
		void refreshAll(plugin);
		for (const leaf of plugin.app.workspace.getLeavesOfType(
			'file-explorer',
		)) {
			const container = leaf.view.containerEl;
			const observer = new MutationObserver(scheduleRefresh);
			observer.observe(container, { childList: true, subtree: true });
			plugin.register(() => observer.disconnect());
		}
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
			} else if (file instanceof TFolder) {
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
					// TODO: Test if this is actually necessary
					// Clear styling on any explorer element still using the old path.
					const oldNameContentEl = getFileNameElement(
						plugin,
						oldPath,
					);
					applyEmptinessStyle(oldNameContentEl, false);
					void updateFileStyling(plugin, file);
				}
			},
		),
	);
}
