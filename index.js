const express = require('express');
const functions = require('@google-cloud/functions-framework');
const OpenAI = require("openai");

const client = new OpenAI();
const unlegalese = express();
unlegalese.use(express.json());

unlegalese.post('/unlegalese/stream', async (req, res) => {

    try {
        const response = await client.responses.create({
            model: "gpt-5-nano",
            input: "Write a one-sentence bedtime story about a unicorn."
        });
        res.send(response.output_text);
    }
    catch (e) {
        res.status(500).json({
            success: false,
            error: e.message
        });
    }

});

unlegalese.post('/unlegalese/structured', (req, res) => {
    res.send('Hit Structured');
});

unlegalese.post('/unlegalese/structured/stream', (req, res) => {
    res.send('Hit Structured');
});

functions.http('unlegalese', unlegalese);