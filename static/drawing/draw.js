//@ts-check

(() => {
    /** @type {HTMLCanvasElement} */
    // @ts-ignore
    const canvas = document.getElementById('draw');
    canvas.width = 500;
    canvas.height = 500;
    let bounds = canvas.getBoundingClientRect();

    window.addEventListener('resize', (ev) => {
        bounds = canvas.getBoundingClientRect();
    });

    /** @type {HTMLButtonElement} */
    // @ts-ignore
    const undoButton = document.getElementById('undo');

    /** @type {HTMLButtonElement} */
    // @ts-ignore
    const clearButton = document.getElementById('clear');

    /** @type {HTMLButtonElement} */
    // @ts-ignore
    const sendButton = document.getElementById('send');

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

        // @ts-ignore
        window.lawl = out;

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

    if (!canvas.getContext) {
        document.write('No canvas support!');
        return;
    }

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
        return [ev.clientX - bounds.left, ev.clientY - bounds.top];
    };

    /** @type {(ev: TouchEvent) => Point} */
    const pointTouch = (ev) => {
        if (!ev.touches.length)
            return [0, 0];

        const touch = ev.touches[0];

        return [touch.clientX - bounds.left, touch.clientY - bounds.top];
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

        if (penIsDown && dist > 10) {
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