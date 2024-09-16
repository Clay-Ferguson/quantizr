import { getAs } from "./AppContext";
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
    init = () => {
        this.aiServices = [];
        this.aiServices.push({
            name: J.AIModel.NONE,
            description: "none (inherit)",
            longDescription: ""
        });

        if (S.quanta.config.useOpenAi) {
            this.aiServices.push({
                name: J.AIModel.OPENAI,
                description: "OpenAI: ChatGPT-4o",
                longDescription: "The most powerful version of OpenAI's intelligent general-purpose AI"
            });
            this.aiServices.push({
                name: J.AIModel.OPENAI_MINI,
                description: "OpenAI: ChatGPT-4o Mini",
                longDescription: "The less expensive version of OpenAI's intelligent general-purpose AI"
            });
        }

        if (S.quanta.config.useGeminiAi) {
            this.aiServices.push({
                name: J.AIModel.GEMINI,
                description: "Google: Gemini 1.5 Pro",
                longDescription: "Google's best general-purpose AI"
            });
            this.aiServices.push({
                name: J.AIModel.GEMINI_FLASH,
                description: "Google: Gemini 1.5 Flash",
                longDescription: "Google's best cost effective general-purpose AI"
            });
        }

        if (S.quanta.config.usePplxAi) {
            this.aiServices.push(//
                {
                    name: J.AIModel.PPLX_LLAMA3,
                    description: "Meta: Llama 3",
                    longDescription: "Meta's Open Source Llama 3"
                });
        }

        if (S.quanta.config.useAnthAi) {
            this.aiServices.push(//
                {
                    name: J.AIModel.ANTH,
                    description: "Anthropic: Claude 3 Opus",
                    longDescription: "Anthropic's very powerful general-purpose AI"
                },
                {
                    name: J.AIModel.ANTH_SONNET,
                    description: "Anthropic: Claude 3.5 Sonnet",
                    longDescription: "Anthropic's most powerful general-purpose AI"
                });
        }

        if (S.quanta.config.usePplxAi) {
            this.aiServices.push(//
                {
                    name: J.AIModel.PPLX,
                    description: "Perplexity: Basic",
                    longDescription: "Perplexity's best high-end powerful general-purpose AI"
                },
                {
                    name: J.AIModel.PPLX_ONLINE,
                    description: "Perplexity: Recent News Aware",
                    longDescription: "Perplexity's AI which has access to the latest news and content from from the web"
                });
        }
    }

    getActiveService = (): AIService => {
        return this.getServiceByName(getAs().userPrefs.aiService);
    }

    getServiceByName = (name: string): AIService => {
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
                className: "aiAnswerFooter float-end"
            })
        ]);
    }

    getAiOptions = (): AIService[] => {
        const aiOptions = [];
        this.aiServices.forEach(ai => {
            aiOptions.push({ key: ai.name, val: ai.description });
        });
        return aiOptions;
    }
}