var BoardZoomer = {
  locked: false,
  rootSelection: null,  
  boardSelection: null, 
  zoomBehavior: null,
  parsedPreLockTransform: null,

  setUpZoomOnBoard: function(boardSel, rootGroupSel) {
    // Make x and y scaling functions that just returns whatever is passed into 
    // them (same domain and range).
    var width = 768, height = 1024;

    var x = d3.scale.linear()
      .domain([0, width])
      .range([0, width]);

    var y = d3.scale.linear()
      .domain([0, height])
      .range([height, 0]);

    BoardZoomer.zoomBehavior = 
    d3.behavior.zoom().x(x).y(y).scaleExtent([0.00390625, 4])
      .on("zoom", BoardZoomer.syncZoomEventToTransform);

    BoardZoomer.boardSelection = boardSel;
    
    // When zoom and pan gestures happen inside of #boardSVG, have it call the 
    // zoom function to make changes.
    BoardZoomer.boardSelection.call(BoardZoomer.zoomBehavior);

    BoardZoomer.rootSelection = rootGroupSel;
  },
  // This function applies the zoom changes to the <g> element rather than
  // the <svg> element because <svg>s do not have a transform attribute. 
  // The behavior is connected to the <svg> rather than the <g> because then
  // dragging-to-pan doesn't work otherwise. Maybe something cannot be 
  // transformed while it is receiving drag events?
  syncZoomEventToTransform: function() {
    if (!BoardZoomer.locked) {
      BoardZoomer.rootSelection.attr('transform', 
        "translate(" + d3.event.translate + ")" + 
        " scale(" + d3.event.scale + ")");
    }
  },
  resetZoom: function() { 
    if (!BoardZoomer.locked) {
      rootSelection.attr('transform', "translate(0, 0) scale(1)");
    }
  },
  lockZoomToDefault: function() {
    // console.log("locked to default!");
    BoardZoomer.resetZoom();
    BoardZoomer.locked = true;
  },
  lockZoom: function() {
    // console.log("locked!");
    BoardZoomer.locked = true;
  },
  unlockZoom: function() {
    BoardZoomer.locked = false;
    // If parsedPreLockTransform is set, restore the zoom transform to that.
    if (BoardZoomer.parsedPreLockTransform) {
      BoardZoomer.tweenToNewZoom(BoardZoomer.parsedPreLockTransform.scale, 
        BoardZoomer.parsedPreLockTransform.translate, 300);
      BoardZoomer.parsedPreLockTransform = null;
    }
  },
  lockZoomToDefaultCenterPanAtDataCoords: function(d) {
    // unlockZoom will restore the zoom transform to this.
    BoardZoomer.parsedPreLockTransform = 
      BoardZoomer.parseScaleAndTranslateFromTransformString(
        BoardZoomer.rootSelection.attr('transform'));

    BoardZoomer.panToCenterOnRect(d);

    BoardZoomer.lockZoom();
  },
  panToCenterOnRect: function(rect) {
    console.log("Centering to rect:", rect);
    var boardWidth = parseInt(BoardZoomer.boardSelection.attr('width'));
    var boardHeight = parseInt(BoardZoomer.boardSelection.attr('height'));

    BoardZoomer.tweenToNewZoom(1, 
      [(-rect.x - rect.width/2 + boardWidth/2), 
      (-rect.y - rect.height/2 + boardHeight/2)], 300);
  },  

  zoomToFitAll: function(elementArray, padding, boardSize, tweenTime) {

    if (BoardZoomer.locked || elementArray.length < 1) {
      // Nothing to do.
      return;
    }

    var enclosingBounds = _.reduce(elementArray, function(memo, element) {
      
      if (!element) {
        return memo;
      }
      
      var elementLeft = 0;
      var elementRight = 0;
      var elementTop = 0;
      var elementBottom = 0;
      
      if (element.x !== undefined) {
        elementLeft = element.x;
        elementRight = elementLeft + element.width;
      }
      else if (element.cx !== undefined) {
        // This is a circle. TODO, maybe: Handle ellipses.
        elementLeft = $(element).attr('cx') - $(element).attr('r');
        elementRight = 
          parseFloat($(element).attr('cx')) + parseFloat($(element).attr('r')); 
      }

      if (element.y !== undefined) {
        elementTop = element.y;
        elementBottom = elementTop + element.height;
      }
      else if (element.cy !== undefined) {
        elementTop = $(element).attr('cy') - $(element).attr('r');
        elementBottom = 
          parseFloat($(element).attr('cy')) + parseFloat($(element).attr('r')); 
      }
      // console.log(elementLeft, elementTop, elementRight, elementBottom);
      
      if (elementLeft < memo.left) {
        memo.left = elementLeft;
      }
      if (elementTop < memo.top) {
        memo.top = elementTop;
      }
      if (elementRight > memo.right) {
        memo.right = elementRight;
      }
      if (elementBottom > memo.bottom) {
        memo.bottom = elementBottom;
      }
      
      return memo;
    }, 
    { left: 9999999, top: 9999999, right: 0, bottom: 0 });

    // console.log(enclosingBounds);

    var boardWidth = boardSize[0];
    var boardHeight = boardSize[1];
    var boundsWidth = enclosingBounds.right - enclosingBounds.left + padding;
    var boundsHeight = enclosingBounds.bottom - enclosingBounds.top + padding;
    var newScaleX = 1.0;
    var newScaleY = 1.0;

    if (boundsWidth > 0) {
      newScaleX = boardWidth/boundsWidth;
    }
    if (boundsHeight > 0) {
      newScaleY = boardHeight/boundsHeight;
    }

    var newScale = newScaleX;   
    if (newScaleY < newScale) {
      newScale = newScaleY;
    }
    
    // var svgNS = $('#svgBoard')[0].namespaceURI;
    // var debugRect = document.createElementNS(svgNS, 'rect');
    // debugRect.setAttribute('x', enclosingBounds.left);
    // debugRect.setAttribute('y', enclosingBounds.top);
    // debugRect.setAttribute('width', enclosingBounds.right - enclosingBounds.left);
    // debugRect.setAttribute('height', enclosingBounds.bottom - enclosingBounds.top);
    // $('#rootGroup').append(debugRect);    

    // newScale = 1.0;
    var centerX = (enclosingBounds.right - enclosingBounds.left)/2;
    var offsetXFromBoardCenter = boardWidth/2 - centerX;
    var centerY = (enclosingBounds.right - enclosingBounds.left)/2;
    var offsetYFromBoardCenter = boardHeight/2 - centerY;
    var newTranslateX = offsetXFromBoardCenter/2 * newScale;
    var newTranslateY = offsetYFromBoardCenter/2 * newScale;
    BoardZoomer.tweenToNewZoom(newScale, [newTranslateX, newTranslateY], 500);
  },

  // newTranslate should be a two-element array corresponding to x and y in 
  // the translation.
  tweenToNewZoom: function(newScale, newTranslate, time) {
    var oldTransform = BoardZoomer.rootSelection.attr('transform');

    d3.transition().duration(time).tween("zoom", function() {
      var oldScale = 1.0;
      var oldTranslate = [0, 0];
      if (oldTransform) {
        var parsed = 
          BoardZoomer.parseScaleAndTranslateFromTransformString(oldTransform);
        oldScale = parsed.scale;
        oldTranslate = parsed.translate;
      }
      // console.log("oldScale, newScale, oldTranslate", oldScale, newScale, oldTranslate);
      var interpolateScale = d3.interpolate(oldScale, newScale);
      interpolateTranslation = d3.interpolate(oldTranslate, newTranslate);

      return function(t) {
        // This updates the behavior's scale so that the next time a zoom
        // happens, it starts from here instead of jumping back to what it
        // thought it was last time.        
        // The translate is applied after the scale is applied, so we need to
        // apply the scaling to the behavior ourselves.       
        var currentScale = interpolateScale(t);
        BoardZoomer.zoomBehavior.scale(currentScale);
        // Same with the translate.
        var currentTranslate = interpolateTranslation(t);
        BoardZoomer.zoomBehavior.translate(currentTranslate);

        // This sets the transform on the root <g> and changes the zoom and
        // panning.
        BoardZoomer.rootSelection.attr('transform', 
          "translate(" + currentTranslate[0] + ", " + currentTranslate[1] + ")" + 
          " scale(" + currentScale + ")");         
      };
    });   
  },

  // Returns dict in the form 
  // { scale: int, translate: [translateX, translateY] }
  parseScaleAndTranslateFromTransformString: function(transformString) {
    var parsed = { scale: 1.0, translate: [0, 0] };

    if (transformString && (transformString.length > 0)) {    
      var translateEndDelimiter = ')';
      // Transform string will be in the form of "translate(0, 0) scale(1)".
      // Scale may be missing, though.
      var scalePiece = transformString.split('scale(')[1];
      if (scalePiece) {
        parsed.scale = parseFloat(scalePiece.substr(0, scalePiece.length - 1));
        translateEndDelimiter = ') ';
      }
      
      var translateFragments = 
        transformString.split(translateEndDelimiter)[0].split(',');
      parsed.translate = [
        // Chop out "translate(".
        parseFloat(translateFragments[0].substr(10)),
        parseFloat(translateFragments[1])
      ];
      if (!parsed.translate[1]) {
        console.log("Got NaN out of", translateFragments);
      }
    }
    return parsed;
  },

  centerOfViewport: function() {
    var scaleAndTranslate = 
      BoardZoomer.parseScaleAndTranslateFromTransformString(
        BoardZoomer.rootSelection.attr('transform'));
    var boardWidth = parseInt(BoardZoomer.boardSelection.attr('width'));
    var boardHeight = parseInt(BoardZoomer.boardSelection.attr('height'));

    return [(-scaleAndTranslate.translate[0] + boardWidth/2)/scaleAndTranslate.scale, 
      (-scaleAndTranslate.translate[1] + boardHeight/2)/scaleAndTranslate.scale];
  }
}
