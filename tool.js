"use strict";

/* ****************************************************************************
  js.js uses instant references to the Tool constructor; load this file before
  the other
**************************************************************************** */

var Tool = (function() {

  // defines a tool with different event handlers and cursor styles
  function Tool(
    handleMouseDown, handleMouseMove, handleMouseUp, redrawCursor
  ) {
    if (!new.target) {
      throw new TypeError(
        "'Tool' must be called as a constructor"
      );
    } else if (arguments.length < 4) {
      throw new TypeError(
        "Could not execute 'Tool': 4 arguments are required, " +
        "but only " + arguments.length + " provided"
      );
    }
    for (var i = 0; i < arguments.length; i++) {
      if (!(typeof arguments[i] == "function")) {
        throw new TypeError(
          "Could not execute 'Tool': argument " + i + " is not of type " +
          "'function'"
        );
      }
    }
  
    this.handleMouseDown = handleMouseDown.bind(this);
    this.handleMouseMove = handleMouseMove.bind(this);
    this.handleMouseUp   = handleMouseUp  .bind(this);
    this.redrawCursor    = redrawCursor;
  }

  // static variables that should stay the same between tools (some might not
  // use all of them)
  // the user may change these

  // properties used to define stroke/fill styles
  Tool.width = 8;
  Tool.lineCap = "round";
  Tool.lineJoin = "round";
  Tool.lineColor = "#000";
  Tool.fillColor = "#000";
  // whether or not to set the globalCompositeOperation to destionation-out when
  // creating a path
  Tool.erase = false;
  // whether or not to call CanvasRenderingContext2D.prototype.fill after drawing
  // a path
  Tool.fill = false;
  Tool.alias = false;
  // whether or not to call the mousemove handler of a tool, activated by a
  // mousedown and disabled by a mouseup
  Tool.active = false;
  // list of coordinate pairs that define points at which to draw points for a
  // path
  Tool.points = [];
  // reference to the current tool used (normal variable assignment will not
  // create a copy of an object)
  Tool.currentTool = undefined;

  // sets the width to a different number; normal variable assignement should
  // not be used elsewhere since the cursor would not update
  Tool.setWidth = function(newWidth) {
  
    // converts newWidth into a whole number or instead 0
    Tool.width = Math.max(parseInt(newWidth), 0);
  
    Tool.currentTool.redrawCursor(Tool.width);
    
  };
  
  // sets the current tool
  Tool.setCurrentTool = function(tool) {
  
    if (!(tool instanceof Tool)) {
      throw new TypeError(
        "Could not execute 'Tool.setCurrentTool': " +
        "argument 1 is not an instance of 'Tool'"
      );
    }
    
    // remove the current event listeners before adding new ones and changing
    // the current tool
    if (Tool.currentTool) {
      // drawingArea defined in js.js
      drawingArea.removeEventListener(
        "mousedown", Tool.currentTool.handleMouseDown, false
      );
      document.removeEventListener(
        "mousemove", Tool.currentTool.handleMouseMove, false
      );
      document.removeEventListener(
        "mouseup"  , Tool.currentTool.handleMouseUp  , false
      );
    }
    
    drawingArea.addEventListener("mousedown", tool.handleMouseDown, false);
       document.addEventListener("mousemove", tool.handleMouseMove, false);
       document.addEventListener("mouseup"  , tool.handleMouseUp  , false);
    
    Tool.currentTool = tool;
    
  };

  return Tool;

})();