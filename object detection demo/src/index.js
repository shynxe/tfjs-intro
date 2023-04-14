import React from "react";
import ReactDOM from "react-dom";
import * as tf from '@tensorflow/tfjs';
import {loadGraphModel} from '@tensorflow/tfjs-converter';
import "./styles.css";

tf.setBackend('webgl');

const threshold = 0.65;

const classesDir = {
    0: "background",
    1: "person",
    2: "bicycle",
    77: "phone",
    75: "clock",
    70: "toilet",
    62: "chair",
}

async function load_model() {
    return await loadGraphModel("http://127.0.0.1:8081/ssdtfjs/model.json");
}

class App extends React.Component {
    videoRef = React.createRef();
    canvasRef = React.createRef();


    componentDidMount() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const webCamPromise = navigator.mediaDevices
                .getUserMedia({
                    audio: false,
                    video: {
                        facingMode: "user"
                    }
                })
                .then(stream => {
                    window.stream = stream;
                    this.videoRef.current.srcObject = stream;
                    return new Promise((resolve, reject) => {
                        this.videoRef.current.onloadedmetadata = () => {
                            resolve();
                        };
                    });
                });

            const modelPromise = load_model();

            Promise.all([modelPromise, webCamPromise])
                .then(values => {
                    this.detectFrame(this.videoRef.current, values[0]);
                })
                .catch(error => {
                    console.error(error);
                });
        }
    }

    detectFrame = (video, model) => {
        tf.engine().startScope();

        model.executeAsync(this.process_input(video)).then(predictions => {
            this.renderPredictions(predictions, video);
            requestAnimationFrame(() => {
                this.detectFrame(video, model);
            });
            tf.engine().endScope();
        });
    };

    process_input(video_frame) {
        /*
        Inputs
            A three-channel image of variable size - the model does NOT support batching.
            The input tensor is a tf.uint8 tensor with shape [1, height, width, 3] with values in [0, 255].
         */
        const tfimg = tf.browser.fromPixels(video_frame, 3).toInt();
        return tfimg.expandDims(0);
    };

    buildDetectedObjects(scores, threshold, boxes, classes) {
        const detectionObjects = []
        var video_frame = document.getElementById('frame');

        scores[0].forEach((score, i) => {
            if (score > threshold) {
                const bbox = [];
                const minY = boxes[0][i][0] * video_frame.offsetHeight;
                const minX = boxes[0][i][1] * video_frame.offsetWidth;
                const maxY = boxes[0][i][2] * video_frame.offsetHeight;
                const maxX = boxes[0][i][3] * video_frame.offsetWidth;
                bbox[0] = minX;
                bbox[1] = minY;
                bbox[2] = maxX - minX;
                bbox[3] = maxY - minY;
                detectionObjects.push({
                    class: classes[i],
                    label: classesDir[classes[i]] ? classesDir[classes[i]] : classes[i],
                    score: score.toFixed(4),
                    bbox: bbox
                })
            }
        })
        return detectionObjects
    }

    renderPredictions = predictions => {
        const ctx = this.canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Font options.
        const font = "16px sans-serif";
        ctx.font = font;
        ctx.textBaseline = "top";

        //Getting predictions
        const boxes = predictions[4].arraySync();
        const scores = predictions[5].arraySync();
        const classes = predictions[6].dataSync();

        const detections = this.buildDetectedObjects(scores, threshold,
            boxes, classes);

        detections.forEach(item => {
            const x = item['bbox'][0];
            const y = item['bbox'][1];
            const width = item['bbox'][2];
            const height = item['bbox'][3];

            // Draw the bounding box.
            ctx.strokeStyle = "#00FFFF";
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            // Draw the label background.
            ctx.fillStyle = "#00FFFF";
            const textWidth = ctx.measureText(item["label"] + " " + (100 * item["score"]).toFixed(2) + "%").width;
            const textHeight = parseInt(font, 10); // base 10
            ctx.fillRect(x, y, textWidth + 4, textHeight + 4);
        });

        detections.forEach(item => {
            const x = item['bbox'][0];
            const y = item['bbox'][1];

            // Draw the text last to ensure it's on top.
            ctx.fillStyle = "#000000";
            ctx.fillText(item["label"] + " " + (100 * item["score"]).toFixed(2) + "%", x, y);
        });
    };

    render() {
        return (
            <div>
                <video
                    style={{height: '700px', width: "1200px"}}
                    className="size"
                    autoPlay
                    playsInline
                    muted
                    ref={this.videoRef}
                    id="frame"
                />
                <canvas
                    className="size"
                    ref={this.canvasRef}
                    width="1200"
                    height="700"
                />
            </div>
        );
    }
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App/>, rootElement);
