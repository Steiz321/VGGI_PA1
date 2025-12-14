"use strict";

let gl; // The webgl context.
let surface; // A surface model
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.
let uSlider, vSlider; // Sliders for granularity
let light_rotation_angle = 0;
let lastTime = 0;

function deg2rad(angle) {
  return (angle * Math.PI) / 180;
}

// Constructor
function Model(name) {
  this.name = name;
  this.iVertexBuffer = gl.createBuffer();
  this.iNormalBuffer = gl.createBuffer();
  this.iIndexBuffer = gl.createBuffer();
  this.count = 0;

  this.BufferData = function (vertices, normals, indices) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STREAM_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STREAM_DRAW
    );

    this.count = indices.length;
  };

  this.Draw = function () {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
    gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribNormal);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
  };
}

function ShaderProgram(name, program) {
  this.name = name;
  this.prog = program;
  this.iAttribVertex = -1;
  this.iAttribNormal = -1;
  this.iModelViewMatrix = -1;
  this.iProjectionMatrix = -1;
  this.iNormalMatrix = -1;
  this.iLightPos = -1;
  this.iColor = -1;

  this.Use = function () {
    gl.useProgram(this.prog);
  };
}

function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  let projection = m4.perspective(Math.PI / 8, 1, 8, 12);
  let modelView = spaceball.getViewMatrix();

  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
  let translateToPointZero = m4.translation(0, 0, -10);

  let matAccum0 = m4.multiply(rotateToPointZero, modelView);
  let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
  gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);

  let normalMatrix = m4.inverse(matAccum1);
  normalMatrix = m4.transpose(normalMatrix);
  gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

  const radius = 7;
  const x = radius * Math.cos(light_rotation_angle);
  const z = radius * Math.sin(light_rotation_angle);
  gl.uniform3fv(shProgram.iLightPos, [x, 3.0, z]);

  gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);

  surface.Draw();
}

function animate(time) {
  const time_in_seconds = time / 1000;
  const deltaTime = time_in_seconds - lastTime;
  lastTime = time_in_seconds;

  // Update animation state
  const rotationSpeed = 0.5; // radians per second
  light_rotation_angle += rotationSpeed * deltaTime;

  draw(); // Render the scene
  window.requestAnimationFrame(animate);
}
function CreateSurfaceData(u_lines, v_lines) {
  let vertexList = [];
  let normalList = [];
  let indicesList = [];

  const R0 = 1.5;
  const A = 0.05;
  const k = 15;
  const m = 15;
  const num_segments = 50;
  function get_corrugated_sphere_coords(theta, phi) {
    let R = R0 + A * Math.sin(k * theta) * Math.cos(m * phi);
    let x = R * Math.sin(theta) * Math.cos(phi);
    let y = R * Math.sin(theta) * Math.sin(phi);
    let z = R * Math.cos(theta);
    return [x, y, z];
  }
  const du = 0.001;
  const dv = 0.001;
  // Function to compute the normal vector at a point (theta, phi)
  function get_normal(theta, phi) {
    // Approximate partial derivatives using central differences
    let P_u_plus = get_corrugated_sphere_coords(theta + du, phi);
    let P_u_minus = get_corrugated_sphere_coords(theta - du, phi);
    let P_v_plus = get_corrugated_sphere_coords(theta, phi + dv);
    let P_v_minus = get_corrugated_sphere_coords(theta, phi - dv);

    let dP_du = m4
      .subtractVectors(P_u_plus, P_u_minus)
      .map((c) => c / (2 * du));
    let dP_dv = m4
      .subtractVectors(P_v_plus, P_v_minus)
      .map((c) => c / (2 * dv));

    let normal = m4.cross(dP_du, dP_dv);
    return m4.normalize(normal);
  }
  for (let i = 0; i <= u_lines; i++) {
    let theta = (i * Math.PI) / u_lines;
    for (let j = 0; j <= v_lines; j++) {
      let phi = (j * 2 * Math.PI) / v_lines;
      let coords = get_corrugated_sphere_coords(theta, phi);
      vertexList.push(...coords);
      let normal = get_normal(theta, phi);
      normalList.push(...normal);
    }
  }

  for (let i = 0; i < u_lines; i++) {
    for (let j = 0; j < v_lines; j++) {
      let p1 = i * (v_lines + 1) + j;
      let p2 = p1 + 1;
      let p3 = (i + 1) * (v_lines + 1) + j;
      let p4 = p3 + 1;
      indicesList.push(p1, p2, p3);
      indicesList.push(p2, p4, p3);
    }
  }

  return {
    vertices: vertexList,
    normals: normalList,
    indices: indicesList,
  };
}

function updateSurface() {
  const u = parseInt(uSlider.value);
  const v = parseInt(vSlider.value);
  const surfaceData = CreateSurfaceData(u, v);
  surface.BufferData(
    surfaceData.vertices,
    surfaceData.normals,
    surfaceData.indices
  );
  draw();
}

function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram("Phong", prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
  shProgram.iAttribNormal = gl.getAttribLocation(prog, "normal");
  shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
  shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");
  shProgram.iNormalMatrix = gl.getUniformLocation(prog, "NormalMatrix");
  shProgram.iLightPos = gl.getUniformLocation(prog, "light_position");
  shProgram.iColor = gl.getUniformLocation(prog, "color");

  surface = new Model("Surface");
  const surfaceData = CreateSurfaceData(
    parseInt(uSlider.value),
    parseInt(vSlider.value)
  );
  surface.BufferData(
    surfaceData.vertices,
    surfaceData.normals,
    surfaceData.indices
  );

  gl.enable(gl.DEPTH_TEST);
}

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

function init() {
  uSlider = document.getElementById("u-slider");
  vSlider = document.getElementById("v-slider");
  uSlider.addEventListener("input", updateSurface);
  vSlider.addEventListener("input", updateSurface);

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
    initGL();
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not initialize the WebGL graphics context: " +
      e +
      "</p>";
    return;
  }

  spaceball = new TrackballRotator(canvas, draw, 0);

  window.requestAnimationFrame(animate);
}
