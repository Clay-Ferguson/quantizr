import { S } from "./Singletons";

declare var webkitSpeechRecognition;
declare var SpeechRecognition;

export class SpeechRecog {
    recognition = null;
    speechActive: boolean = false;
    private callback: (text: string) => void;

    init = () => {
        if (this.recognition) return;

        if (typeof SpeechRecognition === "function") {
            this.recognition = new SpeechRecognition();
        }
        else if (webkitSpeechRecognition) {
            // todo-2: fix linter rule to make this cleaner (the first letter upper case is the issue here)
            let WebkitSpeechRecognition = webkitSpeechRecognition;
            this.recognition = new WebkitSpeechRecognition();
        }

        if (!this.recognition) {
            S.util.showMessage("Speech recognition not available in your browser.", "Warning");
            return;
        }

        // This runs when the speech recognition service starts
        this.recognition.onstart = () => {
            // console.log("speech onStart.");
        };

        this.recognition.onend = () => {
            // console.log("speech onEnd.");
            if (this.speechActive) {
                setTimeout(() => {
                    this.recognition.start();
                    // try this with 250 instead of 500
                }, 500);
            }
        };

        this.recognition.onspeechend = () => {
            // console.log("speech onSpeechEnd.");
            // this.recognition.stop();
        };

        // This runs when the speech recognition service returns result
        this.recognition.onresult = (event) => {
            let transcript = event.results[0][0].transcript;
            let confidence = event.results[0][0].confidence;

            if (this.callback) {
                this.callback(transcript);
            }
        };
    }

    toggleActive = () => {
        this.init();
        if (this.speechActive) {
            this.recognition.stop();
        }
        else {
            this.recognition.start();
        }
        this.speechActive = this.speechActive ? false : true;
    }

    setCallback = (callback: (string) => void) => {
        this.callback = callback;
    }
}
