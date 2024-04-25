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
            name: J.AIServiceName.NONE,
            description: "none (inherit)",
            longDescription: ""
        });

        if (S.quanta.config.useOpenAi) {
            this.aiServices.push({
                name: J.AIServiceName.OPENAI,
                description: "OpenAI: ChatGPT-4",
                longDescription: "The default chatbot and is widely considered the most intelligent general-purpose AI on the market."
            });
        }

        if (S.quanta.config.useGeminiAi) {
            this.aiServices.push({
                name: J.AIServiceName.GEMINI,
                description: "Google: Gemini",
                longDescription: "Google's best general-purpose AI."
            });
        }

        if (S.quanta.config.usePplxAi) {
            this.aiServices.push(//
                {
                    name: J.AIServiceName.PPLX_LLAMA3,
                    description: "Meta: Llama 3",
                    longDescription: "Meta's Open Sourc Llama 3."
                });
        }

        if (S.quanta.config.useAnthAi) {
            this.aiServices.push(//
                {
                    name: J.AIServiceName.ANTH,
                    description: "Anthropic: Claude/Opus",
                    longDescription: "Anthropic's best-in-class most powerful, and most expensive, general-purpose AI."
                },
                {
                    name: J.AIServiceName.ANTH_SONNET,
                    description: "Anthropic: Claude/Sonnet",
                    longDescription: "Anthropic's less powerful, less expensive, general-purpose AI."
                });
        }

        if (S.quanta.config.usePplxAi) {
            this.aiServices.push(//
                {
                    name: J.AIServiceName.PPLX,
                    description: "Perplexity: Basic",
                    longDescription: "Perplexity's best high-end powerful general-purpose AI."
                },
                {
                    name: J.AIServiceName.PPLX_ONLINE,
                    description: "Perplexity: Recent News Aware",
                    longDescription: "Perplexity's AI which has access to the latest news and content from from the web."
                },
                {
                    name: J.AIServiceName.PPLX_CODE_LLAMA,
                    description: "Perplexity: Code Llama",
                    longDescription: "The open source Code Llama, which is great for coding and programming tasks."
                },
                {
                    name: J.AIServiceName.PPLX_MIXTRAL,
                    description: "Perplexity: Mixtral",
                    longDescription: "A high-quality sparse mixture of experts model (SMoE) for generating high-quality code."
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

    getAiOptions = (): any[] => {
        const aiOptions = [];
        this.aiServices.forEach(ai => {
            aiOptions.push({ key: ai.name, val: ai.description });
        });
        return aiOptions;
    }

    isAiType = (nodeType: string): boolean => {
        // #ai-model
        return nodeType === J.NodeType.OPENAI_ANSWER || //
            nodeType === J.NodeType.PPLXAI_ANSWER || //
            nodeType === J.NodeType.ANTHAI_ANSWER || //
            nodeType == J.NodeType.LLAMAAI_ANSWER || //
            nodeType === J.NodeType.GEMINIAI_ANSWER || //
            nodeType === J.NodeType.HUGGINGFACE_ANSWER || //
            nodeType === J.NodeType.OOBAI_ANSWER;
    }
}