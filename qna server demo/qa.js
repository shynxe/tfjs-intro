const { QAClient, initModel} = require("question-answering");


const express = require('express');
const qa = express();
const port = 1234;

qa.use(express.json());

const startApp = async () => {
    const model = await initModel({ name: "deepset/bert-base-cased-squad2" });
    return await QAClient.fromOptions({model});
}

startApp().then((qaClient) => {
    qa.post('/predict', async (req, res) => {
        const { question, context } = req.body;
        const answer = await qaClient.predict(question, context);

        res.send({
            time: answer.inferenceTime,
            text: answer.text,
            score: answer.score,
        })
    });

    qa.listen(port, () => console.log(`Example app listening on port ${port}!`));
});




