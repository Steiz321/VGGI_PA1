"use strict";

let gl; // The webgl context.
let surface; // A surface model
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.

function deg2rad(angle) {
  return (angle * Math.PI) / 180;
}

// corrugated sphere
// classic sphere formula :
// x = R0*sinΘcosφ, y =  R0*sinΘsinφ, z = R0cosΘ
// corrugated sphere formula :
// for creating "corrugation" we modify radius
// R (Θ,φ) = R0 + Asin(kΘ)cos(mφ)
// R0 - basic radius
// A - corrugation amplitude (height of waves)
// k and m - frequencies corrugation along ϑ and ϕ
// The higher the number, the more “waves” there are on the surface.
// x(Θ,φ) = (R0 + Asin(kΘ)cos(mφ))*sinΘcosφ
// y(Θ,φ) = (R0 + Asin(kΘ)cos(mφ))*sinΘsinφ
// z(Θ,φ) = (R0 + Asin(kΘ)cos(mφ))*cosΘ

// Constructor
function Model(name) {
  this.name = name;
  this.iVertexBuffer = gl.createBuffer();
  this.count = 0;

  // -- new properties for saving parameters grid --
  this.numSegments = 0;
  this.numULines = 0;
  this.numVLines = 0;
  // ---------------

  this.BufferData = function (vertices, numSegments, numULines, numVLines) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

    // -- saving parameters --
    this.count = vertices.length / 3;
    this.numSegments = numSegments;
    this.numULines = numULines;
    this.numVLines = numVLines;
    // -----------------------
  };

  this.Draw = function () {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    // -- logic for drawing --
    const verticesPerLine = this.numSegments + 2;
    // +2 due to the repetition of the first point to break
    const totalLines = this.numULines + this.numVLines;

    let offset = 0;
    for (let i = 0; i < totalLines; i++) {
      // draw each line separately
      gl.drawArrays(gl.LINE_STRIP, 0, this.count);
      offset += verticesPerLine;
    }
    // --------------------------
  };
}

function ShaderProgram(name, program) {
  this.name = name;
  this.prog = program;

  // Location of the attribute variable in the shader program.
  this.iAttribVertex = -1;
  // Location of the uniform specifying a color for the primitive.
  this.iColor = -1;
  // Location of the uniform matrix representing the combined transformation.
  this.iModelViewProjectionMatrix = -1;

  this.Use = function () {
    gl.useProgram(this.prog);
  };
}

/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  /* Set the values of the projection transformation */
  let projection = m4.perspective(Math.PI / 8, 1, 8, 12);

  /* Get the view matrix from the SimpleRotator object.*/
  let modelView = spaceball.getViewMatrix();

  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
  let translateToPointZero = m4.translation(0, 0, -10);

  let matAccum0 = m4.multiply(rotateToPointZero, modelView);
  let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

  /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
  let modelViewProjection = m4.multiply(projection, matAccum1);

  gl.uniformMatrix4fv(
    shProgram.iModelViewProjectionMatrix,
    false,
    modelViewProjection
  );

  /* Draw the six faces of a cube, with different colors. */
  gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]); // Yellow color

  surface.Draw();
}

// -- updated fuction for corrugated sphere --
function CreateSurfaceData() {
  let vertexList = [];
  const R0 = 1.5;
  const A = 0.05; // -- corrugation amplitude
  const k = 15; // -- vertical corrugation frequency (theta)
  const m = 15; // -- horizontal corrugation frequency (pho=9)

  const num_u_lines = 20; // -- number of lines V
  const num_v_lines = 30; // -- number of lines U
  const num_segments = 50; // -- number of segments per line

  // -- function for calculation coord of corrugated sphere --
  function get_corrugated_sphere_coords(theta, phi) {
    // --parametric equation for a corrugated sphere --
    // -- R(theta, phi) = R0 + A * sin(k * theta) * cos(m * phi) --
    let R = R0 + A * Math.sin(k * theta) * Math.cos(m * phi);

    let x = R * Math.sin(theta) * Math.cos(phi);
    let y = R * Math.sin(theta) * Math.sin(phi);
    let z = R * Math.cos(theta);
    return [x, y, z];
  }

  // -- for u lines --
  // -- theta (Θ) from 0 to PI, phi (φ) from 0 to 2*PI --
  for (let i = 0; i < num_u_lines; i++) {
    let theta = (i * Math.PI) / (num_u_lines - 1);

    // -- repeat first point, for breaking LINE_STRIP --
    let coords_start = get_corrugated_sphere_coords(theta, 0);
    vertexList.push(...coords_start); // -- first point --

    for (let j = 0; j <= num_segments; j++) {
      let phi = (j * 2 * Math.PI) / num_segments;
      let coords = get_corrugated_sphere_coords(theta, phi);
      vertexList.push(...coords);
    }
    vertexList.push(...coords_start); // -- end point (repeating) --
  }

  // -- for v lines --
  // -- phi from 0 to 2*PI, theta from 0 to PI --
  for (let i = 0; i < num_v_lines; i++) {
    let phi = (i * 2 * Math.PI) / (num_v_lines - 1);

    let coords_start = get_corrugated_sphere_coords(0, phi);
    vertexList.push(...coords_start); // -- first point --

    for (let j = 0; j <= num_segments; j++) {
      let theta = (j * Math.PI) / num_segments;
      let coords = get_corrugated_sphere_coords(theta, phi);
      vertexList.push(...coords);
    }
    vertexList.push(...coords_start); // -- end point (repeating) --
  }

  // -- return list of vertices and parameters --
  return {
    vertices: vertexList,
    numSegments: num_segments,
    numULines: num_u_lines,
    numVLines: num_v_lines,
  };
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram("Basic", prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
  shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(
    prog,
    "ModelViewProjectionMatrix"
  );
  shProgram.iColor = gl.getUniformLocation(prog, "color");

  surface = new Model("Surface");

  // -- get data and grid parameters --
  const surfaceData = CreateSurfaceData();

  // -- pass all data to Model object --
  surface.BufferData(
    surfaceData.vertices,
    surfaceData.numSegments,
    surfaceData.numULines,
    surfaceData.numVLines
  );

  gl.enable(gl.DEPTH_TEST);
}

/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
  let vsh = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsh, vShader);
  gl.compileShader(vsh);
  if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
  }
  let fsh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fsh, fShader);
  gl.compileShader(fsh);
  if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
  }
  let prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
  }
  return prog;
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
  let canvas;
  try {
    canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    if (!gl) {
      throw "Browser does not support WebGL";
    }
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not get a WebGL graphics context.</p>";
    return;
  }
  try {
    initGL(); // initialize the WebGL graphics context
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not initialize the WebGL graphics context: " +
      e +
      "</p>";
    return;
  }

  spaceball = new TrackballRotator(canvas, draw, 0);

  draw();
}
