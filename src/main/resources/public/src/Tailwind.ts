console.log("entering Tailwind.ts");

export class Tailwind {

    // NOTE: Add -mx-4 to compensate for the padding for the first and last columns
    static row = "flex flex-wrap";

    // NOTE: Adding px-4 to each column to add padding between columns
    static col_1 = "w-1/12";
    static col_2 = "w-2/12";
    static col_3 = "w-3/12";
    static col_4 = "w-4/12";
    static col_5 = "w-5/12";
    static col_6 = "w-6/12";
    static col_7 = "w-7/12";
    static col_8 = "w-8/12";
    static col_9 = "w-9/12";
    static col_10 = "w-10/12";
    static col_11 = "w-11/12";
    static col_12 = "w-full";

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

    // static alertPrimary = "bg-blue-600 text-white px-4 py-3 rounded relative border border-blue-400";
    static alertSecondary = "bg-slate-700 text-white p-4 mb-4 rounded-lg border border-gray-200";
    static alertPrimary = this.alertSecondary; // todo-0: change eventually
    static alertDanger = "bg-red-400 border border-red-400 text-white px-4 py-3 rounded relative";
    static alertInfo = "bg-blue-400 border border-blue-200 text-white px-4 py-3 rounded relative"

    static formControl = "text-base block w-full bg-gray-900 text-white placeholder-gray-400 border border-gray-500 p-2 mb-2 focus:outline-none focus:ring-1 focus:ring-green-400";

    // same as formControl but withou w-full
    static formControlFit = "text-base block bg-gray-900 text-white placeholder-gray-400 border border-gray-500 p-2 mb-2 focus:outline-none focus:ring-1 focus:ring-green-400";
}

