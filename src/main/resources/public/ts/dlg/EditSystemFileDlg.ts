console.log("EditSystemFileDlg.ts");

import {DialogBase} from "../DialogBase";

/*
NOTE: This dialog is not yet converted to new Widget Architecture (see ChangePasswordDlgImpl.ts for a working example of the
new architecture)
*/
/* I commented this code out when i transitioned over to ES6 modules, but since this is not a core feature
i haven't re-enabled it yet */
export class EditSystemFileDlgImpl extends DialogBase {
  //
  //   constructor(private fileName: string) {
  //       super("EditSystemFileDlg");
  //   }
  //
  //   /*
  //    * Returns a string that is the HTML content of the dialog
  //    */
  //   render = (): string => {
  //       let content: string = "<h2>File Editor: " + this.fileName + "</h2>";
  //
  //       let buttons = this.makeCloseButton("Save", "SaveFileButton", this.saveEdit)
  //           + this.makeCloseButton("Cancel", "CancelFileEditButton", this.cancelEdit);
  //       content += render.centeredButtonBar(buttons);
  //
  //       return content;
  //   }
  //
  //   saveEdit = (): void => {
  //       console.log("save.");
  //   }
  //
  //   cancelEdit = (): void => {
  //       console.log("cancel.");
  //   }
  //
  //   init = (): void => {
  //   }
}
