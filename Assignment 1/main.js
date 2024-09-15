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

    let score = 0; // Initialize score to 0
    let gameWon = false; // Track if the game has been won


    const pelletSpeed = 0.07;

    // Rectangle properties
    const rectangles = []; // Array to store rectangles
    const rectangleWidth = 0.2; // Width of rectangles
    const rectangleHeight = 0.2; // Height of rectangles

    // Spawn a rectangle at a random position (bottom-left or bottom-right)
    function spawnRectangle() {
        const isLeft = Math.random() < 0.5;
        const startX = isLeft ? -1.0 : 1.0;
        const endX = isLeft ? 1.0 : -1.0;
        const startY = -1.0;
        const endY = 1.0;

        const duration = Math.random() * (5 - 3) + 3; // 3 to 5 seconds
        const speedX = (endX - startX) / (duration * 60); // Assuming 60 FPS
        const speedY = (endY - startY) / (duration * 60);

        rectangles.push({
            x: startX,
            y: startY,
            speedX: speedX,
            speedY: speedY,
            width: rectangleWidth,
            height: rectangleHeight,
        });
    }

    // Spawn a few initial rectangles
    for (let i = 0; i < 3; i++) {
        spawnRectangle();
    }

    // Convert the mouse position to WebGL coordinates
    function getNormalizedX(mouseX, canvasWidth) {
        return (mouseX / canvasWidth) * 2 - 1;
    }

    // Handle mouse move to update triangle position
    canvas.addEventListener('mousemove', function (event) {
        if (!gameWon) {
            triangleX = getNormalizedX(event.clientX, canvas.width);
        }
    });

    // Handle left mouse button click to shoot pellet
    canvas.addEventListener('mousedown', function (event) {
        if (!gameWon && event.button === 0) { // Left mouse button
            if (pelletY === null) {
                pelletY = -1.0;      // Start pellet at the bottom of the canvas
                pelletX = triangleX; // Capture triangle's current position for the pellet
            }
        }
    });

    // Check if a pellet collides with a rectangle
    function checkCollision(rectangle) {
        const halfWidth = rectangle.width / 2;
        const halfHeight = rectangle.height / 2;

        return (
            pelletX >= (rectangle.x - halfWidth) &&
            pelletX <= (rectangle.x + halfWidth) &&
            pelletY >= (rectangle.y - halfHeight) &&
            pelletY <= (rectangle.y + halfHeight)
        );
    }

    // Display "You Win" message when the game is won
    function displayWinMessage() {
        const ctx = canvas.getContext('2d');
        ctx.font = '48px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
        ctx.fillText('You Win!', canvas.width / 2, canvas.height / 2);
    }

    // Display the current score at the top center of the screen
    function displayScore() {
        const ctx = canvas.getContext('2d');
        ctx.font = '24px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.clearRect(0, 0, canvas.width, 50); // Clear the top part of the canvas
        ctx.fillText('Score: ' + score, canvas.width / 2, 30); // Draw score
    }

    // Update and draw the scene, the triangle, pellet, and rectangles
    function drawScene() {
        if (gameWon) {
            // If the game is won, display the win message and stop rendering
            displayWinMessage();
            return;
        }

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Draw triangle
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

        // Update and draw rectangles
        for (let i = rectangles.length - 1; i >= 0; i--) {
            const rectangle = rectangles[i];

            // Update rectangle position
            rectangle.x += rectangle.speedX;
            rectangle.y += rectangle.speedY;

            // Draw rectangle
            drawObject(gl, programInfo, buffers.pellet, rectangle.x, rectangle.y, 4); // Reusing the pellet buffer

            // Check for collisions with the pellet
            if (pelletY !== null && checkCollision(rectangle)) {
                // Remove rectangle if it collides with the pellet
                rectangles.splice(i, 1);
                pelletY = null; // Optionally remove the pellet upon collision
                pelletX = null;
                score++; // Increment the score
                spawnRectangle(); // Respawn a new rectangle immediately

                // Check if the score has reached 5 to stop the game
                if (score >= 5) {
                    gameWon = true; // Set gameWon flag to true
                }
            }

            // Respawn rectangle if it reaches the top corner
            if (rectangle.y >= 1.0) {
                rectangles.splice(i, 1); // Remove the rectangle
                spawnRectangle(); // Spawn a new rectangle
            }
        }

        // Display the current score at the top center
        //displayScore();

        requestAnimationFrame(drawScene);
    }

    // Start the render loop (only once)
    requestAnimationFrame(drawScene);
}

window.onload = main;

