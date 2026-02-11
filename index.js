const express = require('express');
const functions = require('@google-cloud/functions-framework');
const OpenAI = require("openai");

const unlegalese = express();
unlegalese.use(express.json());

let client;
function getClient() {
    if (!client) {
        client = new OpenAI();
    }
    return client;
}

unlegalese.post('/unlegalese/stream', async (req, res) => {

    const { message } = req.body;
    const openaiClient = getClient();

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
        const stream = await openaiClient.responses.stream({
            model: "gpt-5-nano-2025-08-07",
            input: [
                {
                    role: "system",
                    content: "You are an expert in legal matters with a friendly, but concise, writing style. Write a layman-friendly, plain English summary of the legal copy provided by the user. The summary should be between five and eight sentences long.",
                },
                {
                    role: "user",
                    content: message,
                },
            ],
            stream: true,
        });

        for await (const event of stream) {
            // Text tokens
            if (event.type === "response.output_text.delta") {
                res.write(`data: ${JSON.stringify(event.delta)}\n\n`);
            }

            // Optional: detect completion
            if (event.type === "response.completed") {
                res.write(`event: done\ndata: [DONE]\n\n`);
                res.end();
            }
        }
    } catch (err) {
        res.write(
            `event: error\ndata: ${JSON.stringify(err.message)}\n\n`
        );
        res.end();
    }

});

unlegalese.post('/unlegalese/structured', async (req, res) => {
    const { message } = req.body;
    const openaiClient = getClient();

    try {
        const response = await openaiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert in legal matters. Analyze legal documents and provide structured summaries using human-friendly, plain English words."
                },
                {
                    role: "user",
                    content: message
                }
            ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "legal_summary",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            title: {
                                type: "string",
                                description: "A brief title for the legal document"
                            },
                            plain_language_version: {
                                type: "string",
                                description: "Ultra-simplified version for quick reading"
                            },
                            key_points: {
                                type: "array",
                                description: "Key points extracted from the legal text",
                                items: {
                                    type: "object",
                                    properties: {
                                        heading: { type: "string" },
                                        explanation: { type: "string" }
                                    },
                                    required: ["heading", "explanation"],
                                    additionalProperties: false
                                }
                            },
                            concerns: {
                                type: "array",
                                description: "Potential concerns or red flags",
                                items: { type: "string" }
                            }
                        },
                        required: ["title", "plain_language_version", "key_points", "concerns"],
                        additionalProperties: false
                    }
                }
            }
        });

        const structuredData = JSON.parse(response.choices[0].message.content);

        res.json({
            success: true,
            data: structuredData,
            usage: response.usage
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

unlegalese.post('/unlegalese/structured/stream', async (req, res) => {
    const { message } = req.body;
    const openaiClient = getClient();

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
        const stream = await openaiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert in legal matters. Analyze legal documents and provide structured summaries using human-friendly, plain English words."
                },
                {
                    role: "user",
                    content: message
                }
            ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "legal_summary",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            title: {
                                type: "string",
                                description: "A brief title for the legal document"
                            },
                            plain_language_version: {
                                type: "string",
                                description: "Two or three sentence simplified version for quick reading"
                            },
                            key_points: {
                                type: "array",
                                description: "Two or three most important key points extracted from the legal text",
                                items: {
                                    type: "object",
                                    properties: {
                                        heading: { type: "string" },
                                        explanation: { type: "string" }
                                    },
                                    required: ["heading", "explanation"],
                                    additionalProperties: false
                                }
                            },
                            concerns: {
                                type: "array",
                                description: "Two or three most important potential concerns or red flags",
                                items: { type: "string" }
                            }
                        },
                        required: ["title", "plain_language_version", "key_points", "concerns"],
                        additionalProperties: false
                    }
                }
            },
            stream: true
        });

        let accumulatedContent = "";

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;

            if (delta) {
                accumulatedContent += delta;

                // Send the raw delta for progress indication
                res.write(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`);
            }

            // Check if streaming is complete
            if (chunk.choices[0]?.finish_reason === "stop") {
                // Parse the complete JSON and send as structured data
                try {
                    const structuredData = JSON.parse(accumulatedContent);
                    res.write(`data: ${JSON.stringify({ type: "complete", data: structuredData })}\n\n`);
                } catch (parseError) {
                    res.write(`data: ${JSON.stringify({ type: "error", error: "Failed to parse structured data" })}\n\n`);
                }

                res.write(`event: done\ndata: [DONE]\n\n`);
                res.end();
            }
        }

    } catch (err) {
        console.error(err);
        res.write(
            `event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`
        );
        res.end();
    }
});

functions.http('unlegalese', unlegalese);