var graphSession = {
  xAxisDateStrings: [],
  stackedOrGrouped: 'grouped',
  spotlightedLayer: null,
  csvArraysForColumns: {},
  categoryFilter: null
};

var graphSettings = {
  labelMargin: 6,  
  stackedBarWidth: 100,
  margin: {
    top: 40, 
    right: 10, 
    bottom: 20, 
    left: 10
  }  
}

function isiPhone() {
  return navigator.userAgent.match(/(iPod|iPhone)/) && 
  navigator.userAgent.match(/AppleWebKit/)
}

function isiPad() {
  return navigator.userAgent.match(/iPad/) && 
  navigator.userAgent.match(/AppleWebKit/)
}

function isAndroid() {
  var ua = navigator.userAgent.toLowerCase();
  return ua.indexOf("android") > -1;
}

function panToPoint(point, boardSize) {
  var offsetXFromBoardCenter = boardSize[0]/2 - point.x;
  var offsetYFromBoardCenter = boardSize[1]/2 - point.y;
  
  BoardZoomer.tweenToNewZoom(1.0, 
    [offsetXFromBoardCenter, offsetYFromBoardCenter], 
    750);
}

function focusOnRect($rect) {
  var $graph = $('#graph');
 
  var panPoint = {x: $graph.width()/2, y: $graph.height()/2};
  if ($rect.length > 0) {
    panPoint.x = $rect.attr('x');
    panPoint.y = $rect.attr('y');
    spotlightLayer(d3.select($rect.parent()[0]).node().__data__, 
      d3.select('g#graphGroup'));
  }

  panToPoint(panPoint, [window.innerWidth, window.innerHeight]);  
}

function parseMMDDYY(dateString) {
  var dateParts = dateString.split('/');
  return new Date(dateParts[2], dateParts[0] - 1, dateParts[1])
}

function sanitizeAsId(string) {
  return string.replace(/ |:|\./g, '');
}

var layers = [];

function spotlightLayer(layerData, graphGroup) {
  graphSession.spotlightedLayer = layerData;

  graphGroup.selectAll('.layer').transition()
    .duration(500)
    .delay(function(layerData, i) { return i * 10; })
    .style('fill', getFillForLayerGroup);

  d3.select('body').transition()
    .delay(200)
    .style('background-color', '#242425')
    .style('color', '#eee');

  d3.selectAll('.tick text').transition()
    .duration(500)
    .delay(300)
    .style('fill', '#ccc');  
}

