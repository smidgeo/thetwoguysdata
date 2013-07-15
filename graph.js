var Session = {
  xAxisDateStrings: [],
  dateOfLastAttack: null,
  dateOfLastHiss: null,
  stackedOrGrouped: 'grouped',
  spotlightedLayer: null,
  csvArraysForColumns: {},
  categoryFilter: null
};

var Settings = {
  labelMargin: 6,
  preferredCategoryOrder: [
    'Bonus Cat',
    'Shared',
    'Hostility',
    'Dr. Wily'
  ],
  preferredActivityOrders: {
    'Bonus Cat': [
      'Lazy get',
      'Workout'
    ],
    'Hostility': [
      'Bonus Hiss',
      'Wily Attack'
    ],
    'Shared': [
      'Social Snacks',
      'Group Meal',
      'Turf Swap'
    ],
    'Dr. Wily': [
      'Workout',
      'Walk outside',
      'Lazy gets'
    ]
  },
  stackedBarWidth: 100,
  // csvUrl: 'Friendship%20chart.csv'
  csvUrl: 'https://docs.google.com/spreadsheet/pub?key=0AqUvOryrtCYHdHREc3ZjTXpDRVRmZHgzMGZ0VHZwUWc&single=true&gid=0&output=csv'
};

var themes = {
  rainbow: {
    colorRanges: {
      'Bonus Cat': colorbrewer.Greens[5].slice(2, 5),
      'Dr. Wily': colorbrewer.Oranges[5].slice(1, 4),
      Shared: colorbrewer.YlOrRd[7].slice(0, 3),
      Hostility: ['#f21', '#f30']
    },
    stroke: 'none',
    textColor: {
      'Bonus Cat': '#fff',
      'Dr. Wily': '#333',
      Shared: '#333'
    }
  },
  blackandwhite: {
    colorRanges: {
      'Bonus Cat': ['#fff', '#fff', '#fff'],
      'Dr. Wily': ['#181810', '#181810', '#181810', '#181810', '#181810'],
      Shared: colorbrewer.Greys[9].slice(4, 7),
      Hostility: ['#f21', '#f30']      
    },
    stroke: '#333',
    textColor: {
      'Bonus Cat': '#333',
      'Dr. Wily': '#fff',
      Shared: '#fff'
    }
  }
}

var selectedTheme = 'rainbow';

function fetchDateOfLastEvent(csvRows, eventName) {
  var date = null;
  // csvRows are in ascending date order.
  for (var i = csvRows.length - 1; i >= 0; --i) {
    if (parseInt(csvRows[i][eventName]) > 0) {
      date = parseMMDDYY(csvRows[i]['Date']);
      break;
    }
  }
  return date;
}

function daysSinceDate(pastDate) {
  var days = 0;
  if (pastDate) {
    days = 
      ~~(
        (Date.now() - pastDate.getTime())/(24 * 60 * 60 * 1000)
      );
  }
  return days;
}


function isMobile() {
  return isMobileSafari() || isAndroid();
}

