// Initialize WebGL
function initWebGL(canvas) {
    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.log("WebGL not supported, falling back on experimental-webgl");
        return canvas.getContext('experimental-webgl');
    }
    return gl;
}

// Vertex shader program
const vsSource = `
    attribute vec4 aVertexPosition;
    uniform float uXTranslation;
    uniform float uYTranslation;
    void main(void) {
        gl_Position = vec4(aVertexPosition.x + uXTranslation, aVertexPosition.y + uYTranslation, aVertexPosition.z, 1.0);
    }
`;

// Fragment shader program
const fsSource = `
    void main(void) {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White color
    }
`;

// Compile shader
function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Initialize shader program
function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }
    return shaderProgram;
}

// Initialize buffers for the triangle and the pellet
function initBuffers(gl) {
    // Triangle vertices
    const triangleVertices = [
         0.0,  -0.9,  0.0,  // Bottom vertex
        -0.1,  -1.0,  0.0,  // Left vertex
         0.1,  -1.0,  0.0,  // Right vertex
    ];

    const triangleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleVertices), gl.STATIC_DRAW);

    // Pellet vertices (a small square)
    const pelletVertices = [
        -0.02, -0.02, 0.0,
         0.02, -0.02, 0.0,
         0.02,  0.02, 0.0,
        -0.02,  0.02, 0.0
    ];

    const pelletBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pelletBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pelletVertices), gl.STATIC_DRAW);

    return {
        triangle: triangleBuffer,
        pellet: pelletBuffer
    };
}

// Draw a single object (either triangle or pellet)
function drawObject(gl, programInfo, buffer, xTranslation, yTranslation, vertexCount) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;

    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.useProgram(programInfo.program);

    gl.uniform1f(programInfo.uniformLocations.xTranslation, xTranslation);
    gl.uniform1f(programInfo.uniformLocations.yTranslation, yTranslation);

    gl.drawArrays(gl.TRIANGLE_FAN, 0, vertexCount);
}

// Main function to start everything
function main() {
    const canvas = document.querySelector("#glCanvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const gl = initWebGL(canvas);
    if (!gl) {
        return;
    }

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        },
        uniformLocations: {
            xTranslation: gl.getUniformLocation(shaderProgram, 'uXTranslation'),
            yTranslation: gl.getUniformLocation(shaderProgram, 'uYTranslation'),
        },
    };

    const buffers = initBuffers(gl);

    let triangleX = 0.0;   
    let pelletY = null;    
    let pelletX = null;    


    const pelletSpeed = 0.05;

    // Rectangle properties
    let rectangleX = null;
    let rectangleY = null;
    let rectangleSpeedX = 0;
    let rectangleSpeedY = 0;

    // Randomly spawn the rectangle at the bottom-left or bottom-right
    function spawnRectangle() {
        const isLeft = Math.random() < 0.5;
        rectangleX = isLeft ? -1.0 : 1.0;
        rectangleY = -1.0;

        
        const duration = Math.random() * (5 - 3) + 2; // 3 to 5 seconds
        const endX = isLeft ? 1.0 : -1.0;
        const endY = 1.0;

        // Calculate the speed in both X and Y directions
        rectangleSpeedX = (endX - rectangleX) / (duration * 60); // Assuming 60 FPS
        rectangleSpeedY = (endY - rectangleY) / (duration * 60);
    }

    // Initially spawn a rectangle
    spawnRectangle();

    // Convert the mouse position to WebGL coordinates
    function getNormalizedX(mouseX, canvasWidth) {
        return (mouseX / canvasWidth) * 2 - 1;
    }

    // Handle mouse move to update triangle position
    canvas.addEventListener('mousemove', function (event) {
        triangleX = getNormalizedX(event.clientX, canvas.width);
    });

    // Handle left mouse button click to shoot pellet
    canvas.addEventListener('mousedown', function (event) {
        if (event.button === 0) { // Left mouse button
            if (pelletY === null) {
                pelletY = -1.0;      // Start pellet at the bottom of the canvas
                pelletX = triangleX; // Capture triangle's current position for the pellet
            }
        }
    });

    // Draw the scene, including the triangle, pellet, and rectangle
    function drawScene() {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Draw triangle at its current position
        drawObject(gl, programInfo, buffers.triangle, triangleX, 0.0, 3);

        // Draw pellet (if it has been shot)
        if (pelletY !== null) {
            drawObject(gl, programInfo, buffers.pellet, pelletX, pelletY, 4); // Use fixed `pelletX`
            pelletY += pelletSpeed;

            // Remove pellet if it goes off the screen
            if (pelletY > 1.0) {
                pelletY = null;
                pelletX = null;
            }
        }

        // Move and draw the rectangle
        if (rectangleX !== null && rectangleY !== null) {
            drawObject(gl, programInfo, buffers.pellet, rectangleX, rectangleY, 4); // Reusing the pellet buffer for the rectangle

            // Update the rectangle's position
            rectangleX += rectangleSpeedX;
            rectangleY += rectangleSpeedY;

            // Respawn the rectangle if it reaches the top corner
            if (rectangleY >= 1.0) {
                spawnRectangle();
            }
        }

        requestAnimationFrame(drawScene);
    }

    // Start the render loop (only once)
    requestAnimationFrame(drawScene);
}

window.onload = main;