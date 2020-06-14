"use strict";

// defined in init
var frameCanvas;
var frameContext;
var bufferCanvas;
var bufferContext;
var drawingCanvas;
var drawingContext;

var drawingArea;

var brushCursor;

var frameContainer;

// objects that contain children of dialogs, defined in init
var frameInfoDialog;
var toolInfoDialog;
var gifSettingsDialog;

var layer;
var layerCloseButton;

// used to time render speed
var initialRenderTime = -1;

var settings = {
  // dimensions, in pixels
  width: 800,
  height: 600,
  
  defaultDelay: 100
};

var brush = new Tool(
  // mousedown
  // an event object will be passed to this function
  function(event) {
    if (event.button === 0) {
      initializeDrawingContextStyle();
      
      // functions are bound to the tool
      this.draw(event);
      Tool.active = true;
    }
  },
  
  // mousemove
  function(event) {
    if (event.button === 0 && Tool.active) {
      this.draw(event);
    }
  },
  
  // mouseup
  function(event) {
    // if Tool.points is not empty
    if (Tool.points.length > 0) {
      // disable draw on mousemove
      Tool.active = false;
      
      clearContext(drawingContext);
  
      // transfer from drawingContext to bufferContext
    
      // stroke settings
      // bufferContext defined in js.js
      
      initializeBufferContextStyle();
    
      // draw the path
      bufferContext.beginPath();
      bufferContext.moveTo(Tool.points[0].x, Tool.points[0].y);
    
      for (var i = 0; i < Tool.points.length; i++) {
        bufferContext.lineTo(Tool.points[i].x, Tool.points[i].y);
      }
      bufferContext.stroke();
      if (Tool.fill) {
        bufferContext.fill();
      }
      
      // aliasing
      if (Tool.alias) {
        aliasBuffer();
      }

      Tool.points = [];
      
      transferBufferToFrame();
    }
  },
  
  // redrawcursor
  function(width) {
    
    brushCursor.width = width + 4; // 2px on each side
    brushCursor.height = width + 4;
    
    var center = {
      x: brushCursor.width / 2,
      y: brushCursor.height / 2
    };
    
    brushCursor.style.marginTop = -center.x + "px";
    brushCursor.style.marginLeft = -center.y + "px";
    
    var brushCursorContext = brushCursor.getContext("2d");
    
    brushCursorContext.lineWidth = 1;
  
    // draw big circle
    brushCursorContext.strokeStyle = "#333";
    
    brushCursorContext.beginPath();
    brushCursorContext.arc(
      center.x,
      center.y,
      width / 2 + 1,
      0,
      2 * Math.PI
    );
    
    var crosshairRadius = Math.min(4, Math.floor(width / 4));
    
    brushCursorContext.moveTo(
      center.x - crosshairRadius,
      center.y
    );
    brushCursorContext.lineTo(
      center.x + crosshairRadius,
      center.y
    );
    
    brushCursorContext.moveTo(
      center.x,
      center.y - crosshairRadius
    );
    brushCursorContext.lineTo(
      center.x,
      center.y + crosshairRadius
    );
    
    brushCursorContext.stroke();
    
    // draw small circle
    brushCursorContext.strokeStyle = "#fff";
    
    brushCursorContext.beginPath();
    
    brushCursorContext.arc(
      brushCursor.width / 2,
      brushCursor.height / 2,
      width / 2,
      0,
      2 * Math.PI
    );
    
    brushCursorContext.stroke();
  
  }
  
);
  
brush.draw = function(event) {
  
  var coords = getCoordsRelativeToElement(event, frameContainer);
  
  Tool.points.push(coords);
    
  if (Tool.active && Tool.points[Tool.points.length - 2]) {
    drawingContext.beginPath();
    drawingContext.moveTo(
      // - 2, -1 for length being one higher than max index and -1 for
      // selecting previous coordinates
      Tool.points[Tool.points.length - 2].x,
      Tool.points[Tool.points.length - 2].y
    );
    drawingContext.lineTo(coords.x, coords.y);
    drawingContext.stroke();
  }
  
};