function isMobileSafari() {
  return navigator.userAgent.match(/(iPod|iPhone)/) && 
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

d3.csv(Settings.csvUrl,
  function onGettingCSV(error, rows) {
    console.log(rows);
    Session.csvArraysForColumns = csvRowObjectsToArrayDict(rows);
    var csvArrays = _.values(Session.csvArraysForColumns);
    console.log('csvArrays', csvArrays);
    setUpGraph(csvArrays);

    $('#dateoflastattack').text(daysSinceDate(
        fetchDateOfLastEvent(rows, 'Hostility: Wily Attack')
      )
    );
    $('#dateoflasthiss').text(daysSinceDate(
        fetchDateOfLastEvent(rows, 'Hostility: Bonus Hiss')
      )
    );

    var graphGroup = d3.select('g#graphGroup');
    BoardZoomer.setUpZoomOnBoard(d3.select('svg#graph'), graphGroup);

    setTimeout(function initialZoom() {
      if (location.hash) {
        $spotlightRect = $(location.hash);
        focusOnRect($spotlightRect);
      }
    },
    3000);

    $('.attackspotlighttrigger').on('click', function() {
      var attackRect = _.last(_.filter($('[id|="HostilityWilyAttack"]'), 
        function heightIsNonZero(rect) { 
          return (rect.getAttribute('height') > 0); 
        })
      );

      focusOnRect($(attackRect));      
    });

    $('.hissspotlighttrigger').on('click', function() {
      var attackRect = _.last(_.filter($('[id|="HostilityBonusHiss"]'), 
        function heightIsNonZero(rect) { 
          return (rect.getAttribute('height') > 0); 
        })
      );

      focusOnRect($(attackRect));      
    });

  }
);

function parseMMDDYY(dateString) {
  var dateParts = dateString.split('/');
  return new Date(dateParts[2], dateParts[0] - 1, dateParts[1])
}

function sanitizeAsId(string) {
  return string.replace(/ |:|\./g, '');
}

function csvRowObjectsToArrayDict(rows) {
  var groupsForGroupNames = {};
  var columnNames = [];
  var sortedColumnNames = [];
  var groupMetadataForColumnNames = {};

  if (rows.length < 1 || rows[0].length < 3) {
    return groups;
  }
  else {
    columnNames = (_.keys(_.omit(rows[0], 'Date')));

    groupMetadataForColumnNames = _.object(columnNames, 
      _.map(columnNames, function getMetadataForColumnName(columnName) {
        var category = null;
        var activity = null;
        var parts = columnName.split(': ');
        if (parts.length > 1) {
          category = parts[0];
          activity = parts[1];
        }
        var categorySortOrder = -1;
        if (category) {
          categorySortOrder = Settings.preferredCategoryOrder.indexOf(category);
        }
        if (categorySortOrder < 0) {
          // If we don't know how to sort it, but it at the end.
          categorySortOrder = 1000;
        }

        var activitySortOrder = -1;
        if (activity) {
          activitySortOrder = 
            Settings.preferredActivityOrders[category].indexOf(activity);
        }
        if (activitySortOrder < 0) {
          // If we don't know how to sort it, but it at the end.
          activitySortOrder = 999;
        }
        return {
          category: category,
          activity: activity,
          categorySortOrder: categorySortOrder,
          activitySortOrder: activitySortOrder
        };
      })
    );

    sortedColumnNames = _.sortBy(columnNames, function sortColumn(columnName) {
      var metadata = groupMetadataForColumnNames[columnName];
      return metadata.categorySortOrder * 1000 + metadata.activitySortOrder;
    });

    _.each(sortedColumnNames, function initGroupArray(groupKey) {
      groupsForGroupNames[groupKey] = [];
    });

    var startDate = new Date(rows[0].Date);
    var startTime = startDate.getTime();

    _.each(rows, function arrayFromRowObject(row) {
      var xDate = new Date(row.Date);
      var xTime = xDate.getTime();
      var daysElapsed = (xTime - startTime)/1000/(24 * 60 * 60);

      // SIDE EFFECT! Save the date string so the axis can use it later.
      Session.xAxisDateStrings.push(xDate.toDateString());

      var currentCategory = null;
      var numberOfKeysInCategoryProcessed = 0;

      _.each(sortedColumnNames, function putRowContentsIntoArrays(columnName) {
        var columnMetadata = groupMetadataForColumnNames[columnName];

        groupsForGroupNames[columnName].push({
          x: daysElapsed,
          y: row[columnName] ? parseFloat(row[columnName]) : 0,
          y0: sortedColumnNames.indexOf(columnName),
          category: columnMetadata.category,
          activity: columnMetadata.activity,
          columnName: columnName,
          id: sanitizeAsId(columnName) + '-' + xTime,
          activitySortOrder: columnMetadata.activitySortOrder,
          getLabelText: function getText(d) {
            var text = null;
            if (this.y > 0.01) {
              text = this.activity;
            }
            return text;
          }
        });
      })
    });
  }
  return groupsForGroupNames;
}

var layers = [];


// selectedTheme = 'blackandwhite';

// Set up color generating functions.

var bonusColor = d3.scale.ordinal().range(
  themes[selectedTheme].colorRanges['Bonus Cat']);

var wilyColor = d3.scale.ordinal().range(
  themes[selectedTheme].colorRanges['Dr. Wily']);

var sharedColor = d3.scale.ordinal().range(
  themes[selectedTheme].colorRanges.Shared);

var hostilityColor = d3.scale.ordinal().range(
  themes[selectedTheme].colorRanges.Hostility);

function getFillForLayerGroup(d) { 
  var calculated = '#f0f';
  var representatitveCell = d[0];

  if (representatitveCell && 
    (typeof representatitveCell.category === 'string')) {
    switch (representatitveCell.category) {
      case 'Bonus Cat':
        calculated = bonusColor(representatitveCell.activitySortOrder);
        break;
      case 'Dr. Wily':
        calculated = wilyColor(representatitveCell.activitySortOrder);
        break;
      case 'Shared':
        calculated = sharedColor(representatitveCell.activitySortOrder);
        break;
      case 'Hostility':
        calculated = hostilityColor(representatitveCell.activitySortOrder);
        break;
      default:
        console.log('Could not find a color for', representatitveCell);
        // debugger;
    }
  }
  else {
    debugger;
  }

  if (Session.spotlightedLayer && Session.spotlightedLayer !== d) {
    // Shade the color to make it darker.    
    calculated = d3.rgb(calculated).darker(3.5).toString();
  }

  return calculated; 
}

function spotlightLayer(layerData, graphGroup) {
  Session.spotlightedLayer = layerData;

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
  var n = stackData.length, // number of layers
      m = stackData[0].length, // number of samples per layer
      stack = d3.layout.stack(),
      layers = stack(stackData),
      yGroupMax = d3.max(layers, function(layer) { return d3.max(layer, function(d) { return d.y; }); }),
      yStackMax = d3.max(layers, function(layer) { return d3.max(layer, function(d) { return d.y0 + d.y; }); });
  // console.log(stackData);

  function clearSpotlighting() {
    Session.spotlightedLayer = null;
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

  var margin = {top: 40, right: 10, bottom: 20, left: 10},
      width = m * Settings.stackedBarWidth - margin.left - margin.right,
      height = 500 - margin.top - margin.bottom;
   
  if (isMobile()) {
    height = 240;
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
    .tickValues(Session.xAxisDateStrings);
   
  var svg = d3.select('svg#graph')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom);

  var graphGroup = svg.select('g#graphGroup');
  if (graphGroup.empty()) {
    graphGroup = svg.append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')' + 
        ' scale(1)')
      .attr('id', 'graphGroup');
  }

  var layerUpdatingSelection = graphGroup.selectAll('.layer').data(layers, 
    identifyLayer);

  function layerClicked(d) {
    d3.event.stopPropagation();

    if (Session.spotlightedLayer === d) {
      Session.spotlightedLayer = null;
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
        .attr('x', function(d) { return x(d.x) + Settings.labelMargin; })
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
              x: x(d.x)  + Settings.labelMargin, // This is the parent <text>'s x.
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

    Session.stackedOrGrouped = this.value;
    if (this.value === 'grouped') {
      transitionGrouped();
    }
    else {
      transitionStacked();
    }
  }

  function changeFilter() {
    if (Session.categoryFilter !== this.value) {
      clearSpotlighting();

      if (this.value === 'None') {
        Session.categoryFilter = null;  
      }
      else {
        Session.categoryFilter = this.value;
      }

      // Make the cell rect widths and heights redraw and change.
      var csvArrays = [];

      if (!Session.categoryFilter) {
        csvArrays = _.values(Session.csvArraysForColumns);
      }
      else {
        csvArrays = _.filter(Session.csvArraysForColumns, 
          function columnIsInFilter(columnArray, columnName) {
            var representativeCell = columnArray[0];
            return (representativeCell.category === Session.categoryFilter);
          }
        );
      }
      setUpGraph(csvArrays);
    }
  }

}
 
function setUpLegend(parentSelString, colors) {
  d3.select(parentSelString).select('g').selectAll('rect')
  .data(colors)
  .enter()
  .append('rect')  
  .attr('width', 20)
  .attr('height', 30)
  .attr('fill', function getFill(d) { return d; })
  .attr('y', 0)
  .attr('x', function(d, i) { return i * 20; });
}

setUpLegend('#bonuscat-legend', bonusColor.range());
setUpLegend('#drwily-legend', wilyColor.range());
setUpLegend('#shared-legend', sharedColor.range());


