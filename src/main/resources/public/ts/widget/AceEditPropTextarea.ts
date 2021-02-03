import { Constants as C } from "../Constants";
import * as I from "../Interfaces";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

declare var ace;
export class AceEditPropTextarea extends Div implements I.TextEditorIntf {

    aceEditor: any;
    initialValue: string;

    constructor(value: string, public heightString, public aceMode: string, public wordWrap: boolean = true) {
        super(value, {});

        this.aceMode = this.aceMode || "ace/mode/text";

        /* for safety, I'm setting this here redundantly, just to protect against me renaming this class someday and inadvertently breaking code. */
        this.clazz = "AceEditPropTextarea";

        Object.assign(this.attribs, {
            className: "my-ace-editor",
            style: { height: heightString }
        });

        this.initialValue = value; // S.util.escapeHtml(propEntry.property.value);

        this.whenElm((elm: HTMLElement) => {
            this.aceEditor = ace.edit(this.getId());

            // add command to lazy-load keybinding_menu extension
            this.aceEditor.commands.addCommand({
                name: "insetTimestamp",
                // On Ubuntu CTRL-ALT-T was already taken by browser/OS, so I guess we need to make this configurable by users to set their
                // own custom keybindings. For now I hope CTRL-ALT-H works for everyone. I had EditNodeDlg.ts using an insertTime button before
                // deciding todo this via key binding on the element so that is still there commented out, if i change my mind and go back to that.
                bindKey: { win: "Ctrl-Alt-h", mac: "Command-Alt-h" },
                exec: (editor: any) => {
                    this.insertTextAtCursor("[" + S.util.formatDate(new Date()) + "]");
                }
            });

            // reference: https://ace.c9.io/api/editor.html

            // this.aceEditor.setTheme("ace/theme/dracula");
            this.aceEditor.setTheme("ace/theme/monokai");
            this.aceEditor.setFontSize("18px");
            this.aceEditor.setShowPrintMargin(false);

            this.aceEditor.renderer.setShowGutter(false);
            this.aceEditor.setHighlightActiveLine(false);

            this.aceEditor.session.setMode(this.aceMode);

            // always force word wrapping for markdown mode ??? maybe not, markdown can contain long code blocks sometimes, so
            // leave this up to user???
            if (this.aceMode === "ace/mode/markdown") {
                this.wordWrap = true;
            }

            this.aceEditor.session.setUseWrapMode(this.wordWrap);
        });
    }

    setError(error: string) : void {
        this.mergeState({ error });
    }

    setWordWrap(wordWrap: boolean): void {
        if (this.getAceEditor()) {
            this.getAceEditor().session.setUseWrapMode(wordWrap);
        }
    }

    setMode(mode: string): void {
        if (this.getAceEditor()) {
            this.getAceEditor().session.setMode(mode);
        }
    }

    showKeyboardShortcuts() {
        ace.config.loadModule("ace/ext/keybinding_menu", (module) => {
            module.init(this.aceEditor);
            this.aceEditor.showKeyboardShortcuts();
        });
    }

    insertTextAtCursor(text: string) {
        this.aceEditor.session.insert(this.aceEditor.getCursorPosition(), text);
    }

    getAceEditor(): any {
        return this.aceEditor;
    }

    getValue(): string {
        if (!this.aceEditor) {
            return this.initialValue;
        }
        let val = this.aceEditor.getValue();
        return val;
    }

    setValue(val: string): void {
        this.whenElm((elm: HTMLElement) => {
            this.aceEditor.setValue(val, 0);
        });
    }
}