var rect = new Tool(
  
  function(event) {
    if (event.button === 0) {
      initializeDrawingContextStyle();
      
      var coords = getCoordsRelativeToElement(event, frameContainer);
      
      if (Tool.points.length <= 0) {
        Tool.active = true;
      }
      
      Tool.points.push(coords);
      
      if (Tool.points.length >= 2) {
        Tool.active = false;
        
        clearContext(drawingContext);
        
        initializeBufferContextStyle();
        
        rect.draw(event, bufferContext);
        
        // aliasing
        if (Tool.alias) {
          aliasBuffer();
        }

        Tool.points = [];

        transferBufferToFrame();
      }
    }
  },
  
  function(event) {
    if (Tool.active) {
      clearContext(drawingContext);
      
      rect.draw(event, drawingContext);
    }
  },
  
  // empty onmouseup
  function() {
    return undefined;
  },
  
  brush.redrawCursor
  
);

rect.draw = function(event, context) {
  var coords = getCoordsRelativeToElement(event, frameContainer);
  
  if (Tool.fill) {
    context.fillRect(
      Tool.points[0].x,
      Tool.points[0].y,
      coords.x - Tool.points[0].x,
      coords.y - Tool.points[0].y
    );
  }
      
  context.strokeRect(
    Tool.points[0].x,
    Tool.points[0].y,
    coords.x - Tool.points[0].x,
    coords.y - Tool.points[0].y
  );
};

var animation = {
  // array of images
  frames: [],
  
  calculateDuration: function() {
    var totalDuration = 0;
    
    for (var i = 0; i < this.frames.length; i++) {
      totalDuration += parseInt(this.frames[i].getAttribute("data-delay"));
    }
    
    return totalDuration;
  }
};

// object containing various values pertaining to the user's view
var view = {
  currentFrame: 0,
  
  // ImageData array
  versionHistory: [],
  // -1 because it will increment to 0 during record
  currentVersion: -1
};

