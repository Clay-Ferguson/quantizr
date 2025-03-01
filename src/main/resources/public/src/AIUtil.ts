import * as J from "./JavaIntf";
import { S } from "./Singletons";
import { Div } from "./comp/core/Div";
import { Span } from "./comp/core/Span";

export class AIService {
    name: string;
    description: string;
    longDescription: string;
}

export class AIUtil {
    aiServices: AIService[] = [];
    constructor() {
    }

    // #ai-model
    init() {
        this.aiServices = [];
        this.aiServices.push({
            name: J.AIModel.NONE,
            description: "none",
            longDescription: ""
        });

        if (S.quanta.config.useOpenAi) {
            this.aiServices.push({
                name: J.AIModel.OPENAI,
                description: "OpenAI: ChatGPT-4o",
                longDescription: "A very powerful version of OpenAI's intelligent general-purpose AI (128K context, max $15/megatoken)"
            });
            this.aiServices.push({
                name: J.AIModel.OPENAI_MINI,
                description: "OpenAI: ChatGPT-4o Mini",
                longDescription: "The less expensive version of OpenAI's intelligent general-purpose AI (128K context, max $0.6/megatoken)"
            });
        }

        if (S.quanta.config.useGeminiAi) {
            this.aiServices.push({
                name: J.AIModel.GEMINI,
                description: "Google: Gemini 1.5 Pro",
                longDescription: "Google's best general-purpose AI (1 million context, max $21/megatoken)"
            });
            this.aiServices.push({
                name: J.AIModel.GEMINI_FLASH,
                description: "Google: Gemini 1.5 Flash",
                longDescription: "Google's best cost effective general-purpose AI (2 million context, max $0.6/megatoken)"
            });
        }

        if (S.quanta.config.useAnthAi) {
            this.aiServices.push(//
                {
                    name: J.AIModel.ANTH,
                    description: "Anthropic: Claude 3 Opus",
                    longDescription: "Anthropic's very powerful general-purpose AI (200K context, max $75/megatoken)"
                },
                {
                    name: J.AIModel.ANTH_SONNET,
                    description: "Anthropic: Claude 3.7 Sonnet",
                    longDescription: "Anthropic's most powerful general-purpose AI (200K context, max $15/megatoken)"
                });
        }

        if (S.quanta.config.usePplxAi) {
            this.aiServices.push(//
                {
                    name: J.AIModel.PPLX_ONLINE,
                    description: "Perplexity: Recent News Aware",
                    longDescription: "Perplexity's AI which has access to the latest news and content from from the web (127K context, max $1/megatoken)"
                });
        }

        if (S.quanta.config.useXAi) {
            this.aiServices.push({
                name: J.AIModel.XAI,
                description: "XAI: Grok",
                longDescription: "XAI Grok Beta from the company formerly known as Twitter (128K context, max $15/megatoken)"
            });
        }
    }

    getServiceByName(name: string): AIService {
        if (!this.aiServices) return null;
        const ret = this.aiServices.find(ai => ai.name === name);
        if (!ret) {
            return this.aiServices[0];
        }
        return ret;
    }

    getAiNodeFooter(aiServiceDescript: string, node: J.NodeInfo): Div {
        if (!node) return null;
        return new Div(null, null, [
            new Span(S.util.formatDateTime(new Date(node.lastModified)), {
                className: "aiAnswerFooter"
            }),
            new Span(aiServiceDescript, {
                className: "aiAnswerFooter float-right"
            })
        ]);
    }

    getAiOptions(): AIService[] {
        const aiOptions = [];
        this.aiServices.forEach(ai => {
            aiOptions.push({ key: ai.name, val: ai.description });
        });
        return aiOptions;
    }
}