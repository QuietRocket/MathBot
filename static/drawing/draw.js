//@ts-check

(() => {
    // Session variables

    /** @type {number} */
    let size;

    /** @type {Point} */
    let bounds;

    /** @type {number} */
    let lineWidth;

    /** @type {string} */
    let colorString;

    /** @type {number[]} */
    let actionBuffer = [];

    /** @type {Point} */
    let lastTouch;

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

    const updateSize = () => {
        size = Math.min(window.innerHeight, window.innerWidth) - 50;
        canvas.width = canvas.height = size;
    };

    updateSize();

    const updateBounds = () => {
        const rect = canvas.getBoundingClientRect();
        bounds = [rect.left, rect.top];
    };

    updateBounds();

    const updateLineWidth = () => {
        lineWidth = slider.valueAsNumber;
    };

    updateLineWidth();

    const updateColor = () => {
        colorString = picker.value;
    };

    updateColor();

    /** @type {(i: number) => number} */
    const normalize = (i) => i / size;

    /** @type {(i: number) => number} */
    const specialize = (i) => i * size;

    // Events
    window.addEventListener('resize', (ev) => {
        updateBounds();
        updateSize();
        redraw();
    });

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

    sendButton.addEventListener('click', async (ev) => {
        const body = JSON.stringify(actionBuffer);

        const res = await fetch('/submitDrawing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body
        });

        if (res.status === 200) {
            alert('Successfully sent!');
            actionBuffer = [];
            redraw();
        } else {
            const error = await res.text();
            alert(`${res.status}: ${error}`);
        }
    });

    slider.addEventListener('change', (ev) => {
        updateLineWidth();
    });

    picker.addEventListener('change', (ev) => {
        updateColor();
    });

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
            i++;

            if (type <= -1 && type >= -3) {
                const [x, y] = [actionBuffer[i], actionBuffer[i + 1]].map(specialize);
                i += 2;

                switch (type) {
                    case -1: // down
                        {
                            ctx.beginPath();
                            ctx.moveTo(x, y);
                            lastStroked = false;
                        };
                        break;
                    case -2: // move
                        {
                            ctx.lineTo(x, y);
                        };
                        break;
                    case -3: // up
                        {
                            ctx.lineTo(x, y);
                            ctx.stroke();
                            lastStroked = true;
                        };
                        break;
                }
            } else {
                switch (type) {
                    case -4: // line width
                        {
                            const value = actionBuffer[i];
                            i += 1;
                            const norm = (value - 50) / 50;
                            const target = size / 75;
                            ctx.lineWidth = target + 10 * norm;
                        };
                        break;
                    case -5: // color
                        {
                            /** @type {string} */
                            let color;
                            const raw = actionBuffer[i];
                            if (raw === 0) {
                                color = '#000';
                            } else {
                                color = '#' + actionBuffer[i].toString(16);
                            }
                            i += 1;
                            ctx.strokeStyle = color;
                        };
                        break;
                    default:
                        {
                            alert('Something went wrong!');
                        };
                        break;
                };
            }
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

        lastTouch = [touch.clientX - left, touch.clientY - top]

        return lastTouch;
    };

    /** @type {(p: Point) => void} */
    const penDown = (p) => {
        penIsDown = true;

        actionBuffer.push(-1, ...p.map(normalize));
        actionBuffer.push(-4, lineWidth);
        actionBuffer.push(-5, parseInt(colorString.replace('#', '0x')));

        redraw();
    };

    /** @type {(p: Point) => void} */
    const penMove = (p) => {
        const [x1, y1] = p;
        const [x2, y2] = prev;
        const dist = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5;

        if (penIsDown && dist > 5) {
            prev = p;
            actionBuffer.push(-2, ...p.map(normalize));
            redraw();
        }
    };

    /** @type {(p: Point) => void} */
    const penUp = (p) => {
        penIsDown = false;

        actionBuffer.push(-3, ...p.map(normalize));

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
            penUp(lastTouch);

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