function renderGIF(options) {
  // using gif.js by jnordberg - https://github.com/jnordberg/gif.js
  
  // check if the GIF rendering has already started; if it has, then
  // initialRenderTime should be greater than -1; this value is reset in the
  // onfinished event listener
  if (initialRenderTime > -1) {
    // return terminates the function
    return;
  }
  
  // create options object if not provided
  if (!options) {
    options = {};
  }
    
  options.width = settings.width;
  options.height = settings.height;
  
  var repeatsInputValue = gifSettingsDialog.repeatsInput.value;
  if (repeatsInputValue == "0") {
    options.repeat = -1;
  } else if (repeatsInputValue == "-1") {
    options.repeat = 0;
  } else {
    options.repeat = Math.max(parseInt(repeatsInputValue), -1);
  }
  
  var ditherDropdownValue = gifSettingsDialog.dither.value;
  if (ditherDropdownValue && gifSettingsDialog.ditherCheck.checked) {
    ditherDropdownValue += "-serpentine";
  }
  options.dither = ditherDropdownValue;
  
  var qualityInputValue = gifSettingsDialog.qualityInput.value;
  options.quality = Math.max(parseInt(qualityInputValue), 1);
  
  options.debug = true;
    
  var gif = new GIF(options);
  
  // gif.render() is used in iteration via a function, the listener is defined
  // beforehand
  gif.on("finished", function(blob) {
    // calculate render time
    var renderTime = new Date - initialRenderTime;
    
    initialRenderTime = -1;
  
    emptyLayerElement();
  
    console.log("Completed rendering GIF:", blob);
    
    // generate the gif view box
    var url = URL.createObjectURL(blob);
    
    var image = new Image;
    image.className = "gif";
    
    image.src = url;
    
    // generate the GIF details table
    var gifDetails = document.createElement("div");
    gifDetails.className = "gif-details";
    
    var gifDetailsTable = document.createElement("div");
    
    gifDetailsTable.className = "table";
    
    buildTableGroup(
      gifDetailsTable,
      
      ["Size"         , blob.size.toLocaleString() + " B"                    ,
       "Frames"       , animation.frames.length                              ,
       "Render speed" , renderTime.toLocaleString() + "ms"                   ],
      
      ["Width"        , settings.width + "px"                                ,
       "Duration"     , animation.calculateDuration().toLocaleString() + "ms",
       "Workers"      , options.workers || 2                                 ],
      
      ["Height"       , settings.height + "px"                               ,
       "Dithering"    , options.dither || "none"                             ,
       "Interval size", options.quality + "px"                               ],
       
      [""             , ""                                                   ,
       "Repeats"      , repeatsInputValue == -1 ? "infinite" : options.repeat,
       ""             , ""                                                   ]
    );
    
    // uses arguments list
    function buildTableGroup(tableElement, /*dataPairs...*/) {
      var tableGroup = document.createElement("div");
      tableGroup.className = "group";
      
      for (var i = 1; i < arguments.length; i++) {
        var tableRow = document.createElement("div");
        tableRow.className = "item data";
      
        for (var j = 0; j < arguments[i].length; j++) {
          var tableDataCell = document.createElement("div");
          
          // label if even, content if odd
          tableDataCell.className = j % 2 == 0 ? "label" : "content";
          
          tableDataCell.textContent = arguments[i][j];
        
          tableRow.appendChild(tableDataCell);
        }
      
        tableGroup.appendChild(tableRow);
      }
      
      tableElement.appendChild(tableGroup);
    }
    
    function toFixedLocaleString(number, decimalPoints) {
      return number.toLocaleString(
        undefined,
        {minimumFractionDigits: decimalPoints}
      );
    }
    
    gifDetails.appendChild(gifDetailsTable);
    
    layer.appendChild(image);
    layer.appendChild(gifDetails);
    
    // to better performance, object URLs should be revoked after usage; it is
    // not revoked until the layer is closed so that users may download the
    // file while the layer is open
    function revokeImageURL() {
      URL.revokeObjectURL(image);
      layerCloseButton.removeEventListener("click", revokeImageURL, false);
    }
    layerCloseButton.addEventListener("click", revokeImageURL, false);
    
    // finish laying out the layer content else before showing the layer
    layer.className = "layer";
  });
    
  // assign a white background to each frame image (continued during the
  // iteration, using the same canvas/context for each edit)
    
  // without this, each frame would have a black background in the place of
  // transparent pixels
  var canvas = document.createElement("canvas");
  // canvas dimensions must be reset
  canvas.width = settings.width;
  canvas.height = settings.height;
  var context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  
  // this iteration contains an event listener, so a for loop cannot be used
  var i = 0;
  function iterateFrame() {
    clearContext(context);
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(animation.frames[i], 0, 0);
    
    // create a new image object to be added to the GIF
    var image = new Image;
    image.src = canvas.toDataURL();
    
    function handleLoad() {
      gif.addFrame(image, {
        delay: parseInt(animation.frames[i].getAttribute("data-delay"))
      });
      
      i++;
      if (i < animation.frames.length) {
        iterateFrame();
      } else {
        // setup timer for timing render speed
        initialRenderTime = new Date;
      
        gif.render();
        // continue renderGIF in the event listener
      }
    }
    
    image.addEventListener("load", handleLoad, false);
  }
  iterateFrame();
}

function viewVersion(versionNumber) {
  // if versionNumber does not exist
  if (versionNumber >= view.versionHistory.length) {
    throw new RangeError(
      "version number " + versionNumber + " does not exist"
    );
  }
  // if versionNumber is negative
  if (versionNumber < 0) {
    throw new RangeError("version number " + versionNumber + " is negative");
  }
  // if frameNumber is not a number
  if (isNaN(versionNumber)) {
    throw new RangeError("version number " + versionNumber + " is not a number");
  }
  
  clearContext(frameContext);
  
  view.currentVersion = parseInt(versionNumber) || 0;
  frameContext.putImageData(view.versionHistory[view.currentVersion], 0, 0);
  
  updateCurrentFrame();
}

