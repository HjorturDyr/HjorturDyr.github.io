const canvas = document.getElementById('gameCanvas');
const gl = canvas.getContext('webgl');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0, 0, 0, 1); // Start with a black background
gl.enable(gl.DEPTH_TEST);

let simulationStarted = false;
let lastUpdateTime = 0;
let updateInterval = 1000;

const gridSize = 10;
const cubeSize = 2; // Set cube size larger for better visibility
const spacing = 0.3; // Spacing between cubes

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
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White cubes
    }
`;

function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(shader));
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
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program error:', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
gl.useProgram(program);

const cubeVertices = new Float32Array([
    -1, -1, -1,  1, -1, -1,  1,  1, -1, -1,  1, -1, // Front face
    -1, -1,  1,  1, -1,  1,  1,  1,  1, -1,  1,  1, // Back face
    -1, -1, -1, -1,  1, -1, -1,  1,  1, -1, -1,  1, // Left face
     1, -1, -1,  1,  1, -1,  1,  1,  1,  1, -1,  1, // Right face
    -1, -1, -1,  1, -1, -1,  1, -1,  1, -1, -1,  1, // Bottom face
    -1,  1, -1,  1,  1, -1,  1,  1,  1, -1,  1,  1  // Top face
]);

const cubeIndices = new Uint16Array([
    0, 1, 2, 2, 3, 0, // Front face
    4, 5, 6, 6, 7, 4, // Back face
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

let state = new Uint8Array(gridSize * gridSize * gridSize).map(() => Math.random() > 0.5 ? 1 : 0);

const projectionMatrix = createMatrix();
const viewMatrix = createMatrix();
const modelMatrix = createMatrix();
const viewProjectionMatrix = createMatrix();

let angleX = 0;
let angleY = 0;
let zoom = 25;

function createMatrix() {
    return new Float32Array(16).fill(0).map((_, i) => (i % 5 === 0 ? 1 : 0));
}

function multiplyMatrices(out, a, b) {
    const result = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            result[i * 4 + j] =
                a[i * 4] * b[j] +
                a[i * 4 + 1] * b[j + 4] +
                a[i * 4 + 2] * b[j + 8] +
                a[i * 4 + 3] * b[j + 12];
        }
    }
    out.set(result);
}

function perspective(matrix, fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);

    matrix[0] = f / aspect;
    matrix[5] = f;
    matrix[10] = (far + near) * nf;
    matrix[11] = -1;
    matrix[14] = 2 * far * near * nf;
    matrix[15] = 0;
}

function lookAt(matrix, eye, center, up) {
    const z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
    const len = Math.hypot(z0, z1, z2);
    const zNorm = [z0 / len, z1 / len, z2 / len];

    const x0 = up[1] * zNorm[2] - up[2] * zNorm[1];
    const x1 = up[2] * zNorm[0] - up[0] * zNorm[2];
    const x2 = up[0] * zNorm[1] - up[1] * zNorm[0];

    matrix[0] = x0; matrix[4] = x1; matrix[8] = x2;
    matrix[1] = up[0]; matrix[5] = up[1]; matrix[9] = up[2];
    matrix[2] = zNorm[0]; matrix[6] = zNorm[1]; matrix[10] = zNorm[2];
    matrix[12] = eye[0]; matrix[13] = eye[1]; matrix[14] = eye[2]; matrix[15] = 1;
}

function updateCamera() {
    perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100);
    const eye = [Math.sin(angleY) * zoom, angleX * 2, Math.cos(angleY) * zoom];
    lookAt(viewMatrix, eye, [0, 0, 0], [0, 1, 0]);
    multiplyMatrices(viewProjectionMatrix, projectionMatrix, viewMatrix);
}

function drawCube(x, y, z) {
    const translation = [
        (x - gridSize / 2) * (cubeSize + spacing), 
        (y - gridSize / 2) * (cubeSize + spacing), 
        (z - gridSize / 2) * (cubeSize + spacing)
    ];
    modelMatrix[12] = translation[0];
    modelMatrix[13] = translation[1];
    modelMatrix[14] = translation[2];
    multiplyMatrices(viewProjectionMatrix, projectionMatrix, modelMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_modelViewProjection'), false, viewProjectionMatrix);
    gl.drawElements(gl.TRIANGLES, cubeIndices.length, gl.UNSIGNED_SHORT, 0);
}

function stepGameOfLife() {
    const newState = new Uint8Array(state.length);
    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
            for (let z = 0; z < gridSize; z++) {
                const index = x + y * gridSize + z * gridSize * gridSize;
                const neighbors = countNeighbors(x, y, z);
                const currentCell = state[index];
                if (currentCell && (neighbors === 5 || neighbors === 6)) {
                    newState[index] = 1;
                } else if (!currentCell && neighbors === 6) {
                    newState[index] = 1;
                }
            }
        }
    }
    state = newState;
}

function countNeighbors(x, y, z) {
    let count = 0;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            for (let k = -1; k <= 1; k++) {
                if (i === 0 && j === 0 && k === 0) continue;
                const nx = x + i;
                const ny = y + j;
                const nz = z + k;
                if (nx >= 0 && ny >= 0 && nz >= 0 && nx < gridSize && ny < gridSize && nz < gridSize) {
                    count += state[nx + ny * gridSize + nz * gridSize * gridSize];
                }
            }
        }
    }
    return count;
}

function render(currentTime) {
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

    if (simulationStarted && currentTime - lastUpdateTime > updateInterval) {
        stepGameOfLife();
        lastUpdateTime = currentTime;
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

document.getElementById('speedSlider').addEventListener('input', (e) => {
    updateInterval = parseInt(e.target.value, 10);
});

render(0);
