console.log("entering Tailwind.ts");

export class Tailwind {

    // NOTE: Add tw--mx-4 to compensate for the padding for the first and last columns
    static row = "tw-flex tw-flex-wrap";

    // NOTE: Adding tw-px-4 to each column to add padding between columns
    static col_1 = "tw-w-1/12";
    static col_2 = "tw-w-2/12";
    static col_3 = "tw-w-3/12";
    static col_4 = "tw-w-4/12";
    static col_5 = "tw-w-5/12";
    static col_6 = "tw-w-6/12";
    static col_7 = "tw-w-7/12";
    static col_8 = "tw-w-8/12";
    static col_9 = "tw-w-9/12";
    static col_10 = "tw-w-10/12";
    static col_11 = "tw-w-11/12";
    static col_12 = "tw-w-full";

    static getColClass(col: number): string {
        switch (col) {
            case 1: return Tailwind.col_1;
            case 2: return Tailwind.col_2;
            case 3: return Tailwind.col_3;
            case 4: return Tailwind.col_4;
            case 5: return Tailwind.col_5;
            case 6: return Tailwind.col_6;
            case 7: return Tailwind.col_7;
            case 8: return Tailwind.col_8;
            case 9: return Tailwind.col_9;
            case 10: return Tailwind.col_10;
            case 11: return Tailwind.col_11;
            case 12: return Tailwind.col_12;
            default: return Tailwind.col_12;
        }
    }

    // static alertPrimary = "tw-bg-blue-600 tw-text-white tw-px-4 tw-py-3 tw-rounded tw-relative tw-border tw-border-blue-400";
    static alertSecondary = "tw-bg-slate-700 tw-text-white tw-p-4 tw-mb-4 tw-rounded-lg tw-border tw-border-gray-200";
    static alertPrimary = this.alertSecondary; // todo-0: change eventually
    static alertDanger = "tw-bg-red-400 tw-border tw-border-red-400 tw-text-red-700 tw-px-4 tw-py-3 tw-rounded tw-relative";
    static alertInfo = "tw-bg-blue-400 tw-border tw-border-blue-200 tw-text-blue-800 tw-px-4 tw-py-3 tw-rounded tw-relative"

    static formControl = "tw-block tw-w-full tw-bg-gray-900 tw-text-white tw-placeholder-gray-400 tw-border tw-border-gray-600 tw-p-2 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 focus:tw-border-transparent";

    // same as formControl but withou w-full
    static formControlFit = "tw-block tw-bg-gray-900 tw-text-white tw-placeholder-gray-400 tw-border tw-border-gray-600 tw-p-2 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 focus:tw-border-transparent";
}