// shift the view to a different frame, automatically creates a new frame if it
// does not exist
function viewFrame(frameNumber) {
  // if frameNumber is two higher than the current frame ID maximum
  if (frameNumber > animation.frames.length) {
    throw new RangeError(
      "new frame ID, " + frameNumber + ", cannot be higher than the " +
      "current array length, " + animation.frames.length
    );
  }
  // if frameNumber is negative
  if (frameNumber < 0) {
    throw new RangeError("frame number, " + frameNumber + ", is negative");
  }
  // if frameNumber is not a number
  if (isNaN(frameNumber)) {
    throw new RangeError("frame number, " + frameNumber + ", is not a number");
  }

  view.currentFrame = parseInt(frameNumber) || 0;
  
  // update the onion images
  var onions = document.querySelectorAll(".frame-container .onion");
  // iterate through the onions 
  for (var i = 0; i < onions.length; i++) {
    var currentOnion = onions[i];
    
    var previousFrame = animation.frames[view.currentFrame - i - 1];
    if (previousFrame) {
      currentOnion.src = previousFrame.src;
    } else {
      // base64 image of a 1-by-1 transparent PNG
      currentOnion.src =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJA" +
        "AAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=";
    }
  }
  
  clearContext(frameContext);
  
  var currentFrameImage = getCurrentFrameImage();
  
  // so that the new frame does not vanish if Tool.erase is true
  frameContext.globalCompositeOperation = "source-over";
  if (currentFrameImage) {
    // draw the existing frame onto the canvas
    frameContext.drawImage(getCurrentFrameImage(), 0, 0);
  }
  
  // reset version history
  view.versionHistory = [];
  // -1 because it will increment to 0 during record
  view.currentVersion = -1;
  
  // append a new frame onto animation.frames
  updateCurrentFrame();
  recordVersion();
}
  
// add the image to the version history
function recordVersion() {
  // TODO: call this function in necessary areas
  
  view.currentVersion++;
  
  view.versionHistory = view.versionHistory.slice(0, view.currentVersion);
  
  view.versionHistory.push(
    frameContext.getImageData(0, 0, frameCanvas.width, frameCanvas.height)
  );
}

// update a frame's ImageData in animation.frames
function updateCurrentFrame() {
  var image = new Image;
  
  image.src = frameCanvas.toDataURL();
  
  // nonstandard property, used for storing frame duration
  
  // the first conditional exists for new frames where getCurrentFrameImage
  // returns undefined; if it is undefined, the second conditional is not
  // checked and a 'property of undefined' error is not thrown
  if (
      !getCurrentFrameImage()
   || !getCurrentFrameImage().getAttribute("data-delay")
  ) {
    image.setAttribute("data-delay", settings.defaultDelay);
  } else {
    image.setAttribute(
      "data-delay",
      getCurrentFrameImage().getAttribute("data-delay")
    );
  }
  
  animation.frames[view.currentFrame] = image;
  
  // update frame info bar
  updateDialogBoxes();
}

function updateDialogBoxes() {
  // innerHTML is insecure
  frameInfoDialog.number.textContent = view.currentFrame + 1;
  
  frameInfoDialog.numberOutOf.textContent = "/" + animation.frames.length;
  
  frameInfoDialog.delayInput.value =
    getCurrentFrameImage().getAttribute("data-delay");
  
  
}

function refreshCurrentFrame() {
  viewFrame(view.currentFrame);
}
  
function getCurrentFrameImage() {
  return animation.frames[view.currentFrame];
}

// return an object with properties x and y that show the position of a
// MouseEvent relative to its target
function getCoordsRelativeToElement(event, referenceElement) {
  if (!referenceElement) {
    referenceElement = event.target;
  }
  
  var rectObject = referenceElement.getBoundingClientRect();

  return {
    x: event.pageX - rectObject.left,
    y: event.pageY - rectObject.top
  };
}

function resizeDrawing(width, height) {
  width = Math.max(1, width);
  height = Math.max(1, height);
  
  settings.width = width;
  settings.height = height;
  
  // document.querySelector(".frame-container").childNodes includes text nodes in Chrome
  var drawingElements = document.querySelectorAll(".frame-container > *");
  // starting at 1 since <div> dimensions are set separately through CSS
  for (var i = 1; i < drawingElements.length; i++) {
    drawingElements[i].width = width;
    drawingElements[i].height = height;
  }
  
  // CSS dimensions must have specified units
  drawingElements[0].style.width = width + "px";
  drawingElements[0].style.height = height + "px";
  
  frameContainer = document.querySelector(".frame-container");
  frameContainer.style.width = width + "px";
  frameContainer.style.height = height + "px";
}

