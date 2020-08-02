//@ts-check

(() => {
    // Session variables

    /** @type {number} */
    let size;

    /** @type {Point} */
    let bounds;

    /** @type {number} */
    let lineWidth;

    /** @type {number[]} */
    let actionBuffer = [];

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

    /** @type {HTMLInputElement} */
    let picker;

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

    // @ts-ignore
    picker = document.getElementById('picker');

    // Session definitions

    size = Math.min(window.innerHeight, window.innerWidth) - 10;

    canvas.width = canvas.height = size;

    const updateBounds = () => {
        const rect = canvas.getBoundingClientRect();

        bounds = [rect.left, rect.top];
    };

    updateBounds();

    const updateLineWidth = () => {
        lineWidth = slider.valueAsNumber;
    };

    updateLineWidth();

    // Events
    window.addEventListener('resize', updateBounds);

    window.addEventListener('scroll', updateBounds);

    undoButton.addEventListener('click', (ev) => {
        for (let i = actionBuffer.length - 1; i >= 0; i--) {
            const removed = actionBuffer.pop();
            if (removed === -1) { // Hit the start of a line.
                break;
            }
        }
        redraw();
    });

    clearButton.addEventListener('click', (ev) => {
        actionBuffer = [];
        redraw();
    });

    slider.addEventListener('change', (ev) => {
        updateLineWidth();
        redraw();
    });

    // picker.addEventListener('change', (ev) => {
    //     console.log(picker.value);
    // });

    if (!canvas.getContext) {
        document.write('No canvas support!');
        return;
    }

    // Canvas stuff

    const ctx = canvas.getContext('2d');

    /** @typedef {[number, number]} Point */

    /*
     * -1: pen down
     * -2: pen move
     * -3: pen up
     * -4: line width
     */

    /** @type {Point} */
    let prev = [0, 0];

    let penIsDown = false;

    const redraw = () => {
        ctx.clearRect(0, 0, size, size);

        if (actionBuffer.length === 0)
            return;

        let lastStroked = false;

        let i = 0;
        while (i < actionBuffer.length) {
            const type = actionBuffer[i];

            switch (type) {
                case -1: // down
                    {
                        const [x, y] = [actionBuffer[i + 1], actionBuffer[i + 2]];
                        i += 2;
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        lastStroked = false;
                    };
                    break;
                case -2: // move
                    {
                        const [x, y] = [actionBuffer[i + 1], actionBuffer[i + 2]];
                        i += 2;
                        ctx.lineTo(x, y);
                    };
                    break;
                case -3: // up
                    {
                        const [x, y] = [actionBuffer[i + 1], actionBuffer[i + 2]];
                        i += 2;
                        ctx.lineTo(x, y);
                        ctx.stroke();
                        lastStroked = true;

                        console.log(actionBuffer);
                    };
                    break;
                case -4: // line width
                    {
                        const value = actionBuffer[i + 1];
                        i += 1;
                        ctx.lineWidth = value;
                    }
                    break;
                default:
                    {
                        alert('Something went wrong!');
                    };
                    break;
            };

            i++;
        }

        if (!lastStroked)
            ctx.stroke();
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

        actionBuffer.push(-4, lineWidth);
        actionBuffer.push(-1, ...p);

        redraw();
    };

    /** @type {(p: Point) => void} */
    const penMove = (p) => {
        const [x1, y1] = p;
        const [x2, y2] = prev;
        const dist = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5;

        if (penIsDown && dist > 5) {
            prev = p;
            actionBuffer.push(-2, ...p);
            redraw();
        }
    };

    /** @type {(p: Point) => void} */
    const penUp = (p) => {
        penIsDown = false;

        actionBuffer.push(-3, ...p);

        redraw();
    };

    // Canvas events
    {
        canvas.addEventListener('touchstart', (ev) => {
            penDown(pointTouch(ev));

            ev.preventDefault();
        });

        canvas.addEventListener('touchmove', (ev) => {
            penMove(pointTouch(ev));

            ev.preventDefault();
        });

        canvas.addEventListener('touchend', (ev) => {
            penUp(pointTouch(ev));

            ev.preventDefault();
        });

        canvas.addEventListener('mousedown', (ev) => {
            penDown(pointMouse(ev));
        });

        canvas.addEventListener('mousemove', (ev) => {
            penMove(pointMouse(ev));
        });

        canvas.addEventListener('mouseup', (ev) => {
            penUp(pointMouse(ev));
        });
    };

    document.body.appendChild(canvas);
})();