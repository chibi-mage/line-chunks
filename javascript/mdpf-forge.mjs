// Forge versions entry scripts, but relative module imports need their own cache key.
import { attachInlineEditor, attachPromptTabs } from './mdpf-inline.mjs?v=0.49.1-alpha.1';
import { attachOrganization } from './mdpf-organize-view.mjs?v=0.49.1-alpha.1';

const controllers = new Map();
const root = () => typeof gradioApp === 'function' ? gradioApp() : document;
// Forge may retain its startup stylesheet timestamp even after extension updates.
// Load the matching release explicitly so script/CSS versions stay together.
const stylesheet = document.getElementById('mdpf-versioned-styles') ?? document.createElement('link');
stylesheet.id = 'mdpf-versioned-styles'; stylesheet.rel = 'stylesheet';
stylesheet.href = new URL('../style.css?v=0.49.1-alpha.1', import.meta.url).href;
document.head.append(stylesheet);

function mount(native, host, id) {
    // Keep organization outside the native prompt component for autocomplete compatibility.
    const container = document.createElement('div');
    container.className = 'mdpf-organization-host';
    (host.closest(`#${id}_prompt_row`) ?? host).after(container);
    // Mapping is page-local and independent of the removed draft editor.
    let extraQuality = false;
    let organization;
    let workspace;
    const inline = attachInlineEditor(native, host, id, {
        getExtraQuality: () => extraQuality,
        setExtraQuality: value => { extraQuality = value; },
        onAutoFix: () => organization.autoFix(),
        onRevertAutoFix: () => organization.revertAutoFix(),
        getAutoFixState: () => organization?.getAutoFixState() ?? { canRevert: false },
        onOpenReview: () => { workspace.showReview(); organization.openReview(); },
    });
    // Inline observes trusted typing first, retaining line identities before review reads them.
    organization = attachOrganization(native, container, {
        getLineAssignments: () => inline.getLineAssignments(), setLineAssignments: snapshot => inline.setLineAssignments(snapshot),
        getEditorSnapshot: () => inline.getEditorSnapshot(), restoreEditorSnapshot: snapshot => inline.restoreEditorSnapshot(snapshot),
        getAutoFixContext: () => ({ couple: inline.getCoupleState() }),
    });
    workspace = attachPromptTabs(organization.panel, inline.templates, id);
    return {
        native, panel: container, inline,
        observe() { inline.observe(); organization.observe(); },
        destroy() {
            inline.destroy();
            organization.destroy();
            container.remove();
        },
    };
}

function discover() {
    for (const id of ['txt2img', 'img2img']) {
        const host = root().querySelector(`#${id}_prompt`);
        const native = host?.querySelector('textarea.mdpf-native-source') ?? host?.querySelector('textarea');
        const existing = controllers.get(id);
        if (existing && (existing.native !== native || !existing.panel.isConnected || !existing.inline.shell.isConnected)) {
            existing.destroy();
            controllers.delete(id);
        }
        if (host && native && !controllers.has(id)) controllers.set(id, mount(native, host, id));
        controllers.get(id)?.observe();
    }
}

if (typeof onUiLoaded === 'function') onUiLoaded(discover);
if (typeof onAfterUiUpdate === 'function') onAfterUiUpdate(discover);
// Catch programmatic .value changes without input events; never write from this timer.
let timer = null;
function resumeDiscovery() {
    if (timer === null) timer = setInterval(discover, 750);
    discover();
}
window.addEventListener('pagehide', () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
});
// A history-cache restore reuses this module; its startup code does not rerun.
window.addEventListener('pageshow', resumeDiscovery);
resumeDiscovery();