// horizontalPixels: positive = right,
// verticalPixels:   positive = down
function shiftViewport(horizontalPixels, verticalPixels) {
  // inline CSS defines top and left already, so that an empty string does
  // not result in NaN
  frameContainer.style.left =
    (parseInt(frameContainer.style.left) + horizontalPixels) + "px";
  
  frameContainer.style.top =
    (parseInt(frameContainer.style.top) + verticalPixels) + "px";
}

function isInput(element) {
  // if the element with focus is an <input />
  return (
    (element.tagName.toLowerCase() === "input"
  // or the element with focus is a <textarea />
  || element.tagName.toLowerCase() === "textarea"
  ) // and if the text box is not disabled
        
&& !element.disabled);
}

function makeElementDraggable(element) {
  // getComputedStyle tracks both stylesheets and inline styles
  if (!(getComputedStyle(element).position === "absolute")) {
    throw new TypeError("element must be absolutely positioned");
  }
  
  var initialOffsetCoords = {
    x: -1,
    y: -1
  };
  
  element.style.cursor = "move";

  // addEventListener does not override previous event listeners
   element.addEventListener("mousedown", handleMouseDown, false);
  document.addEventListener("mouseup"  , handleMouseUp  , false);
  
  function handleMouseMove(event) {
    // this does NOT equal -initialOffsetCoords.x
    element.style.left = (event.clientX - initialOffsetCoords.x) + "px";
    element.style.top  = (event.clientY - initialOffsetCoords.y) + "px";
  }
  
  function handleMouseDown(event) {
    // to avoid dragging on selection
    if (!isInput(event.target) && event.button === 0) {
    
      initialOffsetCoords.x = event.clientX - parseInt(element.offsetLeft);
      initialOffsetCoords.y = event.clientY - parseInt(element.offsetTop );
  
      document.addEventListener("mousemove", handleMouseMove, true);
      
    }
  }
  
  function handleMouseUp() {
    document.removeEventListener("mousemove", handleMouseMove, true);
  }
}

// remainder = amount of children (starting from first) to keep
function removeChildNodesOf(element, remainder) {
  remainder = Math.max(remainder, 0);

  while (element.childNodes.length > remainder + 1) {
    element.removeChild(element.lastChild);
  }
}

// clear all elements except the close button
function emptyLayerElement() {
  removeChildNodesOf(layer, 1);
}

function aliasBuffer(alphaThreshold) {
  alphaThreshold = Math.max(parseInt(alphaThreshold), 0);
  
  var imageData =
    bufferContext.getImageData(0, 0, bufferCanvas.width, bufferCanvas.height);
      
  for (var i = 0; i < imageData.data.length; i += 4) {
    // if alpha > alphaThreshold, make opaque; transparent otherwise
    if (imageData.data[i + 3] > alphaThreshold) {
      imageData.data[i + 3] = 255;
    } else { 
      imageData.data[i + 3] = 0;
    }
  }
  
  return imageData;
}

function clearContext(context) {
  context.clearRect(
    0,
    0,
    context.canvas.width,
    context.canvas.height
  );
}
  
function initializeDrawingContextStyle() {
  drawingContext.lineWidth = Tool.width;
  drawingContext.lineCap   = Tool.lineCap;
  drawingContext.lineJoin  = Tool.lineJoin;
      
  // black line if not erasing, red otherwise
  if (!Tool.erase) {
    drawingContext.strokeStyle = "#000";
    drawingContext.fillStyle = "#000";
  } else {
    drawingContext.strokeStyle = "#f00";
    drawingContext.fillStyle = "#f00";
  }
}

function initializeBufferContextStyle() {
  bufferContext.lineWidth   = Tool.width;
  bufferContext.lineCap     = Tool.lineCap;
  bufferContext.lineJoin    = Tool.lineJoin;
  bufferContext.strokeStyle = Tool.lineColor;
  bufferContext.fillStyle   = Tool.fillColor;
}