function setUpGraph(stackData) {
  graphSession.stackData = stackData;
  
  var n = stackData.length, // number of layers
      m = stackData[0].length, // number of samples per layer
      stack = d3.layout.stack(),
      layers = stack(stackData),
      yGroupMax = d3.max(layers, function(layer) { return d3.max(layer, function(d) { return d.y; }); }),
      yStackMax = d3.max(layers, function(layer) { return d3.max(layer, function(d) { return d.y0 + d.y; }); });
  // console.log(stackData);

  function clearSpotlighting() {
    graphSession.spotlightedLayer = null;
    graphGroup.selectAll('.layer').style('fill', getFillForLayerGroup)

    d3.select('body')
      .style('background-color', '#fff')
      .style('color', '#333');

    d3.selectAll('.tick text').transition()
      .duration(500)
      .delay(300)
      .style('fill', '#333');
  }

  function identifyLayer(columnArray) {
    return columnArray[0].columnName;
  }

  var width = m * graphSettings.stackedBarWidth - 
    graphSettings.margin.left - graphSettings.margin.right;

  // TODO: Media queries.
  var intendedHeight = '60%';

  if (isiPad()) {
    intendedHeight = 462;
  }
  else if (isiPhone() || isAndroid()) {
    intendedHeight = 300;
  }

  var svg = d3.select('svg#graph')    
    .attr('width', '96%')
    .attr('height', intendedHeight);

  var graphGroup = svg.select('g#graphGroup');
  if (graphGroup.empty()) {
    graphGroup = svg.append('g')
      .attr('transform', 'translate(' + graphSettings.margin.left + ',' + 
        graphSettings.margin.top + ')' + 
        ' scale(1)')
      .attr('id', 'graphGroup');
  }

  var height = 
    d3.select('#graph').node().clientHeight - graphSettings.margin.top - 
      graphSettings.margin.bottom;
  if (height < graphSettings.minimumGraphHeight) {
    height = graphSettings.minimumGraphHeight;
  }

  var x = d3.scale.ordinal()
      .domain(d3.range(m))
      .rangeRoundBands([0, width], .08);
   
  var y = d3.scale.linear()
      .domain([0, yStackMax])
      .range([height, 0]);

  var xAxis = d3.svg.axis()
    .scale(x)
    .tickSize(0)
    .tickPadding(6)
    .orient('bottom')
    .tickValues(graphSession.xAxisDateStrings);

  var layerUpdatingSelection = graphGroup.selectAll('.layer').data(layers, 
    identifyLayer);

  function layerClicked(d) {
    d3.event.stopPropagation();

    if (graphSession.spotlightedLayer === d) {
      graphSession.spotlightedLayer = null;
      clearSpotlighting();
    }
    else {
      spotlightLayer(d, graphGroup);
    }
  }

  var layer = layerUpdatingSelection
    .enter().append('g')
      .attr('class', 'layer')
      .style('fill', getFillForLayerGroup)
      .on('click', layerClicked)
      .on('touchend', layerClicked);
    
  // Need to use the touchend event here because the click event will 
  // trigger a handler on Mobile Safari if there's no zoom behavior attached, 
  // but *if there is*, the zoom behavior will stop the propagation of the click 
  // event.

  layerUpdatingSelection.exit().remove();

  d3.select('html')
    .on('click', clearSpotlighting)
    .on('touchend', clearSpotlighting);

  var textLayerUpdatingSelection = graphGroup.selectAll('.textlayer')
    .data(layers, identifyLayer);

  var textLayer = textLayerUpdatingSelection.enter().append('g')
    .attr('class', 'textlayer');

  textLayerUpdatingSelection.exit().remove();
  
  var rect = layer.selectAll('rect')
      .data(function(d) { return d; })
    .enter().append('rect')
      .attr('stroke', themes[selectedTheme].stroke)
      .attr('id', function(d) { return d.id; })
      .on('click', function rectClicked(d) {
        location.hash = d.id;
      });

  var rectLabel = textLayer.selectAll('text')
    .data(function getLabelData(d) {
      return d;
    })
    .enter().append('text')
      .attr('x', function(d) { return x(d.x); })
      .attr('y', function(d) { return y(d.y); })
      .attr('fill', function(d) {
        return themes[selectedTheme].textColor[d.category];
      })
      .classed('celllabel', true);

  transitionGrouped();

  var axisGroup = graphGroup.select('.x.axis');
  if (axisGroup.empty()) {
    axisGroup = graphGroup.append('g').attr('class', 'x axis')
    .attr('transform', 'translate(0,' + height + ')');
    axisGroup.call(xAxis);
  }
   
  d3.selectAll('#layoutform input').on('change', changeLayout);
  d3.selectAll('#filterform input').on('change', changeFilter);

  function transitionGrouped() {
    y.domain([0, yGroupMax]);

    function getXOfGroupedDatum(d, i, j) { 
      return x(d.x) + x.rangeBand() / n * j; 
    }
    function getYOfGroupedDatum(d) {
      return y(d.y);
    }
 
    rect.transition()
      .duration(500)
      .delay(function(d, i) { return i * 10; })
      .attr('x', getXOfGroupedDatum)
      .attr('width', x.rangeBand() / n)
    .transition()
      .attr('y', getYOfGroupedDatum)
      .attr('height', function(d) { return height - y(d.y); });

    rectLabel.transition()
      .duration(500)
      .transition()
      .attr('x', getXOfGroupedDatum)
      .attr('y', function getLabelYOfGroupedDatum(d) {
        // When setting this, keeping in mind this is going to be rotated 90º.
        return getYOfGroupedDatum(d) - (x.rangeBand() / n)/5;
      })
      .attr('transform', function(d, i, j) { 
        var rectX = getXOfGroupedDatum(d, i, j);
        var rectY = getYOfGroupedDatum(d);
        return 'rotate(90 ' + rectX + ' ' + rectY + ')'; 
      })
      .attr('font-size', 10)
      .selectAll('tspan').remove();

    rectLabel.append('tspan')
      .text(function getText(d) {
        return d.getLabelText();
      });

  }
   
  function transitionStacked() {
    y.domain([0, yStackMax]);

    function getHeightOfStackedDatum(d) { 
      return y(d.y0) - y(d.y0 + d.y); 
    }
    function getYOfStackedDatum(d) {
      return y(d.y0 + d.y); 
    }
   
    var allRectsInGraph = graphGroup.selectAll('rect');
    allRectsInGraph.transition()
        .duration(500)
        .delay(function(d, i) { return i * 10; })
        .attr('y', getYOfStackedDatum)
        .attr('height', getHeightOfStackedDatum)
      .transition()
        .attr('x', function(d) { return x(d.x); })
        .attr('width', x.rangeBand());

    var allCellLabelsInGraph = graphGroup.selectAll('.celllabel');
    allCellLabelsInGraph.transition()
      .duration(500)
      .transition()
        .attr('x', function(d) { return x(d.x) + graphSettings.labelMargin; })
        .attr('y', function(d) { 
          return getYOfStackedDatum(d) + getHeightOfStackedDatum(d)/2;
        })
        .attr('transform', function(d) { return 'rotate:(0) translate(0, 0)'; })
        .attr('font-size', 14)
        .selectAll('tspan').remove();

    rectLabel.each(function makeTspanPerWord(d) {
      var cellText = d.getLabelText();
      if (cellText) {
        var words = cellText.split(' ');
        for (var i = 0; i < words.length; ++i) {
          d3.select(this).append('tspan')
            .text(words[i])
            .attr({
              x: x(d.x)  + graphSettings.labelMargin, // This is the parent <text>'s x.
              dy: i * 16
            });
        }
      }
    });

  }

  var timeout = setTimeout(function() {
    d3.select('input[value=\'stacked\']').property('checked', true).each(
      changeLayout);
  }, 2000);
   
  function changeLayout() {
    clearTimeout(timeout);

    graphSession.stackedOrGrouped = this.value;
    if (this.value === 'grouped') {
      transitionGrouped();
    }
    else {
      transitionStacked();
    }
  }

  function changeFilter() {
    if (graphSession.categoryFilter !== this.value) {
      clearSpotlighting();

      if (this.value === 'None') {
        graphSession.categoryFilter = null;  
      }
      else {
        graphSession.categoryFilter = this.value;
      }

      // Make the cell rect widths and heights redraw and change.
      var csvArrays = [];

      if (!graphSession.categoryFilter) {
        csvArrays = _.values(graphSession.stackData);
      }
      else {
        csvArrays = _.filter(graphSession.stackData, 
          function columnIsInFilter(columnArray, columnName) {
            var representativeCell = columnArray[0];
            return (representativeCell.category === graphSession.categoryFilter);
          }
        );
      }
      setUpGraph(graphSession.stackData);
    }
  }

}


