const canvas = document.getElementById('gameCanvas');
const gl = canvas.getContext('webgl');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let simulationStarted = false;

const gridSize = 10;

const vertexShaderSource = `
    attribute vec3 position;
    uniform mat4 u_modelViewProjection;
    void main() {
        gl_Position = u_modelViewProjection * vec4(position, 1.0);
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    void main() {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
`;

function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader error: ', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexSrc, fragmentSrc) {
    const vs = compileShader(gl, vertexSrc, gl.VERTEX_SHADER);
    const fs = compileShader(gl, fragmentSrc, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    return program;
}

const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
gl.useProgram(program);

const cubeVertices = new Float32Array([
    -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5, // Front face
    -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5, // Back face
    -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,  -0.5,  0.5,  0.5,  -0.5, -0.5,  0.5, // Left face
     0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,   0.5, -0.5,  0.5, // Right face
    -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5, // Bottom face
    -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5  // Top face
]);

const cubeIndices = new Uint16Array([
    0, 1, 2,  2, 3, 0, // Front face
    4, 5, 6,  6, 7, 4, // Back face
    8, 9, 10, 10, 11, 8, // Left face
    12, 13, 14, 14, 15, 12, // Right face
    16, 17, 18, 18, 19, 16, // Bottom face
    20, 21, 22, 22, 23, 20  // Top face
]);

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

const indexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(program, 'position');
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

let state = new Uint8Array(gridSize * gridSize * gridSize).fill(0).map(() => Math.random() > 0.5 ? 1 : 0);

const projectionMatrix = mat4.create();
const viewMatrix = mat4.create();
const modelMatrix = mat4.create();
const viewProjectionMatrix = mat4.create();

let angleX = 0;
let angleY = 0;
let zoom = 20;

function updateCamera() {
    mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100);
    mat4.lookAt(viewMatrix, [zoom * Math.sin(angleY), zoom * Math.sin(angleX), zoom * Math.cos(angleY)], [0, 0, 0], [0, 1, 0]);
    mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);
}

function drawCube(x, y, z) {
    mat4.identity(modelMatrix);
    mat4.translate(modelMatrix, modelMatrix, [x - gridSize / 2, y - gridSize / 2, z - gridSize / 2]);
    const u_modelViewProjection = gl.getUniformLocation(program, 'u_modelViewProjection');
    const modelViewProjection = mat4.create();
    mat4.multiply(modelViewProjection, viewProjectionMatrix, modelMatrix);
    gl.uniformMatrix4fv(u_modelViewProjection, false, modelViewProjection);

    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}

function stepGameOfLife() {
    const newState = new Uint8Array(state.length);

    function getCell(x, y, z) {
        if (x < 0 || y < 0 || z < 0 || x >= gridSize || y >= gridSize || z >= gridSize) return 0;
        return state[x + y * gridSize + z * gridSize * gridSize];
    }

    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
            for (let z = 0; z < gridSize; z++) {
                let neighbors = 0;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dz = -1; dz <= 1; dz++) {
                            if (dx !== 0 || dy !== 0 || dz !== 0) {
                                neighbors += getCell(x + dx, y + dy, z + dz);
                            }
                        }
                    }
                }

                const currentCell = getCell(x, y, z);
                if (currentCell && (neighbors === 5 || neighbors === 6)) {
                    newState[x + y * gridSize + z * gridSize * gridSize] = 1;
                } else if (!currentCell && neighbors === 6) {
                    newState[x + y * gridSize + z * gridSize * gridSize] = 1;
                }
            }
        }
    }

    state = newState;
}
//EEE
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    updateCamera();

    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
            for (let z = 0; z < gridSize; z++) {
                if (state[x + y * gridSize + z * gridSize * gridSize] === 1) {
                    drawCube(x, y, z);
                }
            }
        }
    }

    if (simulationStarted) {
        stepGameOfLife();
    }

    requestAnimationFrame(render);
}

canvas.addEventListener('mousemove', (e) => {
    if (e.buttons === 1) {
        angleY += e.movementX * 0.01;
        angleX += e.movementY * 0.01;
    }
});

canvas.addEventListener('wheel', (e) => {
    zoom += e.deltaY * 0.01;
    zoom = Math.max(5, Math.min(30, zoom));
});

document.getElementById('startButton').addEventListener('click', () => {
    simulationStarted = true;
    document.getElementById('startButton').style.display = 'none';
});

gl.clearColor(0, 0, 0, 1);
gl.enable(gl.DEPTH_TEST);
render();