function setEraserCompositeOperation() {
  // change globalCompositeOperation if erasing
  frameContext.globalCompositeOperation =
    Tool.erase ? "destination-out" : "source-over";
}

function transferBufferToFrame() {
  setEraserCompositeOperation();
      
  // draw onto frameContext
  frameContext.drawImage(bufferCanvas, 0, 0);
  
  clearContext(bufferContext);
    
  recordVersion();
  updateCurrentFrame();
}

function init() {
  // get the <canvas>s and their context
  frameCanvas = document.querySelector(".frame-container .frame");
  frameContext = frameCanvas.getContext("2d");
  bufferCanvas = document.querySelector(".frame-container .buffer");
  bufferContext = bufferCanvas.getContext("2d");
  drawingCanvas = document.querySelector(".frame-container .drawing");
  drawingContext = drawingCanvas.getContext("2d");
  
  resizeDrawing(settings.width, settings.height);
  
  // frameinfo
  // this must go before updateCurrentFrame
  frameInfoDialog = {
      container: document.querySelector(".frame-info"),
    
         number: document.querySelector(".frame-info .number"),
    numberOutOf: document.querySelector(".frame-info .number-outof"),
     delayInput: document.querySelector(".frame-info .delay > input")
  };
  
  // toolinfo
  toolInfoDialog = {
     container: document.querySelector(".tool-info"),
    
    widthInput: document.querySelector(".tool-info .width > input"),
    eraseCheck: document.querySelector(".tool-info .erase"),
     fillCheck: document.querySelector(".tool-info .fill"),
    aliasCheck: document.querySelector(".tool-info .alias")
  };
  
  // gifsettings
  gifSettingsDialog = {
       container: document.querySelector(".gif-settings"),
      
    repeatsInput: document.querySelector(".gif-settings .repeats > input"),
          dither: document.querySelector(".gif-settings .dither"),
     ditherCheck: document.querySelector(".gif-settings .dither-serpentine"),
    qualityInput: document.querySelector(".gif-settings .quality > input")
  };
  
  // add the frame to animation.frames and record the version
  recordVersion();
  updateCurrentFrame();
  
  drawingArea = document.querySelector(".drawing-area");
  
  // attach event listeners
  Tool.setCurrentTool(brush);
  
  // update custom cursor
  brushCursor = document.querySelector(".cursor");
  
  Tool.setWidth(8);

  document.addEventListener("mousemove", updateBrushCursorPosition, false);
  
  // update hotkeys
  document.addEventListener("keydown"  , identifyHotkey , false);
     
  // update dialogs on input
  // onchange updates with checkboxes
  frameInfoDialog.container.addEventListener(
    "input", updateFrameInfo, false
  );
  toolInfoDialog.container.addEventListener(
    "input", updateToolInfo, false
  );
  toolInfoDialog.container.addEventListener(
    "change", updateToolInfo, false
  );
  
  layer = document.querySelector(".layer");
  layerCloseButton = document.querySelector(".layer .close-button");
  
  layerCloseButton.addEventListener("click", hideLayerElement, false);
  
  // hotkeys
  function identifyHotkey(event) {
    // to avoid hotkey activations during typing
    var activeElement = document.activeElement;
    if (!isInput(activeElement)) {
    
      // updateFrameInfo() is included in viewFrame and refreshCurrentFrame
  
      // no special keys
      if (!event.ctrlKey && !event.altKey) {
    
        // next/create frame (->)
        if (event.key === "ArrowRight") {
          viewFrame(view.currentFrame + 1);
        }
        // previous frame (<-)
        else if (event.key === "ArrowLeft"
              && view.currentFrame > 0) { // to avoid negative frames
          viewFrame(view.currentFrame - 1);
        }
    
        // downsize brush by 1 (-)
        else if (event.key === "-"
              && Tool.width > 1) { // to avoid 0 brush width
          Tool.setWidth(Tool.width - 1);
        }
    
        // upsize brush by 1 (shift + =)
        else if (event.key === "+") {
          Tool.setWidth(Tool.width + 1);
        }
      
        // render gif (shift + r)
        else if (event.key === "R") {
          renderGIF();
        }
      
        // duplicate frame (shift + d)
        else if (event.key === "D") {
          animation.frames.splice(
            view.currentFrame + 1,
            0,
            getCurrentFrameImage().cloneNode(true)
          );
          viewFrame(view.currentFrame + 1);
        }
      
        // delete singular frame (del)
        else if (event.key === "Delete"
              && animation.frames.length > 1) {
          animation.frames.splice(view.currentFrame, 1);
      
          // decrement frame number if the frame deleted was the final
          if (view.currentFrame >= animation.frames.length) {
            viewFrame(animation.frames.length - 1);
          } else {
            refreshCurrentFrame();
          }
        }
      
        // delete all frames from point (shift + del)
        else if (event.key === "Delete"
              && view.currentFrame > 0
              && animation.frames.length > 1) { // to avoid empty frame count
          animation.frames = animation.frames.slice(0, view.currentFrame);
      
          viewFrame(view.currentFrame - 1);
        }
      
        // shift viewport upwards by 100px (w)
        else if (event.key === "w") {
          shiftViewport(0, -100);
        }
      
        // shift viewport leftwards by 100px (a)
        else if (event.key === "a") {
          shiftViewport(-100, 0);
        }
      
        // shift viewport downwards by 100px (s)
        else if (event.key === "s") {
          shiftViewport(0, 100);
        }
      
        // shift viewport rightwards by 100px (d)
        else if (event.key === "d") {
          shiftViewport(100, 0);
        }
      
      }
      
      // ctrl
      if (event.ctrlKey && !event.altKey) {
      
        // undo (ctrl + z)
        if (event.key === "z"
         && view.currentVersion > 0) {
          viewVersion(view.currentVersion - 1);
        }
      
        // redo (ctrl + y)
        else if (event.key === "y"
         && view.currentVersion < view.versionHistory.length - 1) {
          viewVersion(view.currentVersion + 1);
        }
      
      }
    
    }
  }
  
  function updateBrushCursorPosition(event) {
    // update custom cursor
    // if hovering over drawing area
    if (event.path.indexOf(drawingArea) > -1) {
      // show custom cursor
      brushCursor.style.display = "initial";
      // document.documentElement is the <html>
      document.documentElement.style.cursor = "none";
      
      brushCursor.style.left = event.pageX + "px";
      brushCursor.style.top  = event.pageY + "px";
    } else {
      // hide custom cursor
      brushCursor.style.display = "none";
      document.documentElement.style.cursor = "initial";
    }
  }
  
  // for input fields within the frame info bar
  function updateFrameInfo() {
    // copies of objects are changed together
    getCurrentFrameImage().setAttribute(
      "data-delay",
      Math.max(1, frameInfoDialog.delayInput.value)
    );
  }
  
  // for input fields within the tool info bar
  function updateToolInfo() {
    // the validation is done in Tool.setWidth
    Tool.setWidth(toolInfoDialog.widthInput.value);
    
    Tool.erase = toolInfoDialog.eraseCheck.checked;
    Tool.fill = toolInfoDialog.fillCheck.checked;
    Tool.alias = toolInfoDialog.aliasCheck.checked;
  }
  
  function hideLayerElement() {
    layer.className = "layer inactive";
  }
  
  // make all dialog boxes draggable
  var dialogElements = document.querySelectorAll(".dialog");
  
  for (var i = 0; i < dialogElements.length; i++) {
    makeElementDraggable(dialogElements[i]);
  }
  
  positionDialogsVertically(document.querySelectorAll(".dialog.align-left"));
  positionDialogsVertically(document.querySelectorAll(".dialog.align-right"));
  
  function positionDialogsVertically(dialogNodeList) {
    var collectiveDialogHeight = 10; // default padding
  
    for (var i = 0; i < dialogNodeList.length; i++) {
      // set the CSS top before adding the current dialog's height
      dialogNodeList[i].style.top = collectiveDialogHeight + "px";
    
      collectiveDialogHeight += dialogNodeList[i].offsetHeight + 10;
    }
  }
  
  // confirm navigation dialog
  onbeforeunload = function() {
    return true;
  };
}

onload = init;