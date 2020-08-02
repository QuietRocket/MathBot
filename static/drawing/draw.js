//@ts-check

(() => {
    // Session variables

    /** @type {number} */
    let size;

    /** @type {Point} */
    let bounds;

    /** @type {number} */
    let lineWidth;

    // Element declarations

    /** @type {HTMLCanvasElement} */
    let canvas;

    /** @type {HTMLButtonElement} */
    let undoButton;

    /** @type {HTMLButtonElement} */
    let clearButton;

    /** @type {HTMLButtonElement} */
    let sendButton;

    /** @type {HTMLInputElement} */
    let slider;

    // Element queries

    // @ts-ignore
    canvas = document.getElementById('draw');

    // @ts-ignore
    undoButton = document.getElementById('undo');

    // @ts-ignore
    clearButton = document.getElementById('clear');

    // @ts-ignore
    sendButton = document.getElementById('send');

    // @ts-ignore
    slider = document.getElementById('slider');

    // Session definitions

    size = Math.min(window.innerHeight, window.innerWidth) - 10;

    canvas.width = canvas.height = size;


    const updateBounds = () => {
        const rect = canvas.getBoundingClientRect();

        bounds = [rect.left, rect.top];
    };

    updateBounds();

    // Events
    window.addEventListener('resize', updateBounds);

    window.addEventListener('scroll', updateBounds);

    undoButton.addEventListener('click', (ev) => {
        for (let i = actions.length - 1; i >= 0; i--) {
            const removed = actions.pop();
            if (removed[1] === 0) { // Hit the start of a line.
                break;
            }
        }
        redraw();
    });

    clearButton.addEventListener('click', (ev) => {
        actions = [];
        redraw();
    });

    sendButton.addEventListener('click', async (ev) => {
        /** @type {number[]} */
        const out = [];

        actions.forEach(([[x, y], t]) => out.push(x, y, t));

        const body = JSON.stringify(out);

        const res = await fetch('/submitDrawing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body
        });

        /** @type {string} */
        let text;

        try {
            text = await res.text();
        } catch (e) {
            alert(e);
        }

        if (text === 'OK') {
            alert('Sent successfully.');
            actions = [];
            redraw();
        }
    });

    slider.addEventListener('change', (ev) => {
        lineWidth = computeLineWidth();
        redraw();
    });

    /** @type {() => number} */
    const computeLineWidth = () => {
        const num = slider.valueAsNumber;
        return size / 2 * num / 100;
    };

    if (!canvas.getContext) {
        document.write('No canvas support!');
        return;
    }

    // Canvas stuff

    const ctx = canvas.getContext('2d');

    /** @typedef {[number, number]} Point */

    /** @typedef {[Point, number]} LineAction
     * 0: pen down
     * 1: pen move
     * 2: pen up
     */

    /** @type {LineAction[]} */
    let actions = [];

    /** @type {Point} */
    let prev = [0, 0];

    let penIsDown = false;

    const redraw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = "rgb(200, 200, 200)"

        for (let i = 0; i < actions.length; i++) {
            const [[x, y], type] = actions[i];

            switch (type) {
                case 0: // down
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    break;
                case 1: // move
                    ctx.lineTo(x, y);
                    break;
                case 2: // up
                    ctx.stroke();
                    break;
            };
        }

        if (actions.length > 0) {
            const [[_x, _y], type] = actions[actions.length - 1];
            if (type !== 2) {
                ctx.stroke();
            }
        }
    };

    /** @type {(ev: MouseEvent) => Point} */
    const pointMouse = (ev) => {
        const [left, top] = bounds;
        return [ev.clientX - left, ev.clientY - top];
    };

    /** @type {(ev: TouchEvent) => Point} */
    const pointTouch = (ev) => {
        const [left, top] = bounds;

        if (!ev.touches.length)
            return [0, 0];

        const touch = ev.touches[0];

        return [touch.clientX - left, touch.clientY - top];
    };

    /** @type {(p: Point) => void} */
    const penDown = (p) => {
        penIsDown = true;

        actions.push([p, 0]);
        redraw();
    };

    /** @type {(p: Point) => void} */
    const penMove = (p) => {
        const [x1, y1] = p;
        const [x2, y2] = prev;
        const dist = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5;

        if (penIsDown && dist > 5) {
            prev = p;
            actions.push([p, 1]);
            redraw();
        }
    };

    /** @type {() => void} */
    const penUp = () => {
        penIsDown = false;

        actions.push([[0, 0], 2]);
        redraw();
    };

    canvas.addEventListener('touchstart', (ev) => {
        penDown(pointTouch(ev));

        ev.preventDefault();
    });

    canvas.addEventListener('touchmove', (ev) => {
        penMove(pointTouch(ev));

        ev.preventDefault();
    });

    canvas.addEventListener('touchend', (ev) => {
        penUp();

        ev.preventDefault();
    });

    canvas.addEventListener('mousedown', (ev) => {
        penDown(pointMouse(ev));
    });

    canvas.addEventListener('mousemove', (ev) => {
        penMove(pointMouse(ev));
    });

    canvas.addEventListener('mouseup', (ev) => {
        penUp();
    });

    document.body.appendChild(canvas);
})();